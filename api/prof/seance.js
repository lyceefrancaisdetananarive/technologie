import { appelant, possedeGroupe } from '../_lib/autorisation.js';
import { lire, configuree, refus } from '../_lib/supabase.js';
import { UUID } from '../_lib/progression.js';

// =====================================================================
// LA SÉANCE EN COURS : qui avance, qui n'avance pas (D22).
//
//   GET ?groupe=ID[&minutes=90]
//     mesure_le : l'instant de la lecture, pour afficher l'âge de la donnée
//     fenetre   : la durée observée, en minutes
//     eleves    : [{ id, prenom, nom, dernier_ecrit, champs_ecrits,
//                    pages, dernier_depot, depots, compte_jamais_ouvert }]
//
// CE QU'ON MESURE, ET CE QU'ON REFUSE DE MESURER.
//
// La demande était « voir mes élèves connectés ». Ce n'est pas ce qui sert.
// Un élève connecté qui n'a rien écrit depuis douze minutes est le cas
// intéressant ; un élève déconnecté parce que le réseau a lâché ne l'est
// pas. Mesurer la présence ferait courir après des pannes de wifi au lieu
// d'élèves en difficulté.
//
// On mesure donc l'ACTIVITÉ, et elle se lit dans des données déjà écrites :
// `reponses.modifie_le` est horodaté à chaque champ rempli,
// `rendus.depose_le` à chaque dépôt. Aucune table nouvelle, aucun mouchard,
// rien qui ne soit déjà décrit dans le registre des traitements.
//
// CE QUI N'EST PAS ICI, ET N'Y SERA PAS : la frappe, le temps de connexion
// cumulé, les pages consultées, le nombre de clics. La règle qui tranche :
// si une donnée ne sert pas à décider d'une aide dans les cinq minutes,
// elle n'a rien à faire sur cet écran.
//
// LA FENÊTRE. Par défaut quatre-vingt-dix minutes, la durée d'une séance au
// LFT. Au-delà, on ne regarde plus la séance en cours mais l'historique, et
// c'est la fiche de l'élève qui sert à cela.
// =====================================================================

const DEFAUT_MINUTES = 90;
const MAX_MINUTES = 240;

export default async function handler(req, res) {
  if (req.method !== 'GET') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'prof') return refus(res, 403, 'Réservé aux professeurs.');

  const groupe = String(req.query?.groupe ?? '');
  if (!UUID.test(groupe)) return refus(res, 400, 'Groupe non précisé.');
  let minutes = Number(req.query?.minutes ?? DEFAUT_MINUTES);
  if (!Number.isFinite(minutes) || minutes <= 0) minutes = DEFAUT_MINUTES;
  minutes = Math.min(Math.round(minutes), MAX_MINUTES);

  try {
    if (!(await possedeGroupe(moi.id, groupe))) {
      return refus(res, 403, "Ce groupe n'est pas le vôtre.");
    }
    const maintenant = new Date();
    const depuis = new Date(maintenant.getTime() - minutes * 60000).toISOString();

    const [inscrits, ecrits, depots] = await Promise.all([
      lire('appartenances',
        `groupe_id=eq.${groupe}&select=profils(id,prenom,nom,derniere_connexion)`),
      // Une ligne par champ rempli : c'est le grain le plus fin dont on
      // dispose, et il suffit. On ne lit PAS le texte écrit : savoir qu'un
      // élève avance ne demande pas de lire par-dessus son épaule.
      lire('reponses',
        `groupe_id=eq.${groupe}&modifie_le=gte.${depuis}` +
        '&select=profil_id,page,question,modifie_le&order=modifie_le.desc'),
      lire('rendus',
        `groupe_id=eq.${groupe}&depose_le=gte.${depuis}` +
        '&select=profil_id,sequence,document,depose_le&order=depose_le.desc'),
    ]);

    const eleves = inscrits
      .map((a) => a.profils)
      .filter(Boolean)
      .map((p) => {
        const siens = ecrits.filter((e) => e.profil_id === p.id);
        // La ligne d'état « fiche » n'est pas un champ rempli : la compter
        // ferait passer pour actif un élève qui a seulement ouvert la page.
        const champs = siens.filter((e) => e.question !== 'fiche');
        const sesDepots = depots.filter((d) => d.profil_id === p.id);
        return {
          id: p.id,
          prenom: p.prenom,
          nom: p.nom,
          compte_jamais_ouvert: !p.derniere_connexion,
          dernier_ecrit: champs.length ? champs[0].modifie_le : null,
          champs_ecrits: champs.length,
          pages: [...new Set(siens.map((e) => e.page))],
          dernier_depot: sesDepots.length ? sesDepots[0].depose_le : null,
          depots: sesDepots.length,
        };
      });

    res.status(200).json({
      ok: true,
      mesure_le: maintenant.toISOString(),
      fenetre: minutes,
      eleves,
    });
  } catch (e) {
    console.error('seance :', e.message);
    refus(res, 500, 'Lecture impossible.');
  }
}
