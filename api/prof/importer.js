import {
  appelant, possedeGroupe, reArmer, comptesElevesOuverts, MESSAGE_VERROU,
} from '../_lib/autorisation.js';
import { configuree, origineLegitime, profsAutorises, refus } from '../_lib/supabase.js';
import { creerOuRattacher } from '../_lib/inscription.js';
import { lireLigne } from '../_lib/listes.js';
import { UUID } from '../_lib/progression.js';

// =====================================================================
// IMPORTER UNE LISTE D'ÉLÈVES À TROIS COLONNES DANS UN DE MES GROUPES.
//
// Décision D15, question 6 : un fichier par groupe (nom, prénom, adresse),
// jamais l'export complet d'EDUKA. Le navigateur envoie les LIGNES BRUTES du
// fichier, par paquets ; c'est le serveur qui les découpe et qui refuse
// toute ligne à plus de trois colonnes (api/_lib/listes.js). Un fichier qui
// porterait des dates de naissance ou des projets d'accompagnement ne passe
// donc pas, même si la page était contournée.
//
// L'IMPORT N'OUVRE QU'APRÈS LA POSITION DU DPO (décision 7) : le verrou
// COMPTES_ELEVES est décrit dans api/_lib/autorisation.js. Fermé, la fonction
// répond 403 et n'écrit rien.
//
// Paquets de douze lignes au plus : chaque élève coûte jusqu'à six appels
// à Supabase, et une fonction Vercel a dix secondes.
// =====================================================================

const MAX_LIGNES = 12;
const ORDRES = ['nom-prenom', 'prenom-nom'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  if (!comptesElevesOuverts()) return refus(res, 403, MESSAGE_VERROU);

  try {
    const groupe = String(req.body?.groupe ?? '');
    const lignes = Array.isArray(req.body?.lignes) ? req.body.lignes : null;
    // L'ordre nom / prénom se lit dans l'en-tête du fichier : la page le
    // transmet, le serveur ne fait confiance qu'aux deux valeurs connues.
    const ordre = ORDRES.includes(req.body?.ordre) ? req.body.ordre : 'nom-prenom';
    if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
    if (!lignes || !lignes.length) return refus(res, 400, 'Aucune ligne reçue.');
    if (lignes.length > MAX_LIGNES) {
      return refus(res, 400, `Au plus ${MAX_LIGNES} lignes par envoi.`);
    }
    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, 'Ce groupe n’est pas l’un des vôtres.');
    }

    const profs = profsAutorises();
    const resultats = [];
    for (const [i, brute] of lignes.entries()) {
      const l = lireLigne(String(brute ?? '').slice(0, 400), ordre);
      if (l.vide || l.entete) { resultats.push({ i, etat: 'ignoree' }); continue; }
      if (l.erreur) { resultats.push({ i, etat: 'refusee', message: l.erreur }); continue; }
      if (!l.email.endsWith('@eleve.egd.mg') && !l.email.endsWith('@egd.mg')) {
        resultats.push({ i, etat: 'refusee', email: l.email,
          message: 'seules les adresses de l’établissement sont acceptées' });
        continue;
      }
      // Une adresse de la liste des professeurs n'est pas un élève : on ne
      // la rétrograde pas, on ne l'inscrit pas, on le dit.
      if (profs.includes(l.email)) {
        resultats.push({ i, etat: 'refusee', email: l.email,
          message: 'cette adresse est celle d’un professeur : elle ne peut pas être inscrite comme élève' });
        continue;
      }
      try {
        const r = await creerOuRattacher({
          moi, email: l.email, nom: l.nom, prenom: l.prenom, role: 'eleve', groupe,
        });
        resultats.push(r.ok
          ? { i, etat: r.nouveau ? 'nouveau' : 'rattache', email: l.email }
          : { i, etat: 'refusee', email: l.email, message: r.message });
      } catch (e) {
        console.error('importer, ligne', i, ':', e.message);
        resultats.push({ i, etat: 'echec', email: l.email,
          message: 'erreur passagère du service : relancez l’import, cette ligne sera reprise' });
      }
    }

    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    res.status(200).json({ ok: true, resultats });
  } catch (e) {
    console.error('importer :', e.message);
    refus(res, 500, 'L’import n’a pas abouti. Les lignes déjà inscrites le restent.');
  }
}
