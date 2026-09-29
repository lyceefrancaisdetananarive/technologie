import { appelant, sesGroupes } from '../_lib/autorisation.js';
import { lire, configuree, refus } from '../_lib/supabase.js';

// =====================================================================
// CE QUI EST OUVERT POUR MOI : la liste des évaluations publiées dans mes
// groupes (D21).
//
//   GET  ->  { sequences: ['5eme/p1/seq1', ...] }
//
// Elle sert à faire APPARAÎTRE le lien, dans le classeur et sur la page du
// niveau. Elle ne sert pas à protéger la page : c'est le portier qui ferme
// l'évaluation, et lui seul, parce qu'une adresse se tape à la main et que
// vingt-sept codes de cahier en « E » y mènent directement.
//
// Cacher un lien n'est pas une protection, c'est une politesse. Les deux
// sont nécessaires : sans le portier, l'évaluation serait lisible d'avance ;
// sans la liste, le lien resterait affiché pour mener à un refus, ce qui
// est une mauvaise manière de dire « pas encore ».
//
// Aucune date, aucun nom de professeur : l'élève n'a pas besoin de savoir
// QUAND son professeur a ouvert l'évaluation, seulement qu'elle est ouverte.
// =====================================================================

export default async function handler(req, res) {
  if (req.method !== 'GET') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');

  try {
    const groupes = await sesGroupes(moi);
    if (!groupes.length) return res.status(200).json({ ok: true, sequences: [] });
    const ids = groupes.map((g) => g.id).join(',');
    const lignes = await lire('publications',
      `groupe_id=in.(${ids})&document=eq.eval&select=sequence`);
    res.status(200).json({
      ok: true,
      sequences: [...new Set(lignes.map((l) => l.sequence))],
    });
  } catch (e) {
    console.error('publications :', e.message);
    // Une panne de lecture ne doit pas casser le classeur : sans liste, le
    // lien reste caché, ce qui est le repli sûr.
    res.status(200).json({ ok: true, sequences: [] });
  }
}
