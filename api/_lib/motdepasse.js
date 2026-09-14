// =====================================================================
// La règle du mot de passe, en un seul endroit (CNIL, délibération
// n° 2022-100 ; ANSSI, recommandations relatives aux mots de passe).
//
// Douze caractères au moins, sans imposer de composition : trois mots
// collés valent mieux qu'un « P@ssw0rd! ». En revanche on refuse ce qui se
// devine en une poignée d'essais : les mots de passe les plus courants, les
// suites de clavier, les mots du lieu (technologie, tananarive, lft, egd),
// l'année, un même caractère répété, et tout ce qui reprend l'identité du
// compte (prénom, nom, partie locale de l'adresse).
// =====================================================================

export const LONGUEUR_MIN = 12;

const COURANTS = [
  'motdepasse', 'password', 'passw0rd', 'azerty', 'qwerty', 'azertyuiop', 'qwertyuiop',
  'abcdefgh', 'abcdefghijkl', '12345678', '123456789', '1234567890', '123456789012',
  '111111', '000000', 'bonjour', 'soleil', 'chocolat', 'iloveyou', 'jetaime', 'admin',
  'bienvenue', 'welcome', 'letmein', 'monkey', 'dragon', 'football', 'princesse',
  'technologie', 'techno', 'tananarive', 'antananarivo', 'madagascar', 'lycee', 'lft',
  'egd', 'college', 'eleve', 'professeur', 'classe', 'cahier', 'quiz',
];
const SUITES = ['azertyuiop', 'qwertyuiop', 'qsdfghjklm', 'wxcvbn', 'abcdefghijklmnop', '0123456789', '9876543210'];

const normaliser = (s) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/**
 * Renvoie null si le mot de passe est acceptable, sinon le message à
 * montrer, en français, sans jargon. `compte` porte email, prenom, nom.
 */
export function refuserMotDePasse(mdp, compte = {}) {
  const brut = String(mdp ?? '');
  if (brut.length < LONGUEUR_MIN) {
    return `Le mot de passe doit faire au moins ${LONGUEUR_MIN} caractères. `
      + 'Trois mots collés font l’affaire, et se retiennent.';
  }
  if (brut.length > 128) return 'Le mot de passe est trop long (128 caractères au plus).';
  const n = normaliser(brut);
  if (!n) return 'Le mot de passe doit contenir des lettres ou des chiffres.';
  if (/^(.)\1+$/.test(n)) return 'Un même caractère répété n’est pas un mot de passe.';
  const annee = new Date().getFullYear();
  const interdits = [...COURANTS, String(annee), String(annee - 1), String(annee + 1)];
  for (const mot of interdits) {
    // Le mot de passe EST ce mot, ou ce mot suivi de chiffres : « technologie2026 ».
    if (n === mot || new RegExp(`^${mot}\\d{0,6}$`).test(n)) {
      return 'Ce mot de passe est trop courant ou trop facile à deviner. Choisissez trois mots qui n’ont rien à voir entre eux.';
    }
  }
  for (const s of SUITES) {
    if (n.length >= 8 && (s.includes(n) || n.includes(s.slice(0, 8)))) {
      return 'Une suite de touches du clavier se devine : choisissez trois mots qui n’ont rien à voir entre eux.';
    }
  }
  const identite = [
    compte.prenom, compte.nom, String(compte.email ?? '').split('@')[0],
    ...String(compte.email ?? '').split('@')[0].split(/[._-]/),
  ].map(normaliser).filter((x) => x.length >= 4);
  for (const morceau of identite) {
    if (n.includes(morceau)) {
      return 'Le mot de passe ne doit pas contenir votre nom, votre prénom ni votre adresse.';
    }
  }
  return null;
}
