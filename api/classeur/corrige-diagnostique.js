import { appelant } from '../_lib/autorisation.js';
import { lire, configuree, refus } from '../_lib/supabase.js';
import { NIVEAUX } from '../_lib/progression.js';
import { corrigeDe } from '../_lib/diagnostiques-corriges.js';

// =====================================================================
// LA CORRECTION DE L'ÉVALUATION DIAGNOSTIQUE (D20, 21 septembre 2026).
//
//   GET ?niveau=4eme   le corrigé du niveau et l'état du dépôt de l'élève.
//
// LE CORRIGÉ NE SORT DU SERVEUR QUE POUR UN ÉLÈVE QUI A DÉPOSÉ SON
// ÉVALUATION. La page de l'évaluation est publique et ne contient jamais les
// réponses attendues ; un visiteur sans session, un professeur, ou un élève
// qui n'a pas encore envoyé sa copie reçoivent un refus, sans un seul item.
// Le dépôt retenu est le plus récent de l'ÉVALUATION (document eval) dont
// le fichier est bien arrivé (fichier non null) : un dépôt commencé mais
// jamais confirmé ne compte pas, exactement comme il s'affiche « incomplet »
// dans le classeur ; la feuille B, envoyée sous la même séquence comme
// document « autre » (et tout dépôt manuel « Autre » ou « Activité » fait
// depuis Mon classeur), ne compte pas non plus : elle n'ouvrirait pas le
// corrigé, et ne masquerait pas le mot du professeur écrit sur l'évaluation.
//
// L'appréciation renvoyée est le mot du professeur sur ce dépôt
// (rendus.appreciation), null tant qu'il n'a pas corrigé : la page l'affiche
// au même endroit que la correction automatique, quand il arrive. L'id du
// dépôt (rendu) est renvoyé aussi : la page le compare à sa marque locale
// d'envoi pour savoir si les réponses gardées sur le poste sont celles de
// cette copie (poste partagé de salle informatique).
//
// Lecture seule : pas d'origineLegitime sur un GET (comme groupes.js), et
// rien n'est écrit. La réponse n'est jamais mise en cache : elle dépend de
// la session, et vercel.json le dit déjà pour tout /api/, mais l'en-tête est
// posé ici aussi, explicitement.
// =====================================================================

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  const moi = await appelant(req);
  if (!moi) return refus(res, 401, 'Session expirée.');
  if (moi.role !== 'eleve') return refus(res, 403, 'Réservé aux élèves.');

  const niveau = String(req.query?.niveau ?? '');
  if (!NIVEAUX.includes(niveau)) return refus(res, 400, 'Niveau inconnu.');

  try {
    // Le niveau vient de NIVEAUX, jamais du navigateur tel quel : la séquence
    // est donc sûre à écrire dans la requête.
    const depot = (await lire('rendus',
      `profil_id=eq.${moi.id}` +
      `&sequence=eq.${niveau}/p1/diagnostique` +
      `&document=eq.eval` +
      `&fichier=not.is.null` +
      `&select=id,depose_le,corrige_le,appreciation,groupe_id` +
      `&order=depose_le.desc&limit=1`))[0];
    if (!depot) {
      return refus(res, 403,
        'Envoie d’abord ton évaluation : la correction s’affiche ensuite.');
    }

    res.status(200).json({
      ok: true,
      niveau,
      rendu: depot.id,
      depose_le: depot.depose_le,
      corrige_le: depot.corrige_le ?? null,
      appreciation: depot.appreciation ?? null,
      items: corrigeDe(niveau).items,
    });
  } catch (e) {
    console.error('corrige-diagnostique :', e.message);
    refus(res, 500, 'Lecture impossible.');
  }
}
