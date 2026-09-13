// =====================================================================
// Les règles de la progression, côté navigateur.
//
// Miroir de api/_lib/progression.js : quand une règle change, elle change
// dans les deux fichiers. Ce module ne parle pas au réseau et ne touche pas
// au DOM ; il transforme les données du catalogue et des tables plans,
// avancement, exceptions en états lisibles : fait, en cours, à venir, badge.
// =====================================================================

// Le catalogue arrive par un <script> classique chargé avant ce module. S'il
// a manqué (liaison coupée pendant le chargement), le module ne doit pas
// mourir à l'import sans un mot : il reste vide, et la page le constate avec
// catalogueCharge() pour afficher un message plutôt qu'un écran blanc.
const CATALOGUE = window.CATALOGUE ?? { niveaux: {} };

const PAR_ID = new Map();
for (const niv of ['5eme', '4eme', '3eme']) {
  for (const s of CATALOGUE.niveaux[niv]?.sequences ?? []) PAR_ID.set(s.id, { ...s, niveau: niv });
}

/** Le catalogue est-il bien là ? À tester avant tout rendu. */
export function catalogueCharge() { return PAR_ID.size > 0; }

export const NIVEAU_COURT = { '5eme': '5e', '4eme': '4e', '3eme': '3e' };
export const ETATS = {
  absent: 'Absent', a_reprendre: 'À reprendre', rattrape: 'Rattrapé',
};

/** La séquence du catalogue portant cet identifiant, ou null. */
export function sequence(id) { return PAR_ID.get(id) ?? null; }

/** Toutes les séquences du catalogue, dans l'ordre des niveaux. */
export function toutesLesSequences() { return [...PAR_ID.values()]; }

/**
 * Les titres des séances d'une séquence. Quand le catalogue compte autant
 * d'activités que de séances, l'activité donne son titre à la séance ;
 * sinon la séance garde un numéro.
 */
export function titresSeances(s) {
  const n = s.seances;
  const act = s.activites ?? [];
  return Array.from({ length: n }, (_, i) =>
    act.length === n && act[i]?.titre ? act[i].titre : `Séance ${i + 1}`);
}

/** Les numéros de séance cochés pour cette séquence, dans le groupe. */
export function seancesFaites(avancement, id) {
  return avancement.filter((a) => a.sequence === id).map((a) => a.seance);
}

/**
 * L'état d'une séquence pour le groupe : 'fait' si toutes ses séances sont
 * cochées, 'encours' si au moins une l'est, 'avenir' sinon.
 */
export function etatSequence(s, avancement) {
  const faites = seancesFaites(avancement, s.id).length;
  if (faites >= s.seances) return 'fait';
  return faites > 0 ? 'encours' : 'avenir';
}

/**
 * LE BADGE SE DÉDUIT, IL NE SE STOCKE PAS (décision 9).
 * Toutes les séances de la séquence cochées pour le groupe, et l'élève sans
 * exception ouverte (absent, à reprendre) sur cette séquence. « Rattrapé »
 * ne retient pas le badge.
 */
export function badgeAcquis(s, avancement, exceptions, eleveId) {
  const faites = new Set(seancesFaites(avancement, s.id));
  for (let i = 1; i <= s.seances; i++) if (!faites.has(i)) return false;
  return !exceptions.some((x) =>
    x.sequence === s.id && x.profil_id === eleveId && x.etat !== 'rattrape');
}

/**
 * Le résumé d'un groupe pour le tableau de bord : nombre de séances faites
 * sur les séances des séquences visibles, et la séquence en cours (la
 * première visible qui n'est pas terminée).
 */
export function resumeGroupe(plan, avancement) {
  let total = 0;
  let faites = 0;
  let courante = null;
  for (const p of plan) {
    if (!p.visible) continue;
    const s = sequence(p.sequence);
    if (!s) continue;
    total += s.seances;
    const f = Math.min(s.seances, seancesFaites(avancement, s.id).length);
    faites += f;
    if (!courante && f < s.seances) courante = s;
  }
  return { total, faites, courante, terminee: total > 0 && faites >= total };
}
