import { appelant, sesGroupes } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import { sequenceDuCatalogue } from '../_lib/progression.js';
import { journaliser } from '../_lib/journal.js';

// =====================================================================
// LES RÉPONSES D'UN ÉLÈVE DANS UNE FICHE D'ACTIVITÉ (D16 point f, puis
// fiche interactive du 20 septembre 2026).
//
// Une fiche s'identifie par le chemin de la page tel que le catalogue
// l'écrit : 5eme/p1/seq1-activite.html. Rien n'est écrit pour un visiteur
// sans session ni pour un professeur : la fiche reste publique, les champs
// ne parlent qu'à l'élève.
//
// Une ligne de la table reponses par (élève, page, question) :
//   'reponse'   le bloc libre « Ma réponse » au pied de la fiche ;
//   'fiche'     l'état de la fiche ('en cours' dès le premier champ,
//               'terminee' après « J'ai terminé ») et la correction globale
//               du professeur ;
//   'z3', 'b4', 't2-r3-c2'   un champ de la fiche (zone, trou, case), avec
//               son intitulé tel que la page l'affiche.
//
//   GET  ?page=…                      mes lignes (toutes, ou celles de
//                                     cette fiche) et l'état de la fiche.
//   POST {page, texte}                écrit ou remplace le bloc libre.
//   POST {page, question, texte, intitule}   écrit ou remplace un champ ;
//                                     un texte vide efface le champ (l'élève
//                                     a vidé la case), sans erreur.
//   POST {page, fini: true}           « J'ai terminé » : la fiche passe à
//                                     'terminee'.
//   DELETE {page}                     supprime le bloc libre.
//   DELETE {page, question}           supprime ce champ.
//
// Chaque écriture renvoie le prénom du compte, pour qu'un élève sur un poste
// partagé voie dans quel classeur son texte vient d'être rangé.
//
// GEL PAR LA FICHE : dès que le professeur a posé sa correction globale
// (corrige_le sur la ligne 'fiche'), TOUTE écriture sur cette page est
// refusée (409), bloc libre compris : sinon un élève pourrait réécrire ses
// réponses après avoir lu la correction. Une ligne isolée qui porte son
// propre corrige_le (ancienne correction du bloc libre, commentaire figé
// d'un champ) est refusée de la même façon.
//
// LE GROUPE EST DÉDUIT ICI, JAMAIS ENVOYÉ PAR LE NAVIGATEUR : c'est le
// groupe de l'élève, pour l'année la plus récente, dont le niveau est celui
// de la fiche. Un élève sans groupe et un élève d'un autre niveau reçoivent
// deux messages distincts : le premier jour, les comptes existent avant les
// inscriptions, et « pas de ton niveau » serait faux et désorientant.
//
// L'INTITULÉ EST DU TEXTE BRUT que le navigateur envoie : il ne sert qu'à
// l'affichage (textContent) dans les classeurs, jamais à retrouver un
// élément de la page ni à décider quoi que ce soit. La clé du champ, elle,
// est vérifiée par motif.
// =====================================================================

const PAGE = /^([345]eme)\/(p\d)\/(seq\d{1,2})-(activite|ebep)\.html$/;
const LIBRE = 'reponse';      // le bloc libre au pied de la fiche
const FICHE = 'fiche';        // la ligne d'état de la fiche
// Une clé de champ : zone (z3), trou (b4) ou case de tableau (t2-r3-c2).
const CLE = /^(?:[zb]\d{1,3}|t\d{1,2}-r\d{1,3}-c\d{1,2})$/;
const MAX = 4000;
const MAX_INTITULE = 200;
const FIGEE = 'Ton professeur a corrigé cette fiche : elle ne se modifie plus.';

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

/** Un texte d'élève normalisé : retours à la ligne Unix, bords rognés, plafonné. */
const nettoyer = (t, n = MAX) => tronquer(String(t ?? '').replace(/\r\n?/g, '\n').trim(), n);

const COLONNES = 'id,page,question,texte,intitule,redige_le,modifie_le,correction,corrige_le';

/** La ligne telle que le navigateur la reçoit (jamais le groupe_id brut). */
function exposer(l) {
  if (!l) return null;
  return {
    id: l.id, page: l.page, question: l.question, texte: l.texte,
    intitule: l.intitule ?? null, redige_le: l.redige_le ?? null,
    modifie_le: l.modifie_le ?? null,
    correction: l.correction ?? null, corrige_le: l.corrige_le ?? null,
  };
}

/** L'état de la fiche pour le navigateur, ou null s'il n'y a pas de ligne 'fiche'. */
function etatFiche(f) {
  if (!f) return null;
  return {
    corrige: Boolean(f.corrige_le), corrige_le: f.corrige_le ?? null,
    correction: f.correction ?? null, texte: f.texte, modifie_le: f.modifie_le ?? null,
  };
}

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
      // L'état de la fiche n'a de sens que pour UNE page : sans filtre, le
      // classeur regroupe lui-même les lignes 'fiche' par page.
      const fiche = page ? reponses.find((r) => r.question === FICHE) ?? null : null;
      return res.status(200).json({
        ok: true, reponses, fiche: etatFiche(fiche), prenom: moi.prenom ?? null,
      });
    }

    const page = String(req.body?.page ?? '');
    const fiche = ficheDuCatalogue(page);
    if (!fiche) return refus(res, 400, 'Fiche inconnue.');

    // La question : le bloc libre par défaut, ou une clé de champ. Tout le
    // reste est refusé : la ligne 'fiche' n'est écrite que par ce serveur
    // (« J'ai terminé »), jamais nommée par le navigateur.
    const brute = req.body?.question;
    const fini = brute == null && req.body?.fini === true;
    const question = brute == null ? LIBRE : String(brute);
    if (question !== LIBRE && !CLE.test(question)) return refus(res, 400, 'Question inconnue.');
    const surPage = `profil_id=eq.${moi.id}&page=eq.${encodeURIComponent(page)}`;
    const cleDe = (q) => `${surPage}&question=eq.${q}`;

    // GEL PAR LA FICHE, avant toute écriture ou suppression. Cette lecture
    // ne suffit pas à elle seule : entre elle et l'écriture d'un champ
    // (trois ou quatre allers-retours), le professeur a pu corriger. Deux
    // garde-fous complètent : le filtre corrige_le=is.null de chaque
    // écriture (le professeur pose corrige_le sur les champs en même temps
    // que sur la fiche), et la relecture de la ligne 'fiche' APRÈS
    // l'écriture dans poser(), qui défait ce qui vient d'être écrit si la
    // fiche s'est figée entre-temps. groupe_id sert à faire suivre la
    // fiche quand l'élève a changé de groupe (voir plus bas) ; il ne sort
    // jamais vers le navigateur (exposer, etatFiche).
    let [ligneFiche] = await lire('reponses', `${cleDe(FICHE)}&select=${COLONNES},groupe_id`);
    if (ligneFiche?.corrige_le) return refus(res, 409, FIGEE);

    // ---- Retirer ma réponse, ou un champ --------------------------------
    if (req.method === 'DELETE') {
      const [existante] = await lire('reponses', `${cleDe(question)}&select=id,corrige_le`);
      if (!existante) return refus(res, 404, 'Aucune réponse à supprimer sur cette fiche.');
      if (existante.corrige_le) {
        return refus(res, 409, 'Cette réponse a déjà été corrigée : elle ne se supprime plus. Parles-en à ton professeur.');
      }
      const effacees = await ecrire('reponses', `id=eq.${existante.id}&corrige_le=is.null`, {}, 'DELETE');
      if (!effacees.length) {
        return refus(res, 409, 'Ton professeur vient de corriger cette réponse : elle ne se supprime plus.');
      }
      await journaliser(moi.id, 'reponse.supprimee', moi.id, existante.id);
      return res.status(200).json({
        ok: true, supprimee: true, question, fiche: etatFiche(ligneFiche), prenom: moi.prenom ?? null,
      });
    }

    // ---- Écrire : le texte, puis le groupe -------------------------------
    const texte = nettoyer(req.body?.texte);
    if (!fini && !texte && question === LIBRE) {
      return refus(res, 400, 'Écris ta réponse avant de l’envoyer.');
    }

    // Un champ vidé par l'élève disparaît, sans passer par le groupe : garder
    // une ligne vide serait refusé par la base (texte entre 1 et 4000) et
    // compterait pour une réponse dans le classeur du professeur.
    if (!fini && question !== LIBRE && !texte) {
      const effacees = await ecrire('reponses', `${cleDe(question)}&corrige_le=is.null`, {}, 'DELETE');
      if (!effacees.length) {
        const [restante] = await lire('reponses', `${cleDe(question)}&select=id`);
        if (restante) return refus(res, 409, FIGEE);
      }
      return res.status(200).json({
        ok: true, supprimee: true, question, ligne: null, fiche: etatFiche(ligneFiche),
        prenom: moi.prenom ?? null,
      });
    }

    const groupes = await sesGroupes(moi);
    if (!groupes.length) {
      return refus(res, 403, 'Tu n’es inscrit dans aucun groupe pour le moment : demande à ton professeur.');
    }
    // sesGroupes() met l'année la plus récente en tête : c'est elle qui
    // compte, comme pour les niveaux scellés dans le cookie (D16, point b).
    const annee = groupes[0].annee;
    const groupe = groupes.filter((g) => g.annee === annee).find((g) => g.niveau === fiche.niveau);
    if (!groupe) return refus(res, 403, 'Cette fiche n’est pas de ton niveau cette année.');

    // LA FICHE SUIT L'ÉLÈVE. Un élève transféré en cours d'année (db/11 ne
    // déplace pas les lignes de reponses) aurait sinon sa page répartie sur
    // deux groupes : l'ancien professeur et le nouveau recevraient tous
    // deux un 403 à la correction (chaque groupe rencontré doit être le
    // sien), et le nouveau ne verrait qu'une fiche partielle. Toute la page
    // est donc rapatriée dans le groupe courant dès qu'un champ s'écrit.
    if (ligneFiche && ligneFiche.groupe_id && ligneFiche.groupe_id !== groupe.id) {
      await ecrire('reponses', surPage, { groupe_id: groupe.id });
      ligneFiche.groupe_id = groupe.id;
    }

    const quand = new Date().toISOString();

    /**
     * Écrit ou remplace la ligne `q` de cette page. Un premier envoi
     * s'insère ; si deux envois se croisent (double clic, deux onglets) et
     * que l'insertion tombe en doublon, on relit et on remplace comme pour
     * un envoi suivant : aucun texte n'est perdu. Renvoie null si la ligne
     * s'est figée entre-temps (zéro ligne écrite par le filtre).
     *
     * COURSE AVEC LA CORRECTION. Pour une ligne autre que 'fiche', la
     * ligne 'fiche' est relue APRÈS l'écriture : si le professeur a corrigé
     * entre la vérification du gel et cette écriture, ce qui vient d'être
     * écrit est défait (la ligne créée est effacée, la ligne modifiée
     * retrouve son texte et sa date) et null est rendu, d'où un 409. Le
     * texte de l'élève reste dans son navigateur, rien n'est perdu ; la
     * fiche corrigée reste exactement celle que le professeur a lue.
     */
    async function poser(q, corps, valeurs) {
      let [existante] = await lire('reponses', `${cleDe(q)}&select=id,corrige_le,texte,modifie_le`);
      if (existante?.corrige_le) return null;
      let ecrite = null, creee = false;
      if (!existante) {
        try {
          [ecrite] = await ecrire('reponses', '', {
            profil_id: moi.id, groupe_id: groupe.id, page, question: q,
            redige_le: quand, modifie_le: quand, ...corps, ...valeurs,
          }, 'POST');
          creee = true;
        } catch (e) {
          if (e.code !== '23505' && e.statut !== 409) throw e;
          [existante] = await lire('reponses', `${cleDe(q)}&select=id,corrige_le,texte,modifie_le`);
          if (!existante || existante.corrige_le) return null;
        }
      }
      if (!creee) {
        [ecrite] = await ecrire('reponses',
          `id=eq.${existante.id}&corrige_le=is.null`, { ...valeurs, modifie_le: quand });
        if (!ecrite) return null;
      }
      if (q === FICHE) return ecrite;
      const [fiche] = await lire('reponses', `${cleDe(FICHE)}&select=id,corrige_le`);
      if (!fiche?.corrige_le) return ecrite;
      if (creee) await ecrire('reponses', `id=eq.${ecrite.id}`, {}, 'DELETE');
      else {
        await ecrire('reponses', `id=eq.${existante.id}`,
          { texte: existante.texte, modifie_le: existante.modifie_le });
      }
      return null;
    }

    // ---- « J'ai terminé » -----------------------------------------------
    if (fini) {
      ligneFiche = await poser(FICHE, {}, { texte: 'terminee' });
      if (!ligneFiche) return refus(res, 409, FIGEE);
      return res.status(200).json({
        ok: true, ligne: exposer(ligneFiche), fiche: etatFiche(ligneFiche),
        prenom: moi.prenom ?? null, groupe: groupe.code,
      });
    }

    // ---- Un champ de la fiche --------------------------------------------
    if (question !== LIBRE) {
      const intitule = tronquer(String(req.body?.intitule ?? '').replace(/\s+/g, ' ').trim(), MAX_INTITULE) || null;
      // La ligne d'état naît avec le premier champ : c'est elle que le
      // professeur corrige, et c'est elle qui compte dans « fiches à corriger ».
      if (!ligneFiche) ligneFiche = await poser(FICHE, { texte: 'en cours' }, {});
      if (!ligneFiche) return refus(res, 409, FIGEE);
      const ligne = await poser(question, {}, { texte, intitule });
      if (!ligne) return refus(res, 409, FIGEE);
      return res.status(200).json({
        ok: true, ligne: exposer(ligne), fiche: etatFiche(ligneFiche),
        prenom: moi.prenom ?? null, groupe: groupe.code,
      });
    }

    // ---- Le bloc libre « Ma réponse » ------------------------------------
    const ligne = await poser(LIBRE, {}, { texte });
    if (!ligne) {
      return refus(res, 409, 'Ton professeur vient de corriger cette réponse : elle ne se modifie plus.');
    }
    res.status(200).json({
      ok: true,
      // `reponse` est la forme que js/reponse.js lit depuis D16 ; `ligne` et
      // `fiche` sont la forme commune à toutes les écritures.
      reponse: {
        id: ligne.id, page, texte: ligne.texte, modifie_le: ligne.modifie_le,
        correction: ligne.correction ?? null, corrige_le: ligne.corrige_le ?? null,
      },
      ligne: exposer(ligne),
      fiche: etatFiche(ligneFiche),
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
