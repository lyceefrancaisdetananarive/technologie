// =====================================================================
// Portier du site Technologie · Vercel Edge Middleware
//
// PRINCIPE : le site reste PUBLIC. Les 228 pages pédagogiques et les 165
// QR codes ne demandent aucun compte — une panne d'authentification ne doit
// jamais empêcher une séance d'avoir lieu, et un élève sans compte doit
// pouvoir scanner un QR code le premier jour.
//
// Seules trois familles d'adresses exigent une session. Elles sont listées
// explicitement ci-dessous : ce qui n'y figure pas est public, et cette
// asymétrie est délibérée. Une liste blanche de pages protégées se relit
// en dix secondes ; une liste noire de pages publiques se troue en silence
// chaque fois qu'on ajoute une page.
// =====================================================================

import { ouvrir, lireCookie } from './api/_lib/session.js';

export const config = {
  // On ne fait tourner le portier que là où il sert. Tout le reste du site
  // est servi directement par Vercel, sans latence ajoutée.
  //
  // Les exclusions portent sur les DOSSIERS, barre oblique comprise. Écrite
  // « (?!_next|img|css|js) », la regex exclurait aussi bien « /jsomething.html »
  // que « /js/ » : une page dont le nom commence par ces trois lettres
  // n'atteindrait jamais le portier, et un corrigé qui s'y trouverait serait
  // servi sans contrôle. Aucun chemin protégé n'est dans ce cas aujourd'hui
  // (ils vivent tous sous /3eme, /4eme, /5eme, /classeur et /enseignant),
  // mais c'est le genre de piège qui se referme le jour où l'on ajoute une page.
  matcher: [
    '/enseignant/:path*',
    '/classeur/:path*',
    '/((?!_next/|img/|css/|js/).*)',
  ],
};

// Dossiers protégés, SANS barre finale. Vercel redirige « /classeur/ » vers
// « /classeur » puis sert index.html : le chemin réellement servi n'a donc
// pas de barre finale, et un préfixe écrit « /classeur/ » ne l'attraperait
// pas. Le dossier lui-même doit être protégé autant que ce qu'il contient.
const DOSSIERS_PROF = ['/enseignant'];
const DOSSIERS_ELEVE = ['/classeur'];
const SUFFIXES_PROF = ['-prof.html'];

/** Le chemin est-il ce dossier, ou quelque chose dedans ? */
function dansDossier(chemin, dossier) {
  return chemin === dossier || chemin.startsWith(dossier + '/');
}

// Les 29 pages -ebep NE SONT PAS des documents professeur. « B » veut dire
// « Version adaptée » : ces pages sont derrière 27 QR codes imprimés sur la
// même planche que les codes élèves et collés dans les cahiers. Les mettre
// en accès professeur casserait 27 codes déjà distribués, pour les élèves
// qui en ont le plus besoin.
//
// Les éléments de correction qu'en contenaient deux (seq7 de 3ème, seq9 de
// 4ème) ont été déplacés vers les fiches -prof correspondantes le 8 septembre
// 2026. Aucune page -ebep ne porte plus de réponse : les 27 codes restent
// ouverts. Si une nouvelle page -ebep reçoit un corrigé, déplacer le corrigé,
// ne pas fermer la page.
const PAGES_PROF = [];

// Le chemin d'une requête n'est PAS décodé par l'URL : `url.pathname` de
// « /5eme/p1/seq1%2Dprof.html » vaut littéralement « …seq1%2Dprof.html », et
// `.endsWith('-prof.html')` y répond false. Vercel, lui, décode avant de
// chercher le fichier sur le disque, et sert le corrigé. Sans cette
// normalisation, un seul caractère encodé traverse le portier : vérifié, la
// forme encodée renvoie bien 200 en production.
//
// On décode donc, en boucle (une double encodage « %252D » se décode en
// « %2D », puis en « - »), on unifie la casse et les barres obliques, et on
// neutralise les segments « . » et « .. ». Un encodage malformé fait échouer
// le décodage : on renvoie alors le chemin le plus défavorable, pour refuser
// plutôt que laisser passer.
function normaliser(chemin) {
  let c = chemin;
  for (let i = 0; i < 3; i++) {
    let d;
    try { d = decodeURIComponent(c); } catch { return '/interdit-encodage-invalide'; }
    if (d === c) break;
    c = d;
  }
  c = c.toLowerCase().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  // La barre finale doit survivre : les préfixes protégés s'écrivent
  // « /classeur/ », et un chemin réduit à « /classeur » ne les reconnaîtrait
  // plus. C'est le genre de détail qui ouvre un dossier entier en silence.
  const barreFinale = c.length > 1 && c.endsWith('/');
  const segments = [];
  for (const s of c.split('/')) {
    if (s === '' || s === '.') continue;
    if (s === '..') { segments.pop(); continue; }
    segments.push(s);
  }
  return '/' + segments.join('/') + (barreFinale && segments.length ? '/' : '');
}

function exigence(cheminBrut) {
  const chemin = normaliser(cheminBrut);
  if (DOSSIERS_PROF.some((d) => dansDossier(chemin, d))) return 'prof';
  if (SUFFIXES_PROF.some((s) => chemin.endsWith(s))) return 'prof';
  if (PAGES_PROF.includes(chemin)) return 'prof';
  if (DOSSIERS_ELEVE.some((d) => dansDossier(chemin, d))) return 'connecte';
  return null;
}

export { normaliser };

export default async function middleware(requete) {
  const url = new URL(requete.url);
  const requis = exigence(url.pathname);

  if (!requis) return;   // page publique : Vercel sert le fichier

  const secret = process.env.LFT_COOKIE_SECRET;
  const session = await ouvrir(lireCookie(requete.headers.get('cookie')), secret);

  // Aucune session valable : on renvoie vers la connexion en gardant la
  // destination, pour y revenir une fois identifié.
  if (!session) {
    const vers = new URL('/connexion.html', url.origin);
    vers.searchParams.set('suite', url.pathname + url.search);
    return Response.redirect(vers, 302);
  }

  // Session valable mais rôle insuffisant : un élève qui a deviné l'adresse
  // d'un corrigé. On ne redirige pas vers la connexion — il EST connecté —
  // on refuse, et on le dit clairement.
  if (requis === 'prof' && session.role !== 'prof') {
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Accès refusé</title>' +
      '<style>body{font-family:system-ui;max-width:32rem;margin:4rem auto;' +
      'padding:0 1rem;color:#323232;line-height:1.6}h1{color:#0096c8}</style>' +
      '<h1>Cette page est réservée aux professeurs</h1>' +
      '<p>Vous êtes bien connecté, mais cette page contient un corrigé ou un ' +
      'document de suivi. Elle ne vous est pas destinée.</p>' +
      '<p><a href="/">Revenir au site de Technologie</a></p>',
      { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  // Mot de passe encore provisoire : on ne laisse rien voir avant le
  // changement, sinon l'élève travaille toute l'année avec le mot de passe
  // que le professeur a dicté à voix haute devant la classe.
  if (session.prov && !url.pathname.startsWith('/changer-mot-de-passe')) {
    return Response.redirect(new URL('/changer-mot-de-passe.html', url.origin), 302);
  }
}
