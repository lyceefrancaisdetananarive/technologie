import { appelant } from '../_lib/autorisation.js';
import { lire, configuree, refus } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'eleve') return refus(res, 403, 'Réservé aux élèves.');

  try {
    const rendus = await lire('rendus',
      `profil_id=eq.${moi.id}` +
      `&select=id,sequence,document,fichier,commentaire,binome,` +
      `appreciation,note,depose_le,corrige_le,groupes(code)` +
      `&order=depose_le.desc`);

    // « On a réinitialisé mon accès » : l'élève doit le savoir. Le repli
    // professeur est un pouvoir réel sur son compte, il ne doit pas être
    // silencieux.
    const repli = await lire('journal_repli',
      `eleve_id=eq.${moi.id}&vu_par_eleve=eq.false&select=quand&order=quand.desc&limit=1`);

    res.status(200).json({ ok: true, rendus, repli: repli[0] ?? null });
  } catch (e) {
    console.error('mes-rendus :', e.message);
    refus(res, 500, 'Lecture impossible.');
  }
}
