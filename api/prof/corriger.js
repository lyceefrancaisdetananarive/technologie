import { appelant, enseigneA } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  const { rendu, appreciation, note } = req.body ?? {};
  if (!rendu) return refus(res, 400, 'Rendu non précisé.');

  try {
    const r = (await lire('rendus', `id=eq.${rendu}&select=id,profil_id`))[0];
    if (!r) return refus(res, 404, 'Rendu introuvable.');
    if (!(await enseigneA(moi.id, r.profil_id))) {
      return refus(res, 403, "Cet élève n'est pas dans vos groupes.");
    }

    // La note reste facultative : les notes officielles vivent dans PRONOTE.
    // Les dupliquer ici créerait un second registre à conserver, à justifier
    // et à tenir à jour.
    const valeurNote = (note === '' || note == null) ? null : Number(note);
    if (valeurNote != null && (Number.isNaN(valeurNote) || valeurNote < 0 || valeurNote > 20)) {
      return refus(res, 400, 'La note doit être comprise entre 0 et 20.');
    }

    await ecrire('rendus', `id=eq.${rendu}`, {
      appreciation: appreciation ? String(appreciation).slice(0, 4000) : null,
      note: valeurNote,
      corrige_le: new Date().toISOString(),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('corriger :', e.message);
    refus(res, 500, "La correction n'a pas été enregistrée.");
  }
}
