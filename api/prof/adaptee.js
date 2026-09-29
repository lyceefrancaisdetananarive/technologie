import { appelant, possedeGroupe, reArmer } from '../_lib/autorisation.js';
import { ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import { UUID } from '../_lib/progression.js';

// =====================================================================
// SERVIR LA VERSION ADAPTEE A UN ELEVE, DANS UN GROUPE (D23).
//
//   POST { groupe, eleve, adaptee: true|false }
//
// L'élève reçoit alors, dans ses fiches de séquence, l'onglet « Version
// adaptée » : même activité, autrement. Vingt-sept fiches existent déjà,
// une par séquence ; celui qui en a le plus besoin est celui qui pense le
// moins à aller les chercher.
//
// CE QUE CET APPEL N'ACCEPTE PAS, ET N'ACCEPTERA PAS : un motif, une note,
// une date de notification, une mention de PAP, de PPRE ou de trouble. Le
// corps de la requête n'a que trois champs, et c'est délibéré. Écrire le
// motif créerait un traitement de données de santé au sens de l'article 9
// du RGPD, sans base légale, sans analyse d'impact et sans durée de
// conservation. Le motif est déjà consigné là où il est encadré : le
// dossier de l'élève et PRONOTE.
//
// La règle dont ce refus est l'application : le classeur enregistre ce que
// l'établissement FAIT, pas ce qu'il SAIT de l'élève.
//
// LE GESTE N'EST PAS JOURNALISÉ, et c'est voulu. Le journal (db/09) sert à
// retrouver qui a supprimé quoi ; il est lisible par le coordonnateur. Y
// inscrire « untel a posé la version adaptée sur untel » y ferait entrer,
// horodatée et nominative, exactement l'information qu'on refuse de
// stocker. L'état courant suffit : il se lit dans la fiche de l'élève.
// =====================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  const { groupe, eleve, adaptee } = req.body ?? {};
  if (!UUID.test(String(groupe ?? ''))) return refus(res, 400, 'Groupe non précisé.');
  if (!UUID.test(String(eleve ?? ''))) return refus(res, 400, 'Élève non précisé.');
  if (typeof adaptee !== 'boolean') return refus(res, 400, 'Valeur attendue : vrai ou faux.');

  try {
    // Le professeur du GROUPE, et lui seul : un coordonnateur n'a pas à
    // régler cela dans la classe d'un collègue, c'est une décision
    // pédagogique qui se prend devant l'élève.
    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, "Ce groupe n'est pas le vôtre.");
    }
    const lignes = await ecrire('appartenances',
      `groupe_id=eq.${groupe}&profil_id=eq.${eleve}`,
      { version_adaptee: adaptee });
    if (!Array.isArray(lignes) || !lignes.length) {
      return refus(res, 404, "Cet élève n'est pas inscrit dans ce groupe.");
    }
    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    res.status(200).json({ ok: true, version_adaptee: adaptee });
  } catch (e) {
    console.error('adaptee :', e.message);
    refus(res, 500, "Le réglage n'a pas été enregistré.");
  }
}
