import { appelant, possedeGroupe, reArmer } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import { UUID, sequenceDuCatalogue } from '../_lib/progression.js';

// =====================================================================
// CORRIGER UN TRAVAIL DÉPOSÉ : une appréciation, et facultativement UNE
// compétence de la séquence avec un niveau de maîtrise du LSU.
//
// PLUS DE NOTE SUR 20 (décision D15, question 4). Les notes vivent dans
// PRONOTE ; le classeur est un outil de travail, pas un second livret. La
// colonne rendus.note reste en base pour d'anciennes lignes, plus rien ne
// l'écrit. La compétence doit être l'une de celles que le catalogue
// rattache à la séquence du dépôt : on ne positionne pas un élève sur une
// compétence que la séquence ne travaille pas.
// =====================================================================

const MAITRISES = ['insuffisante', 'fragile', 'satisfaisante', 'tres_bonne'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  try {
    const { rendu, appreciation, competence, maitrise, annuler } = req.body ?? {};
    if (!UUID.test(String(rendu ?? ''))) return refus(res, 400, 'Rendu non précisé.');

    const r = (await lire('rendus', `id=eq.${rendu}&select=id,profil_id,groupe_id,sequence`))[0];
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
        appreciation: null, note: null, competence: null, maitrise: null, corrige_le: null,
      });
      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({ ok: true, annule: true });
    }

    const texte = appreciation ? String(appreciation).slice(0, 4000) : null;
    const comp = competence ? String(competence).slice(0, 200) : null;
    const niv = maitrise ? String(maitrise) : null;

    if (comp) {
      const s = sequenceDuCatalogue(r.sequence);
      if (!s || !(s.competences ?? []).includes(comp)) {
        return refus(res, 400, 'Cette compétence n’est pas rattachée à la séquence du dépôt.');
      }
    }
    if (niv && !MAITRISES.includes(niv)) {
      return refus(res, 400, 'Niveau de maîtrise inconnu.');
    }
    if ((comp && !niv) || (niv && !comp)) {
      return refus(res, 400, 'Indiquez la compétence ET le niveau de maîtrise, ou aucun des deux.');
    }
    if (!texte && !comp) {
      return refus(res, 400,
        'Écrivez une appréciation, ou situez une compétence. Pour retirer une ' +
        'correction déjà enregistrée, utilisez « Retirer la correction ».');
    }

    await ecrire('rendus', `id=eq.${rendu}`, {
      appreciation: texte,
      competence: comp,
      maitrise: niv,
      note: null,
      corrige_le: new Date().toISOString(),
    });

    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('corriger :', e.message);
    refus(res, 500, "La correction n'a pas été enregistrée.");
  }
}
