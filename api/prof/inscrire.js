import { ouvrir, lireCookie } from '../_lib/session.js';
import { possedeGroupe } from '../_lib/autorisation.js';
import {
  lire, ecrire, creerUtilisateur, utilisateurParEmail, verifierMotDePasse,
  profsAutorises, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// =====================================================================
// INSCRIRE UNE PERSONNE : un élève dans l'un de MES groupes, ou un collègue
// comme professeur.
//
// LE RÔLE NE SE DEMANDE PAS, IL SE DÉDUIT, et c'est le cœur de la sécurité
// de ce fichier. L'appelant n'envoie jamais « role » : le serveur regarde si
// l'adresse figure dans PROFS_TECHNO, la liste que seul l'administrateur du
// projet Vercel peut modifier. Dedans, la personne est professeur. Dehors,
// elle est élève, quoi qu'en dise la requête.
//
// Sans cette règle, la fonction serait une fabrique à complices : sur un
// poste de salle informatique où une session professeur est restée ouverte,
// l'élève suivant se créerait un compte professeur permanent, qui survivrait
// à la fermeture du navigateur et ouvrirait les 32 corrigés. Ajouter un
// collègue redevient ainsi un geste d'administration, fait une fois dans
// Vercel, et non un bouton dans une page.
//
// AUCUN MOT DE PASSE N'EST FABRIQUÉ NI TRANSMIS. Le compte naît avec un mot
// de passe aléatoire que personne ne lit, et son titulaire passe par
// « Première connexion » pour choisir le sien. Rien à dicter, rien à
// périmer, rien à perdre en route.
// =====================================================================

const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return refus(res, 401, 'Session expirée.');

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const nom = String(req.body?.nom ?? '').trim().slice(0, 80);
  const prenom = String(req.body?.prenom ?? '').trim().slice(0, 80);
  const groupe = String(req.body?.groupe ?? '').trim();
  const confirmation = String(req.body?.confirmation ?? '');

  if (!ADRESSE.test(email)) return refus(res, 400, 'Adresse invalide.');

  try {
    const moi = (await lire('profils',
      `id=eq.${session.sub}&select=id,email,role,actif,mdp_provisoire`))[0];
    if (!moi || moi.role !== 'prof' || !moi.actif) {
      return refus(res, 403, 'Action réservée aux professeurs.');
    }
    if (moi.mdp_provisoire) {
      return refus(res, 403,
        'Choisissez d’abord votre propre mot de passe définitif.');
    }

    const role = profsAutorises().includes(email) ? 'prof' : 'eleve';

    // Le domaine reste vérifié ici en plus de la contrainte en base, pour
    // rendre un refus lisible plutôt qu'une erreur 500 venue de Postgres.
    if (!email.endsWith('@egd.mg') && !email.endsWith('@eleve.egd.mg')) {
      return refus(res, 400,
        'Seules les adresses de l’établissement sont acceptées.');
    }

    if (role === 'prof') {
      // BARRIÈRE. Créer un professeur est l'action la plus lourde du système :
      // elle ouvre les 32 corrigés et le classeur de tous les groupes. Le
      // cookie prouve qu'on est devant le poste, pas qu'on est le professeur.
      if (!confirmation) {
        return refus(res, 400,
          'Ajouter un professeur demande de retaper votre mot de passe.');
      }
      if (!(await verifierMotDePasse(moi.email, confirmation))) {
        await ecrire('tentatives', '', { profil_id: moi.id }, 'POST')
          .catch(() => {});
        return refus(res, 401, 'Mot de passe incorrect.');
      }
    } else {
      // Un élève s'inscrit dans un groupe, et ce groupe doit être le mien.
      if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
      if (!(await possedeGroupe(moi.id, groupe))) {
        return refus(res, 403, 'Ce groupe n’est pas l’un des vôtres.');
      }
    }

    // ---- L'ORDRE DES ÉCRITURES, ENCORE UNE FOIS -----------------------
    // Pas de transaction : trois appels HTTP sur une liaison qui coupe.
    // Chaque préfixe doit être un état sûr.
    //   compte seul        -> la personne ne peut pas se connecter, la
    //                         connexion lit profils en premier et ne trouve
    //                         rien. Relancer l'inscription répare.
    //   compte + profil    -> elle se connecte et voit un classeur vide.
    //   les trois          -> état final.
    // Aucun de ces états n'accorde quoi que ce soit indûment.
    let idAuth = await utilisateurParEmail(email);
    if (!idAuth) idAuth = await creerUtilisateur(email);
    if (!idAuth) idAuth = await utilisateurParEmail(email);   // course
    if (!idAuth) return refus(res, 500, 'Le compte n’a pas pu être créé.');

    await ecrire('profils', '', {
      id: idAuth, email, role, nom: nom || null, prenom: prenom || null,
      actif: true, mdp_provisoire: true, mdp_pose_le: null,
    }, 'POST').catch(async (e) => {
      // Déjà présent : on réactive et on met à jour l'identité, sans
      // toucher au mot de passe ni au drapeau provisoire de quelqu'un qui
      // a déjà choisi le sien.
      if (!String(e.message).includes('409')) throw e;
      await ecrire('profils', `id=eq.${idAuth}`, {
        role, actif: true,
        ...(nom ? { nom } : {}), ...(prenom ? { prenom } : {}),
      });
    });

    if (role === 'eleve') {
      await ecrire('appartenances', '',
        { profil_id: idAuth, groupe_id: groupe }, 'POST').catch((e) => {
          if (!String(e.message).includes('409')) throw e;   // déjà inscrit
        });
    }

    res.status(200).json({
      ok: true, email, role,
      message: role === 'prof'
        ? `${email} est maintenant professeur. Il doit passer par « Première `
          + `connexion » pour choisir son mot de passe.`
        : `${email} est inscrit. L’élève passe par « Première connexion » `
          + `pour choisir son mot de passe.`,
    });
  } catch (e) {
    console.error('inscrire :', e.message);
    refus(res, 500, 'L’inscription n’a pas abouti.');
  }
}
