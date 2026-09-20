// =====================================================================
// Les vérifications d'autorisation du classeur, en un seul endroit.
//
// Elles sont ici et pas dispersées dans chaque fonction parce que c'est
// exactement le genre de contrôle qu'on oublie de recopier dans le
// troisième fichier. Un seul endroit à relire, un seul à corriger.
// =====================================================================

import { ouvrir, lireCookie, sceller, poserCookie } from './session.js';
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
 * le mot de passe est provisoire, mais il ne juge pas /api/ : les fonctions
 * passent sans lui (décision D16, PREFIXES_PUBLICS). Sans le contrôle ici, qui
 * ramasse une bandelette peut se connecter, se faire renvoyer vers la page
 * de changement, et pendant ce temps appeler /api/classeur/mes-rendus pour
 * LIRE le classeur de sa victime, sans rien modifier, donc sans qu'elle
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
  // Défaillance en position fermée : si le compteur est illisible, l'action
  // lourde est refusée plutôt que laissée passer sans garde.
  const echecs = await lire('tentatives',
    `profil_id=eq.${profId}&origine=eq.ressaisie&quand=gte.${depuis}&select=id`)
    .catch((e) => { console.error('ressaisie : compteur illisible,', e.message); return null; });
  return echecs !== null && echecs.length < MAX_RESSAISIES;
}

export async function noterEchecRessaisie(profId) {
  await ecrire('tentatives', '',
    { profil_id: profId, origine: 'ressaisie' }, 'POST').catch(() => {});
}

export { MAX_RESSAISIES, FENETRE_MINUTES };

/**
 * Les groupes de cette personne : ceux qu'elle enseigne, ou ceux où elle est
 * inscrite. Année la plus récente d'abord, puis code : un élève qui garde ses
 * groupes d'une année sur l'autre (conservation sur le cycle, décision D15)
 * retrouve le groupe de l'année en tête.
 */
export async function sesGroupes(profil) {
  if (profil.role === 'prof') {
    return lire('groupes',
      `prof_id=eq.${profil.id}&select=id,code,libelle,niveau,annee&order=annee.desc,code`);
  }
  const liens = await lire('appartenances',
    `profil_id=eq.${profil.id}&select=groupes(id,code,libelle,niveau,annee)`);
  return liens.map((l) => l.groupes).filter(Boolean)
    .sort((a, b) => String(b.annee).localeCompare(String(a.annee)) || String(a.code).localeCompare(String(b.code)));
}

/**
 * Les niveaux d'un élève pour l'année en cours, dans l'ordre du cycle
 * (décision D16 : un élève ne voit que les fiches de son niveau). Union des
 * niveaux de ses groupes de l'année la plus récente : un élève inscrit par
 * erreur dans deux niveaux garde l'accès aux deux plutôt que d'être bloqué
 * le jour de la séance ; db/02 le signale. Tableau vide pour un élève sans
 * groupe (compte importé avant l'inscription, ou retiré) ; undefined pour un
 * professeur, que le portier ne filtre jamais.
 */
export const NIVEAUX_CYCLE = ['5eme', '4eme', '3eme'];

export async function niveauxDe(profil) {
  if (profil.role !== 'eleve') return undefined;
  const groupes = await sesGroupes(profil);
  if (!groupes.length) return [];
  const annee = groupes[0].annee;   // sesGroupes trie l'année récente en tête
  const niveaux = new Set(groupes
    .filter((g) => String(g.annee) === String(annee))
    .map((g) => g.niveau));
  return NIVEAUX_CYCLE.filter((n) => niveaux.has(n));
}

/**
 * LE VERROU DES COMPTES D'ÉLÈVES RÉELS (décisions D14 et D15, question 7).
 *
 * Aucune donnée réelle d'élève n'entre dans le site avant l'accord de la
 * direction et la position du délégué à la protection des données. Tant que
 * la variable COMPTES_ELEVES ne vaut pas « ouvert » dans les réglages du
 * projet Vercel, l'import des listes et l'inscription à la main d'une adresse
 * d'élève sont refusés ; seuls les comptes fictifs d'essai (essai-xxxxx-n)
 * passent. C'est un geste d'administration, fait une fois, daté dans
 * DECISIONS.md, pas un bouton dans une page.
 */
export function comptesElevesOuverts() {
  return String(process.env.COMPTES_ELEVES ?? '').trim().toLowerCase() === 'ouvert';
}

export const FICTIF = /^essai-[a-z0-9]{5}-[1-9]@eleve\.egd\.mg$/;
export const MESSAGE_VERROU = 'Les comptes d’élèves ne sont pas encore ouverts : '
  + 'ils attendent la position du délégué à la protection des données. Seuls '
  + 'les groupes d’essai sont possibles. Rien n’a été enregistré.';

/**
 * LE COORDONNATEUR (décision D16, 14 septembre 2026).
 *
 * Un professeur de la liste, désigné par son adresse dans la variable
 * COORDONNATEUR_TECHNO du projet Vercel, jamais dans le dépôt. Il gère les
 * comptes de TOUS les groupes : import des listes, inscription, retrait,
 * mise à la corbeille, restauration ; et il est le seul à pouvoir supprimer
 * définitivement un élève, geste qui emporte le classeur de l'élève.
 *
 * Gérer les comptes n'est pas lire les travaux : le coordonnateur ne voit
 * pas les dépôts des groupes de ses collègues, enseigneA() et sesGroupes()
 * ne changent pas. La variable absente ne désigne personne : la suppression
 * définitive est alors impossible, et c'est le comportement sûr.
 */
export function estCoordonnateur(profil) {
  if (!profil || profil.role !== 'prof' || !roleTenable(profil)) return false;
  const adresses = String(process.env.COORDONNATEUR_TECHNO ?? '').toLowerCase()
    .match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [];
  return adresses.includes(String(profil.email ?? '').toLowerCase());
}

/** Ce professeur peut-il gérer les comptes de ce groupe : le sien, ou coordonnateur. */
export async function gereGroupe(moi, groupeId) {
  if (estCoordonnateur(moi)) return true;
  return possedeGroupe(moi.id, groupeId);
}

/** Ce professeur peut-il gérer le compte de cet élève : l'un de ses élèves, ou coordonnateur. */
export async function gereEleve(moi, eleveId) {
  if (estCoordonnateur(moi)) return true;
  return enseigneA(moi.id, eleveId);
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

/**
 * Écriture enregistrée : on réarme la session du professeur pour DUREE_PROF
 * (quatre-vingt-dix minutes, une séance ; même valeur à la connexion, voir
 * api/auth/connexion.js).
 * Partagé par la correction, le plan de l'année et l'avancement, pour que le
 * professeur qui travaille ne soit pas déconnecté au milieu d'une séance.
 *
 * `dep` est RECOPIÉ, jamais recalculé : c'est l'heure de la connexion
 * initiale, et elle porte le plafond absolu de session (voir session.js).
 * Sans ce report, sceller() poserait un nouveau départ à chaque écriture et
 * le plafond ne mordrait jamais : une session laissée ouverte se
 * prolongerait indéfiniment, à raison d'une coche toutes les quatre-vingt-
 * neuf minutes.
 */
export const DUREE_PROF = 5400;

export async function reArmer(req, res, moi) {
  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return false;
  // Le niveau est recopié tel quel : le réarmement ne relit pas la base.
  const jeton = await sceller(
    { sub: moi.id, role: moi.role, prov: false, dep: session.dep, niv: session.niv },
    process.env.LFT_COOKIE_SECRET, DUREE_PROF);
  res.setHeader('Set-Cookie', poserCookie(jeton, moi.role, DUREE_PROF, session.niv));
  return true;
}
