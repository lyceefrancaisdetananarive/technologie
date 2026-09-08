import { appelant, enseigneA } from '../_lib/autorisation.js';
import { sceller, poserCookie, ouvrir, lireCookie } from '../_lib/session.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';

// La session du professeur ne dure que 30 minutes, pour qu'elle ne déborde
// pas sur la classe suivante. Corriger une série de rendus prend plus
// longtemps : chaque correction ENREGISTRÉE réarme donc le compte à rebours.
//
// Le réarmement est attaché à une écriture, jamais à une lecture. Une
// prolongation déclenchée par la simple consultation d'une page serait
// entretenue par l'élève même qui exploite une session laissée ouverte : la
// session ne mourrait jamais tant que quelqu'un regarde. Ici, seul celui qui
// corrige prolonge, et corriger n'est pas quelque chose qu'un élève peut
// faire : enseigneA() a déjà tranché.
const DUREE_PROF = 1800;

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

    // Correction enregistrée : on réarme la session pour 30 minutes.
    //
    // `dep` est RECOPIÉ, jamais recalculé : c'est l'heure de la connexion
    // initiale, et elle porte le plafond absolu de session (voir
    // api/_lib/session.js). Sans ce report, sceller() poserait un nouveau
    // départ à chaque correction et le plafond ne mordrait jamais : une
    // session laissée ouverte se prolongerait indéfiniment, à raison d'une
    // correction toutes les vingt-neuf minutes.
    const session = await ouvrir(
      lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
    if (!session) return refus(res, 401, 'Session expirée.');
    const jeton = await sceller(
      { sub: moi.id, role: moi.role, prov: false, dep: session.dep },
      process.env.LFT_COOKIE_SECRET, DUREE_PROF);
    res.setHeader('Set-Cookie', poserCookie(jeton, moi.role, DUREE_PROF));
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('corriger :', e.message);
    refus(res, 500, "La correction n'a pas été enregistrée.");
  }
}
