import { appelant, possedeGroupe, membreDe, reArmer } from '../_lib/autorisation.js';
import { ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import {
  UUID, ETATS_EXCEPTION, sequenceDuCatalogue, normaliserSeances,
} from '../_lib/progression.js';

// =====================================================================
// COCHER « FAIT EN CLASSE », ET POSER UNE EXCEPTION POUR UN ÉLÈVE.
//
// Décision 1 : le professeur coche pour le groupe entier, en un geste ;
// l'élève ne coche rien. Ce qui déroge pour un élève (absent, à reprendre,
// rattrapé) se pose à part, et c'est cette exception qui retient le badge
// de fin de séquence (décision 9, règle dans _lib/progression.js).
//
//   POST  {groupe, sequence, seances: [1, 2], fait: true|false}
//         coche ou décoche des séances pour le groupe. `seances` accepte la
//         séquence entière d'un coup : c'est le geste de groupe en un clic.
//   PATCH {groupe, sequence, seance, eleve, etat}
//         pose (etat parmi absent, a_reprendre, rattrape) ou retire
//         (etat null) l'exception d'un élève sur une séance. Pas de champ
//         libre : un motif d'absence deviendrait vite une donnée de santé.
//
// Chaque écriture porte l'auteur (par) et l'heure : la progression est une
// donnée en base avec auteur et horodatage, jamais un état de navigateur.
// =====================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return refus(res, 405, 'Méthode non autorisée.');
  }
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  try {
    const groupe = String(req.body?.groupe ?? '');
    const sequence = String(req.body?.sequence ?? '');
    if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
    if (!sequenceDuCatalogue(sequence)) return refus(res, 400, 'Séquence inconnue.');

    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, "Ce groupe n'est pas le vôtre.");
    }

    // ---- Coches du groupe ----------------------------------------------
    if (req.method === 'POST') {
      const seances = normaliserSeances(sequence, req.body?.seances ?? req.body?.seance);
      if (!seances) return refus(res, 400, 'Numéro de séance hors de la séquence.');
      const fait = req.body?.fait !== false;

      if (fait) {
        // Insérer ou remplacer : recocher une séance déjà cochée met simplement
        // l'auteur et l'heure à jour, sans doublon ni erreur.
        await ecrire('avancement', '',
          seances.map((n) => ({
            groupe_id: groupe, sequence, seance: n, par: moi.id,
            fait_le: new Date().toISOString(),
          })),
          'POST', 'resolution=merge-duplicates');
      } else {
        await ecrire('avancement',
          `groupe_id=eq.${groupe}&sequence=eq.${encodeURIComponent(sequence)}`
          + `&seance=in.(${seances.join(',')})`, {}, 'DELETE');
      }
      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({ ok: true, sequence, seances, fait });
    }

    // ---- Exception d'un élève -------------------------------------------
    const eleve = String(req.body?.eleve ?? '');
    if (!UUID.test(eleve)) return refus(res, 400, 'Élève non précisé.');
    const seances = normaliserSeances(sequence, req.body?.seance);
    if (!seances || seances.length !== 1) {
      return refus(res, 400, 'Numéro de séance hors de la séquence.');
    }
    const seance = seances[0];
    const etat = req.body?.etat == null || req.body.etat === '' ? null : String(req.body.etat);
    if (etat !== null && !ETATS_EXCEPTION.includes(etat)) {
      return refus(res, 400, 'État inconnu.');
    }

    // L'élève doit être inscrit dans CE groupe, pas seulement dans l'un des
    // miens : une exception vit dans le groupe, comme la coche qu'elle nuance.
    if (!(await membreDe(eleve, groupe))) {
      return refus(res, 403, "Cet élève n'est pas inscrit dans ce groupe.");
    }

    const cle = `groupe_id=eq.${groupe}&sequence=eq.${encodeURIComponent(sequence)}`
      + `&seance=eq.${seance}&profil_id=eq.${eleve}`;
    if (etat === null) {
      await ecrire('exceptions', cle, {}, 'DELETE');
    } else {
      await ecrire('exceptions', '', {
        groupe_id: groupe, sequence, seance, profil_id: eleve,
        etat, par: moi.id, le: new Date().toISOString(),
      }, 'POST', 'resolution=merge-duplicates');
    }
    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    res.status(200).json({ ok: true, sequence, seance, eleve, etat });
  } catch (e) {
    console.error('avancement :', e.message);
    refus(res, 500, req.method === 'POST'
      ? 'La coche n’a pas été enregistrée. Réessayez.'
      : 'L’exception n’a pas été enregistrée. Réessayez.');
  }
}
