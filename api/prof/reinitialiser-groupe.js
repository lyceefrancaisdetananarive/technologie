import { appelant, possedeGroupe, ressaisieAutorisee, noterEchecRessaisie, FENETRE_MINUTES }
  from '../_lib/autorisation.js';
import { journaliser } from '../_lib/journal.js';
import {
  definirMotDePasse, verifierMotDePasse, lire, ecrire,
  configuree, origineLegitime, refus,
} from '../_lib/supabase.js';
import { UUID } from '../_lib/progression.js';

// =====================================================================
// MOTS DE PASSE PROVISOIRES POUR TOUT UN GROUPE, EN UNE FOIS.
//
// Le cas : une première séance où une partie des élèves n'ouvre pas sa
// boîte de courriel (identifiants jamais reçus, mot de passe de la boîte
// oublié). Réinitialiser à l'unité demande au professeur de retaper son
// propre mot de passe à chaque fois : pour quinze élèves, c'est quinze
// ressaisies au tableau, devant la classe.
//
// Ici : UNE ressaisie, et un mot de passe provisoire par élève, mais SEULS
// les élèves qui n'ont jamais choisi leur mot de passe (mdp_provisoire =
// true) sont touchés. Un élève qui a déjà choisi le sien n'est pas
// dérangé : s'il l'a oublié, c'est la réinitialisation à l'unité.
//
// Mêmes barrières que reinitialiser-eleve.js, dans le même ordre : origine,
// session professeur, verrou sur la ressaisie, propriété du groupe AVANT
// le mot de passe, puis, pour chaque élève, marquage d'abord et mot de
// passe en dernier (une coupure laisse un compte marqué provisoire dont le
// mot de passe n'a pas changé : gênant, jamais dangereux). Chaque élève est
// journalisé comme s'il avait été réinitialisé seul.
//
// La liste rendue est faite pour être imprimée et découpée : elle ne vaut
// que 24 heures (mdp_pose_le), à générer le matin même de la séance.
// =====================================================================

const SYLLABES = ['ba','be','bi','bo','da','de','di','do','fa','fe','fi','fo',
  'ka','ke','ki','ko','la','le','li','lo','ma','me','mi','mo','na','ne','ni',
  'no','ra','re','ri','ro','sa','se','si','so','ta','te','ti','to','va','vu'];

function motDePasseProvisoire() {
  const t = new Uint32Array(6);
  crypto.getRandomValues(t);
  const mot = (n, d) => Array.from({ length: n },
    (_, i) => SYLLABES[t[d + i] % SYLLABES.length]).join('');
  return `${mot(2, 0)}-${mot(3, 2)}-${10 + (t[5] % 90)}`;
}

const MOTIFS = ['boite_inaccessible', 'mot_de_passe_oublie', 'compte_bloque', 'autre'];
const PAR_LOT = 4;   // écritures en parallèle : la fonction doit tenir en quelques secondes

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const prof = await appelant(req);
  if (!prof) return refus(res, 401, 'Session expirée.');
  if (prof.role !== 'prof') return refus(res, 403, 'Action réservée aux professeurs.');

  const groupeId = String(req.body?.groupe ?? '');
  const motif = MOTIFS.includes(String(req.body?.motif ?? '')) ? String(req.body.motif) : 'boite_inaccessible';
  const confirmation = String(req.body?.confirmation ?? '');
  if (!UUID.test(groupeId)) return refus(res, 400, 'Groupe non précisé.');
  if (!confirmation) return refus(res, 400, 'Confirmation manquante.');

  try {
    if (!(await ressaisieAutorisee(prof.id))) {
      return refus(res, 429, `Trop d'essais. Réessayez dans ${FENETRE_MINUTES} minutes.`);
    }
    // Propriété du groupe AVANT le mot de passe (même raison que dans
    // reinitialiser-eleve.js : ne rien laisser deviner à un poste ouvert).
    if (!(await possedeGroupe(prof.id, groupeId))) {
      return refus(res, 403, "Ce groupe n'est pas le vôtre.");
    }
    if (!(await verifierMotDePasse(prof.email, confirmation))) {
      await noterEchecRessaisie(prof.id);
      return refus(res, 401, 'Mot de passe incorrect. Cette action demande de retaper le vôtre.');
    }

    const groupe = (await lire('groupes', `id=eq.${groupeId}&select=id,code,libelle`))[0];
    const membres = await lire('appartenances',
      `groupe_id=eq.${groupeId}&select=profils(id,prenom,nom,email,role,actif,mdp_provisoire)`);
    const eleves = membres.map((m) => m.profils)
      .filter((e) => e && e.role === 'eleve' && e.actif)
      .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));
    const cibles = eleves.filter((e) => e.mdp_provisoire === true);
    const deja = eleves.length - cibles.length;

    const liste = [];
    for (let i = 0; i < cibles.length; i += PAR_LOT) {
      await Promise.all(cibles.slice(i, i + PAR_LOT).map(async (e) => {
        const provisoire = motDePasseProvisoire();
        await ecrire('profils', `id=eq.${e.id}`,
          { mdp_provisoire: true, mdp_pose_le: new Date().toISOString() });
        await ecrire('journal_repli', '',
          { prof_id: prof.id, eleve_id: e.id, motif }, 'POST');
        await journaliser(prof.id, 'mdp.reinitialise', e.id, motif + ' (groupe)');
        await definirMotDePasse(e.id, provisoire);
        // Comme reinitialiser-eleve.js : le verrou de connexion repart de zero
        await ecrire('tentatives',
          `profil_id=eq.${e.id}&origine=eq.connexion`, {}, 'DELETE').catch(() => {});
        liste.push({ prenom: e.prenom, nom: e.nom, email: e.email, motDePasse: provisoire });
      }));
    }
    liste.sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));

    res.status(200).json({
      ok: true,
      groupe: groupe?.code ?? '',
      poseLe: new Date().toISOString(),
      eleves: liste,
      dejaChoisi: deja,
      avertissement:
        'Ces mots de passe sont imprimés pour être remis un par un, jamais ' +
        'projetés. Chaque élève doit en choisir un autre à sa première ' +
        'connexion. Ils cessent de fonctionner au bout de 24 heures. ' +
        'L’opération est journalisée pour chaque élève.',
    });
  } catch (e) {
    console.error('reinitialiser-groupe :', e.message);
    refus(res, 500, "La réinitialisation du groupe n'a pas abouti.");
  }
}
