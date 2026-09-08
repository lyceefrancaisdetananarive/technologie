import { sceller, poserCookie } from '../_lib/session.js';
import {
  verifierMotDePasse, lire, ecrire, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// Message unique pour tout échec. Ne jamais distinguer « adresse inconnue »
// de « mot de passe faux » : la différence dirait à un élève curieux qui
// possède un compte dans l'établissement.
const ECHEC = "Adresse ou mot de passe incorrect.";

// Verrou par COMPTE et non par adresse IP : le lycée sort par une seule IP
// publique, un verrou par IP bloquerait une classe entière dès qu'un élève
// se trompe cinq fois.
const MAX_TENTATIVES = 8;
const FENETRE_MINUTES = 15;

export default async function handler(req, res) {
  if (req.method !== 'POST') return refus(res, 405, 'Méthode non autorisée.');
  if (!configuree()) return refus(res, 503, "Le service n'est pas encore configuré.");
  if (!origineLegitime(req)) return refus(res, 403, 'Origine non autorisée.');

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const motDePasse = String(req.body?.motDePasse ?? '');
  if (!email || !motDePasse) return refus(res, 400, ECHEC);

  try {
    // 1. La personne figure-t-elle sur la liste d'autorisation ?
    //    On regarde AVANT de solliciter Supabase Auth : un compte peut
    //    exister côté authentification et avoir été désactivé ici.
    const profils = await lire(
      'profils',
      `email=eq.${encodeURIComponent(email)}&select=id,role,actif,mdp_provisoire,prenom`
    );
    const profil = profils[0];

    // 2. Verrou de compte.
    const depuis = new Date(Date.now() - FENETRE_MINUTES * 60000).toISOString();
    const echecs = profil
      ? await lire('tentatives',
          `profil_id=eq.${profil.id}&quand=gte.${depuis}&select=id`)
      : [];
    if (echecs.length >= MAX_TENTATIVES) {
      return refus(res, 429,
        `Trop d'essais. Réessayez dans ${FENETRE_MINUTES} minutes, ou ` +
        `demandez à votre professeur de réinitialiser votre accès.`);
    }

    // 3. Le mot de passe.
    const id = await verifierMotDePasse(email, motDePasse);

    if (!id || !profil || profil.id !== id || !profil.actif) {
      if (profil) {
        await ecrire('tentatives', '', { profil_id: profil.id }, 'POST').catch(() => {});
      }
      return refus(res, 401, ECHEC);
    }

    // 4. Le rôle est relu EN BASE. Jamais dans user_metadata, que
    //    l'utilisateur peut réécrire lui-même avec updateUser().
    const jeton = await sceller(
      { sub: profil.id, role: profil.role, prov: profil.mdp_provisoire },
      process.env.LFT_COOKIE_SECRET,
      3600
    );

    await ecrire('tentatives', `profil_id=eq.${profil.id}`, {}, 'DELETE').catch(() => {});
    await ecrire('profils', `id=eq.${profil.id}`,
      { derniere_connexion: new Date().toISOString() }).catch(() => {});

    res.setHeader('Set-Cookie', poserCookie(jeton));
    res.status(200).json({
      ok: true,
      role: profil.role,
      prenom: profil.prenom,
      motDePasseProvisoire: profil.mdp_provisoire,
    });
  } catch (e) {
    console.error('connexion :', e.message);
    refus(res, 500, "Le service d'authentification est momentanément indisponible.");
  }
}
