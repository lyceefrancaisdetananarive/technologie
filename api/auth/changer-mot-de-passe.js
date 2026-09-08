import { ouvrir, lireCookie, sceller, poserCookie } from '../_lib/session.js';
import {
  definirMotDePasse, verifierMotDePasse, lire, ecrire,
  configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// Longueur minimale plutôt que « une majuscule, un chiffre, un symbole ».
// Exiger une composition compliquée d'élèves de onze ans produit
// « Password1! » écrit au crayon dans la trousse. Douze caractères libres
// résistent mieux, et se retiennent : trois mots collés suffisent.
const LONGUEUR_MIN = 12;

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const session = await ouvrir(
    lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
  if (!session) return refus(res, 401, 'Session expirée. Reconnectez-vous.');

  const ancien = String(req.body?.ancien ?? '');
  const nouveau = String(req.body?.nouveau ?? '');

  if (nouveau.length < LONGUEUR_MIN) {
    return refus(res, 400,
      `Le mot de passe doit faire au moins ${LONGUEUR_MIN} caractères. ` +
      `Trois mots collés font l'affaire, et se retiennent.`);
  }
  if (nouveau === ancien) {
    return refus(res, 400, "Le nouveau mot de passe doit être différent de l'ancien.");
  }

  try {
    const p = (await lire('profils',
      `id=eq.${session.sub}&select=id,email,role,actif`))[0];
    if (!p || !p.actif) return refus(res, 401, 'Compte introuvable ou désactivé.');

    // On revérifie l'ancien mot de passe. Sans cela, un camarade qui trouve
    // un poste laissé ouvert changerait le mot de passe et volerait le compte.
    if (!(await verifierMotDePasse(p.email, ancien))) {
      return refus(res, 401, "L'ancien mot de passe est incorrect.");
    }

    await definirMotDePasse(p.id, nouveau);
    await ecrire('profils', `id=eq.${p.id}`, { mdp_provisoire: false });

    // Nouveau cookie sans le drapeau « provisoire », sinon le portier
    // renverrait l'élève en boucle vers cette même page.
    const jeton = await sceller(
      { sub: p.id, role: p.role, prov: false },
      process.env.LFT_COOKIE_SECRET, 3600);
    res.setHeader('Set-Cookie', poserCookie(jeton));
    res.status(200).json({ ok: true });
  } catch (e) {
    // Cas non résolu, à connaître : si l'écriture aboutit chez Supabase mais
    // que la réponse se perd sur une liaison coupée, l'élève croit avoir
    // échoué alors que son mot de passe A changé. Le repli professeur est
    // alors le seul recours.
    console.error('changer-mot-de-passe :', e.message);
    refus(res, 500, "Le changement n'a pas abouti. Réessayez ; si cela " +
      "persiste, demandez une réinitialisation à votre professeur.");
  }
}
