import { appelant, possedeGroupe, reArmer } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import { UUID } from '../_lib/progression.js';

// =====================================================================
// LES RÉPONSES RÉDIGÉES D'UN GROUPE, ET LEUR CORRECTION (D16, point f).
//
//   GET   ?groupe=ID                 toutes les réponses du groupe, les non
//                                    corrigées d'abord, avec l'élève.
//   PATCH {reponse, correction}      écrit la correction et fige la réponse.
//   PATCH {reponse, annuler: true}   retire la correction : l'élève peut
//                                    de nouveau modifier ou supprimer.
//
// PAS D'EFFACEMENT PAR LE PROFESSEUR. Le geste effacerMot de corriger.js
// vide un champ facultatif ; ici le texte EST le travail, et le travail
// d'un mineur ne disparaît pas par un bouton (règle de supprimer-depot.js).
// Si un texte doit vraiment disparaître, cela relève d'une demande écrite.
// L'élève, lui, supprime sa propre réponse tant qu'elle n'est pas corrigée.
//
// Le groupe doit être L'UN DES MIENS (possedeGroupe) : même cloisonnement
// que rendus.js et corriger.js. Chaque écriture réarme la session.
// =====================================================================

const MAX = 4000;
const COLONNES = 'id,page,question,texte,redige_le,modifie_le,correction,corrige_le,profil_id';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return refus(res, 405, 'Méthode non autorisée.');
  }
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (req.method === 'PATCH' && !origineLegitime(req)) {
    return refus(res, 403, 'Origine non autorisée.');
  }
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  try {
    // ---- La liste du groupe ---------------------------------------------
    if (req.method === 'GET') {
      const groupe = String(req.query?.groupe ?? '');
      if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
      if (!(await possedeGroupe(moi.id, groupe))) {
        return refus(res, 403, "Ce groupe n'est pas le vôtre.");
      }
      // L'embed profils(...) n'est possible sans ambiguïté que parce que
      // reponses n'a qu'une clé étrangère vers profils (pas de prof_id).
      const reponses = await lire('reponses',
        `groupe_id=eq.${groupe}&select=${COLONNES},profils(id,prenom,nom)` +
        '&order=corrige_le.asc.nullsfirst,modifie_le.desc');
      return res.status(200).json({
        ok: true, reponses,
        a_corriger: reponses.filter((r) => !r.corrige_le).length,
      });
    }

    // ---- Corriger, ou retirer la correction -----------------------------
    const { reponse, correction, annuler } = req.body ?? {};
    const id = String(reponse ?? '');
    if (!UUID.test(id)) return refus(res, 400, 'Réponse non précisée.');

    const r = (await lire('reponses', `id=eq.${id}&select=id,profil_id,groupe_id`))[0];
    if (!r) return refus(res, 404, 'Réponse introuvable.');
    if (!(await possedeGroupe(moi.id, r.groupe_id))) {
      return refus(res, 403, "Cette réponse n'a pas été rédigée dans l'un de vos groupes.");
    }

    // RETIRER UNE CORRECTION : même recours que pour les dépôts. Un clic par
    // mégarde sur « Enregistrer » figeait la réponse pour toujours.
    if (annuler) {
      await ecrire('reponses', `id=eq.${id}`, { correction: null, corrige_le: null });
      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({ ok: true, annule: true });
    }

    // Tronqué en caractères (Array.from), pas en unités UTF-16 : un emoji
    // coupé en deux serait refusé par la base et la correction perdue.
    const texte = Array.from(String(correction ?? '').replace(/\r\n?/g, '\n').trim())
      .slice(0, MAX).join('');
    if (!texte) {
      return refus(res, 400,
        'Écrivez une correction. Pour retirer une correction déjà enregistrée, '
        + 'utilisez « Retirer la correction ».');
    }
    const quand = new Date().toISOString();
    await ecrire('reponses', `id=eq.${id}`, { correction: texte, corrige_le: quand });

    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    res.status(200).json({ ok: true, reponse: { id, correction: texte, corrige_le: quand } });
  } catch (e) {
    console.error('reponses prof :', e.message);
    refus(res, 500, req.method === 'GET'
      ? 'Lecture impossible.'
      : "La correction n'a pas été enregistrée.");
  }
}
