import { appelant, possedeGroupe } from '../_lib/autorisation.js';
import { lire, urlLectureSignee, configuree, refus } from '../_lib/supabase.js';

// Renvoie une URL de lecture valable cinq minutes. Le fichier n'est jamais
// public : sans passer par ici, personne ne l'atteint, même en connaissant
// son chemin exact.
// L'AUTORISATION PORTE SUR LE GROUPE DU RENDU, PAS SUR L'APPARTENANCE
// COURANTE DE L'ÉLÈVE. Le groupe est la relation qui a produit ce travail,
// et il ne bouge plus. Passer par l'appartenance rendait le rendu
// inaccessible dès que l'élève changeait de groupe : le classeur affichait
// encore le dépôt et son lien, mais toute action dessus était refusée en
// 403. Le professeur garde ce qu'il a reçu, et ne gagne rien sur ce qui a
// été déposé chez un collègue.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');

  const id = String(req.query?.rendu ?? '');
  if (!UUID.test(id)) return refus(res, 400, 'Rendu non précisé.');

  try {
    const r = (await lire('rendus', `id=eq.${id}&select=profil_id,groupe_id,fichier`))[0];
    if (!r || !r.fichier) return refus(res, 404, 'Fichier introuvable.');

    const autorise = r.profil_id === moi.id ||
      (moi.role === 'prof' && await possedeGroupe(moi.id, r.groupe_id));
    if (!autorise) return refus(res, 403, 'Ce travail ne vous est pas destiné.');

    res.status(200).json({ ok: true, url: await urlLectureSignee(r.fichier) });
  } catch (e) {
    console.error('fichier :', e.message);
    refus(res, 500, 'Lecture impossible.');
  }
}
