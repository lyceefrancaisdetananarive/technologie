import { appelant, sesGroupes } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import { sequenceDuCatalogue } from '../_lib/progression.js';
import { journaliser } from '../_lib/journal.js';

// =====================================================================
// LA RÉPONSE RÉDIGÉE D'UN ÉLÈVE AU PIED D'UNE FICHE (décision D16, point f).
//
// Une réponse par fiche d'activité (ou sa version adaptée), identifiée par
// le chemin de la page tel que le catalogue l'écrit : 5eme/p1/seq1-activite
// .html. Rien n'est écrit pour un visiteur sans session ni pour un
// professeur : la fiche reste publique, le bloc ne parle qu'à l'élève.
//
//   GET  ?page=…       mes réponses (toutes, ou celle de cette fiche)
//   POST {page, texte} écrit ou remplace ma réponse, tant qu'elle n'est
//                      pas corrigée ; renvoie le prénom du compte, pour
//                      qu'un élève sur un poste partagé voie dans quel
//                      classeur son texte vient d'être rangé.
//   DELETE {page}      supprime ma réponse, tant qu'elle n'est pas corrigée
//                      (parité avec supprimer-depot.js : un texte envoyé
//                      depuis le mauvais compte doit pouvoir être retiré).
//
// LE GROUPE EST DÉDUIT ICI, JAMAIS ENVOYÉ PAR LE NAVIGATEUR : c'est le
// groupe de l'élève, pour l'année la plus récente, dont le niveau est celui
// de la fiche. Un élève sans groupe et un élève d'un autre niveau reçoivent
// deux messages distincts : le premier jour, les comptes existent avant les
// inscriptions, et « pas de ton niveau » serait faux et désorientant.
// =====================================================================

const PAGE = /^([345]eme)\/(p\d)\/(seq\d{1,2})-(activite|ebep)\.html$/;
const QUESTION = 'reponse';   // une seule réponse par fiche en v1
const MAX = 4000;

/** La fiche du catalogue portant ce chemin, ou null si le chemin ment. */
function ficheDuCatalogue(page) {
  const m = PAGE.exec(String(page ?? ''));
  if (!m) return null;
  const s = sequenceDuCatalogue(`${m[1]}/${m[2]}/${m[3]}`);
  if (!s || s.documents?.[m[4]]?.fichier !== page) return null;
  return { niveau: m[1], sequence: s.id, doc: m[4] };
}

/**
 * Tronque en CARACTÈRES, pas en unités UTF-16 : slice() couperait un emoji
 * en deux, et PostgreSQL refuserait la moitié restante (22P02). La
 * contrainte char_length de la base compte comme Array.from.
 */
const tronquer = (t, n) => Array.from(t).slice(0, n).join('');

const COLONNES = 'id,page,question,texte,redige_le,modifie_le,correction,corrige_le';

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return refus(res, 405, 'Méthode non autorisée.');
  }
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (req.method !== 'GET' && !origineLegitime(req)) {
    return refus(res, 403, 'Origine non autorisée.');
  }
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'eleve') return refus(res, 403, 'Réservé aux élèves.');

  try {
    // ---- Mes réponses --------------------------------------------------
    if (req.method === 'GET') {
      const page = String(req.query?.page ?? '');
      const filtre = page ? `&page=eq.${encodeURIComponent(page)}` : '';
      const reponses = await lire('reponses',
        `profil_id=eq.${moi.id}${filtre}&select=${COLONNES},groupes(code)&order=modifie_le.desc`);
      return res.status(200).json({ ok: true, reponses, prenom: moi.prenom ?? null });
    }

    const page = String(req.body?.page ?? '');
    const fiche = ficheDuCatalogue(page);
    if (!fiche) return refus(res, 400, 'Fiche inconnue.');
    const cle = `profil_id=eq.${moi.id}&page=eq.${encodeURIComponent(page)}&question=eq.${QUESTION}`;

    // ---- Retirer ma réponse ---------------------------------------------
    if (req.method === 'DELETE') {
      const [existante] = await lire('reponses', `${cle}&select=id,corrige_le`);
      if (!existante) return refus(res, 404, 'Aucune réponse à supprimer sur cette fiche.');
      if (existante.corrige_le) {
        return refus(res, 409, 'Cette réponse a déjà été corrigée : elle ne se supprime plus. Parles-en à ton professeur.');
      }
      // Le filtre corrige_le=is.null est répété dans l'écriture : entre la
      // lecture et la suppression, le professeur a pu corriger.
      const effacees = await ecrire('reponses', `id=eq.${existante.id}&corrige_le=is.null`, {}, 'DELETE');
      if (!effacees.length) {
        return refus(res, 409, 'Ton professeur vient de corriger cette réponse : elle ne se supprime plus.');
      }
      await journaliser(moi.id, 'reponse.supprimee', moi.id, existante.id);
      return res.status(200).json({ ok: true, supprimee: true });
    }

    // ---- Écrire ou remplacer ma réponse ---------------------------------
    const texte = tronquer(String(req.body?.texte ?? '').replace(/\r\n?/g, '\n').trim(), MAX);
    if (!texte) return refus(res, 400, 'Écris ta réponse avant de l’envoyer.');

    const groupes = await sesGroupes(moi);
    if (!groupes.length) {
      return refus(res, 403, 'Tu n’es inscrit dans aucun groupe pour le moment : demande à ton professeur.');
    }
    // sesGroupes() met l'année la plus récente en tête : c'est elle qui
    // compte, comme pour les niveaux scellés dans le cookie (D16, point b).
    const annee = groupes[0].annee;
    const groupe = groupes.filter((g) => g.annee === annee).find((g) => g.niveau === fiche.niveau);
    if (!groupe) return refus(res, 403, 'Cette fiche n’est pas de ton niveau cette année.');

    const quand = new Date().toISOString();
    let [existante] = await lire('reponses', `${cle}&select=id,corrige_le`);
    if (existante?.corrige_le) {
      return refus(res, 409, 'Cette réponse a déjà été corrigée : elle ne se modifie plus.');
    }

    let ligne;
    if (!existante) {
      // Un premier envoi s'insère ; si deux envois se croisent (double clic,
      // deux onglets) et que l'insertion tombe en doublon, on relit et on
      // remplace comme pour un envoi suivant : aucun texte n'est perdu.
      try {
        [ligne] = await ecrire('reponses', '', {
          profil_id: moi.id, groupe_id: groupe.id, page, question: QUESTION,
          texte, redige_le: quand, modifie_le: quand,
        }, 'POST');
      } catch (e) {
        if (e.code !== '23505' && e.statut !== 409) throw e;
        [existante] = await lire('reponses', `${cle}&select=id,corrige_le`);
        if (!existante) throw e;
      }
    }
    if (!ligne) {
      // Le filtre corrige_le=is.null est répété dans l'écriture : entre la
      // lecture et l'écriture, le professeur a pu corriger. Zéro ligne
      // écrite veut dire « figée entre-temps ».
      [ligne] = await ecrire('reponses', `id=eq.${existante.id}&corrige_le=is.null`,
        { texte, modifie_le: quand });
      if (!ligne) {
        return refus(res, 409, 'Ton professeur vient de corriger cette réponse : elle ne se modifie plus.');
      }
    }
    res.status(200).json({
      ok: true,
      reponse: {
        id: ligne.id, page, texte: ligne.texte, modifie_le: ligne.modifie_le,
        correction: ligne.correction ?? null, corrige_le: ligne.corrige_le ?? null,
      },
      prenom: moi.prenom ?? null,
      groupe: groupe.code,
    });
  } catch (e) {
    console.error('reponse :', e.message);
    refus(res, 500, req.method === 'GET'
      ? 'Lecture impossible.'
      : 'La réponse n’a pas été enregistrée. Réessaie dans un instant : ton texte est toujours là.');
  }
}
