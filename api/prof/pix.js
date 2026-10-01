import { appelant, possedeGroupe, enseigneA, reArmer } from '../_lib/autorisation.js';
import { lire, ecrire, configuree, origineLegitime, refus } from '../_lib/supabase.js';
import { journaliser } from '../_lib/journal.js';
import { UUID } from '../_lib/progression.js';

// =====================================================================
// LE RELEVÉ PIX D'UN GROUPE, ET L'ARBITRAGE DES RAPPROCHEMENTS.
//
//   GET  ?groupe=<uuid>
//        les élèves du groupe, avec leur relevé Pix s'ils en ont un, et
//        ceux qui n'en ont pas. Les rapprochements REFUSÉS sont rendus
//        aussi : sans eux, on ne pourrait pas revenir sur un refus.
//   POST { eleve, appariement: 'confirme' | 'refuse' }
//        le professeur tranche. Dès lors, l'import n'y touche plus.
//
// POURQUOI UN ARBITRAGE EXISTE.
//
// Pix Orga n'expose aucun identifiant : le participant tape son nom, et il
// le tape mal. Le rapprochement est donc un pari, fait par outils/
// importer-pix.py dans la seule classe de l'élève. L'outil refuse de parier
// quand deux noms sont plausibles ; il reste de toute façon des cas où il a
// parié et s'est trompé. C'est à l'oeil humain de le voir, et il ne peut le
// voir que si le nom tapé dans Pix lui est montré. D'où cet écran.
//
// CE QUE CET APPEL NE SAIT PAS FAIRE, DÉLIBÉRÉMENT : créer un
// rapprochement. Choisir parmi les noms tapés dans une campagne suppose
// d'avoir la campagne sous les yeux, c'est-à-dire le fichier exporté. Ce
// travail-là se fait à l'import (`importer-pix.py --trancher`), une fois
// par relevé. Ici on ne fait que CONFIRMER ou ÉCARTER ce qui est en base :
// un écran de classe n'a pas à inventer des identités.
//
// Le geste EST journalisé, contrairement à celui de la version adaptée : un
// score Pix est un résultat scolaire, pas une donnée de santé, et savoir
// qui a écarté quel rapprochement est utile quand un élève conteste.
// =====================================================================

const TRANCHES = ['confirme', 'refuse'];

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
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  try {
    if (req.method === 'GET') return await lecture(req, res, moi);
    if (req.method === 'DELETE') return await oublier(req, res, moi);
    return await arbitrage(req, res, moi);
  } catch (e) {
    // La table peut ne pas exister encore (db/17-pix.sql non joué). Ce n'est
    // pas une panne du tableau de bord : on le dit, et l'écran le dira aussi.
    //
    // On teste le STATUT, pas le message : `ecrire` jette « écriture pix »
    // avec un accent, et `lire` « lecture pix » sans. Chercher la chaîne,
    // c'est le genre de filtre qui tombe en marche à la première relecture.
    const absente = e.statut === 404 || / pix : 404$/.test(e.message);
    // LE REPLI MUET EST RESERVE A LA LECTURE. Posé sur les deux méthodes, il
    // répondait « tout va bien » à une ÉCRITURE qui n'avait pas eu lieu :
    // l'écran affichait « Rapprochement écarté », le professeur passait à la
    // suite, et rien n'était en base. Un geste qui échoue doit le dire.
    if (absente && req.method === 'GET') {
      console.error('pix prof :', e.message);
      return res.status(200).json({ ok: true, indisponible: true, eleves: [] });
    }
    if (absente) {
      return refus(res, 503, "Le relevé Pix n'est pas en service : votre "
        + "décision n'a pas été enregistrée.");
    }
    console.error('pix prof :', e.message);
    return refus(res, 500, "Le relevé Pix n'a pas pu être lu.");
  }
}

async function lecture(req, res, moi) {
  const groupe = String(req.query?.groupe ?? '');
  if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
  if (!(await possedeGroupe(moi.id, groupe))) {
    return refus(res, 403, "Ce groupe n'est pas le vôtre.");
  }

  const liens = await lire('appartenances',
    `groupe_id=eq.${groupe}&select=profils!inner(id,nom,prenom,actif)`);
  const eleves = liens
    .map((l) => l.profils)
    .filter((p) => p && p.actif !== false)
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr')
      || String(a.prenom).localeCompare(String(b.prenom), 'fr'));
  if (!eleves.length) return res.status(200).json({ ok: true, eleves: [] });

  const releves = await lire('pix',
    `profil_id=in.(${eleves.map((e) => e.id).join(',')})`
    + '&select=profil_id,nom_pix,nom_pix_aussi,classe,score,certifiable,envoi,'
    + 'parcours,appariement,releve_le');
  const par = new Map(releves.map((r) => [r.profil_id, r]));

  res.status(200).json({
    ok: true,
    eleves: eleves.map((e) => {
      const r = par.get(e.id);
      return {
        id: e.id,
        nom: e.nom,
        prenom: e.prenom,
        pix: r ? {
          nomPix: r.nom_pix,
          nomPixAussi: r.nom_pix_aussi || null,
          classe: r.classe,
          score: r.score,
          certifiable: r.certifiable === true,
          envoi: r.envoi,
          parcours: r.parcours || {},
          appariement: r.appariement,
          releveLe: r.releve_le,
        } : null,
      };
    }),
  });
}

/**
 * OUBLIER UN RAPPROCHEMENT : supprimer la ligne, et rien d'autre.
 *
 * POURQUOI CE GESTE MANQUAIT. « Refusé » voulait dire « ce n'est pas lui »,
 * et l'import ne revenait plus jamais dessus : c'était le but. Mais cela
 * condamnait l'élève à rester sans relevé pour l'année, même le jour où Pix
 * livre enfin la bonne ligne, parce qu'il n'existait aucun moyen de revenir
 * en arrière. Un refus doit pouvoir s'annuler, sans quoi il n'est pas un
 * arbitrage, c'est une sentence.
 *
 * Supprimer la ligne plutôt qu'ajouter un troisième état : l'import repart
 * alors de zéro pour cet élève, exactement comme s'il n'avait jamais été vu.
 * Pas de colonne de plus, pas d'état de plus à comprendre.
 */
async function oublier(req, res, moi) {
  const eleve = String(req.body?.eleve ?? req.query?.eleve ?? '');
  if (!UUID.test(eleve)) return refus(res, 400, 'Élève non précisé.');
  if (!(await enseigneA(moi.id, eleve))) {
    return refus(res, 403, "Cet élève n'est pas dans vos groupes.");
  }
  const lignes = await ecrire('pix', `profil_id=eq.${eleve}`, {}, 'DELETE');
  const nom = Array.isArray(lignes) && lignes[0] ? lignes[0].nom_pix : null;
  if (!nom) return refus(res, 404, "Cet élève n'a pas de relevé Pix.");

  // Le journal garde le nom oublié : c'est tout ce qui restera de la ligne.
  await journaliser(moi.id, 'pix.oublie', eleve, `nom dans Pix : ${nom}`);
  res.status(200).json({ ok: true, oublie: nom });
}

async function arbitrage(req, res, moi) {
  const eleve = String(req.body?.eleve ?? '');
  const appariement = String(req.body?.appariement ?? '');
  if (!UUID.test(eleve)) return refus(res, 400, 'Élève non précisé.');
  if (!TRANCHES.includes(appariement)) {
    return refus(res, 400, 'Valeur attendue : confirme ou refuse.');
  }
  if (!(await enseigneA(moi.id, eleve))) {
    return refus(res, 403, "Cet élève n'est pas dans vos groupes.");
  }

  const lignes = await ecrire('pix', `profil_id=eq.${eleve}`, { appariement });
  if (!Array.isArray(lignes) || !lignes.length) {
    return refus(res, 404, "Cet élève n'a pas de relevé Pix à arbitrer.");
  }

  // Le journal garde la trace du geste, pas du score : la cible est l'élève,
  // le détail dit seulement sur quel nom tapé la décision a porté. C'est la
  // seule trace de CE QUI a été écarté, le jour où un élève le contestera.
  await journaliser(moi.id, appariement === 'refuse' ? 'pix.refuse' : 'pix.confirme',
                    eleve, `nom dans Pix : ${lignes[0].nom_pix}`);

  if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
  res.status(200).json({ ok: true, appariement });
}
