import { ouvrir, lireCookie, sceller, poserCookie } from '../_lib/session.js';
import {
  definirMotDePasse, verifierMotDePasse, utilisateurDuJeton, lire, ecrire,
  configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// Longueur minimale plutôt que « une majuscule, un chiffre, un symbole ».
// Exiger une composition compliquée d'élèves de onze ans produit
// « Password1! » écrit au crayon dans la trousse. Douze caractères libres
// résistent mieux, et se retiennent : trois mots collés suffisent.
const LONGUEUR_MIN = 12;

// =====================================================================
// DEUX ENTRÉES, PAS UNE.
//
//  A. CHANGEMENT ORDINAIRE : l'élève est déjà connecté. Il fournit son
//     ancien mot de passe, qu'on revérifie. Sans cette revérification, un
//     camarade qui trouve un poste laissé ouvert volerait le compte.
//
//  B. PREMIÈRE CONNEXION : l'élève arrive depuis le lien reçu par courriel.
//     Il n'a NI session NI ancien mot de passe — c'est tout l'objet de la
//     démarche. Il présente le jeton de récupération émis par Supabase, que
//     Supabase seul valide. Sans cette entrée, le parcours « Première
//     connexion » ne peut pas aboutir : c'est le chemin qu'emprunte une
//     classe entière le premier jour.
// =====================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, 'Service non configuré.');
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const ancien = String(req.body?.ancien ?? '');
  const nouveau = String(req.body?.nouveau ?? '');
  const jeton = String(req.body?.jeton ?? '');

  if (nouveau.length < LONGUEUR_MIN) {
    return refus(res, 400,
      `Le mot de passe doit faire au moins ${LONGUEUR_MIN} caractères. ` +
      `Trois mots collés font l'affaire, et se retiennent.`);
  }

  try {
    let profil = null;

    if (jeton) {
      // ---- Entrée B : jeton de récupération reçu par courriel ----------
      // C'est Supabase qui dit à qui appartient ce jeton et s'il est encore
      // valable. Sa durée de vie est réglée dans le tableau de bord Supabase
      // (à ramener à 1 h) : c'est elle, et non nous, qui périme le lien.
      const porteur = await utilisateurDuJeton(jeton);
      if (!porteur) {
        return refus(res, 401,
          "Ce lien n'est plus valable. Il expire après un temps court, et il " +
          "ne sert qu'une fois. Demandez-en un nouveau depuis « Première " +
          "connexion », ou demandez à votre professeur.");
      }
      profil = (await lire('profils',
        `id=eq.${porteur.id}&select=id,email,role,actif`))[0];

    } else {
      // ---- Entrée A : session en cours + ancien mot de passe ------------
      const session = await ouvrir(
        lireCookie(req.headers.cookie), process.env.LFT_COOKIE_SECRET);
      if (!session) return refus(res, 401, 'Session expirée. Reconnectez-vous.');

      if (nouveau === ancien) {
        return refus(res, 400,
          "Le nouveau mot de passe doit être différent de l'ancien.");
      }

      profil = (await lire('profils',
        `id=eq.${session.sub}&select=id,email,role,actif`))[0];
      if (!profil || !profil.actif) {
        return refus(res, 401, 'Compte introuvable ou désactivé.');
      }
      if (!(await verifierMotDePasse(profil.email, ancien))) {
        return refus(res, 401, "L'ancien mot de passe est incorrect.");
      }
    }

    if (!profil || !profil.actif) {
      return refus(res, 401, 'Compte introuvable ou désactivé.');
    }

    await definirMotDePasse(profil.id, nouveau);
    await ecrire('profils', `id=eq.${profil.id}`,
      { mdp_provisoire: false, mdp_pose_le: new Date().toISOString() });

    // Cookie sans le drapeau « provisoire », sinon le portier renverrait
    // l'élève en boucle vers cette même page. Le rôle est celui lu EN BASE.
    const jetonSession = await sceller(
      { sub: profil.id, role: profil.role, prov: false },
      process.env.LFT_COOKIE_SECRET, 3600);
    res.setHeader('Set-Cookie', poserCookie(jetonSession, profil.role));
    res.status(200).json({ ok: true, role: profil.role });

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
