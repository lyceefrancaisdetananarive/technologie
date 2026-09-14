import {
  appelant, gereEleve, estCoordonnateur, ressaisieAutorisee, noterEchecRessaisie,
  FENETRE_MINUTES, reArmer,
} from '../_lib/autorisation.js';
import { journaliser } from '../_lib/journal.js';
import {
  lire, ecrire, configuree, origineLegitime, refus, verifierMotDePasse,
  listerFichiers, supprimerFichier, supprimerUtilisateur,
} from '../_lib/supabase.js';

// =====================================================================
// UN COMPTE D'ÉLÈVE : corriger son nom, le restaurer depuis la corbeille,
// ou le supprimer définitivement (décision D16, 14 septembre 2026).
//
//  · PATCH  { eleve, nom, prenom } : corriger une faute de saisie. Le
//    professeur de l'élève ou le coordonnateur. L'adresse ne se modifie pas
//    ici : c'est l'identifiant du compte, il vient d'EDUKA, et le changer
//    reviendrait à créer un autre compte.
//
//  · POST   { eleve, action: 'restaurer' } : sortir de la corbeille. Le
//    compte redevient actif, avec ses groupes et ses travaux intacts.
//
//  · DELETE { eleve, confirmation } : SUPPRESSION DÉFINITIVE. Réservée au
//    coordonnateur, avec ressaisie de son mot de passe, et seulement pour un
//    compte déjà à la corbeille : un professeur ne peut pas, même par
//    erreur, faire disparaître le classeur d'un élève en un clic. La base
//    efface les lignes en cascade ; les fichiers du bucket sont effacés ici,
//    avant le compte, pour ne rien laisser d'orphelin. Le geste est
//    journalisé avec l'adresse, seule trace qui subsiste du compte.
// =====================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (!['PATCH', 'POST', 'DELETE'].includes(req.method)) {
    return refus(res, 405, 'Méthode non autorisée.');
  }
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Action réservée aux professeurs.');

  const eleve = String(req.body?.eleve ?? '').trim();
  if (!UUID.test(eleve)) return refus(res, 400, 'Élève non précisé.');
  if (eleve === moi.id) return refus(res, 400, 'Ce compte est le vôtre.');

  try {
    const cible = (await lire('profils',
      `id=eq.${eleve}&select=id,email,role,actif,prenom,nom`))[0];
    if (!cible) return refus(res, 404, 'Personne introuvable.');
    if (cible.role !== 'eleve') {
      return refus(res, 403, 'Ce compte n’est pas celui d’un élève.');
    }
    if (!(await gereEleve(moi, eleve))) {
      return refus(res, 403, 'Cet élève n’est dans aucun de vos groupes.');
    }
    const qui = `${cible.prenom ?? ''} ${cible.nom ?? ''}`.trim();

    // ---- Corriger le nom ----------------------------------------------
    if (req.method === 'PATCH') {
      const nom = String(req.body?.nom ?? '').trim().slice(0, 80);
      const prenom = String(req.body?.prenom ?? '').trim().slice(0, 80);
      if (!nom || !prenom) return refus(res, 400, 'Nom et prénom requis.');
      if (/[;,\t\r\n<>]/.test(nom + prenom)) {
        return refus(res, 400, 'Le nom et le prénom ne contiennent ni ponctuation de liste ni chevrons.');
      }
      await ecrire('profils', `id=eq.${eleve}`, { nom, prenom });
      await journaliser(moi.id, 'compte.modifie', eleve);
      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({ ok: true, message: `Nom corrigé : ${prenom} ${nom}.` });
    }

    // ---- Restaurer depuis la corbeille --------------------------------
    if (req.method === 'POST') {
      if (req.body?.action !== 'restaurer') return refus(res, 400, 'Action inconnue.');
      if (cible.actif) return refus(res, 409, 'Ce compte n’est pas dans la corbeille.');
      await ecrire('profils', `id=eq.${eleve}`, { actif: true });
      await journaliser(moi.id, 'compte.restaure', eleve);
      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({
        ok: true,
        message: `${qui} est restauré : le compte se connecte de nouveau, avec ses groupes et ses travaux.`,
      });
    }

    // ---- Supprimer définitivement : coordonnateur, mot de passe, corbeille ---
    if (!estCoordonnateur(moi)) {
      return refus(res, 403,
        'Seul le coordonnateur peut supprimer définitivement un compte. '
        + 'Mettez l’élève à la corbeille : ses travaux sont conservés.');
    }
    if (cible.actif) {
      return refus(res, 409,
        'Mettez d’abord ce compte à la corbeille. La suppression définitive ne se fait que depuis la corbeille.');
    }
    const confirmation = String(req.body?.confirmation ?? '');
    if (!confirmation) return refus(res, 401, 'Retapez votre mot de passe pour confirmer.');
    if (!(await ressaisieAutorisee(moi.id))) {
      return refus(res, 429, `Trop d'essais. Réessayez dans ${FENETRE_MINUTES} minutes.`);
    }
    if (!(await verifierMotDePasse(moi.email, confirmation))) {
      await noterEchecRessaisie(moi.id);
      return refus(res, 401, 'Mot de passe incorrect.');
    }

    // Les fichiers d'abord : ils ne suivent pas la cascade de la base.
    const fichiers = await listerFichiers(cible.id);
    let effaces = 0;
    for (const chemin of fichiers) {
      if (await supprimerFichier(chemin)) effaces += 1;
    }
    if (effaces !== fichiers.length) {
      return refus(res, 500,
        `${effaces} fichier(s) sur ${fichiers.length} effacé(s) : le compte est conservé, relancez la suppression.`);
    }
    // Journalisé AVANT l'effacement : la cible disparaît avec le compte, et
    // journal.acteur est le coordonnateur, qui reste.
    await journaliser(moi.id, 'compte.supprime', eleve,
      `${cible.email} ; ${fichiers.length} fichier(s)`);
    if (!(await supprimerUtilisateur(cible.id))) {
      return refus(res, 500, 'Le compte n’a pas pu être supprimé. Ses fichiers l’ont été : relancez.');
    }
    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    return res.status(200).json({
      ok: true,
      message: `Le compte de ${qui} est supprimé définitivement, avec ${fichiers.length} fichier(s) et tout son classeur.`,
    });
  } catch (e) {
    console.error('eleve :', e.message);
    refus(res, 500, 'L’opération n’a pas abouti.');
  }
}
