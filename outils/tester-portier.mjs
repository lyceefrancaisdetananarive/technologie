// Teste la redirection de l'accueil par le portier (D24).
//   LFT_COOKIE_SECRET=essai node outils/tester-portier.mjs
// Aucun reseau, aucune base : le portier ne lit que le cookie scelle.
import middleware from '../middleware.js';
import { sceller, NOM_COOKIE } from '../api/_lib/session.js';

process.env.LFT_COOKIE_SECRET = process.env.LFT_COOKIE_SECRET || 'secret-de-test';
const S = process.env.LFT_COOKIE_SECRET;
const ORIGINE = 'https://techlft.egd.mg';

const requete = (chemin, jeton) => new Request(ORIGINE + chemin,
  { headers: jeton ? { cookie: `${NOM_COOKIE}=${jeton}` } : {} });
const cible = (r) => (r && r.status === 302) ? new URL(r.headers.get('location')).pathname : (r ? 'HTTP ' + r.status : 'servi');

const prof = await sceller({ sub: 'p1', role: 'prof', prov: false, niv: [] }, S, 600);
const eleve = await sceller({ sub: 'e1', role: 'eleve', prov: false, niv: ['5eme'] }, S, 600);
const provisoire = await sceller({ sub: 'e2', role: 'eleve', prov: true, niv: ['5eme'] }, S, 600);
const vieux = await sceller({ sub: 'e3', role: 'eleve', prov: false }, S, 600);   // sans niv
const falsifie = prof.slice(0, -4) + (prof.endsWith('AAAA') ? 'BBBB' : 'AAAA');

const cas = [
  ['visiteur sur /',                      '/',                   null,       'servi'],
  ['visiteur sur /index.html',            '/index.html',         null,       'servi'],
  ['professeur sur /',                    '/',                   prof,       '/enseignant/index.html'],
  ['professeur sur /index.html',          '/index.html',         prof,       '/enseignant/index.html'],
  ['eleve sur /',                         '/',                   eleve,      '/classeur/index.html'],
  ['eleve, mot de passe provisoire',      '/',                   provisoire, '/changer-mot-de-passe.html'],
  ['cookie sans niveaux, sur /',          '/',                   vieux,      '/classeur/index.html'],
  ['cookie falsifie sur /',               '/',                   falsifie,   'servi'],
  ['encodage /%69ndex.html, professeur',  '/%69ndex.html',       prof,       '/enseignant/index.html'],
  ['connexion NON redirigee, professeur', '/connexion.html',     prof,       'servi'],
  ['connexion NON redirigee, vieux cookie','/connexion.html',    vieux,      'servi'],
  ['parents, visiteur',                   '/parents.html',       null,       'servi'],
  ['parents, professeur (reste public)',  '/parents.html',       prof,       'servi'],
];
let echecs = 0;
for (const [nom, chemin, jeton, attendu] of cas) {
  const obtenu = cible(await middleware(requete(chemin, jeton)));
  const bon = obtenu === attendu;
  if (!bon) echecs++;
  console.log(`${bon ? 'ok     ' : 'ECHEC  '} ${nom.padEnd(42)} -> ${obtenu}${bon ? '' : '   (attendu : ' + attendu + ')'}`);
}
console.log(echecs ? `\n${echecs} echec(s)` : `\n${cas.length} cas, tous conformes`);
process.exit(echecs ? 1 : 0);
