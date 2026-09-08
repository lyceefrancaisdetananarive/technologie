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

// Durée de vie d'un mot de passe PROVISOIRE, c'est-à-dire de celui que le
// professeur dicte à voix haute ou que l'élève reçoit par courriel. Passé ce
// délai, il ne connecte plus rien : la bandelette retrouvée dans une trousse
// à la période suivante est morte.
//
// 24 heures, et pas 30 minutes : un mot de passe donné en fin de séance doit
// encore servir le soir même à la maison. Et pas une semaine : le seul usage
// légitime est immédiat. En redonner un coûte un clic au professeur.
//
// Ce contrôle ne s'applique QUE tant que mdp_provisoire est vrai. Dès que
// l'élève a choisi son mot de passe, il ne s'applique plus jamais : sans
// cette précaution on l'enfermerait dehors le lendemain de sa connexion.
const PROVISOIRE_HEURES = 24;

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
      `email=eq.${encodeURIComponent(email)}` +
      `&select=id,role,actif,mdp_provisoire,mdp_pose_le,prenom`
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

    // 4. Le mot de passe est bon. Mais s'il est encore PROVISOIRE, a-t-il
    //    encore le droit de servir ? On refuse APRÈS avoir vérifié le mot de
    //    passe, jamais avant : sinon la page dirait à qui l'essaie que ce
    //    compte existe et qu'il attend sa première connexion.
    if (profil.mdp_provisoire) {
      const pose = Date.parse(profil.mdp_pose_le ?? '');
      const limite = Date.now() - PROVISOIRE_HEURES * 3600_000;
      if (!Number.isFinite(pose) || pose < limite) {
        return refus(res, 403,
          "Ce mot de passe provisoire a expiré : il ne sert que pendant " +
          `${PROVISOIRE_HEURES} heures. Demandez-en un nouveau à votre ` +
          "professeur, ou passez par « Première connexion ».");
      }
    }

    // 5. Le rôle est relu EN BASE. Jamais dans user_metadata, que
    //    l'utilisateur peut réécrire lui-même avec updateUser().
    const jeton = await sceller(
      { sub: profil.id, role: profil.role, prov: profil.mdp_provisoire },
      process.env.LFT_COOKIE_SECRET,
      3600
    );

    await ecrire('tentatives', `profil_id=eq.${profil.id}`, {}, 'DELETE').catch(() => {});
    await ecrire('profils', `id=eq.${profil.id}`,
      { derniere_connexion: new Date().toISOString() }).catch(() => {});

    res.setHeader('Set-Cookie', poserCookie(jeton, profil.role));
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
