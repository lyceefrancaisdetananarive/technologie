// =====================================================================
// Les vérifications d'autorisation du classeur, en un seul endroit.
//
// Elles sont ici et pas dispersées dans chaque fonction parce que c'est
// exactement le genre de contrôle qu'on oublie de recopier dans le
// troisième fichier. Un seul endroit à relire, un seul à corriger.
// =====================================================================

import { ouvrir, lireCookie } from './session.js';
import { lire } from './supabase.js';

/**
 * Qui appelle ? Relit le profil EN BASE, jamais au mot du cookie : un cookie
 * reste valable une heure après une désactivation.
 * Renvoie null si la session est absente, expirée, ou le compte inactif.
 */
export async function appelant(req) {
  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return null;
  const p = (await lire('profils',
    `id=eq.${session.sub}&select=id,role,actif,prenom,nom`))[0];
  return (p && p.actif) ? p : null;
}

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
