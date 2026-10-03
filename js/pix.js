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

// =====================================================================
// L'AGE DU RELEVE, ET POURQUOI IL DOIT S'AFFICHER.
//
// Le site ne lit pas Pix en direct, et il ne peut pas : Pix a desactive
// l'acces par programme le 29 janvier 2024, en restreignant le user-agent,
// « pour garantir le service ». La seule voie restante est l'export CSV,
// telecharge depuis un navigateur, puis outils/importer-pix.py. Ce que
// l'eleve voit est donc une PHOTOGRAPHIE, prise le jour de l'import.
//
// Sans sa date, cette photographie se fait passer pour un direct, et l'eleve
// qui vient d'envoyer son profil en conclut que le site se trompe. Le
// 2 octobre 2026, un eleve de 3e a signale exactement cela : son score etait
// monte au-dela de 500 pix dans Pix, et le classeur montrait encore celui du
// relevé du 1er. Le classeur avait raison sur ce qu'il savait ; il avait tort
// de ne pas dire QUAND il l'avait appris.
//
// Le seuil est a huit jours et non a sept : un releve hebdomadaire ne doit pas
// s'annoncer vieux le jour meme ou il va etre refait.
//
// Rend null si la date manque ou ne s'analyse pas. Mieux vaut se taire que
// dater a faux.
// =====================================================================

/**
 * Une date en francais, telle qu'on l'ecrit : « 1er octobre » et non « 1
 * octobre ». toLocaleDateString ne connait pas cet ordinal, qui ne vaut que
 * pour le premier du mois. Le texte s'affiche a des eleves : une faute dans la
 * date est une faute dans la lecon.
 */
function enClair(d, mois) {
  const s = d.toLocaleDateString('fr-FR', { day: 'numeric', month: mois });
  return d.getDate() === 1 ? s.replace(/^1\b/, '1er') : s;
}

export function ageReleve(iso, seuilJours = 8) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const jours = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  return {
    jours,
    vieux: jours >= seuilJours,
    jour: enClair(d, 'long'),
    court: enClair(d, 'short'),
    depuis: jours === 0 ? "aujourd’hui" : jours === 1 ? 'hier' : `il y a ${jours} jours`,
  };
}

/** La date d'un envoi de profil, sans l'heure : l'eleve retient le jour. */
export function jourSeul(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return enClair(d, 'long');
}
