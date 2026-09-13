import { appelant, sesGroupes } from '../_lib/autorisation.js';
import { lire, configuree, refus } from '../_lib/supabase.js';
import { planParDefaut, sequenceDuCatalogue, badgeAcquis } from '../_lib/progression.js';

// =====================================================================
// LA PROGRESSION VUE PAR L'ÉLÈVE : sa carte de l'année.
//
// Pour chacun de ses groupes : le plan choisi par le professeur (ou celui du
// catalogue), les séances cochées « faites en classe », SES exceptions et
// rien que les siennes (un camarade n'a pas à savoir qui était absent :
// même règle que la politique RLS de db/04-progression.sql), et les badges
// que le serveur déduit avec la règle de _lib/progression.js.
//
// Une progression se lit par rapport à soi : aucun effectif, aucun autre
// élève, aucun classement dans cette réponse.
// =====================================================================

export default async function handler(req, res) {
  if (req.method !== 'GET') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'eleve') return refus(res, 403, 'Réservé aux élèves.');

  try {
    const groupes = await sesGroupes(moi);
    if (!groupes.length) return res.status(200).json({ ok: true, groupes: [] });
    const ids = groupes.map((g) => g.id).join(',');
    const [plans, coches, exceptions] = await Promise.all([
      lire('plans', `groupe_id=in.(${ids})&select=groupe_id,sequence,position,visible&order=position`),
      lire('avancement', `groupe_id=in.(${ids})&select=groupe_id,sequence,seance,fait_le`),
      lire('exceptions',
        `groupe_id=in.(${ids})&profil_id=eq.${moi.id}&select=groupe_id,sequence,seance,etat`),
    ]);
    res.status(200).json({
      ok: true,
      groupes: groupes.map((g) => {
        const perso = plans.filter((p) => p.groupe_id === g.id && sequenceDuCatalogue(p.sequence))
          .map(({ groupe_id, ...p }) => p);
        // Chaque ligne porte son nombre de séances : les pages de niveau
        // (components.js) n'ont pas toujours le catalogue sous la main.
        const plan = (perso.length ? perso : planParDefaut(g.niveau))
          .map((p) => ({ ...p, seances: sequenceDuCatalogue(p.sequence).seances }));
        const avancement = coches.filter((c) => c.groupe_id === g.id)
          .map(({ groupe_id, ...c }) => c);
        const miennes = exceptions.filter((x) => x.groupe_id === g.id)
          .map(({ groupe_id, ...x }) => x);
        return {
          id: g.id, code: g.code, libelle: g.libelle, niveau: g.niveau,
          plan, avancement, exceptions: miennes,
          badges: plan.filter((p) => p.visible && badgeAcquis(p.sequence,
            avancement.filter((a) => a.sequence === p.sequence).map((a) => a.seance),
            miennes)).map((p) => p.sequence),
        };
      }),
    });
  } catch (e) {
    console.error('progression :', e.message);
    refus(res, 500, 'Lecture impossible.');
  }
}
