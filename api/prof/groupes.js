import { ouvrir, lireCookie } from '../_lib/session.js';
import { possedeGroupe } from '../_lib/autorisation.js';
import {
  lire, ecrire, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// =====================================================================
// LES GROUPES D'UN PROFESSEUR : créer, renommer, retirer, et lister avec
// leurs effectifs.
//
// Un groupe appartient à UN professeur (groupes.prof_id). C'est ce qui fait
// tenir toute l'autorisation du classeur : « cet élève est-il dans un de MES
// groupes » est la question que posent enseigneA() et possedeGroupe(), et
// c'est elle qui empêche un professeur de voir ou de modifier les élèves
// d'un collègue.
//
// La suppression n'est possible que sur un groupe VIDE. Un groupe qui porte
// des inscriptions ou des dépôts ne s'efface pas : la clé étrangère est en
// cascade, et l'effacer emporterait les travaux des élèves.
// =====================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIVEAUX = ['5eme', '4eme', '3eme'];

export default async function handler(req, res) {
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (req.method !== 'GET' && !origineLegitime(req)) {
    return refus(res, 403, 'Origine non autorisée.');
  }

  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return refus(res, 401, 'Session expirée.');

  try {
    const moi = (await lire('profils',
      `id=eq.${session.sub}&select=id,role,actif,mdp_provisoire`))[0];
    if (!moi || moi.role !== 'prof' || !moi.actif) {
      return refus(res, 403, 'Action réservée aux professeurs.');
    }
    if (moi.mdp_provisoire) {
      return refus(res, 403,
        'Choisissez d’abord votre propre mot de passe définitif.');
    }

    // ---- Lister mes groupes et qui s'y trouve -------------------------
    if (req.method === 'GET') {
      const groupes = await lire('groupes',
        `prof_id=eq.${moi.id}&select=id,code,libelle,niveau,annee&order=code`);
      const membres = groupes.length
        ? await lire('appartenances',
            `groupe_id=in.(${groupes.map((g) => g.id).join(',')})`
            + `&select=groupe_id,profils(id,email,nom,prenom,actif,mdp_provisoire)`)
        : [];
      return res.status(200).json({
        ok: true,
        groupes: groupes.map((g) => ({
          ...g,
          eleves: membres
            .filter((m) => m.groupe_id === g.id && m.profils)
            .map((m) => m.profils)
            .sort((a, b) => String(a.nom ?? '').localeCompare(String(b.nom ?? ''))),
        })),
      });
    }

    // ---- Créer un groupe ----------------------------------------------
    if (req.method === 'POST') {
      const code = String(req.body?.code ?? '').trim().slice(0, 40);
      const libelle = String(req.body?.libelle ?? '').trim().slice(0, 120);
      const niveau = String(req.body?.niveau ?? '').trim();
      if (!code || !libelle) return refus(res, 400, 'Code et libellé requis.');
      if (!NIVEAUX.includes(niveau)) {
        return refus(res, 400, 'Niveau attendu : 5eme, 4eme ou 3eme.');
      }
      const [g] = await ecrire('groupes', '',
        { code, libelle, niveau, prof_id: moi.id }, 'POST')
        .catch((e) => {
          if (e.code === '23505' || e.statut === 409) {
            throw new Error('CODE_PRIS');
          }
          throw e;
        });
      return res.status(200).json({ ok: true, groupe: g });
    }

    // ---- Renommer ------------------------------------------------------
    if (req.method === 'PATCH') {
      const id = String(req.body?.id ?? '');
      const libelle = String(req.body?.libelle ?? '').trim().slice(0, 120);
      if (!UUID.test(id)) return refus(res, 400, 'Groupe non précisé.');
      if (!libelle) return refus(res, 400, 'Libellé requis.');
      if (!(await possedeGroupe(moi.id, id))) {
        return refus(res, 403, 'Ce groupe n’est pas l’un des vôtres.');
      }
      await ecrire('groupes', `id=eq.${id}`, { libelle });
      return res.status(200).json({ ok: true });
    }

    // ---- Supprimer, seulement si le groupe est vide ---------------------
    if (req.method === 'DELETE') {
      const id = String(req.body?.id ?? '');
      if (!UUID.test(id)) return refus(res, 400, 'Groupe non précisé.');
      if (!(await possedeGroupe(moi.id, id))) {
        return refus(res, 403, 'Ce groupe n’est pas l’un des vôtres.');
      }
      const inscrits = await lire('appartenances',
        `groupe_id=eq.${id}&select=profil_id&limit=1`);
      if (inscrits.length) {
        return refus(res, 409,
          'Ce groupe compte encore des élèves. Retirez-les d’abord : '
          + 'supprimer le groupe emporterait leurs travaux.');
      }
      const depots = await lire('rendus', `groupe_id=eq.${id}&select=id&limit=1`);
      if (depots.length) {
        return refus(res, 409,
          'Ce groupe porte des travaux déposés. Il ne peut pas être supprimé.');
      }
      await ecrire('groupes', `id=eq.${id}`, {}, 'DELETE');
      return res.status(200).json({ ok: true });
    }

    return refus(res, 405, 'Méthode non autorisée.');
  } catch (e) {
    if (e.message === 'CODE_PRIS') {
      return refus(res, 409, 'Ce code de groupe est déjà utilisé.');
    }
    console.error('groupes prof :', e.message);
    refus(res, 500, 'Opération impossible.');
  }
}
