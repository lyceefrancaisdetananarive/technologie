import { appelant, gereGroupe, gereEleve } from '../_lib/autorisation.js';
import { journaliser } from '../_lib/journal.js';
import {
  lire, ecrire, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// =====================================================================
// RETIRER UN ÉLÈVE D'UN GROUPE, OU LE METTRE À LA CORBEILLE.
//
// CE QUE CE POINT D'ENTRÉE NE FAIT PAS : supprimer un compte d'élève. Le
// travail déposé est lié au profil ; effacer le profil effacerait les rendus
// en cascade (db/01-schema.sql, on delete cascade). Le travail d'un mineur
// ne disparaît pas d'un clic de professeur. La suppression définitive est
// un geste à part, réservé au coordonnateur, avec ressaisie de son mot de
// passe, et seulement depuis la corbeille : api/prof/eleve.js (décision D16).
//
// Deux gestes, de gravité très différente, et c'est volontaire :
//
//  · RETIRER DU GROUPE : réversible, sans perte. L'élève change de groupe,
//    ou n'aurait pas dû y être. Ses dépôts restent, et le professeur du
//    groupe où il est vraiment continue de les voir.
//
//  · METTRE À LA CORBEILLE (désactiver) : le compte ne se connecte plus,
//    mais tout est conservé, et « restaurer » le rétablit tel quel. C'est
//    ce que fait le bouton « supprimer » d'un professeur : jamais plus.
//
// Le coordonnateur peut faire les deux gestes sur n'importe quel groupe.
// =====================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  // appelant() relit le profil en base et revérifie le rôle professeur
  // contre PROFS_TECHNO à chaque appel.
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Action réservée aux professeurs.');

  const eleve = String(req.body?.eleve ?? '').trim();
  const groupe = String(req.body?.groupe ?? '').trim();
  const desactiver = Boolean(req.body?.desactiver);

  if (!UUID.test(eleve)) return refus(res, 400, 'Élève non précisé.');

  try {
    if (eleve === moi.id) {
      return refus(res, 400, 'Vous ne pouvez pas vous retirer vous-même.');
    }

    const cible = (await lire('profils',
      `id=eq.${eleve}&select=id,role,prenom,nom`))[0];
    if (!cible) return refus(res, 404, 'Personne introuvable.');
    if (cible.role !== 'eleve') {
      // Un professeur ne se retire pas depuis cette page. Le message précédent
      // prescrivait de modifier PROFS_TECHNO « et c'est tout » : c'était FAUX
      // au moment où il a été écrit, la liste n'étant alors consultée qu'à
      // l'admission. Elle est désormais vérifiée à chaque appel, donc le
      // retrait révoque bien l'accès, mais il laisse les groupes du partant
      // sans professeur, et cela, aucune page ne le répare.
      return refus(res, 403,
        'Un professeur ne se retire pas ici. Retirez son adresse de la liste '
        + 'PROFS_TECHNO, ce qui lui ferme l’accès dès sa requête suivante, '
        + 'puis transférez ses groupes à un collègue : sans cela ils restent '
        + 'à son nom et leurs élèves deviennent invisibles à tous.');
    }

    if (desactiver) {
      // La corbeille touche TOUS les groupes, y compris ceux de collègues :
      // on exige donc d'enseigner à cet élève (ou d'être coordonnateur), et
      // on le dit dans la réponse.
      if (!(await gereEleve(moi, eleve))) {
        return refus(res, 403, 'Cet élève n’est dans aucun de vos groupes.');
      }
      await ecrire('profils', `id=eq.${eleve}`, { actif: false });
      await journaliser(moi.id, 'compte.desactive', eleve);
      return res.status(200).json({
        ok: true,
        message: `${cible.prenom ?? ''} ${cible.nom ?? ''} est dans la corbeille : `
          + `le compte ne se connecte plus, ses travaux et ses groupes sont `
          + `conservés, et « restaurer » le rétablit tel quel. Cela vaut pour `
          + `TOUS ses groupes, y compris ceux de vos collègues. Seul le `
          + `coordonnateur peut supprimer définitivement un compte.`,
      });
    }

    if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
    if (!(await gereGroupe(moi, groupe))) {
      return refus(res, 403, 'Ce groupe n’est pas l’un des vôtres.');
    }

    await ecrire('appartenances',
      `profil_id=eq.${eleve}&groupe_id=eq.${groupe}`, {}, 'DELETE');
    await journaliser(moi.id, 'compte.retire', eleve, groupe);

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
