import { sceller, poserCookie } from '../_lib/session.js';
import { roleTenable, niveauxDe } from '../_lib/autorisation.js';
import {
  verifierMotDePasse, lire, ecrire, configuree, origineLegitime, refus,
} from '../_lib/supabase.js';

// Message unique pour tout échec. Ne jamais distinguer « adresse inconnue »
// de « mot de passe faux » : la différence dirait à un élève curieux qui
// possède un compte dans l'établissement.
// Le même message pour un mot de passe faux, une adresse inconnue et un
// compte mis en pause : rien ne dit à qui essaie si l'adresse existe.
const ECHEC = 'Adresse ou mot de passe incorrect. Après plusieurs essais, le '
  + 'compte se met en pause un quart d’heure : passez alors par « Première '
  + 'connexion » pour choisir un nouveau mot de passe.';

// LE VERROU (CNIL, délibération n° 2022-100 ; ANSSI). À partir de
// SEUIL_PAUSE échecs sur la fenêtre, chaque essai attend un délai qui
// double (0,5 s, 1 s, 2 s, 4 s) AVANT que le mot de passe soit vérifié ; à
// partir de MAX_TENTATIVES, le compte est en pause jusqu'à la fin de la
// fenêtre, mot de passe juste compris, et Supabase n'est plus sollicité.
//
// La pause s'applique aussi au titulaire : c'est le prix d'une restriction
// réelle. Le titulaire a toujours une issue immédiate qui ne passe pas par
// ce verrou : le lien « Première connexion », ou la réinitialisation par son
// professeur. Un compteur par compte, jamais par adresse IP : le lycée sort
// sur une seule adresse, un compteur par IP fermerait la porte à tout le
// monde à la première classe qui se trompe.
const SEUIL_PAUSE = 5;
const MAX_TENTATIVES = 10;
const FENETRE_MINUTES = 15;
const DELAI_MAX_MS = 4000;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Durée de la session, en secondes, selon le rôle.
//
// Une heure pour un professeur, c'est la classe suivante : connecté à 8h05
// pour projeter un corrigé, il l'est encore à 9h05, quand vingt-huit autres
// élèves se sont installés devant le même poste. Trente minutes ferment la
// séance sans la déborder. L'élève garde une heure : sa session n'ouvre que
// son propre classeur, et l'expirer en pleine activité coûterait un dépôt.
//
// La session du professeur se réarme à chaque correction enregistrée (voir
// api/prof/corriger.js) : corriger vingt-cinq rendus ne déconnecte donc pas.
// Le réarmement est volontairement lié à une ÉCRITURE et non à une lecture :
// une prolongation déclenchée par la simple consultation serait entretenue
// par l'élève même qui exploite la session restée ouverte.
// Élève : deux heures. Chaque élève ouvre sa session à chaque séance
// (décision D15, question 12), et une séance dure 1 h 30 : une heure
// expirait au milieu du dépôt. Le cookie reste sans Max-Age, donc il meurt
// avec le navigateur, et le plafond absolu de quatre heures s'applique.
const DUREE = { prof: 1800, eleve: 7200 };

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
      `&select=id,email,role,actif,mdp_provisoire,mdp_pose_le,prenom`
    );
    const profil = profils[0];

    // 2. Le verrou, AVANT la vérification. On lit les échecs récents du
    //    compte ; une adresse inconnue reçoit le même délai de base, pour
    //    que le temps de réponse ne dise pas si le compte existe.
    let echecs = 0;
    if (profil) {
      const depuis = new Date(Date.now() - FENETRE_MINUTES * 60000).toISOString();
      const lignes = await lire('tentatives',
        `profil_id=eq.${profil.id}&origine=eq.connexion&quand=gte.${depuis}&select=id`)
        .catch((e) => {
          // Compteur illisible : on ne laisse pas passer sans ralentir, mais
          // on ne ferme pas la porte à tout le monde sur une panne de table.
          console.error('connexion : compteur illisible,', e.message);
          return new Array(SEUIL_PAUSE).fill(null);
        });
      echecs = lignes.length;
    }
    if (echecs >= MAX_TENTATIVES) {
      await attendre(DELAI_MAX_MS);
      return refus(res, 401, ECHEC);
    }
    if (echecs >= SEUIL_PAUSE || !profil) {
      const rang = profil ? echecs - SEUIL_PAUSE : 0;
      await attendre(Math.min(DELAI_MAX_MS, 500 * 2 ** rang));
    }

    // 3. Le mot de passe.
    const id = await verifierMotDePasse(email, motDePasse);
    const bon = Boolean(id && profil && profil.id === id);

    if (!bon || !profil.actif) {
      // On ne compte que les vrais échecs de mot de passe. Un mot de passe
      // JUSTE sur un compte désactivé n'est pas une tentative de devinette :
      // le compter polluerait le verrou sans rien protéger.
      if (profil && !bon) {
        await ecrire('tentatives', '',
          { profil_id: profil.id, origine: 'connexion' }, 'POST').catch(() => {});
        if (echecs + 1 >= MAX_TENTATIVES) {
          console.error('connexion : compte mis en pause après', echecs + 1, 'échecs');
        }
      }
      return refus(res, 401, ECHEC);
    }

    // Le rôle est-il encore tenable ? profils.role dit ce qui a été décidé
    // un jour ; PROFS_TECHNO dit ce qui est vrai aujourd'hui. Sans cela,
    // retirer une adresse de la liste ne révoquait rien du tout.
    if (!roleTenable(profil)) {
      return refus(res, 403,
        "Votre compte n'est plus autorisé. Adressez-vous à l'administrateur "
        + 'du site.');
    }

    // 4. Le mot de passe est bon. Mais s'il est encore PROVISOIRE, a-t-il
    //    encore le droit de servir ? On refuse APRÈS avoir vérifié le mot de
    //    passe, jamais avant : sinon la page dirait à qui l'essaie que ce
    //    compte existe et qu'il attend sa première connexion.
    if (profil.mdp_provisoire) {
      const pose = Date.parse(profil.mdp_pose_le ?? '');
      const limite = Date.now() - PROVISOIRE_HEURES * 3600_000;
      // Une date ABSENTE ne périme rien. Voir le contrat de la colonne dans
      // db/01-schema.sql : NULL veut dire « aucun mot de passe provisoire n'a
      // été remis à quelqu'un par ce code », donc il n'y a rien à périmer.
      // Traiter NULL comme « expiré » refusait tous les comptes importés,
      // c'est-à-dire toute une rentrée.
      if (Number.isFinite(pose) && pose < limite) {
        return refus(res, 403,
          "Ce mot de passe provisoire a expiré : il ne sert que pendant " +
          `${PROVISOIRE_HEURES} heures. Demandez-en un nouveau à votre ` +
          "professeur, ou passez par « Première connexion ».");
      }
    }

    // 5. Le rôle est relu EN BASE. Jamais dans user_metadata, que
    //    l'utilisateur peut réécrire lui-même avec updateUser().
    //    Les niveaux d'un élève sont lus ici, une fois pour toute la
    //    session : le portier n'appelle jamais la base (décision D16).
    const niv = await niveauxDe(profil);
    const jeton = await sceller(
      { sub: profil.id, role: profil.role, prov: profil.mdp_provisoire, niv },
      process.env.LFT_COOKIE_SECRET,
      DUREE[profil.role] ?? 1800
    );

    await ecrire('tentatives',
      `profil_id=eq.${profil.id}&origine=eq.connexion`, {}, 'DELETE').catch(() => {});
    await ecrire('profils', `id=eq.${profil.id}`,
      { derniere_connexion: new Date().toISOString() }).catch(() => {});

    res.setHeader('Set-Cookie',
      poserCookie(jeton, profil.role, DUREE[profil.role] ?? 1800, niv));
    res.status(200).json({
      ok: true,
      role: profil.role,
      prenom: profil.prenom,
      niveaux: niv ?? null,
      motDePasseProvisoire: profil.mdp_provisoire,
    });
  } catch (e) {
    console.error('connexion :', e.message);
    refus(res, 500, "Le service d'authentification est momentanément indisponible.");
  }
}
