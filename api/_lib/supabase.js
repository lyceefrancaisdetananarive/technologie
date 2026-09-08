// =====================================================================
// Accès à Supabase depuis les fonctions Vercel, sans aucune dépendance npm.
// Node 20 a fetch nativement : le site n'a toujours pas d'étape de
// compilation, et le dépôt n'a pas de node_modules à auditer.
// =====================================================================

const URL_BASE = () => process.env.SUPABASE_URL;

/** Clé de service : ignore le RLS. Ne doit JAMAIS sortir d'ici. */
const SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Clé anon : publique, sert à vérifier un mot de passe. */
const ANON = () => process.env.SUPABASE_ANON_KEY;

export function configuree() {
  // PROFS_TECHNO est exigée au même titre que les clés. Sans elle,
  // profsAutorises() renverrait une liste vide, et le contrôle continu du
  // rôle rétrograderait TOUS les professeurs d'un coup, un lundi matin, sur
  // un simple oubli au redéploiement. Une panne franche en 503 se répare en
  // une minute ; une rétrogradation silencieuse ne se voit pas.
  return Boolean(URL_BASE() && SERVICE() && ANON()
    && process.env.LFT_COOKIE_SECRET && profsAutorises().length);
}

/** Vérifie une paire adresse / mot de passe. Renvoie l'id, ou null. */
export async function verifierMotDePasse(email, motDePasse) {
  const r = await fetch(`${URL_BASE()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON(), 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d?.user?.id ?? null;
}

/** Lecture en base avec la clé de service (RLS ignoré). */
export async function lire(table, requete) {
  const r = await fetch(`${URL_BASE()}/rest/v1/${table}?${requete}`, {
    headers: { apikey: SERVICE(), authorization: `Bearer ${SERVICE()}` },
  });
  if (!r.ok) throw new Error(`lecture ${table} : ${r.status}`);
  return r.json();
}

/** Écriture en base avec la clé de service. */
export async function ecrire(table, requete, corps, methode = 'PATCH') {
  const r = await fetch(`${URL_BASE()}/rest/v1/${table}?${requete}`, {
    method: methode,
    headers: {
      apikey: SERVICE(),
      authorization: `Bearer ${SERVICE()}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(corps),
  });
  if (!r.ok) {
    // ERREUR STRUCTURÉE, et non une chaîne à fouiller.
    //
    // La version précédente concaténait le statut ET le corps dans le
    // message, et les appelants testaient `includes('409')`. Un corps
    // contenant « 409 » pour une autre raison passait alors pour un doublon,
    // et l'inscription rapportait un succès là où rien n'avait été écrit.
    // On expose donc le statut et le SQLSTATE de PostgREST séparément.
    let corps = {};
    try { corps = JSON.parse(await r.text()); } catch { /* corps non JSON */ }
    const e = new Error(`écriture ${table} : ${r.status} ${corps.message ?? ''}`);
    e.statut = r.status;
    e.code = corps.code ?? null;         // 23505 = doublon, 23503 = clé absente
    throw e;
  }
  return r.json();
}

/** Change le mot de passe d'un compte (API d'administration). */
export async function definirMotDePasse(idUtilisateur, motDePasse) {
  const r = await fetch(`${URL_BASE()}/auth/v1/admin/users/${idUtilisateur}`, {
    method: 'PUT',
    headers: {
      apikey: SERVICE(),
      authorization: `Bearer ${SERVICE()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ password: motDePasse }),
  });
  if (!r.ok) throw new Error(`mot de passe : ${r.status}`);
  return true;
}

/**
 * À qui appartient ce jeton de récupération ? Sert au parcours « première
 * connexion » : l'élève arrive depuis le lien reçu par courriel, il n'a ni
 * session ni ancien mot de passe, et sans cela il ne peut rien faire.
 *
 * Le jeton est vérifié PAR SUPABASE, jamais par nous, et il ne quitte pas le
 * serveur : la page le transmet à /api/, elle ne parle pas à Supabase. Cela
 * évite de publier l'URL et la clé anon dans les 228 pages.
 */
export async function utilisateurDuJeton(jeton) {
  const r = await fetch(`${URL_BASE()}/auth/v1/user`, {
    headers: { apikey: ANON(), authorization: `Bearer ${jeton}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u?.id) return null;
  return { id: u.id, email: String(u.email ?? '').toLowerCase() };
}

/** Demande à Supabase d'envoyer le courriel de réinitialisation. */
export async function envoyerLienReinitialisation(email, origine) {
  const r = await fetch(`${URL_BASE()}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: ANON(), 'content-type': 'application/json' },
    body: JSON.stringify({ email, redirect_to: `${origine}/changer-mot-de-passe.html` }),
  });
  return r.ok;
}

/**
 * Défense en profondeur contre la falsification de requête. Le cookie est
 * déjà SameSite=Strict ; cette vérification rattrape les navigateurs qui
 * l'ignoreraient et les appels forgés depuis un autre site.
 */
export function origineLegitime(requete) {
  const origine = requete.headers.origin || requete.headers.referer;
  if (!origine) return false;
  const hote = requete.headers.host;
  try {
    return new URL(origine).host === hote;
  } catch {
    return false;
  }
}

/** Réponse d'erreur uniforme : jamais de détail exploitable. */
export function refus(res, code, message) {
  res.status(code).json({ ok: false, message });
}

// =====================================================================
// STOCKAGE DES FICHIERS
// Le navigateur n'a pas de session Supabase : il ne peut ni écrire ni lire
// directement. Ces deux fonctions émettent des URL signées, temporaires et
// verrouillées sur un chemin, APRÈS que /api/ a vérifié qui appelle.
// =====================================================================

/** Autorisation d'écriture, valable quelques minutes, sur ce chemin exact. */
export async function urlDepotSignee(chemin) {
  const r = await fetch(
    `${URL_BASE()}/storage/v1/object/upload/sign/rendus/${chemin}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE(),
        authorization: `Bearer ${SERVICE()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 300 }),   // 5 minutes
    });
  if (!r.ok) throw new Error(`url de dépôt : ${r.status} ${await r.text()}`);
  const d = await r.json();
  return `${URL_BASE()}/storage/v1${d.url}`;
}

/** Autorisation de lecture, valable le temps de consulter la copie. */
export async function urlLectureSignee(chemin, secondes = 300) {
  const r = await fetch(`${URL_BASE()}/storage/v1/object/sign/rendus/${chemin}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE(),
      authorization: `Bearer ${SERVICE()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: secondes }),
  });
  if (!r.ok) throw new Error(`url de lecture : ${r.status}`);
  const d = await r.json();
  return `${URL_BASE()}/storage/v1${d.signedURL}`;
}

/** Supprime un fichier (purge de fin d'année, remplacement d'un dépôt). */
export async function supprimerFichier(chemin) {
  const r = await fetch(`${URL_BASE()}/storage/v1/object/rendus/${chemin}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE(), authorization: `Bearer ${SERVICE()}` },
  });
  return r.ok;
}

/**
 * Crée un compte d'authentification avec un mot de passe ALÉATOIRE que
 * personne ne lit, pas même l'appelant. Son titulaire passera forcément par
 * « Première connexion » pour choisir le sien.
 *
 * C'est délibéré : un mot de passe que quelqu'un a vu est un mot de passe à
 * périmer, à dicter et à journaliser. Ici il n'y a rien à transmettre, donc
 * rien à perdre en route, et mdp_pose_le peut rester NULL comme le veut le
 * contrat du schéma.
 */
export async function creerUtilisateur(email) {
  const alea = crypto.getRandomValues(new Uint8Array(32));
  const motDePasse = btoa(String.fromCharCode(...alea)).slice(0, 40);
  const r = await fetch(`${URL_BASE()}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE(),
      authorization: `Bearer ${SERVICE()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password: motDePasse, email_confirm: true }),
  });
  if (r.status === 422) return null;          // l'adresse existe déjà
  if (!r.ok) throw new Error(`création compte : ${r.status}`);
  const u = await r.json();
  return u?.id ?? null;
}

/** Cherche un compte d'authentification par son adresse. */
export async function utilisateurParEmail(email) {
  const r = await fetch(
    `${URL_BASE()}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: { apikey: SERVICE(), authorization: `Bearer ${SERVICE()}` } });
  if (!r.ok) return null;
  const d = await r.json();
  const u = (d?.users ?? []).find(
    (x) => String(x.email ?? '').toLowerCase() === email.toLowerCase());
  return u?.id ?? null;
}

/**
 * La liste des adresses autorisées à porter le rôle PROFESSEUR.
 *
 * Elle vit dans la variable d'environnement PROFS_TECHNO, que seul
 * l'administrateur du projet Vercel peut modifier, et JAMAIS dans le dépôt,
 * qui est public : publier les adresses professionnelles de collègues sans
 * leur accord serait une faute.
 *
 * C'est la barrière contre l'escalade de privilège. Sans elle, un professeur
 * dont la session reste ouverte sur un poste de salle informatique permettrait
 * à qui s'assoit devant de se fabriquer un compte professeur permanent, qui
 * survivrait à la fermeture du navigateur et ouvrirait les 32 corrigés.
 * Ajouter un collègue devient alors un geste d'administration, fait une fois,
 * et non un bouton dans une page.
 *
 * Séparateurs acceptés : virgule, point-virgule, espace, retour à la ligne.
 */
export function profsAutorises() {
  // EXTRACTION PAR MOTIF, ET NON PAR DÉCOUPAGE.
  //
  // Le contenu exact de cette variable n'est pas connu du code : elle a été
  // remplie à la main dans Vercel, et elle est marquée secrète, donc illisible
  // depuis le tableau de bord. Découper sur des séparateurs supposés faisait
  // dépendre l'accès de TOUTE l'équipe d'un format deviné : une liste écrite
  // en JSON, avec des noms devant les adresses, ou séparée autrement, aurait
  // rendu la liste vide ou inexacte, et le contrôle continu du rôle aurait
  // enfermé les quatre professeurs dehors sans rien expliquer.
  //
  // On cherche donc les adresses là où elles sont, quel que soit ce qui les
  // entoure : guillemets, crochets, virgules, chevrons, retours à la ligne.
  return (String(process.env.PROFS_TECHNO ?? '')
    .toLowerCase()
    .match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? []);
}
