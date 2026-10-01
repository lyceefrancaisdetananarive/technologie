import { appelant } from '../_lib/autorisation.js';
import { lire, configuree, refus } from '../_lib/supabase.js';

/**
 * LE RELEVÉ PIX DE L'ÉLÈVE (1er octobre 2026).
 *
 * Pix Orga ne connaît pas nos comptes : le participant tape lui-même son nom,
 * et il le tape mal. Le rapprochement est donc fait une fois, à l'import, et
 * inscrit dans la table `pix` (voir db/17-pix.sql). Cet appel ne fait que lire
 * la ligne de l'élève qui le demande.
 *
 * DEUX PRÉCAUTIONS QUI COMPTENT.
 *
 * La ligne dont l'appariement a été REFUSÉ par le professeur n'est jamais
 * servie : un rapprochement écarté ne doit pas revenir par la fenêtre. Et le
 * nom tel qu'il a été tapé dans Pix EST renvoyé, puis affiché : c'est ce qui
 * permet à l'élève de dire « ce n'est pas moi » si le rapprochement est faux.
 * Un score muet serait invérifiable.
 *
 * Une absence de ligne n'est pas une erreur : la plupart des élèves n'ont pas
 * encore de relevé. On rend `pix: null`, la tuile le dit en toutes lettres.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');

  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'eleve') return refus(res, 403, 'Réservé aux élèves.');

  try {
    const lignes = await lire('pix',
      `profil_id=eq.${moi.id}&appariement=neq.refuse`
      + '&select=nom_pix,nom_pix_aussi,classe,score,certifiable,envoi,parcours,'
      + 'competences,appariement,releve_le');
    const p = lignes[0];
    res.status(200).json({
      ok: true,
      pix: p ? {
        nomPix: p.nom_pix,
        nomPixAussi: p.nom_pix_aussi || null,
        classe: p.classe,
        score: p.score,
        certifiable: p.certifiable === true,
        envoi: p.envoi,
        parcours: p.parcours || {},
        competences: p.competences || {},
        confirme: p.appariement === 'confirme',
        releveLe: p.releve_le,
      } : null,
    });
  } catch (e) {
    console.error('pix :', e.message);
    // UNE TABLE ABSENTE N'EST PAS UNE PANNE : avant que db/17 ne soit joué,
    // le classeur doit fonctionner et la tuile se taire. Mais TOUT LE RESTE
    // en est une, et la taire aussi serait mentir à l'élève : pendant une
    // indisponibilité, il lirait « pas encore de relevé » alors que le sien
    // existe. On ne rattrape donc que le 404, et on le dit pour le reste.
    if (e.statut === 404 || / pix : 404$/.test(e.message)) {
      return res.status(200).json({ ok: true, pix: null, indisponible: true });
    }
    refus(res, 503, "Le relevé Pix n'a pas pu être lu pour le moment.");
  }
}
