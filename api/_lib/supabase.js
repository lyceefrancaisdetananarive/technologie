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
  return Boolean(URL_BASE() && SERVICE() && ANON() && process.env.LFT_COOKIE_SECRET);
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
  if (!r.ok) throw new Error(`écriture ${table} : ${r.status} ${await r.text()}`);
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
