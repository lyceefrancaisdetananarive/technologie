import { appelant, sesGroupes } from '../_lib/autorisation.js';
import { configuree, refus } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  try {
    res.status(200).json({
      ok: true, role: moi.role, prenom: moi.prenom,
      groupes: await sesGroupes(moi),
    });
  } catch (e) {
    console.error('groupes :', e.message);
    refus(res, 500, 'Lecture impossible.');
  }
}
