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
      + '&select=nom_pix,classe,score,certifiable,envoi,parcours,competences,appariement,releve_le');
    const p = lignes[0];
    res.status(200).json({
      ok: true,
      pix: p ? {
        nomPix: p.nom_pix,
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
    // La table peut ne pas encore exister : l'absence de relevé n'est pas une
    // panne du classeur, et la tuile doit rester muette plutôt que rouge.
    console.error('pix :', e.message);
    res.status(200).json({ ok: true, pix: null, indisponible: true });
  }
}
