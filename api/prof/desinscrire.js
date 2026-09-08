import { ouvrir, lireCookie } from '../_lib/session.js';
import { possedeGroupe, enseigneA } from '../_lib/autorisation.js';
import {
  lire, ecrire, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// =====================================================================
// RETIRER UN ÉLÈVE D'UN GROUPE, OU DÉSACTIVER SON COMPTE.
//
// CE QUE CE POINT D'ENTRÉE NE FAIT PAS, ET NE FERA PAS : supprimer un
// compte d'élève. Le travail déposé est lié au profil ; effacer le profil
// effacerait les rendus en cascade (db/01-schema.sql, on delete cascade).
// Le travail d'un mineur ne disparaît pas d'un clic, même du professeur.
// Une suppression définitive relève d'une demande écrite et d'un geste
// d'administration, pas d'un bouton dans une page.
//
// Deux gestes, de gravité très différente, et c'est volontaire :
//
//  · RETIRER DU GROUPE : réversible, sans perte. L'élève change de groupe,
//    ou n'aurait pas dû y être. Ses dépôts restent, et le professeur du
//    groupe où il est vraiment continue de les voir.
//
//  · DÉSACTIVER : le compte ne se connecte plus, mais tout est conservé.
//    Sert au départ d'un élève en cours d'année. Réversible en réinscrivant.
// =====================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return refus(res, 401, 'Session expirée.');

  const eleve = String(req.body?.eleve ?? '').trim();
  const groupe = String(req.body?.groupe ?? '').trim();
  const desactiver = Boolean(req.body?.desactiver);

  if (!UUID.test(eleve)) return refus(res, 400, 'Élève non précisé.');

  try {
    const moi = (await lire('profils',
      `id=eq.${session.sub}&select=id,role,actif,mdp_provisoire`))[0];
    if (!moi || moi.role !== 'prof' || !moi.actif) {
      return refus(res, 403, 'Action réservée aux professeurs.');
    }
    if (moi.mdp_provisoire) {
      return refus(res, 403,
        'Choisissez d’abord votre propre mot de passe définitif.');
    }
    if (eleve === moi.id) {
      return refus(res, 400, 'Vous ne pouvez pas vous retirer vous-même.');
    }

    const cible = (await lire('profils',
      `id=eq.${eleve}&select=id,role,prenom,nom`))[0];
    if (!cible) return refus(res, 404, 'Personne introuvable.');
    if (cible.role !== 'eleve') {
      // Un professeur ne se retire pas depuis cette page : son rôle vient de
      // PROFS_TECHNO, et c'est là qu'il faut le retirer.
      return refus(res, 403,
        'Un professeur se retire en modifiant la liste PROFS_TECHNO, pas ici.');
    }

    if (desactiver) {
      // Désactiver touche TOUS les groupes, y compris ceux de collègues :
      // on exige donc d'enseigner à cet élève, et on le dit dans la réponse.
      if (!(await enseigneA(moi.id, eleve))) {
        return refus(res, 403, 'Cet élève n’est dans aucun de vos groupes.');
      }
      await ecrire('profils', `id=eq.${eleve}`, { actif: false });
      return res.status(200).json({
        ok: true,
        message: `Le compte de ${cible.prenom ?? ''} ${cible.nom ?? ''} est `
          + `désactivé. Ses travaux sont conservés, et la réinscription le `
          + `réactive. Attention : cela vaut pour TOUS ses groupes, y compris `
          + `ceux de vos collègues.`,
      });
    }

    if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, 'Ce groupe n’est pas l’un des vôtres.');
    }

    await ecrire('appartenances',
      `profil_id=eq.${eleve}&groupe_id=eq.${groupe}`, {}, 'DELETE');

    res.status(200).json({
      ok: true,
      message: `${cible.prenom ?? ''} ${cible.nom ?? ''} ne fait plus partie `
        + `de ce groupe. Son compte et ses travaux sont conservés.`,
    });
  } catch (e) {
    console.error('desinscrire :', e.message);
    refus(res, 500, 'Le retrait n’a pas abouti.');
  }
}
