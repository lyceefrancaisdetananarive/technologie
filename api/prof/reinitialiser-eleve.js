import { ouvrir, lireCookie } from '../_lib/session.js';
import { ressaisieAutorisee, noterEchecRessaisie, FENETRE_MINUTES }
  from '../_lib/autorisation.js';
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
      `id=eq.${session.sub}&select=id,email,role,actif,mdp_provisoire`))[0];
    if (!prof || prof.role !== 'prof' || !prof.actif) {
      return refus(res, 403, 'Action réservée aux professeurs.');
    }
    // Ce point d'entrée lit la session directement et ne passe donc pas par
    // appelant(), qui porte ailleurs ce même refus. Un compte dont le mot de
    // passe est encore provisoire n'agit sur rien, professeur compris.
    if (prof.mdp_provisoire) {
      return refus(res, 403,
        'Choisissez d’abord votre propre mot de passe définitif.');
    }

    // L'identifiant doit être un uuid. Sans ce contrôle, une valeur
    // quelconque fait échouer le cast côté PostgREST et remonte en 500,
    // ce qui masque un refus derrière une panne.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(eleveId)) {
      return refus(res, 400, 'Élève non précisé.');
    }

    // Verrou sur la ressaisie, avec la même table et la même fenêtre que la
    // page de connexion. Sans lui, cette barrière avait une porte de
    // service : depuis une session laissée ouverte, on pouvait essayer le
    // mot de passe du professeur autant de fois qu'on voulait, sans limite
    // et sans laisser la moindre trace.
    if (!(await ressaisieAutorisee(prof.id))) {
      return refus(res, 429,
        `Trop d'essais. Réessayez dans ${FENETRE_MINUTES} minutes.`);
    }

    // L'ORDRE DE CES DEUX CONTRÔLES EST UNE DÉCISION DE SÉCURITÉ.
    //
    // L'appartenance au groupe se vérifie AVANT le mot de passe. Dans
    // l'ordre inverse, la réponse trahissait la supposition : un mot de passe
    // faux donnait « Mot de passe incorrect », un mot de passe JUSTE donnait
    // « Cet élève n'est dans aucun de vos groupes » sur un identifiant
    // inventé. Un bit par requête, sans qu'aucune réinitialisation n'ait
    // lieu, donc sans que le professeur voie jamais rien. Depuis un poste
    // laissé ouvert, cela revenait à deviner son mot de passe à l'aveugle.
    //
    // Vérifier l'appartenance d'abord ne divulgue rien : la page liste déjà
    // les élèves du groupe à qui a la session sous les yeux.
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

    // BARRIÈRE, et non simple confirmation. Le cookie de session suffit à
    // prouver qu'on est DEVANT le poste du professeur ; il ne prouve pas
    // qu'on EST le professeur. Sur un poste de salle informatique où une
    // session est restée ouverte, l'élève suivant fabriquerait le mot de
    // passe d'un camarade, et le journal accuserait le professeur, puisque
    // le contrôle d'appartenance au groupe passerait : l'appelant EST bien
    // le professeur de cet élève. Le mot de passe, lui, il ne l'a pas.
    if (!(await verifierMotDePasse(prof.email, confirmation))) {
      await noterEchecRessaisie(prof.id);
      return refus(res, 401,
        'Mot de passe incorrect. Cette action demande de retaper le vôtre.');
    }

    // L'ORDRE DE CES TROIS ÉCRITURES EST UNE DÉCISION DE SÉCURITÉ.
    //
    // Il n'y a pas de transaction : trois appels HTTP, sur une liaison qui
    // coupe. Chaque préfixe de la séquence doit donc être un état sûr.
    //
    // L'ordre naturel — poser le mot de passe, puis marquer le compte — est
    // le mauvais. Une coupure entre les deux, sur un élève dont le mot de
    // passe n'était PAS provisoire (le cas ordinaire : il a oublié celui
    // qu'il avait choisi), installerait comme mot de passe DÉFINITIF celui
    // qui vient d'être dicté à voix haute devant la classe. Le drapeau
    // resterait faux, donc la connexion ne testerait jamais la date, donc
    // ce mot de passe ne périmerait jamais, et rien ne figurerait au
    // journal. C'est exactement le défaut que la péremption doit fermer.
    //
    // On marque donc D'ABORD, on pose le mot de passe EN DERNIER. Une
    // coupure laisse alors un compte marqué provisoire dont le mot de passe
    // n'a pas changé : l'élève entre avec l'ancien, qu'il connaît, et on lui
    // demande d'en choisir un nouveau. Gênant, jamais dangereux.
    const provisoire = motDePasseProvisoire();
    await ecrire('profils', `id=eq.${eleve.id}`,
      { mdp_provisoire: true, mdp_pose_le: new Date().toISOString() });
    await ecrire('journal_repli', '',
      { prof_id: prof.id, eleve_id: eleve.id, motif }, 'POST');
    await definirMotDePasse(eleve.id, provisoire);

    res.status(200).json({
      ok: true,
      eleve: `${eleve.prenom} ${eleve.nom}`,
      motDePasse: provisoire,
      avertissement:
        "Ce mot de passe s'affiche à l'écran et sera dit à voix haute : " +
        "la classe peut l'entendre. Faites-le changer immédiatement par " +
        "l'élève. Il cesse de fonctionner au bout de 24 heures. " +
        "L'opération est journalisée et signalée à l'élève.",
    });
  } catch (e) {
    console.error('reinitialiser-eleve :', e.message);
    refus(res, 500, "La réinitialisation n'a pas abouti.");
  }
}
