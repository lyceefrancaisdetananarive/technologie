// =====================================================================
// Les vérifications d'autorisation du classeur, en un seul endroit.
//
// Elles sont ici et pas dispersées dans chaque fonction parce que c'est
// exactement le genre de contrôle qu'on oublie de recopier dans le
// troisième fichier. Un seul endroit à relire, un seul à corriger.
// =====================================================================

import { ouvrir, lireCookie } from './session.js';
import { lire, ecrire, profsAutorises } from './supabase.js';

/**
 * Qui appelle ? Relit le profil EN BASE, jamais au mot du cookie : un cookie
 * reste valable une heure après une désactivation.
 *
 * Renvoie null si la session est absente, expirée, si le compte est inactif,
 * OU SI LE MOT DE PASSE EST ENCORE PROVISOIRE.
 *
 * Ce dernier cas est le moins évident et c'est le plus important. Le portier
 * (middleware.js) renvoie bien les PAGES vers la page de changement tant que
 * le mot de passe est provisoire, mais il ne juge pas /api/ : il ne protège
 * que /enseignant, /classeur et les fiches -prof. Sans le contrôle ici, qui
 * ramasse une bandelette peut se connecter, se faire renvoyer vers la page
 * de changement, et pendant ce temps appeler /api/classeur/mes-rendus pour
 * LIRE le classeur de sa victime — sans rien modifier, donc sans qu'elle
 * s'en aperçoive jamais. Le mot de passe provisoire n'ouvre donc rien tant
 * qu'il n'a pas été échangé.
 */
export async function appelant(req) {
  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return null;
  const p = (await lire('profils',
    `id=eq.${session.sub}&select=id,email,role,actif,mdp_provisoire,prenom,nom`))[0];
  if (!p || !p.actif || p.mdp_provisoire) return null;
  if (!roleTenable(p)) return null;
  return p;
}

/**
 * LE RÔLE PROFESSEUR EST VÉRIFIÉ À CHAQUE APPEL, PAS SEULEMENT À L'ADMISSION.
 *
 * profils.role est une trace de ce qui a été décidé un jour ; PROFS_TECHNO est
 * la liste de ce qui est vrai maintenant. Sans ce contrôle, retirer une
 * adresse de la liste ne révoquait RIEN : le collègue parti en décembre se
 * connectait encore en janvier, ouvrait les 32 corrigés, et pouvait reprendre
 * la main sur le compte d'un mineur, indéfiniment et sans alerte. La page de
 * gestion prescrivait pourtant cette manœuvre à l'administrateur.
 *
 * La liste absente ne dégrade personne : configuree() l'exige, et son absence
 * donne 503 sur tout le service. Panne franche plutôt que rétrogradation muette.
 */
export function roleTenable(profil) {
  if (profil.role !== 'prof') return true;
  return profsAutorises().includes(String(profil.email ?? '').toLowerCase());
}

// ---------------------------------------------------------------------
// LE VERROU DES RESSAISIES, en un seul endroit.
//
// Trois points d'entrée redemandent son mot de passe au professeur avant une
// action lourde : changer son mot de passe, inscrire un collègue, redonner un
// accès à un élève. C'est exactement le genre de contrôle qu'on oublie de
// recopier dans le troisième fichier, et c'est ce qui s'est produit : un seul
// des trois lisait le compteur.
//
// Le compteur lu est celui d'origine 'ressaisie', jamais celui des connexions
// ratées : sinon un inconnu, depuis Internet, bloquerait ces trois actions en
// se trompant dix fois sur l'adresse du professeur.
// ---------------------------------------------------------------------
const MAX_RESSAISIES = 8;
const FENETRE_MINUTES = 15;

export async function ressaisieAutorisee(profId) {
  const depuis = new Date(Date.now() - FENETRE_MINUTES * 60000).toISOString();
  const echecs = await lire('tentatives',
    `profil_id=eq.${profId}&origine=eq.ressaisie&quand=gte.${depuis}&select=id`)
    .catch(() => []);
  return echecs.length < MAX_RESSAISIES;
}

export async function noterEchecRessaisie(profId) {
  await ecrire('tentatives', '',
    { profil_id: profId, origine: 'ressaisie' }, 'POST').catch(() => {});
}

export { MAX_RESSAISIES, FENETRE_MINUTES };

/** Les groupes de cette personne — ceux qu'elle enseigne, ou ceux où elle est inscrite. */
export async function sesGroupes(profil) {
  if (profil.role === 'prof') {
    return lire('groupes',
      `prof_id=eq.${profil.id}&select=id,code,libelle,niveau&order=code`);
  }
  const liens = await lire('appartenances',
    `profil_id=eq.${profil.id}&select=groupes(id,code,libelle,niveau)`);
  return liens.map((l) => l.groupes).filter(Boolean);
}

/** Cet élève est-il dans un groupe de ce professeur ? */
export async function enseigneA(profId, eleveId) {
  const l = await lire('appartenances',
    `profil_id=eq.${eleveId}&select=groupe_id,groupes!inner(prof_id)` +
    `&groupes.prof_id=eq.${profId}`);
  return l.length > 0;
}

/** Ce professeur est-il celui de ce groupe ? */
export async function possedeGroupe(profId, groupeId) {
  const g = await lire('groupes', `id=eq.${groupeId}&prof_id=eq.${profId}&select=id`);
  return g.length > 0;
}

/** Cet élève est-il inscrit dans ce groupe ? */
export async function membreDe(eleveId, groupeId) {
  const a = await lire('appartenances',
    `profil_id=eq.${eleveId}&groupe_id=eq.${groupeId}&select=profil_id`);
  return a.length > 0;
}
