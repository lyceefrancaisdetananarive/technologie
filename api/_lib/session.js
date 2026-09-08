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

// Le témoin. Il ne contient AUCUN jeton et AUCUNE identité : seulement le
// rôle, en clair, pour que les 228 pages sachent afficher un avertissement
// sans un octet de réseau. Le cookie de session, lui, est HttpOnly : le
// JavaScript des pages ne peut ni le lire ni l'effacer, donc sans ce témoin
// une session laissée ouverte est rigoureusement invisible.
//
// C'EST UN VOYANT, PAS UNE BARRIÈRE. Un élève peut l'effacer lui-même dans
// son navigateur : il n'y gagne rien, la session reste ce qu'elle est et le
// portier décide toujours sur le cookie scellé. Ne jamais fonder un contrôle
// d'accès dessus.
const NOM_TEMOIN = 'lft_ouvert';

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
// PLAFOND ABSOLU DE SESSION.
//
// La session du professeur se réarme à chaque correction enregistrée, pour
// qu'une série de corrections ne soit pas interrompue. Sans plafond, ce
// réarmement n'a aucune fin : celui qui s'assoit devant une session laissée
// ouverte peut enregistrer une correction toutes les vingt-neuf minutes et la
// maintenir vivante toute la journée. `dep` porte l'heure de la connexion
// INITIALE, il est recopié tel quel à chaque réarmement, et il n'est jamais
// repoussé. Passé ce délai, il faut retaper son mot de passe, point.
const PLAFOND_SECONDES = 4 * 3600;

export async function sceller(charge, secret, duree = 3600) {
  const maintenant = Math.floor(Date.now() / 1000);
  const corps = {
    ...charge,
    dep: charge.dep ?? maintenant,
    exp: maintenant + duree,
  };
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
    const maintenant = Math.floor(Date.now() / 1000);
    if (!corps.exp || corps.exp < maintenant) return null;
    // Plafond absolu : une session réarmée indéfiniment finit quand même.
    if (!corps.dep || maintenant - corps.dep > PLAFOND_SECONDES) return null;
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
export function poserCookie(jeton, role, duree = 3600) {
  const cookies = [
    `${NOM_COOKIE}=${jeton}; Path=/; HttpOnly; Secure; SameSite=Strict`,
  ];
  // Le témoin accompagne la session et meurt avec elle. Pas de HttpOnly,
  // puisque tout son intérêt est d'être lisible par js/components.js.
  //
  // Il porte SA PROPRE ÉCHÉANCE dans sa valeur, « prof.1789456123 ». Sans
  // elle, le témoin survivait au sceau : la session expirait au bout de
  // trente minutes mais le bandeau rouge restait affiché, à réclamer la
  // fermeture d'une session déjà morte. Un avertissement qui se trompe finit
  // par ne plus être lu. Pas de Max-Age pour autant : le témoin doit mourir
  // avec le navigateur, comme le sceau.
  if (role === 'eleve' || role === 'prof') {
    const jusqua = Math.floor(Date.now() / 1000) + duree;
    cookies.push(
      `${NOM_TEMOIN}=${role}.${jusqua}; Path=/; Secure; SameSite=Strict`);
  }
  return cookies;
}

export function effacerCookie() {
  return [
    `${NOM_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${NOM_TEMOIN}=; Path=/; Secure; SameSite=Strict; Max-Age=0`,
  ];
}

export { NOM_COOKIE, NOM_TEMOIN };
