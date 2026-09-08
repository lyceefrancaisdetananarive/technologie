import { appelant, membreDe } from '../_lib/autorisation.js';
import { lire, ecrire, urlDepotSignee, configuree, origineLegitime, refus }
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

    const seq = String(sequence).slice(0, 120);
    const doc = String(document).slice(0, 40);
    const champs = {
      commentaire: commentaire ? String(commentaire).slice(0, 2000) : null,
      binome: binome ? String(binome).slice(0, 120) : null,
    };

    // La ligne est créée AVANT le fichier, avec « fichier » à null : c'est
    // le marqueur « dépôt en cours ». Si le téléversement échoue — et sur
    // cette liaison, il échouera parfois — la ligne reste visible comme
    // incomplète plutôt que de disparaître en silence.
    //
    // MAIS ON NE RECOMMENCE PAS UNE LIGNE À CHAQUE ESSAI. Le message affiché
    // après un échec invite à réessayer ; chaque essai repassait ici et
    // ajoutait un dépôt fantôme de plus. Un élève sur une liaison mauvaise
    // pouvait en semer cinq ou six pour un seul travail, et le professeur
    // les voyait tous. On reprend donc celui qui est resté en attente pour
    // la même séquence et le même document, s'il existe.
    const enCours = await lire('rendus',
      `profil_id=eq.${moi.id}&groupe_id=eq.${groupe}` +
      `&sequence=eq.${encodeURIComponent(seq)}` +
      `&document=eq.${encodeURIComponent(doc)}` +
      `&fichier=is.null&select=id&order=depose_le.desc&limit=1`);

    let rendu;
    if (enCours.length) {
      // On rafraîchit le mot à l'attention du professeur et le binôme : ils
      // ont pu changer entre deux tentatives.
      [rendu] = await ecrire('rendus', `id=eq.${enCours[0].id}`, champs);
    } else {
      [rendu] = await ecrire('rendus', '', {
        profil_id: moi.id,
        groupe_id: groupe,
        sequence: seq,
        document: doc,
        ...champs,
      }, 'POST');
    }

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
