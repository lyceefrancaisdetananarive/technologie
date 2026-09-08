import { effacerCookie } from '../_lib/session.js';

export default async function handler(req, res) {
  // Efface le cookie ET demande au navigateur de vider ce qu'il a stocké
  // pour ce site. Sur un poste partagé, c'est le geste qui compte.
  // Attention : Clear-Site-Data n'est pas honoré partout de la même façon,
  // et ne touche ni au dossier Téléchargements, ni au gestionnaire de mots
  // de passe du navigateur, ni à la file d'impression.
  res.setHeader('Set-Cookie', effacerCookie());
  res.setHeader('Clear-Site-Data', '"cache", "storage"');
  res.status(200).json({ ok: true });
}
