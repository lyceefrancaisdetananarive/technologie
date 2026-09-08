import { appelant, membreDe } from '../_lib/autorisation.js';
import { ecrire, urlDepotSignee, configuree, origineLegitime, refus }
  from '../_lib/supabase.js';

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png',
                     'image/webp': 'webp', 'application/pdf': 'pdf' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée. Reconnectez-vous.');
  if (moi.role !== 'eleve') return refus(res, 403, 'Réservé aux élèves.');

  const { groupe, sequence, document, type, commentaire, binome } = req.body ?? {};
  if (!groupe || !sequence || !document) return refus(res, 400, 'Dépôt incomplet.');

  const ext = EXTENSIONS[type];
  if (!ext) {
    return refus(res, 400,
      'Format non accepté. Déposez une photo (JPEG, PNG) ou un PDF.');
  }

  try {
    // L'élève dépose-t-il bien dans un groupe où il est inscrit ? Sans ce
    // contrôle, il déposerait dans le groupe d'une autre classe.
    if (!(await membreDe(moi.id, groupe))) {
      return refus(res, 403, "Vous n'êtes pas inscrit dans ce groupe.");
    }

    // La ligne est créée AVANT le fichier, avec « fichier » à null : c'est
    // le marqueur « dépôt en cours ». Si le téléversement échoue — et sur
    // cette liaison, il échouera parfois — la ligne reste visible comme
    // incomplète plutôt que de disparaître en silence.
    const [rendu] = await ecrire('rendus', '', {
      profil_id: moi.id,
      groupe_id: groupe,
      sequence: String(sequence).slice(0, 120),
      document: String(document).slice(0, 40),
      commentaire: commentaire ? String(commentaire).slice(0, 2000) : null,
      binome: binome ? String(binome).slice(0, 120) : null,
    }, 'POST');

    // Le chemin est construit ICI, côté serveur. Le client ne le choisit
    // jamais : c'est ce qui empêche un élève d'écrire chez un camarade.
    const chemin = `${moi.id}/${rendu.id}.${ext}`;
    res.status(200).json({
      ok: true, rendu: rendu.id, chemin,
      url: await urlDepotSignee(chemin),
    });
  } catch (e) {
    console.error('preparer-depot :', e.message);
    refus(res, 500, "Le dépôt n'a pas pu être préparé.");
  }
}
