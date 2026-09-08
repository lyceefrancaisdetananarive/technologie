import { appelant, possedeGroupe } from '../_lib/autorisation.js';
import { lire, configuree, refus } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  const groupe = String(req.query?.groupe ?? '');
  if (!groupe) return refus(res, 400, 'Groupe non précisé.');

  try {
    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, "Ce groupe n'est pas le vôtre.");
    }
    const rendus = await lire('rendus',
      `groupe_id=eq.${groupe}` +
      `&select=id,sequence,document,fichier,commentaire,binome,` +
      `appreciation,note,depose_le,corrige_le,profil_id,profils(id,prenom,nom)` +
      `&order=depose_le.desc`);

    // Effectif du groupe : sans lui, on ne voit pas qui n'a rien rendu.
    const inscrits = await lire('appartenances',
      `groupe_id=eq.${groupe}&select=profils(id,prenom,nom)&order=profils(nom)`);

    res.status(200).json({
      ok: true, rendus,
      eleves: inscrits.map((i) => i.profils).filter(Boolean),
    });
  } catch (e) {
    console.error('rendus :', e.message);
    refus(res, 500, 'Lecture impossible.');
  }
}
