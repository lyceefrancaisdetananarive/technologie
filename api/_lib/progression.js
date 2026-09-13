// =====================================================================
// Les règles de la progression par groupe, en un seul endroit.
//
// Trois fonctions /api/ les partagent (plan, avancement, essai), et la page
// enseignant/plan.html applique les mêmes règles dans le navigateur. Quand
// une règle change, elle change ici ET dans js/progression-regles.js, et
// nulle part ailleurs.
//
// Le catalogue est la copie ES du plan de l'année (api/_lib/catalogue.js,
// générée par outils/generer.py). Une séquence s'identifie par
// « niveau/pN/seqN », exactement comme dans rendus.sequence.
// =====================================================================

import CATALOGUE from './catalogue.js';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NIVEAUX = ['5eme', '4eme', '3eme'];
export const ETATS_EXCEPTION = ['absent', 'a_reprendre', 'rattrape'];

/** Plafond des séances par séquence, celui de la contrainte en base. */
export const MAX_SEANCES = 12;

/** Nombre maximal de séquences dans le plan d'un groupe : 27 existent. */
export const MAX_PLAN = 40;

const PAR_ID = new Map();
for (const niv of NIVEAUX) {
  for (const s of CATALOGUE.niveaux[niv].sequences) {
    PAR_ID.set(s.id, { ...s, niveau: niv });
  }
}

/** La séquence du catalogue portant cet identifiant, ou null. */
export function sequenceDuCatalogue(id) {
  return PAR_ID.get(String(id ?? '')) ?? null;
}

/**
 * Le plan proposé à la création d'un groupe : les neuf séquences de son
 * niveau, dans l'ordre du catalogue, toutes visibles. C'est ce que reçoit un
 * professeur qui n'a encore rien réordonné (décision 3).
 */
export function planParDefaut(niveau) {
  const n = CATALOGUE.niveaux[niveau];
  if (!n) return [];
  return n.sequences.map((s, i) => ({ sequence: s.id, position: i + 1, visible: true }));
}

/**
 * Valide un plan envoyé par le navigateur et le normalise.
 * Renvoie { plan } ou { erreur }. Un plan est une liste ordonnée de
 * séquences du catalogue, sans doublon, chacune visible ou non.
 */
export function normaliserPlan(brut) {
  if (!Array.isArray(brut) || !brut.length) return { erreur: 'Plan vide.' };
  if (brut.length > MAX_PLAN) return { erreur: 'Plan trop long.' };
  const vus = new Set();
  const plan = [];
  for (const e of brut) {
    const id = String(e?.sequence ?? '');
    if (!sequenceDuCatalogue(id)) return { erreur: `Séquence inconnue : ${id.slice(0, 40)}` };
    if (vus.has(id)) return { erreur: `Séquence en double : ${id}` };
    vus.add(id);
    plan.push({ sequence: id, position: plan.length + 1, visible: e?.visible !== false });
  }
  return { plan };
}

/**
 * Les numéros de séance valides pour une séquence : 1..seances du catalogue.
 * Renvoie la liste normalisée, ou null si un numéro sort du cadre.
 */
export function normaliserSeances(sequence, brut) {
  const s = sequenceDuCatalogue(sequence);
  if (!s) return null;
  const liste = Array.isArray(brut) ? brut : [brut];
  const nums = [...new Set(liste.map((x) => Number(x)))];
  if (!nums.length || nums.length > MAX_SEANCES) return null;
  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > Math.min(s.seances, MAX_SEANCES)) return null;
  }
  return nums.sort((a, b) => a - b);
}

/**
 * LE BADGE SE DÉDUIT, IL NE SE STOCKE PAS (décision 9).
 *
 * Un élève a le badge d'une séquence quand le professeur a coché toutes les
 * séances de cette séquence pour le groupe, et que l'élève n'a sur ces
 * séances aucune exception encore ouverte (absent, à reprendre). Une
 * exception « rattrapé » ne l'empêche pas : c'est précisément ce qu'elle
 * dit. La même règle vit dans js/progression-regles.js pour l'affichage.
 */
export function badgeAcquis(sequence, seancesFaites, exceptionsEleve) {
  const s = sequenceDuCatalogue(sequence);
  if (!s) return false;
  const faites = new Set(seancesFaites);
  for (let i = 1; i <= s.seances; i++) if (!faites.has(i)) return false;
  return !exceptionsEleve.some((x) => x.sequence === sequence && x.etat !== 'rattrape');
}
