// =====================================================================
// Le cookie de session du site Technologie.
//
// POURQUOI NOTRE PROPRE COOKIE PLUTÔT QUE LE JETON SUPABASE ?
//
// 1. Le middleware doit décider en périphérie, sans appeler la base :
//    la liaison de Tananarive ne supporte pas un aller-retour de plus par
//    page. Il lui faut donc un jeton qu'il sache vérifier tout seul.
// 2. Supabase signe ses jetons tantôt en HS256, tantôt en ES256 selon
//    l'âge du projet. Dépendre de cela, c'est un système qui casse le jour
//    d'une migration côté fournisseur.
// 3. Le rôle NE DOIT JAMAIS venir de « user_metadata » : tout utilisateur
//    authentifié peut le réécrire lui-même avec updateUser(). Un élève de
//    3ème qui lit la documentation Supabase se ferait professeur en une
//    ligne. Le rôle est donc relu en base à la connexion, puis scellé ici.
//
// Le secret LFT_COOKIE_SECRET est distinct de celui de Supabase : la fuite
// de l'un ne compromet pas l'autre.
// =====================================================================

const NOM_COOKIE = 'lft_session';

// Base64url sans dépendance, valable en Edge comme en Node.
const enc = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const dec = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function cle(secret) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

/**
 * Scelle une session. `duree` en secondes.
 * charge = { sub, role, prov }  — rien de plus : ce cookie voyage à chaque
 * requête, il n'a pas à contenir le nom ni l'adresse de l'élève.
 */
export async function sceller(charge, secret, duree = 3600) {
  const corps = { ...charge, exp: Math.floor(Date.now() / 1000) + duree };
  const texte = enc(new TextEncoder().encode(JSON.stringify(corps)));
  const sig = await crypto.subtle.sign('HMAC', await cle(secret),
    new TextEncoder().encode(texte));
  return `${texte}.${enc(sig)}`;
}

/**
 * Vérifie et ouvre une session. Renvoie null à la moindre anomalie :
 * signature fausse, jeton expiré, format inattendu, secret absent.
 * On échoue TOUJOURS en position fermée.
 */
export async function ouvrir(jeton, secret) {
  try {
    if (!jeton || !secret) return null;
    const [texte, sig] = jeton.split('.');
    if (!texte || !sig) return null;

    const valide = await crypto.subtle.verify(
      'HMAC', await cle(secret), dec(sig),
      new TextEncoder().encode(texte)
    );
    if (!valide) return null;

    const corps = JSON.parse(new TextDecoder().decode(dec(texte)));
    if (!corps.exp || corps.exp < Math.floor(Date.now() / 1000)) return null;
    if (corps.role !== 'eleve' && corps.role !== 'prof') return null;
    return corps;
  } catch {
    return null;
  }
}

/** Lit le cookie de session dans un en-tête Cookie brut. */
export function lireCookie(entete) {
  if (!entete) return null;
  for (const part of entete.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === NOM_COOKIE) return v.join('=');
  }
  return null;
}

/**
 * En-tête Set-Cookie.
 *   HttpOnly : document.cookie ne le voit pas, donc pas de vol par XSS.
 *              (Cela ne le cache PAS des outils de développement : un élève
 *              assis devant une machine déverrouillée le lira. Seul le
 *              verrouillage de session protège de cela.)
 *   Secure   : jamais en clair sur le réseau du lycée.
 *   SameSite=Strict : le cookie n'accompagne aucune requête venue d'un autre
 *              site, ce qui neutralise la falsification de requête (CSRF).
 *   Pas de Max-Age : cookie de session, il meurt avec le navigateur. Sur un
 *              poste partagé, c'est la seule garantie qui ne dépende pas
 *              d'un élève qui pense à cliquer sur « Se déconnecter ».
 */
export function poserCookie(jeton) {
  return `${NOM_COOKIE}=${jeton}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function effacerCookie() {
  return `${NOM_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export { NOM_COOKIE };
