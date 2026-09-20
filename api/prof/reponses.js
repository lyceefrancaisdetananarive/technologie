import { appelant, possedeGroupe, reArmer } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import { UUID } from '../_lib/progression.js';

// =====================================================================
// LES RÉPONSES D'UN GROUPE DANS LES FICHES, ET LEUR CORRECTION (D16 point
// f, puis fiche interactive du 20 septembre 2026).
//
//   GET   ?groupe=ID
//         toutes les lignes du groupe avec l'élève, triées page, élève,
//         question ; et `fiches`, une entrée par (élève, page) agrégée ici,
//         pour que la page de correction n'ait pas à regrouper elle-même.
//   PATCH {fiche: {profil, page}, correction, commentaires?}
//         la correction GLOBALE de la fiche (obligatoire), posée sur la
//         ligne 'fiche', qui fige tous les champs de la page ; et, en
//         option, un commentaire par champ (colonne correction de la ligne
//         du champ). corrige_le est posé en même temps sur chaque champ
//         déjà écrit : c'est ce qui rend atomique le filtre
//         corrige_le=is.null des écritures de l'élève (course entre sa
//         frappe et la correction), comme la section 1 du cahier des
//         charges le permet.
//   PATCH {fiche: {profil, page}, annuler: true}
//         retire la correction et les commentaires de toute la page :
//         l'élève peut de nouveau écrire.
//   PATCH {reponse: ID, correction} et {reponse: ID, annuler: true}
//         conservés tels quels : une réponse libre seule (fiche d'avant le
//         20 septembre), ou le commentaire d'un champ isolé.
//
// PAS D'EFFACEMENT PAR LE PROFESSEUR. Le geste effacerMot de corriger.js
// vide un champ facultatif ; ici le texte EST le travail, et le travail
// d'un mineur ne disparaît pas par un bouton (règle de supprimer-depot.js).
// Si un texte doit vraiment disparaître, cela relève d'une demande écrite.
// L'élève, lui, supprime ses propres lignes tant que la fiche n'est pas
// corrigée.
//
// Le groupe doit être L'UN DES MIENS (possedeGroupe) : même cloisonnement
// que rendus.js et corriger.js, vérifié sur les lignes elles-mêmes, jamais
// sur un groupe que le navigateur nommerait. Chaque écriture réarme la
// session.
// =====================================================================

const MAX = 4000;
const FICHE = 'fiche';
const LIBRE = 'reponse';
// Même motif que api/classeur/reponse.js : une clé de champ (zone, trou, case).
const CLE = /^(?:[zb]\d{1,3}|t\d{1,2}-r\d{1,3}-c\d{1,2})$/;
const PAGE = /^[345]eme\/p[1-5]\/seq\d{1,2}-(activite|ebep)\.html$/;
const COLONNES = 'id,page,question,texte,intitule,redige_le,modifie_le,correction,corrige_le,profil_id';

/**
 * Tronqué en caractères (Array.from), pas en unités UTF-16 : un emoji
 * coupé en deux serait refusé par la base et la correction perdue.
 */
const nettoyer = (t) => Array.from(String(t ?? '').replace(/\r\n?/g, '\n').trim())
  .slice(0, MAX).join('');

/**
 * Les fiches d'un groupe : une entrée par (élève, page), à partir des
 * lignes. L'état vient de la ligne 'fiche' quand elle existe ; sans elle,
 * une réponse libre seule est « libre », corrigée ou non selon sa propre
 * ligne (les fiches d'avant le 20 septembre n'ont que cette ligne).
 * nb_champs compte les CHAMPS DE LA FICHE (zones, cases, trous), comme la
 * barre de la fiche côté élève ; ni la ligne d'état ni le bloc libre, que
 * `libre` signale à part. Les fiches non corrigées viennent en tête, puis
 * les plus récentes.
 */
export function agregerFiches(lignes) {
  const parCle = new Map();
  for (const l of lignes) {
    const cle = `${l.profil_id}\n${l.page}`;
    let f = parCle.get(cle);
    if (!f) {
      f = {
        profil_id: l.profil_id, prenom: l.profils?.prenom ?? null, nom: l.profils?.nom ?? null,
        page: l.page, etat: 'en cours', corrige_le: null, correction: null,
        modifie_le: null, nb_champs: 0, libre: false, ids: [], _fiche: null, _libre: null,
      };
      parCle.set(cle, f);
    }
    f.ids.push(l.id);
    if (!f.modifie_le || String(l.modifie_le) > String(f.modifie_le)) f.modifie_le = l.modifie_le;
    if (l.question === FICHE) f._fiche = l;
    else if (l.question === LIBRE) { f.libre = true; f._libre = l; }
    else f.nb_champs += 1;
  }
  const fiches = [];
  for (const f of parCle.values()) {
    const porteuse = f._fiche ?? f._libre;
    if (porteuse) {
      f.corrige_le = porteuse.corrige_le ?? null;
      f.correction = porteuse.correction ?? null;
    }
    if (f.corrige_le) f.etat = 'corrigee';
    else if (f._fiche) f.etat = f._fiche.texte === 'terminee' ? 'terminee' : 'en cours';
    else if (f._libre && f.nb_champs === 0) f.etat = 'libre';
    delete f._fiche; delete f._libre;
    fiches.push(f);
  }
  fiches.sort((a, b) => (a.etat === 'corrigee') - (b.etat === 'corrigee')
    || String(b.modifie_le).localeCompare(String(a.modifie_le)));
  return fiches;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return refus(res, 405, 'Méthode non autorisée.');
  }
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (req.method === 'PATCH' && !origineLegitime(req)) {
    return refus(res, 403, 'Origine non autorisée.');
  }
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  try {
    // ---- La liste du groupe ---------------------------------------------
    if (req.method === 'GET') {
      const groupe = String(req.query?.groupe ?? '');
      if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
      if (!(await possedeGroupe(moi.id, groupe))) {
        return refus(res, 403, "Ce groupe n'est pas le vôtre.");
      }
      // L'embed profils(...) n'est possible sans ambiguïté que parce que
      // reponses n'a qu'une clé étrangère vers profils (pas de prof_id).
      const reponses = await lire('reponses',
        `groupe_id=eq.${groupe}&select=${COLONNES},profils(id,prenom,nom)` +
        '&order=page,profil_id,question');
      const fiches = agregerFiches(reponses);
      return res.status(200).json({
        ok: true, reponses, fiches,
        // Une fiche vide (ligne d'état seule, tous les champs effacés) n'a
        // rien à corriger ; un bloc libre seul, si (même règle que plan.js).
        a_corriger: fiches.filter((f) => f.etat !== 'corrigee' && (f.nb_champs > 0 || f.libre)).length,
      });
    }

    const { reponse, correction, annuler, commentaires } = req.body ?? {};

    // ---- Une fiche entière ----------------------------------------------
    if (req.body?.fiche && typeof req.body.fiche === 'object') {
      const profil = String(req.body.fiche.profil ?? '');
      const page = String(req.body.fiche.page ?? '');
      if (!UUID.test(profil) || !PAGE.test(page)) return refus(res, 400, 'Fiche non précisée.');
      const surPage = `profil_id=eq.${profil}&page=eq.${encodeURIComponent(page)}`;
      const lignes = await lire('reponses', `${surPage}&select=id,question,groupe_id,corrige_le`);
      if (!lignes.length) return refus(res, 404, 'Fiche introuvable.');
      // Toutes les lignes d'une page sont du même groupe (celui de l'élève
      // au moment de l'écriture) ; chaque groupe rencontré doit être le mien.
      for (const g of new Set(lignes.map((l) => l.groupe_id))) {
        if (!(await possedeGroupe(moi.id, g))) {
          return refus(res, 403, "Cette fiche n'a pas été remplie dans l'un de vos groupes.");
        }
      }
      const ligneFiche = lignes.find((l) => l.question === FICHE) ?? null;
      const champs = lignes.filter((l) => l.question !== FICHE);

      // RETIRER LA CORRECTION : sur la ligne d'état ET sur chaque champ, le
      // bloc libre compris. Même recours que pour les dépôts : un clic par
      // mégarde sur « Enregistrer » figeait la fiche pour toujours.
      if (annuler) {
        await ecrire('reponses', surPage, { correction: null, corrige_le: null });
        if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
        return res.status(200).json({ ok: true, annule: true, fiche: { profil_id: profil, page } });
      }

      const texte = nettoyer(correction);
      if (!texte) {
        return refus(res, 400,
          'Écrivez une correction. Pour retirer une correction déjà enregistrée, '
          + 'utilisez « Retirer la correction ».');
      }
      const quand = new Date().toISOString();
      const seuleLibre = !ligneFiche && champs.length === 1 && champs[0].question === LIBRE;
      // LES CHAMPS D'ABORD, puis la ligne d'état. L'élève relit la ligne
      // 'fiche' après chaque écriture et défait la sienne si elle est
      // corrigée ; poser corrige_le sur les champs avant la fiche fait que
      // sa mise à jour d'un champ existant (filtrée par corrige_le=is.null)
      // n'écrit plus rien dès cet instant. Seuls les champs encore libres
      // sont touchés : une correction isolée antérieure garde sa date.
      const aFiger = champs.filter((c) => !c.corrige_le && !(seuleLibre && c.question === LIBRE)).map((c) => c.id);
      if (aFiger.length) {
        await ecrire('reponses', `id=in.(${aFiger.join(',')})&corrige_le=is.null`, { corrige_le: quand });
      }
      if (ligneFiche) {
        await ecrire('reponses', `id=eq.${ligneFiche.id}`, { correction: texte, corrige_le: quand });
      } else if (seuleLibre) {
        // Fiche d'avant le 20 septembre : la correction reste sur le bloc
        // libre, comme la page de l'élève la lit.
        await ecrire('reponses', `id=eq.${champs[0].id}`, { correction: texte, corrige_le: quand });
      } else {
        // Des champs sans ligne d'état (elle a été effacée) : on la recrée,
        // terminée puisque corrigée. Un doublon (l'élève vient de la
        // recréer) se rattrape en la corrigeant.
        try {
          await ecrire('reponses', '', {
            profil_id: profil, groupe_id: champs[0].groupe_id, page, question: FICHE,
            texte: 'terminee', redige_le: quand, modifie_le: quand,
            correction: texte, corrige_le: quand,
          }, 'POST');
        } catch (e) {
          if (e.code !== '23505' && e.statut !== 409) throw e;
          await ecrire('reponses', `${surPage}&question=eq.${FICHE}`,
            { correction: texte, corrige_le: quand });
        }
      }

      // LES COMMENTAIRES PAR CHAMP : seulement sur des lignes que l'élève a
      // écrites (une clé inconnue est ignorée, jamais créée) ; le bloc
      // libre d'une fiche à champs se commente aussi. Sur une réponse libre
      // SEULE, la colonne correction de cette ligne porte déjà la
      // correction globale : un commentaire 'reponse' l'écraserait, il est
      // ignoré. Un texte vide retire le commentaire.
      const poses = {};
      if (commentaires && typeof commentaires === 'object' && !Array.isArray(commentaires)) {
        for (const [q, t] of Object.entries(commentaires)) {
          if (!CLE.test(q) && q !== LIBRE) continue;
          if (seuleLibre && q === LIBRE) continue;
          const l = champs.find((c) => c.question === q);
          if (!l) continue;
          const mot = nettoyer(t) || null;
          await ecrire('reponses', `id=eq.${l.id}`, { correction: mot });
          poses[q] = mot;
        }
      }

      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({
        ok: true,
        fiche: { profil_id: profil, page, etat: 'corrigee', correction: texte, corrige_le: quand },
        commentaires: poses,
      });
    }

    // ---- Une ligne isolée : corriger, ou retirer la correction ----------
    const id = String(reponse ?? '');
    if (!UUID.test(id)) return refus(res, 400, 'Réponse non précisée.');

    const r = (await lire('reponses', `id=eq.${id}&select=id,profil_id,groupe_id,page,question`))[0];
    if (!r) return refus(res, 404, 'Réponse introuvable.');
    if (!(await possedeGroupe(moi.id, r.groupe_id))) {
      return refus(res, 403, "Cette réponse n'a pas été rédigée dans l'un de vos groupes.");
    }

    // RETIRER UNE CORRECTION : même recours que pour les dépôts. Un clic par
    // mégarde sur « Enregistrer » figeait la réponse pour toujours. Sur la
    // ligne 'fiche', c'est la correction globale que l'on retire : toute la
    // page est libérée, commentaires compris, comme par {fiche, annuler} ;
    // sinon l'élève reverrait des commentaires sur une fiche non corrigée.
    if (annuler) {
      const cible = r.question === FICHE
        ? `profil_id=eq.${r.profil_id}&page=eq.${encodeURIComponent(r.page)}`
        : `id=eq.${id}`;
      await ecrire('reponses', cible, { correction: null, corrige_le: null });
      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({ ok: true, annule: true });
    }

    const texte = nettoyer(correction);
    if (!texte) {
      return refus(res, 400,
        'Écrivez une correction. Pour retirer une correction déjà enregistrée, '
        + 'utilisez « Retirer la correction ».');
    }
    const quand = new Date().toISOString();
    await ecrire('reponses', `id=eq.${id}`, { correction: texte, corrige_le: quand });

    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    res.status(200).json({ ok: true, reponse: { id, correction: texte, corrige_le: quand } });
  } catch (e) {
    console.error('reponses prof :', e.message);
    refus(res, 500, req.method === 'GET'
      ? 'Lecture impossible.'
      : "La correction n'a pas été enregistrée.");
  }
}
