import { appelant } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import { sequenceDuCatalogue } from '../_lib/progression.js';

// =====================================================================
// LE MEILLEUR SCORE DE QUIZ D'UN ÉLÈVE (décision D15, question 10).
//
// Un quiz par séquence, identifié par la séquence du catalogue. On garde LE
// MEILLEUR SCORE SEULEMENT : le nombre de bonnes réponses, le nombre de
// questions de cet essai, et sa date. Ni les réponses, ni le nombre
// d'essais, ni les autres dates : le quiz reste un entraînement, l'élève
// recommence autant qu'il veut, et rien ici n'est une note (D14). Rien
// n'est écrit pour un visiteur sans session : le quiz public reste anonyme.
//
//   GET          mes scores : [{quiz, meilleur, total, meilleur_le}]
//   POST {quiz, score, total}   enregistre un essai, renvoie le meilleur et
//                le prénom du compte : sur un poste partagé, l'élève voit
//                dans quel classeur son score vient d'être écrit.
//
// Le total vient du navigateur (nombre de questions du quiz) : on le borne
// et on le vérifie contre le score, sans le croire davantage. Un élève qui
// forgerait un score ne tromperait que lui-même.
// =====================================================================

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return refus(res, 405, 'Méthode non autorisée.');
  }
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (req.method === 'POST' && !origineLegitime(req)) {
    return refus(res, 403, 'Origine non autorisée.');
  }
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'eleve') return refus(res, 403, 'Réservé aux élèves.');

  try {
    if (req.method === 'GET') {
      const scores = await lire('scores',
        `profil_id=eq.${moi.id}&select=quiz,meilleur,total,meilleur_le`);
      return res.status(200).json({ ok: true, scores });
    }

    const quiz = String(req.body?.quiz ?? '');
    const score = Number(req.body?.score);
    const total = Number(req.body?.total);
    const s = sequenceDuCatalogue(quiz);
    if (!s || !s.documents?.quiz) return refus(res, 400, 'Quiz inconnu.');
    if (!Number.isInteger(total) || total < 1 || total > 60) {
      return refus(res, 400, 'Nombre de questions invalide.');
    }
    if (!Number.isInteger(score) || score < 0 || score > total) {
      return refus(res, 400, 'Score invalide.');
    }

    const quand = new Date().toISOString();
    const cle = `profil_id=eq.${moi.id}&quiz=eq.${encodeURIComponent(quiz)}`;
    const nouveau = { profil_id: moi.id, quiz, meilleur: score, total, meilleur_le: quand };

    // Un premier essai s'insère ; si deux essais se croisent (double clic,
    // deux onglets) et que l'insertion tombe en doublon, on relit et on
    // compare comme pour un essai suivant : aucun essai n'est perdu.
    let [existant] = await lire('scores', `${cle}&select=meilleur,total`);
    let record = false;
    if (!existant) {
      try {
        await ecrire('scores', '', nouveau, 'POST');
        existant = nouveau;
        record = true;
      } catch (e) {
        if (e.code !== '23505' && e.statut !== 409) throw e;
        [existant] = await lire('scores', `${cle}&select=meilleur,total`);
      }
    }
    if (!record) {
      // Le meilleur se compare en proportion : un quiz peut changer de nombre
      // de questions d'une année sur l'autre. À proportion égale sur un
      // nouveau format, le record migre vers le format courant.
      record = total === existant.total
        ? score > existant.meilleur
        : score / total >= existant.meilleur / existant.total;
      if (record) {
        await ecrire('scores', cle, { meilleur: score, total, meilleur_le: quand });
        existant = nouveau;
      }
    }
    res.status(200).json({
      ok: true, quiz, meilleur: existant.meilleur, total: existant.total, record,
      prenom: moi.prenom ?? null,
    });
  } catch (e) {
    console.error('score :', e.message);
    refus(res, 500, 'Le score n’a pas été enregistré. Le quiz, lui, est bien fait.');
  }
}
