// =====================================================================
// CE QUE PIX APPELLE UN PARCOURS, ET CE QU'UN ÉLÈVE COMPREND.
//
// Les clés viennent des noms de campagnes dans Pix Orga (« 6e-ps »,
// « collecte »), qui sont des codes de gestion, pas des mots d'élève. La
// table est donc partagée entre la tuile du classeur et l'écran du
// professeur : les deux doivent nommer la même chose de la même façon,
// sans quoi un élève et son professeur ne parlent plus du même parcours.
//
// Une clé inconnue n'est pas une erreur : la liste des campagnes change
// chaque année. Elle s'affiche telle quelle, et on complète ici.
// =====================================================================

export const PARCOURS = {
  rentree: 'Parcours de rentrée',
  cyberharcelement: 'Cyberharcèlement',
  creation_de_contenu: 'Création de contenu',
  '6e-ps': 'Protection et sécurité',
  collecte: 'Collecte de profil',
};

export const libelleParcours = (cle) => PARCOURS[cle] || cle;

/**
 * Le pourcentage d'un parcours, tel que Pix l'exporte : tantôt 0,72, tantôt
 * 72, et avec une virgule française. Rend null si ce n'est pas un nombre.
 */
export function pourcentage(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n <= 1 ? n * 100 : n);
}
