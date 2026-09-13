import {
  appelant, possedeGroupe, ressaisieAutorisee, noterEchecRessaisie, FENETRE_MINUTES,
  comptesElevesOuverts, FICTIF, MESSAGE_VERROU,
} from '../_lib/autorisation.js';
import {
  verifierMotDePasse, profsAutorises, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';
import { creerOuRattacher } from '../_lib/inscription.js';

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

  // appelant() relit le profil en base et revérifie le rôle professeur
  // contre PROFS_TECHNO à chaque appel : un collègue retiré de la liste ne
  // peut plus inscrire personne, même avec un cookie encore valable.
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Action réservée aux professeurs.');

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const nom = String(req.body?.nom ?? '').trim().slice(0, 80);
  const prenom = String(req.body?.prenom ?? '').trim().slice(0, 80);
  const groupe = String(req.body?.groupe ?? '').trim();
  const confirmation = String(req.body?.confirmation ?? '');

  if (!ADRESSE.test(email)) return refus(res, 400, 'Adresse invalide.');

  try {
    const role = profsAutorises().includes(email) ? 'prof' : 'eleve';

    // LE VERROU DES COMPTES D'ÉLÈVES RÉELS (api/_lib/autorisation.js) vaut
    // aussi pour l'inscription à la main : seuls les comptes fictifs d'essai
    // passent tant que le délégué n'a pas rendu sa position.
    if (role === 'eleve' && !FICTIF.test(email) && !comptesElevesOuverts()) {
      return refus(res, 403, MESSAGE_VERROU);
    }

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
      // Le compteur était alimenté sans jamais être lu : la barrière laissait
      // deviner le mot de passe du professeur à l'infini depuis une session
      // laissée ouverte. Le verrou est maintenant partagé par les trois
      // ressaisies du dépôt, et il ne lit que les échecs de ressaisie, jamais
      // ceux de la page de connexion, qu'un inconnu peut provoquer.
      if (!(await ressaisieAutorisee(moi.id))) {
        return refus(res, 429,
          `Trop d'essais. Réessayez dans ${FENETRE_MINUTES} minutes.`);
      }
      if (!(await verifierMotDePasse(moi.email, confirmation))) {
        await noterEchecRessaisie(moi.id);
        return refus(res, 401, 'Mot de passe incorrect.');
      }
    } else {
      // Un élève s'inscrit dans un groupe, et ce groupe doit être le mien.
      if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
      if (!(await possedeGroupe(moi.id, groupe))) {
        return refus(res, 403, 'Ce groupe n’est pas l’un des vôtres.');
      }
    }

    // Compte, profil, inscription : le même geste que l'import d'une liste,
    // écrit une seule fois dans api/_lib/inscription.js.
    const r = await creerOuRattacher({ moi, email, nom, prenom, role, groupe });
    if (!r.ok) return refus(res, r.statut, r.message);

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
