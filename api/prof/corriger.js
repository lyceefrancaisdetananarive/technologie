import { appelant, possedeGroupe } from '../_lib/autorisation.js';
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

/**
 * Écriture enregistrée : on réarme la session du professeur pour 30 minutes.
 *
 * `dep` est RECOPIÉ, jamais recalculé : c'est l'heure de la connexion
 * initiale, et elle porte le plafond absolu de session (voir
 * api/_lib/session.js). Sans ce report, sceller() poserait un nouveau départ
 * à chaque correction et le plafond ne mordrait jamais : une session laissée
 * ouverte se prolongerait indéfiniment, à raison d'une correction toutes les
 * vingt-neuf minutes.
 */
async function reArmer(req, res, moi) {
  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return false;
  const jeton = await sceller(
    { sub: moi.id, role: moi.role, prov: false, dep: session.dep },
    process.env.LFT_COOKIE_SECRET, DUREE_PROF);
  res.setHeader('Set-Cookie', poserCookie(jeton, moi.role, DUREE_PROF));
  return true;
}

// L'AUTORISATION PORTE SUR LE GROUPE DU RENDU, PAS SUR L'APPARTENANCE
// COURANTE DE L'ÉLÈVE. Le groupe est la relation qui a produit ce travail,
// et il ne bouge plus. Passer par l'appartenance rendait le rendu
// inaccessible dès que l'élève changeait de groupe : le classeur affichait
// encore le dépôt et son lien, mais toute action dessus était refusée en
// 403. Le professeur garde ce qu'il a reçu, et ne gagne rien sur ce qui a
// été déposé chez un collègue.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  const { rendu, appreciation, note, annuler } = req.body ?? {};
  if (!UUID.test(String(rendu ?? ''))) return refus(res, 400, 'Rendu non précisé.');

  try {
    const r = (await lire('rendus', `id=eq.${rendu}&select=id,profil_id,groupe_id`))[0];
    if (!r) return refus(res, 404, 'Rendu introuvable.');
    if (!(await possedeGroupe(moi.id, r.groupe_id))) {
      return refus(res, 403, "Ce travail n'a pas été déposé dans l'un de vos groupes.");
    }

    // RETIRER UNE CORRECTION. Sans cela, corrige_le se posait pour toujours :
    // un clic par mégarde sur « Enregistrer » marquait le travail corrigé, et
    // rien nulle part ne savait le défaire. L'élève ne pouvait plus rien
    // redéposer, confirmer-depot.js répondant « Ce travail a déjà été
    // corrigé », et le professeur n'avait aucun recours.
    if (annuler) {
      await ecrire('rendus', `id=eq.${rendu}`, {
        appreciation: null, note: null, corrige_le: null,
      });
      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({ ok: true, annule: true });
    }

    // La note reste facultative : les notes officielles vivent dans PRONOTE.
    // Les dupliquer ici créerait un second registre à conserver, à justifier
    // et à tenir à jour.
    const valeurNote = (note === '' || note == null) ? null : Number(note);
    if (valeurNote != null && (Number.isNaN(valeurNote) || valeurNote < 0 || valeurNote > 20)) {
      return refus(res, 400, 'La note doit être comprise entre 0 et 20.');
    }

    // UNE CORRECTION VIDE N'EN EST PAS UNE, et on refuse d'en écrire une.
    // C'est ce qui rendait le clic par mégarde dangereux : les deux champs
    // vides écrasaient l'appréciation existante par null tout en posant
    // corrige_le. Désormais un clic sur un formulaire vide ne fait rien du
    // tout, et le dit.
    const texte = appreciation ? String(appreciation).slice(0, 4000) : null;
    if (!texte && valeurNote == null) {
      return refus(res, 400,
        'Écrivez une appréciation, ou mettez une note. Pour retirer une ' +
        'correction déjà enregistrée, utilisez « Retirer la correction ».');
    }

    await ecrire('rendus', `id=eq.${rendu}`, {
      appreciation: texte,
      note: valeurNote,
      corrige_le: new Date().toISOString(),
    });

    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('corriger :', e.message);
    refus(res, 500, "La correction n'a pas été enregistrée.");
  }
}
