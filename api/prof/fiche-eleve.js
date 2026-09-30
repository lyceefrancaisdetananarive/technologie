import { appelant, gereEleve, sesGroupes } from '../_lib/autorisation.js';
import { lire, configuree, refus } from '../_lib/supabase.js';
import { UUID, planParDefaut, sequenceDuCatalogue } from '../_lib/progression.js';

// =====================================================================
// LA FICHE D'UN ÉLÈVE EN TECHNOLOGIE : tout ce que le site sait de son
// travail, en une lecture.
//
//   GET ?eleve=ID
//     eleve      : {id, prenom, nom, derniere_connexion, mot_de_passe_a_choisir}
//     groupes    : ceux que JE lui enseigne, avec leur plan et l'avancement
//     rendus     : ses dépôts, du plus récent au plus ancien, avec la
//                  correction écrite et l'heure exacte du dépôt
//     fiches     : ses réponses rédigées, regroupées par page d'activité
//     scores     : son meilleur score par quiz
//     exceptions : ses absences, reprises et rattrapages
//
// TROIS DÉCISIONS QUI TIENNENT TOUT LE RESTE.
//
// 1. AUCUN TOTAL, AUCUNE MOYENNE, AUCUN RANG. Le classeur mesure le
//    travail, pas la valeur : les notes vivent dans PRONOTE (décision D15).
//    Renvoyer un total ferait de cette fiche un second livret scolaire, avec
//    les obligations de conservation et de communication qui vont avec.
//
// 2. LE PÉRIMÈTRE EST CELUI DU PROFESSEUR QUI DEMANDE. On ne renvoie que
//    les groupes que CE professeur enseigne à CET élève, et les travaux
//    déposés dans ces groupes. Un élève qui a deux professeurs de
//    technologie ne fait pas passer le travail de l'un sous les yeux de
//    l'autre. Le coordonnateur, lui, voit tout : gereEleve() le dit.
//
// 3. LE POSITIONNEMENT AU DIAGNOSTIQUE N'EST PAS ICI. Il se lit dans les
//    PDF déposés, que rien ne dépouille en ligne aujourd'hui : l'outil
//    `outils/depouiller-diagnostique.py` le fait hors ligne. Renvoyer un
//    champ vide serait mentir sur ce que le site sait. Les dépôts du
//    diagnostique, eux, figurent dans `rendus` comme les autres, avec leur
//    accusé de réception. Voir le brief de refonte, étape 4.
//
// Lecture seule, aucune écriture, aucune donnée nouvelle : tout sort des
// tables que le classeur remplit déjà.
// =====================================================================

const CHAMP = /^(?:[zb]\d{1,3}|t\d{1,2}-r\d{1,3}-c\d{1,2})$/;

/** Regroupe les lignes de `reponses` par page, comme le fait le classeur. */
function parFiche(lignes) {
  const pages = new Map();
  for (const l of lignes) {
    if (!pages.has(l.page)) {
      pages.set(l.page, {
        page: l.page, groupe_id: l.groupe_id, champs: [], libre: null,
        etat: 'encours', correction: null, corrige_le: null,
        modifie_le: l.modifie_le,
      });
    }
    const f = pages.get(l.page);
    if (l.modifie_le > f.modifie_le) f.modifie_le = l.modifie_le;
    if (l.question === 'fiche') {
      // La ligne d'état porte l'avancement de la fiche ET la correction
      // globale du professeur : c'est elle qui gèle la page une fois posée.
      f.etat = l.corrige_le ? 'corrigee'
        : (l.texte || '').trim() === 'terminee' ? 'terminee' : 'encours';
      f.correction = l.correction ?? null;
      f.corrige_le = l.corrige_le ?? null;
    } else if (l.question === 'reponse') {
      f.libre = { texte: l.texte, modifie_le: l.modifie_le };
    } else if (CHAMP.test(l.question)) {
      f.champs.push({ champ: l.question, intitule: l.intitule ?? null, texte: l.texte });
    }
  }
  return [...pages.values()]
    .map((f) => ({ ...f, nb_champs: f.champs.length }))
    .sort((a, b) => String(b.modifie_le).localeCompare(String(a.modifie_le)));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  const eleve = String(req.query?.eleve ?? '');
  if (!UUID.test(eleve)) return refus(res, 400, 'Élève non précisé.');

  try {
    if (!(await gereEleve(moi, eleve))) {
      return refus(res, 403, "Cet élève n'est pas dans l'un de vos groupes.");
    }
    const p = (await lire('profils',
      `id=eq.${eleve}&select=id,prenom,nom,role,actif,derniere_connexion,mdp_provisoire`))[0];
    if (!p || p.role !== 'eleve') return refus(res, 404, 'Élève introuvable.');

    // Les groupes que JE lui enseigne : l'intersection de ses appartenances
    // et de mes groupes. Sans cette intersection, un coordonnateur verrait
    // la même fiche qu'un collègue, mais un collègue verrait celle du
    // coordonnateur.
    const [miens, siens] = await Promise.all([
      sesGroupes(moi),
      lire('appartenances',
        `profil_id=eq.${eleve}&select=groupe_id,version_adaptee`),
    ]);
    const aLui = new Set(siens.map((a) => a.groupe_id));
    const adaptee = new Map(siens.map((a) => [a.groupe_id, !!a.version_adaptee]));
    const communs = miens.filter((g) => aLui.has(g.id));
    if (!communs.length) {
      return res.status(200).json({
        ok: true, eleve: { id: p.id, prenom: p.prenom, nom: p.nom },
        groupes: [], rendus: [], fiches: [], scores: [], exceptions: [],
      });
    }
    const ids = communs.map((g) => g.id).join(',');

    const [rendus, reponses, scores, exceptions, plans, coches] = await Promise.all([
      lire('rendus',
        `profil_id=eq.${eleve}&groupe_id=in.(${ids})` +
        `&select=id,groupe_id,sequence,document,fichier,commentaire,binome,` +
        `appreciation,competence,maitrise,depose_le,corrige_le&order=depose_le.desc`),
      lire('reponses',
        `profil_id=eq.${eleve}&groupe_id=in.(${ids})` +
        `&select=id,groupe_id,page,question,texte,intitule,redige_le,modifie_le,` +
        `correction,corrige_le&order=page,question`),
      lire('scores', `profil_id=eq.${eleve}&select=quiz,meilleur,total,meilleur_le`),
      lire('exceptions',
        `profil_id=eq.${eleve}&groupe_id=in.(${ids})` +
        `&select=groupe_id,sequence,seance,etat,le`),
      lire('plans', `groupe_id=in.(${ids})&select=groupe_id,sequence,position,visible&order=position`),
      lire('avancement', `groupe_id=in.(${ids})&select=groupe_id,sequence,seance,fait_le`),
    ]);

    res.status(200).json({
      ok: true,
      eleve: {
        id: p.id, prenom: p.prenom, nom: p.nom, actif: p.actif,
        derniere_connexion: p.derniere_connexion,
        mot_de_passe_a_choisir: !!p.mdp_provisoire,
      },
      groupes: communs.map((g) => {
        const perso = plans.filter((x) => x.groupe_id === g.id
          && sequenceDuCatalogue(x.sequence)).map(({ groupe_id, ...x }) => x);
        const plan = (perso.length ? perso : planParDefaut(g.niveau))
          .map((x) => ({ ...x, seances: sequenceDuCatalogue(x.sequence).seances }));
        return {
          id: g.id, code: g.code, libelle: g.libelle, niveau: g.niveau, plan,
          // Le SERVICE rendu, jamais sa cause : voir db/16-version-adaptee.sql.
          version_adaptee: adaptee.get(g.id) === true,
          avancement: coches.filter((c) => c.groupe_id === g.id)
            .map(({ groupe_id, ...c }) => c),
        };
      }),
      rendus,
      fiches: parFiche(reponses),
      scores,
      exceptions,
    });
  } catch (e) {
    console.error('fiche-eleve :', e.message);
    refus(res, 500, 'Lecture impossible.');
  }
}
