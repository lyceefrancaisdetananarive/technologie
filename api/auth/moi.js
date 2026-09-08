import { ouvrir, lireCookie } from '../_lib/session.js';
import { lire, configuree } from '../_lib/supabase.js';

// Qui suis-je ? Utilisé par les pages pour afficher le prénom et adapter
// le menu. Le rôle renvoyé est RELU EN BASE, pas repris du cookie : si un
// compte est désactivé en cours d'heure, l'effet est immédiat ici, alors
// que le cookie du portier reste valable jusqu'à son expiration.
export default async function handler(req, res) {
  if (!configuree()) return res.status(503).json({ connecte: false });

  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return res.status(200).json({ connecte: false });

  try {
    const p = (await lire('profils',
      `id=eq.${session.sub}&select=prenom,nom,role,actif,mdp_provisoire`))[0];
    if (!p || !p.actif) return res.status(200).json({ connecte: false });

    res.status(200).json({
      connecte: true,
      prenom: p.prenom,
      nom: p.nom,
      role: p.role,
      motDePasseProvisoire: p.mdp_provisoire,
    });
  } catch {
    res.status(200).json({ connecte: false });
  }
}
