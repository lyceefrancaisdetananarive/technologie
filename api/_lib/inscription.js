// =====================================================================
// Créer ou rattacher une personne : le même geste pour l'inscription à la
// main (api/prof/inscrire.js) et pour l'import d'une liste
// (api/prof/importer.js). Un seul endroit à relire, un seul à corriger.
// =====================================================================

import { enseigneA } from './autorisation.js';
import { lire, ecrire, creerUtilisateur, utilisateurParEmail } from './supabase.js';

/**
 * Crée le compte, le profil et, pour un élève, l'inscription au groupe.
 * Renvoie { ok: true } ou { ok: false, statut, message }.
 *
 * L'ORDRE DES ÉCRITURES. Pas de transaction : trois appels HTTP sur une
 * liaison qui coupe. Chaque préfixe doit être un état sûr.
 *   compte seul        -> la personne ne peut pas se connecter, la connexion
 *                         lit profils en premier et ne trouve rien. Relancer
 *                         l'inscription répare.
 *   compte + profil    -> elle se connecte et voit un classeur vide.
 *   les trois          -> état final.
 * Aucun de ces états n'accorde quoi que ce soit indûment.
 *
 * AUCUN MOT DE PASSE N'EST FABRIQUÉ NI TRANSMIS : le compte naît avec un mot
 * de passe aléatoire que personne ne lit, et son titulaire passe par
 * « Première connexion » pour choisir le sien.
 */
export async function creerOuRattacher({ moi, email, nom, prenom, role, groupe }) {
  let idAuth = await utilisateurParEmail(email);
  if (!idAuth) idAuth = await creerUtilisateur(email);
  if (!idAuth) idAuth = await utilisateurParEmail(email);   // course
  if (!idAuth) return { ok: false, statut: 500, message: 'Le compte n’a pas pu être créé.' };

  try {
    await ecrire('profils', '', {
      id: idAuth, email, role, nom: nom || null, prenom: prenom || null,
      actif: true, mdp_provisoire: true, mdp_pose_le: null,
    }, 'POST');
  } catch (e) {
    // Doublon reconnu par le SQLSTATE de PostgREST, jamais en cherchant
    // « 409 » dans une chaîne : le corps d'une autre erreur pouvait contenir
    // ce nombre, et l'inscription rapportait un succès là où rien n'avait
    // été écrit.
    if (e.code !== '23505' && e.statut !== 409) throw e;

    // LA PERSONNE EXISTE DÉJÀ, ET ELLE N'EST PEUT-ÊTRE PAS À MOI.
    //
    // Réécrire ici role, actif, nom et prenom permettrait de réactiver,
    // renommer, et surtout RÉTROGRADER quelqu'un hors de son périmètre :
    // réinscrire l'adresse d'un collègue retiré de PROFS_TECHNO le ferait
    // passer de professeur à élève, orphelinant tous ses groupes.
    //
    // On ne touche donc aux champs globaux que dans deux cas légitimes : un
    // élève que j'inscris dans mon propre groupe (je l'encadre dès lors), ou
    // une adresse entrée dans la liste des professeurs. Jamais de
    // rétrogradation.
    const existant = (await lire('profils', `id=eq.${idAuth}&select=role,actif`))[0];
    if (existant?.role === 'prof' && role === 'eleve') {
      return {
        ok: false, statut: 409,
        message: 'Cette adresse porte un compte professeur. Pour la '
          + 'rétrograder, transférez d’abord ses groupes à un collègue : la '
          + 'réinscription ne doit pas le faire en silence.',
      };
    }
    if (existant?.role === 'eleve' && role === 'prof') {
      // L'adresse est entrée dans PROFS_TECHNO et l'appelant a ressaisi son
      // mot de passe : le compte monte en professeur, et le rôle annoncé est
      // celui écrit en base. roleTenable() continue de surveiller la liste.
      await ecrire('profils', `id=eq.${idAuth}`, {
        role: 'prof', actif: true,
        ...(nom ? { nom } : {}), ...(prenom ? { prenom } : {}),
      });
      return { ok: true, id: idAuth, nouveau: false };
    }
    // Un élève que j'inscris dans MON groupe (l'appelant a vérifié
    // possedeGroupe) est un élève que j'encadre : la réinscription réactive
    // et met le nom à jour, comme desinscrire.js le promet. L'ancienne
    // condition regardait enseigneA() AVANT l'inscription au groupe, donc
    // jamais vraie pour un élève venu d'un collègue.
    if ((role === 'eleve' && groupe) || await enseigneA(moi.id, idAuth)) {
      await ecrire('profils', `id=eq.${idAuth}`, {
        actif: true,
        ...(nom ? { nom } : {}), ...(prenom ? { prenom } : {}),
      });
    }
    if (role === 'eleve') {
      await ecrire('appartenances', '',
        { profil_id: idAuth, groupe_id: groupe }, 'POST').catch((e) => {
          if (e.code !== '23505' && e.statut !== 409) throw e;   // déjà inscrit
        });
    }
    return { ok: true, id: idAuth, nouveau: false };
  }

  if (role === 'eleve') {
    await ecrire('appartenances', '',
      { profil_id: idAuth, groupe_id: groupe }, 'POST').catch((e) => {
        if (e.code !== '23505' && e.statut !== 409) throw e;   // déjà inscrit
      });
  }
  return { ok: true, id: idAuth, nouveau: true };
}
