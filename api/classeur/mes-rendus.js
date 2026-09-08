import { appelant } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, refus } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'eleve') return refus(res, 403, 'Réservé aux élèves.');

  try {
    const rendus = await lire('rendus',
      `profil_id=eq.${moi.id}` +
      `&select=id,sequence,document,fichier,commentaire,binome,` +
      `appreciation,note,depose_le,corrige_le,groupes(code)` +
      `&order=depose_le.desc`);

    // « On a réinitialisé mon accès » : l'élève doit le savoir. Le repli
    // professeur est un pouvoir réel sur son compte, il ne doit pas être
    // silencieux.
    const repli = await lire('journal_repli',
      `eleve_id=eq.${moi.id}&vu_par_eleve=eq.false&select=quand&order=quand.desc&limit=1`);

    // ACCUSÉ DE LECTURE. Sans lui, vu_par_eleve n'était jamais mis à vrai
    // par personne : ni ici, ni ailleurs dans le code, et le navigateur ne
    // le peut pas non plus, journal_repli n'ayant qu'une politique de
    // lecture. Le bandeau « votre professeur a réinitialisé votre accès »
    // s'allumait donc en septembre et restait allumé jusqu'en juin, avec la
    // même date. Un signal permanent cesse d'être un signal : en février,
    // l'élève ne le voit plus, et la deuxième réinitialisation passe
    // inaperçue. On le marque vu au moment où on le remet à la page, pour
    // qu'il signale un ÉVÉNEMENT et non un état.
    if (repli.length) {
      await ecrire('journal_repli',
        `eleve_id=eq.${moi.id}&vu_par_eleve=eq.false`,
        { vu_par_eleve: true }).catch(() => {});
    }

    res.status(200).json({ ok: true, rendus, repli: repli[0] ?? null });
  } catch (e) {
    console.error('mes-rendus :', e.message);
    refus(res, 500, 'Lecture impossible.');
  }
}
