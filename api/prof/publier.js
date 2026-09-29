import { appelant, possedeGroupe, reArmer } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import { UUID, sequenceDuCatalogue } from '../_lib/progression.js';

// =====================================================================
// PUBLIER OU RETIRER UNE ÉVALUATION, POUR UN GROUPE (D21).
//
//   GET    ?groupe=ID              l'historique des ouvertures du groupe
//   POST   { groupe, sequence }    publier l'évaluation de cette séquence
//   DELETE { groupe, sequence }    la refermer
//
// FERMER N'EFFACE PAS (D21 bis). La ligne reste, avec `retire_le` et
// `retire_par` : savoir qu'une évaluation a été ouverte à 16 h 34 puis
// refermée à 16 h 47 vaut mieux que de constater qu'elle est fermée. Le
// verbe HTTP reste DELETE parce que c'est ce que le professeur fait, du
// point de vue de l'élève ; ce qui se passe en base est une mise à jour.
//
// Une évaluation publiée devient lisible par les élèves de CE groupe, et
// d'aucun autre. Le geste est daté et signé : `publie_le` et `par`.
//
// POURQUOI LE RETRAIT EXISTE, ET POURQUOI IL EST AUSSI SIMPLE QUE LA
// PUBLICATION. Un clic de trop sur « publier » ouvre une évaluation à
// vingt-huit élèves. Si le retrait demandait une confirmation, un mot de
// passe ou un détour, la réaction naturelle serait d'attendre, et pendant
// ce temps l'évaluation reste ouverte. Une erreur doit pouvoir se défaire
// plus vite qu'elle ne s'est faite.
//
// CE QUI N'EST PAS VÉRIFIÉ ICI, ET C'EST VOULU : que la séquence soit au
// plan du groupe, ou qu'elle ait commencé. Un professeur peut vouloir
// ouvrir une évaluation de rattrapage sur une séquence écartée, ou une
// évaluation de début d'année sur une séquence pas encore traitée. Le site
// n'a pas à arbitrer une décision pédagogique ; il vérifie seulement que la
// séquence existe et qu'elle porte bien une évaluation.
// =====================================================================

async function etatDuGroupe(groupe) {
  // Tout l'historique, fermetures comprises : l'écran du plan n'affiche que
  // les lignes ouvertes, mais la fiche d'un groupe pourra montrer le reste
  // sans nouvel appel.
  return lire('publications',
    `groupe_id=eq.${groupe}&document=eq.eval` +
    '&select=id,sequence,publie_le,par,retire_le,retire_par&order=publie_le.desc');
}

export default async function handler(req, res) {
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  try {
    if (req.method === 'GET') {
      const groupe = String(req.query?.groupe ?? '');
      if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
      if (!(await possedeGroupe(moi.id, groupe))) {
        return refus(res, 403, "Ce groupe n'est pas le vôtre.");
      }
      return res.status(200).json({ ok: true, publications: await etatDuGroupe(groupe) });
    }

    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return refus(res, 405, 'Méthode non autorisée.');
    }
    // Les écritures ne partent que du site : même règle que corriger.js.
    if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

    const { groupe, sequence } = req.body ?? {};
    if (!UUID.test(String(groupe ?? ''))) return refus(res, 400, 'Groupe non précisé.');
    const seq = String(sequence ?? '');
    const s = sequenceDuCatalogue(seq);
    if (!s) return refus(res, 400, 'Séquence inconnue.');
    if (!s.documents || !s.documents.eval) {
      return refus(res, 400, 'Cette séquence ne porte pas d’évaluation.');
    }
    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, "Ce groupe n'est pas le vôtre.");
    }

    const cleOuverte = `groupe_id=eq.${groupe}`
      + `&sequence=eq.${encodeURIComponent(seq)}`
      + '&document=eq.eval&retire_le=is.null';

    if (req.method === 'POST') {
      try {
        await ecrire('publications', '',
          { groupe_id: groupe, sequence: seq, document: 'eval', par: moi.id },
          'POST');
      } catch (e) {
        // 23505 : l'index partiel a refusé une seconde ouverture alors qu'une
        // est déjà en cours. C'est un double clic, pas une erreur : le
        // résultat voulu est déjà là. Toute autre faute remonte.
        if (e.code !== '23505') throw e;
      }
    } else {
      // On FERME la ligne ouverte, on ne la supprime pas. Si aucune n'est
      // ouverte, la mise à jour ne touche rien et c'est très bien : refermer
      // deux fois n'est pas une erreur.
      await ecrire('publications', cleOuverte,
        { retire_le: new Date().toISOString(), retire_par: moi.id });
    }
    if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
    res.status(200).json({ ok: true, publications: await etatDuGroupe(groupe) });
  } catch (e) {
    console.error('publier :', e.message);
    refus(res, 500, "L'opération n'a pas abouti.");
  }
}
