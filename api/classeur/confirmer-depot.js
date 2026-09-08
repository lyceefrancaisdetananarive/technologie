import { appelant } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';

// Appelée une fois le fichier arrivé chez Supabase. Tant qu'elle n'a pas
// été appelée, « fichier » reste null et le dépôt s'affiche comme incomplet.
export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');

  const { rendu, chemin } = req.body ?? {};
  if (!rendu || !chemin) return refus(res, 400, 'Requête incomplète.');

  try {
    const r = (await lire('rendus', `id=eq.${rendu}&select=id,profil_id,corrige_le`))[0];
    if (!r || r.profil_id !== moi.id) return refus(res, 403, 'Dépôt inconnu.');
    if (r.corrige_le) return refus(res, 409, 'Ce travail a déjà été corrigé.');
    // Le chemin doit commencer par l'identifiant de l'élève : dernière
    // barrière si quelqu'un rejoue la requête avec un autre chemin.
    if (!String(chemin).startsWith(`${moi.id}/`)) {
      return refus(res, 403, 'Chemin non autorisé.');
    }
    await ecrire('rendus', `id=eq.${rendu}`, { fichier: chemin });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('confirmer-depot :', e.message);
    refus(res, 500, "La confirmation n'a pas abouti.");
  }
}
