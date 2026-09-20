import { appelant, possedeGroupe, reArmer } from '../_lib/autorisation.js';
import {
  lire, ecrire, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';
import {
  UUID, planParDefaut, normaliserPlan, sequenceDuCatalogue,
} from '../_lib/progression.js';

// =====================================================================
// LE PLAN DE L'ANNÉE D'UN GROUPE, ET OÙ EN EST CHAQUE GROUPE.
//
// Décision 3 : chaque professeur réordonne, saute ou ajoute des séquences
// pour ses groupes. Le catalogue du site reste le plan proposé ; la table
// `plans` ne contient une ligne que pour les groupes dont le professeur a
// touché l'ordre. Tant qu'elle est vide pour un groupe, le plan du
// catalogue s'applique et la réponse le dit (personnalise: false).
//
//   GET  ?groupe=ID   tout ce qu'il faut à la page du plan : l'ordre, les
//                     séances cochées, les exceptions par élève, l'effectif.
//   GET               le résumé de TOUS mes groupes pour le tableau de bord :
//                     l'ordre et les coches, sans exception ni nom d'élève,
//                     et ce qui attend une correction (dépôts, réponses).
//   PUT  {groupe, plan: [{sequence, visible}]}   remplace l'ordre.
//   DELETE {groupe}   efface l'ordre personnalisé : retour au catalogue.
//
// Le groupe doit être L'UN DES MIENS (possedeGroupe) : un professeur ne lit
// ni ne modifie le plan d'un collègue, et c'est la même règle que le RLS
// pose en seconde barrière dans db/04-progression.sql.
// =====================================================================

const COLONNES_PLAN = 'sequence,position,visible';

/**
 * Une ligne de plan dont la séquence a quitté le catalogue (identifiant
 * renommé par outils/generer.py) n'est pas renvoyée : le navigateur ne
 * saurait ni l'afficher ni la réordonner, et elle rendrait le plan
 * impossible à enregistrer. Le prochain enregistrement la retire de la base.
 */
const auCatalogue = (lignes) => lignes.filter((p) => sequenceDuCatalogue(p.sequence));

/**
 * Le nombre de FICHES à corriger par groupe, à partir des lignes de
 * reponses (fiche interactive du 20 septembre 2026 ; même règle que
 * a_corriger dans api/prof/reponses.js). Une fiche est une paire (élève,
 * page) ; elle attend une correction quand :
 *   - sa ligne d'état (question = 'fiche') n'a pas de corrige_le et que
 *     l'élève y a écrit au moins un champ (une ligne d'état seule, tous les
 *     champs effacés, n'a rien à corriger) ;
 *   - ou, sans ligne d'état (fiche d'avant le 20 septembre), sa réponse
 *     libre (question = 'reponse') n'a pas de corrige_le.
 * Renvoie une Map groupe_id -> nombre, ou null si la lecture a échoué.
 */
export function fichesACorriger(lignes) {
  if (!lignes) return null;
  const parFiche = new Map();
  for (const l of lignes) {
    const cle = `${l.profil_id}\n${l.page}`;
    let f = parFiche.get(cle);
    if (!f) { f = { groupe_id: l.groupe_id, etat: null, libre: null, champs: 0 }; parFiche.set(cle, f); }
    if (l.question === 'fiche') f.etat = l;
    else {
      f.champs += 1;
      if (l.question === 'reponse') f.libre = l;
    }
  }
  const parGroupe = new Map();
  for (const f of parFiche.values()) {
    const attend = f.etat ? (!f.etat.corrige_le && f.champs > 0) : Boolean(f.libre && !f.libre.corrige_le);
    if (attend) parGroupe.set(f.groupe_id, (parGroupe.get(f.groupe_id) ?? 0) + 1);
  }
  return parGroupe;
}

export default async function handler(req, res) {
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (req.method !== 'GET' && !origineLegitime(req)) {
    return refus(res, 403, 'Origine non autorisée.');
  }

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  try {
    // ---- Le tableau de bord : tous mes groupes -------------------------
    if (req.method === 'GET' && !req.query?.groupe) {
      const groupes = await lire('groupes',
        `prof_id=eq.${moi.id}&select=id,code,libelle,niveau&order=code`);
      if (!groupes.length) return res.status(200).json({ ok: true, groupes: [] });
      const ids = groupes.map((g) => g.id).join(',');
      // Les deux compteurs « à corriger » (D16, point e) : les dépôts qui
      // portent un fichier et pas de corrige_le, et les FICHES à corriger
      // (une par élève et par page, voir fichesACorriger). Sans filtre de
      // plan ni d'appartenance : c'est ce que la page de correction montre.
      // Chaque lecture est protégée à part : une panne (table reponses pas
      // encore créée, liaison) donne null, jamais un tableau de bord qui
      // tombe.
      const [plans, coches, membres, depots, redigees] = await Promise.all([
        lire('plans', `groupe_id=in.(${ids})&select=groupe_id,${COLONNES_PLAN}&order=position`),
        lire('avancement', `groupe_id=in.(${ids})&select=groupe_id,sequence,seance`),
        lire('appartenances', `groupe_id=in.(${ids})&select=groupe_id`),
        lire('rendus', `groupe_id=in.(${ids})&fichier=not.is.null&corrige_le=is.null&select=groupe_id`)
          .catch(() => null),
        lire('reponses', `groupe_id=in.(${ids})&select=groupe_id,profil_id,page,question,corrige_le`)
          .catch(() => null),
      ]);
      const compter = (lignes, gid) => (lignes ? lignes.filter((l) => l.groupe_id === gid).length : null);
      const fiches = fichesACorriger(redigees);
      return res.status(200).json({
        ok: true,
        groupes: groupes.map((g) => {
          const perso = auCatalogue(plans.filter((p) => p.groupe_id === g.id)
            .map(({ groupe_id, ...p }) => p));
          return {
            ...g,
            effectif: membres.filter((m) => m.groupe_id === g.id).length,
            personnalise: perso.length > 0,
            plan: perso.length ? perso : planParDefaut(g.niveau),
            avancement: coches.filter((c) => c.groupe_id === g.id)
              .map(({ groupe_id, ...c }) => c),
            // null = « indisponible », que la page distingue de zéro.
            a_corriger: { depots: compter(depots, g.id), reponses: fiches ? (fiches.get(g.id) ?? 0) : null },
          };
        }),
      });
    }

    const groupe = String((req.method === 'GET' ? req.query?.groupe : req.body?.groupe) ?? '');
    if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, "Ce groupe n'est pas le vôtre.");
    }

    // ---- La page du plan : un groupe en détail --------------------------
    if (req.method === 'GET') {
      const [g, plan, avancement, exceptions, inscrits] = await Promise.all([
        lire('groupes', `id=eq.${groupe}&select=id,code,libelle,niveau,annee`),
        lire('plans', `groupe_id=eq.${groupe}&select=${COLONNES_PLAN}&order=position`),
        lire('avancement', `groupe_id=eq.${groupe}&select=sequence,seance,fait_le`),
        lire('exceptions',
          `groupe_id=eq.${groupe}&select=sequence,seance,profil_id,etat,le`),
        lire('appartenances',
          `groupe_id=eq.${groupe}&select=profils(id,prenom,nom)&order=profils(nom)`),
      ]);
      const perso = auCatalogue(plan);
      return res.status(200).json({
        ok: true,
        groupe: g[0],
        personnalise: perso.length > 0,
        plan: perso.length ? perso : planParDefaut(g[0].niveau),
        avancement,
        exceptions,
        eleves: inscrits.map((i) => i.profils).filter(Boolean),
      });
    }

    // ---- Remplacer l'ordre ----------------------------------------------
    if (req.method === 'PUT') {
      const { plan, erreur } = normaliserPlan(req.body?.plan);
      if (erreur) return refus(res, 400, erreur);

      // Deux appels, pas de transaction : chaque préfixe doit être un état
      // sûr. On écrit d'abord les lignes voulues (insérer ou remplacer sur la
      // clé groupe + séquence), puis on retire celles qui ne sont plus dans
      // la liste. Si la liaison coupe entre les deux, le plan contient
      // quelques séquences de trop, à leur ancienne position : rien de
      // perdu, et le prochain enregistrement répare.
      await ecrire('plans', '',
        plan.map((p) => ({ groupe_id: groupe, ...p })),
        'POST', 'resolution=merge-duplicates');
      const gardees = plan.map((p) => `"${p.sequence}"`).join(',');
      await ecrire('plans',
        `groupe_id=eq.${groupe}&sequence=not.in.(${gardees})`, {}, 'DELETE');

      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({ ok: true, personnalise: true, plan });
    }

    // ---- Revenir au plan du catalogue -----------------------------------
    if (req.method === 'DELETE') {
      await ecrire('plans', `groupe_id=eq.${groupe}`, {}, 'DELETE');
      const g = (await lire('groupes', `id=eq.${groupe}&select=niveau`))[0];
      if (!(await reArmer(req, res, moi))) return refus(res, 401, 'Session expirée.');
      return res.status(200).json({
        ok: true, personnalise: false, plan: planParDefaut(g?.niveau),
      });
    }

    return refus(res, 405, 'Méthode non autorisée.');
  } catch (e) {
    console.error('plan :', e.message);
    refus(res, 500, req.method === 'GET'
      ? 'Le plan n’a pas pu être lu. Réessayez.'
      : 'Le plan n’a pas été enregistré. Réessayez.');
  }
}
