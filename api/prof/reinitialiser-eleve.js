import { ouvrir, lireCookie } from '../_lib/session.js';
import {
  definirMotDePasse, verifierMotDePasse, lire, ecrire,
  configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// Mot de passe prononçable : il sera DICTÉ à voix haute dans une salle de
// classe. « bafi-rolun-47 » se transmet sans erreur ; « xK7#pQ2z » non.
// Le prix de cette lisibilité est qu'il est plus faible : d'où l'obligation
// de le changer immédiatement, et le fait qu'il ne serve qu'une fois.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return refus(res, 401, 'Session expirée.');

  const eleveId = String(req.body?.eleve ?? '');
  const motif = String(req.body?.motif ?? '').slice(0, 200);
  const confirmation = String(req.body?.confirmation ?? '');
  if (!eleveId) return refus(res, 400, 'Élève non précisé.');
  if (!confirmation) return refus(res, 400, 'Confirmation manquante.');

  try {
    // Le rôle est RELU EN BASE, jamais pris au mot du cookie. Un cookie
    // reste valable une heure après une révocation : pour une action aussi
    // lourde que prendre la main sur le compte d'un mineur, on revérifie.
    const prof = (await lire('profils',
      `id=eq.${session.sub}&select=id,email,role,actif`))[0];
    if (!prof || prof.role !== 'prof' || !prof.actif) {
      return refus(res, 403, 'Action réservée aux professeurs.');
    }

    // BARRIÈRE, et non simple confirmation. Le cookie de session suffit à
    // prouver qu'on est DEVANT le poste du professeur ; il ne prouve pas
    // qu'on EST le professeur. Sur un poste de salle informatique où une
    // session est restée ouverte, l'élève suivant fabriquerait le mot de
    // passe d'un camarade, et le journal accuserait le professeur, puisque
    // le contrôle d'appartenance au groupe passerait : l'appelant EST bien
    // le professeur de cet élève. Le mot de passe, lui, il ne l'a pas.
    if (!(await verifierMotDePasse(prof.email, confirmation))) {
      return refus(res, 401,
        'Mot de passe incorrect. Cette action demande de retaper le vôtre.');
    }

    // Et surtout : cet élève est-il DANS UN DE SES GROUPES ? Sans ce
    // contrôle, n'importe lequel des quatre professeurs réinitialiserait
    // n'importe lequel des élèves de l'établissement.
    const lien = await lire('appartenances',
      `profil_id=eq.${eleveId}&select=groupe_id,groupes!inner(prof_id)` +
      `&groupes.prof_id=eq.${prof.id}`);
    if (!lien.length) {
      return refus(res, 403,
        "Cet élève n'est dans aucun de vos groupes. Adressez-vous au " +
        "professeur qui en a la charge.");
    }

    const eleve = (await lire('profils',
      `id=eq.${eleveId}&select=id,role,prenom,nom,actif`))[0];
    if (!eleve || eleve.role !== 'eleve' || !eleve.actif) {
      return refus(res, 404, 'Élève introuvable ou compte désactivé.');
    }

    const provisoire = motDePasseProvisoire();
    await definirMotDePasse(eleve.id, provisoire);
    await ecrire('profils', `id=eq.${eleve.id}`,
      { mdp_provisoire: true, mdp_pose_le: new Date().toISOString() });
    await ecrire('journal_repli', '',
      { prof_id: prof.id, eleve_id: eleve.id, motif }, 'POST');

    res.status(200).json({
      ok: true,
      eleve: `${eleve.prenom} ${eleve.nom}`,
      motDePasse: provisoire,
      avertissement:
        "Ce mot de passe s'affiche à l'écran et sera dit à voix haute : " +
        "la classe peut l'entendre. Faites-le changer immédiatement par " +
        "l'élève. L'opération est journalisée et signalée à l'élève.",
    });
  } catch (e) {
    console.error('reinitialiser-eleve :', e.message);
    refus(res, 500, "La réinitialisation n'a pas abouti.");
  }
}
