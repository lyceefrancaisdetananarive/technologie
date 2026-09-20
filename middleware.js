// =====================================================================
// Portier du site Technologie · Vercel Edge Middleware
//
// PRINCIPE (décision D16 du 17 septembre 2026) : le site est RÉSERVÉ. Sans
// compte, on voit l'accueil, la présentation pour les parents, la
// progression (les index de niveau, avec les titres des séquences), les
// pages légales et la connexion. Tout le reste, cours, activités, quiz,
// outils, classeur, exige une session ; les corrigés et l'espace enseignant
// exigent une session de professeur ; et un élève ne voit que les fiches de
// son niveau.
//
// La liste des pages PUBLIQUES est explicite, ci-dessous, et elle est
// courte. Ce qui n'y figure pas est fermé, et cette asymétrie est délibérée :
// une liste blanche se relit en dix secondes, et une page ajoutée par
// erreur est fermée par défaut, jamais ouverte par oubli.
//
// Les 165 QR codes collés dans les cahiers mènent à go.html, page publique
// qui résout le code puis saute vers la fiche : le portier renvoie alors à
// la connexion en gardant la fiche demandée (« suite »), et l'élève y
// arrive une fois identifié. Aucune adresse encodée ne change.
// =====================================================================

import { ouvrir, lireCookie } from './api/_lib/session.js';

export const config = {
  // On ne fait tourner le portier que là où il sert. Les quatre dossiers de
  // ressources sont servis directement par Vercel, sans latence ajoutée.
  //
  // Les exclusions portent sur les DOSSIERS, barre oblique comprise. Écrite
  // « (?!_next|img|css|js) », la regex exclurait aussi bien « /jsomething.html »
  // que « /js/ » : une page dont le nom commence par ces trois lettres
  // n'atteindrait jamais le portier et serait servie sans contrôle.
  matcher: [
    '/enseignant/:path*',
    '/classeur/:path*',
    '/((?!_next/|img/|css/|js/|fonts/).*)',
  ],
};

// L'hôte des sessions. Les QR codes imprimés en septembre 2026 encodent
// technologie-lft.vercel.app ; les fiches et les courriels disent
// techlft.egd.mg. Deux hôtes, c'est deux cookies, donc deux connexions pour
// le même élève dans la même heure. On ramène tout sur l'adresse du lycée,
// chemin et requête conservés : le code du cahier arrive au bon endroit.
const HOTE_ANCIEN = 'technologie-lft.vercel.app';
const HOTE = 'https://techlft.egd.mg';

// PAGES PUBLIQUES, en minuscules, telles que normaliser() les produit.
// « /5eme » et « /5eme/index.html » sont la progression du niveau : les
// titres des séquences, pas leur contenu.
const PAGES_PUBLIQUES = new Set([
  '/', '/index.html',
  '/parents.html',
  '/go.html',
  '/connexion.html', '/mot-de-passe-oublie.html', '/changer-mot-de-passe.html',
  '/accessibilite.html', '/donnees-personnelles.html', '/mentions-legales.html',
  '/5eme', '/5eme/', '/5eme/index.html',
  '/4eme', '/4eme/', '/4eme/index.html',
  '/3eme', '/3eme/', '/3eme/index.html',
  // Évaluation diagnostique de rentrée en ligne (D17) : envoyée par courriel avant
  // que les élèves aient leur mot de passe, sans corrigé, aucune donnée stockée.
  '/5eme/p1/diagnostique-en-ligne.html', '/4eme/p1/diagnostique-en-ligne.html', '/3eme/p1/diagnostique-en-ligne.html',
  '/5eme/p1/feuille-b-en-ligne.html', '/4eme/p1/feuille-b-en-ligne.html', '/3eme/p1/feuille-b-en-ligne.html',
  '/robots.txt', '/favicon.ico',
]);
// Les fonctions vérifient elles-mêmes la session ; les quatre dossiers de
// ressources sont déjà hors du matcher, listés ici pour que la règle se
// lise en un seul endroit.
const PREFIXES_PUBLICS = ['/api/', '/img/', '/css/', '/js/', '/fonts/'];

// Dossiers professeur, SANS barre finale. Vercel redirige « /enseignant/ »
// vers « /enseignant » puis sert index.html : le dossier lui-même doit être
// protégé autant que ce qu'il contient.
const DOSSIERS_PROF = ['/enseignant'];
const SUFFIXES_PROF = ['-prof.html'];
const NIVEAUX = ['5eme', '4eme', '3eme'];

/** Le chemin est-il ce dossier, ou quelque chose dedans ? */
function dansDossier(chemin, dossier) {
  return chemin === dossier || chemin.startsWith(dossier + '/');
}

// Les 29 pages -ebep NE SONT PAS des documents professeur. « B » veut dire
// « Version adaptée » : ces pages sont derrière 27 QR codes imprimés sur la
// même planche que les codes élèves et collés dans les cahiers. Elles
// demandent une session d'élève comme toute fiche (D16), jamais une session
// de professeur : les mettre en accès professeur casserait 27 codes déjà
// distribués, pour les élèves qui en ont le plus besoin.
//
// Les éléments de correction qu'en contenaient deux (seq7 de 3ème, seq9 de
// 4ème) ont été déplacés vers les fiches -prof correspondantes le 8 septembre
// 2026. Si une nouvelle page -ebep reçoit un corrigé, déplacer le corrigé,
// ne pas changer la règle.
const PAGES_PROF = [
  // Documents de travail du professeur qui ne portent pas le suffixe -prof :
  // la fiche de préparation de la première séance, le relevé des comptes
  // numériques d'un groupe, le diaporama de la première séance et le guide
  // d'utilisation. Ils ne sont liés que depuis l'espace enseignant.
  '/3eme/p1/seance1-preparation.html',
  '/3eme/p1/releve-comptes.html',
  '/3eme/p1/seance1-diaporama.pptx',
  '/guide-utilisation-site-technologie-lft.pptx',
];

// Le chemin d'une requête n'est PAS décodé par l'URL : `url.pathname` de
// « /5eme/p1/seq1%2Dprof.html » vaut littéralement « …seq1%2Dprof.html », et
// `.endsWith('-prof.html')` y répond false. Vercel, lui, décode avant de
// chercher le fichier sur le disque, et sert le corrigé. Sans cette
// normalisation, un seul caractère encodé traverse le portier : vérifié, la
// forme encodée renvoyait bien 200 en production.
//
// On décode donc, en boucle (une double encodage « %252D » se décode en
// « %2D », puis en « - »), on unifie la casse et les barres obliques, et on
// neutralise les segments « . » et « .. ». Un encodage malformé fait échouer
// le décodage : on renvoie alors un chemin qui n'est public nulle part, pour
// refuser plutôt que laisser passer.
function normaliser(chemin) {
  let c = chemin;
  for (let i = 0; i < 3; i++) {
    let d;
    try { d = decodeURIComponent(c); } catch { return '/interdit-encodage-invalide'; }
    if (d === c) break;
    c = d;
  }
  c = c.toLowerCase().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  // La barre finale doit survivre : « /5eme/ » et « /5eme » sont deux
  // entrées de la liste publique, et un dossier réduit à son nom ne doit
  // pas être confondu avec ce qu'il contient.
  const barreFinale = c.length > 1 && c.endsWith('/');
  const segments = [];
  for (const s of c.split('/')) {
    if (s === '' || s === '.') continue;
    if (s === '..') { segments.pop(); continue; }
    segments.push(s);
  }
  return '/' + segments.join('/') + (barreFinale && segments.length ? '/' : '');
}

/**
 * Ce que le chemin exige : { requis: null | 'connecte' | 'prof', niveau }.
 * Les règles professeur passent AVANT la liste publique : une entrée
 * ajoutée par erreur à la liste n'ouvrira jamais un corrigé. `niveau` est
 * posé pour toute fiche vivant sous /5eme, /4eme ou /3eme hors index : le
 * portier n'y laisse qu'un élève de ce niveau, ou un professeur.
 */
function exigence(cheminBrut) {
  const chemin = normaliser(cheminBrut);
  if (DOSSIERS_PROF.some((d) => dansDossier(chemin, d))) return { requis: 'prof', niveau: null };
  if (SUFFIXES_PROF.some((s) => chemin.endsWith(s))) return { requis: 'prof', niveau: null };
  if (PAGES_PROF.includes(chemin)) return { requis: 'prof', niveau: null };
  if (PAGES_PUBLIQUES.has(chemin)) return { requis: null, niveau: null };
  if (PREFIXES_PUBLICS.some((p) => chemin.startsWith(p))) return { requis: null, niveau: null };
  const premier = chemin.split('/')[1];
  const niveau = NIVEAUX.includes(premier) ? premier : null;
  return { requis: 'connecte', niveau };
}

export { normaliser, exigence };

// Response.redirect() rend des en-têtes immuables : impossible d'y poser
// « no-store ». Or une redirection vers la connexion ne doit jamais être
// gardée par un cache partagé (mandataire du lycée) : un second élève la
// recevrait à la place de la fiche.
function rediriger(vers) {
  return new Response(null, {
    status: 302,
    headers: { location: vers.toString(), 'cache-control': 'no-store' },
  });
}

function page(statut, titre, corps) {
  return new Response(
    '<!doctype html><html lang="fr"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${titre}</title>` +
    '<style>body{font-family:system-ui;max-width:32rem;margin:4rem auto;' +
    'padding:0 1rem;color:#323232;line-height:1.6}h1{color:#0096c8}' +
    'a{color:#0096c8}</style>' +
    `<h1>${titre}</h1>${corps}</html>`,
    { status: statut, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}

export default async function middleware(requete) {
  const url = new URL(requete.url);

  if (url.hostname === HOTE_ANCIEN) {
    return Response.redirect(new URL(url.pathname + url.search, HOTE), 308);
  }

  const { requis, niveau } = exigence(url.pathname);
  if (!requis) return;   // page publique : Vercel sert le fichier

  const secret = process.env.LFT_COOKIE_SECRET;
  const session = await ouvrir(lireCookie(requete.headers.get('cookie')), secret);
  const suite = url.pathname + url.search;

  // Aucune session valable : on renvoie vers la connexion en gardant la
  // destination, pour y revenir une fois identifié. « profil=prof »
  // présélectionne l'entrée professeur quand la page l'exige.
  if (!session) {
    const vers = new URL('/connexion.html', url.origin);
    vers.searchParams.set('suite', suite);
    if (requis === 'prof') vers.searchParams.set('profil', 'prof');
    return rediriger(vers);
  }

  // Session valable mais rôle insuffisant : un élève qui a deviné l'adresse
  // d'un corrigé. On ne redirige pas vers la connexion, il EST connecté :
  // on refuse, et on le dit clairement.
  if (requis === 'prof' && session.role !== 'prof') {
    return page(403, 'Cette page est réservée aux professeurs',
      '<p>Vous êtes bien connecté, mais cette page contient un corrigé ou un ' +
      'document de suivi. Elle ne vous est pas destinée.</p>' +
      '<p><a href="/">Revenir au site de Technologie</a></p>');
  }

  // Mot de passe encore provisoire : on ne laisse rien voir avant le
  // changement, sinon l'élève travaille toute l'année avec le mot de passe
  // que le professeur a dicté à voix haute devant la classe. La page
  // demandée est conservée : après le changement, l'élève y arrive.
  if (session.prov && !url.pathname.startsWith('/changer-mot-de-passe')) {
    const vers = new URL('/changer-mot-de-passe.html', url.origin);
    vers.searchParams.set('suite', suite);
    return rediriger(vers);
  }

  // Le niveau (décision D16). Un professeur n'est jamais filtré.
  if (niveau && session.role === 'eleve') {
    // Cookie scellé avant le 18 septembre 2026, sans niveau : on refait la
    // connexion, qui le posera. Pas de message, la page de connexion suffit.
    if (!Array.isArray(session.niv)) {
      const vers = new URL('/connexion.html', url.origin);
      vers.searchParams.set('suite', suite);
      return rediriger(vers);
    }
    if (!session.niv.length) {
      return page(403, 'Pas encore de groupe',
        '<p>Tu n’es inscrit dans aucun groupe pour le moment : demande à ton ' +
        'professeur. Tu pourras ouvrir cette page dès que ce sera fait.</p>' +
        '<p><a href="/">Revenir à l’accueil</a></p>');
    }
    if (!session.niv.includes(niveau)) {
      const mien = session.niv[0];
      const libelle = { '5eme': '5e', '4eme': '4e', '3eme': '3e' };
      return page(403, 'Pas cette année',
        `<p>Cette page fait partie du programme de ${libelle[niveau] ?? niveau}. ` +
        `Cette année, tu es en ${libelle[mien] ?? mien} : tu la retrouveras le moment venu.</p>` +
        `<p><a href="/${mien}/index.html">Voir mon programme de ${libelle[mien] ?? mien}</a></p>`);
    }
  }
}
