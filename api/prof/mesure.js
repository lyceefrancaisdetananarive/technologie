import { appelant, possedeGroupe } from '../_lib/autorisation.js';
import { lire, configuree, refus } from '../_lib/supabase.js';
import { UUID, planParDefaut, sequenceDuCatalogue } from '../_lib/progression.js';

// =====================================================================
// CE QUI EST UTILISÉ, CE QUI BLOQUE : la mesure d'un groupe (phase 5).
//
// Aucun outil d'audience, aucun script de suivi, aucune donnée nouvelle :
// tout se lit dans les tables que le classeur remplit déjà (dépôts,
// corrections, coches, scores de quiz, comptes, échecs de connexion). Le
// professeur ne lit que SON groupe, et ce qu'il lit sert à différencier
// (qui n'a pas encore travaillé, qui n'arrive pas à se connecter), pas à
// classer : aucun rang, aucune moyenne de groupe affichée comme une note.
//
//   GET ?groupe=ID
//     eleves    : [{id, prenom, nom, acces_jamais_ouvert, mot_de_passe_a_choisir,
//                   inactif, echecs_depuis_succes}]
//     sequences : [{sequence, visible, faites, seances, depots, corriges, quiz}]
//                 depots = élèves ayant déposé, quiz = élèves ayant fait le quiz
//     cellules  : [{profil_id, sequence, depot, corrige, quiz: {meilleur, total}}]
//     blocages  : {acces_jamais_ouverts, bloques, depots_sans_correction_7j}
//
// « Échecs depuis la dernière connexion réussie » : api/auth/connexion.js
// efface les tentatives d'un compte à chaque connexion réussie ; ce qui
// reste est donc ce qui n'a PAS été suivi d'un succès. Un élève est
// signalé « bloqué » à partir du seuil du verrou de connexion.
// =====================================================================

const SEUIL_BLOCAGE = 8;   // MAX_TENTATIVES de api/auth/connexion.js

export default async function handler(req, res) {
  if (req.method !== 'GET') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  const groupe = String(req.query?.groupe ?? '');
  if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');

  try {
    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, "Ce groupe n'est pas le vôtre.");
    }
    const [g] = await lire('groupes', `id=eq.${groupe}&select=id,code,libelle,niveau`);
    const inscrits = await lire('appartenances',
      `groupe_id=eq.${groupe}&select=profils(id,prenom,nom,mdp_provisoire,actif,derniere_connexion)&order=profils(nom)`);
    const eleves = inscrits.map((i) => i.profils).filter(Boolean);
    if (!eleves.length) {
      return res.status(200).json({ ok: true, groupe: g, eleves: [], sequences: [], cellules: [], blocages: {} });
    }
    const ids = eleves.map((e) => e.id).join(',');
    const depuis = new Date(Date.now() - 30 * 86400000).toISOString();
    const [plans, coches, rendus, scores, echecs] = await Promise.all([
      lire('plans', `groupe_id=eq.${groupe}&select=sequence,position,visible&order=position`),
      lire('avancement', `groupe_id=eq.${groupe}&select=sequence,seance`),
      lire('rendus', `groupe_id=eq.${groupe}&select=profil_id,sequence,fichier,depose_le,corrige_le`),
      lire('scores', `profil_id=in.(${ids})&select=profil_id,quiz,meilleur,total`),
      lire('tentatives', `profil_id=in.(${ids})&origine=eq.connexion&quand=gte.${depuis}&select=profil_id`),
    ]);
    // Même règle que plan.js et progression.js : un plan personnalisé dont
    // aucune ligne n'est au catalogue retombe sur le plan du catalogue.
    const perso = plans.filter((p) => sequenceDuCatalogue(p.sequence));
    const plan = perso.length ? perso : planParDefaut(g.niveau);
    // Tout se compte sur le périmètre de la grille : les élèves du groupe et
    // les séquences de son plan. Un dépôt hors plan n'apparaît nulle part.
    const idsEleves = new Set(eleves.map((e) => e.id));
    const seqs = new Set(plan.map((p) => p.sequence));
    const rendusVus = rendus.filter((r) => r.fichier && idsEleves.has(r.profil_id) && seqs.has(r.sequence));

    const echecsPar = {};
    for (const t of echecs) echecsPar[t.profil_id] = (echecsPar[t.profil_id] ?? 0) + 1;

    const cellules = [];
    for (const e of eleves) {
      for (const p of plan) {
        const miens = rendusVus.filter((r) => r.profil_id === e.id && r.sequence === p.sequence);
        const q = scores.find((s) => s.profil_id === e.id && s.quiz === p.sequence);
        if (!miens.length && !q) continue;
        cellules.push({
          profil_id: e.id, sequence: p.sequence,
          depot: miens.length > 0,
          corrige: miens.some((r) => r.corrige_le),
          quiz: q ? { meilleur: q.meilleur, total: q.total } : null,
        });
      }
    }

    const sequences = plan.map((p) => {
      const s = sequenceDuCatalogue(p.sequence);
      const cel = cellules.filter((c) => c.sequence === p.sequence);
      return {
        sequence: p.sequence, visible: p.visible,
        faites: coches.filter((c) => c.sequence === p.sequence).length,
        seances: s.seances,
        depots: cel.filter((c) => c.depot).length,
        corriges: cel.filter((c) => c.corrige).length,
        quiz: cel.filter((c) => c.quiz).length,
      };
    });

    const ilYA7j = Date.now() - 7 * 86400000;
    res.status(200).json({
      ok: true,
      groupe: g,
      eleves: eleves.map((e) => ({
        id: e.id, prenom: e.prenom, nom: e.nom,
        // « accès jamais ouvert » : aucune connexion réussie à ce jour ;
        // « mot de passe à choisir » : provisoire, après une réinitialisation
        // par le professeur ou avant la première connexion.
        acces_jamais_ouvert: !e.derniere_connexion,
        mot_de_passe_a_choisir: Boolean(e.mdp_provisoire),
        inactif: !e.actif,
        echecs_depuis_succes: echecsPar[e.id] ?? 0,
      })),
      sequences, cellules,
      blocages: {
        acces_jamais_ouverts: eleves.filter((e) => !e.derniere_connexion).length,
        bloques: Object.values(echecsPar).filter((n) => n >= SEUIL_BLOCAGE).length,
        depots_sans_correction_7j: rendusVus.filter((r) => !r.corrige_le
          && new Date(r.depose_le).getTime() < ilYA7j).length,
      },
    });
  } catch (e) {
    console.error('mesure :', e.message);
    refus(res, 500, 'La mesure n’a pas pu être lue. Réessayez.');
  }
}
