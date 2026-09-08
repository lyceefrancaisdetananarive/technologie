import { effacerCookie } from '../_lib/session.js';
import { origineLegitime, refus } from '../_lib/supabase.js';

export default async function handler(req, res) {
  // CE POINT D'ENTRÉE A ÉTÉ OUVERT À TOUS PENDANT UN TEMPS, ET C'EST GRAVE.
  //
  // Il ne vérifiait ni la méthode ni l'origine : un GET suffisait, et son
  // adresse est en clair dans js/components.js, servi aux 228 pages. Un élève
  // qui la tapait dans la barre d'adresse, ou n'importe quelle page tierce la
  // chargeant dans une balise <img>, déclenchait la réponse ci-dessous chez
  // tout visiteur.
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  // Efface les deux cookies : le sceau, et le témoin qui allume le bandeau.
  res.setHeader('Set-Cookie', effacerCookie());

  // « cookies », et surtout PAS « storage ».
  //
  // Se déconnecter, c'est fermer une session. La session ne vit que dans deux
  // cookies, que la ligne ci-dessus supprime déjà. « storage » vidait tout le
  // stockage local du navigateur pour ce site, sans distinction de clé : les
  // réponses du diagnostic de 3ème en cours de saisie (diag3e-2026), le profil
  // du professeur (techno-lft-profil), la progression débloquée
  // (techno-lft-progression) et ses vidéos (techno-lft-videos). Aucune de ces
  // quatre clés ne porte de session : les détruire ne fermait rien et
  // supprimait le travail d'un binôme au milieu d'une séance.
  //
  // « cache » est retiré pour une autre raison : il refacturait le CSS, le
  // JavaScript et les images à la classe suivante, sur la liaison de
  // Tananarive. On ne fait pas payer une déconnexion à ceux qui n'ont rien
  // demandé.
  //
  // Attention : Clear-Site-Data n'est pas honoré partout de la même façon.
  // La suppression des cookies ci-dessus, elle, l'est.
  res.setHeader('Clear-Site-Data', '"cookies"');
  res.status(200).json({ ok: true });
}
