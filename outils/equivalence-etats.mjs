// =====================================================================
// Preuve d'equivalence : la fonction unique etatFiche() rend-elle bien ce que
// rendaient les quatre implementations d'origine ?
//
// Ecrit le 30 septembre 2026, au moment de reduire ces quatre copies a une
// seule. Les quatre fonctions d'origine sont recopiees telles qu'elles
// etaient, et confrontees a la nouvelle sur toutes les combinaisons
// d'entree. Trois ecarts sont voulus : ils corrigent des defauts latents de
// api/prof/fiche-eleve.js. Tout autre ecart est une regression.
//
// Usage : node outils/equivalence-etats.mjs
// =====================================================================

import { etatFiche, A_FAIRE } from '../js/etats-fiche.js';

// les quatre implementations d'origine, recopiees telles quelles
const ancien = {
  'api/prof/reponses.js': ({ corrigeLe, ligneFiche, nbChamps, ligneLibre }) => {
    let etat = 'en cours';
    if (corrigeLe) etat = 'corrigee';
    else if (ligneFiche) etat = ligneFiche.texte === 'terminee' ? 'terminee' : 'en cours';
    else if (ligneLibre && nbChamps === 0) etat = 'libre';
    return etat;
  },
  'api/prof/fiche-eleve.js': ({ corrigeLe, ligneFiche }) =>
    !ligneFiche ? 'encours'
      : corrigeLe ? 'corrigee'
      : (ligneFiche.texte || '').trim() === 'terminee' ? 'terminee' : 'encours',
  'enseignant/classeur.html': ({ corrigeLe, ligneFiche, nbChamps }) =>
    corrigeLe ? 'corrigee'
      : ligneFiche ? (ligneFiche.texte === 'terminee' ? 'terminee' : 'en cours')
      : nbChamps ? 'en cours' : 'libre',
  'classeur/index.html': ({ corrigeLe, ligneFiche, nbChamps }) =>
    corrigeLe ? 'corrigee'
      : ligneFiche?.texte === 'terminee' ? 'terminee'
      : (!ligneFiche && !nbChamps) ? 'libre' : 'en cours',
};

// toutes les combinaisons d'entree
const cas = [];
for (const corrigeLe of [null, '2026-09-26T10:00:00Z'])
  for (const ligneFiche of [null, { texte: 'en cours' }, { texte: 'terminee' }])
    for (const nbChamps of [0, 3])
      for (const ligneLibre of [null, { texte: 'bla' }])
        cas.push({ corrigeLe, ligneFiche, nbChamps, ligneLibre });

// Une entree est ATTEIGNABLE si au moins une ligne existe : les agregateurs
// sautent les fiches sans aucune ligne (`continue`). Une date de correction
// sans aucune ligne est impossible par construction : la correction est
// portee PAR une ligne, celle de la fiche ou celle de la reponse libre.
const atteignable = (c) => !!(c.ligneFiche || c.nbChamps > 0 || c.ligneLibre);
const impossible  = (c) => !!c.corrigeLe && !c.ligneFiche && !c.ligneLibre;

let ecarts = 0, verifies = 0, attendus = [];
for (const c of cas) {
  const neuf = etatFiche(c);
  if (impossible(c)) continue;
  if (!atteignable(c)) {
    if (neuf !== A_FAIRE) { console.log('!! cas inatteignable mal classe', c, neuf); ecarts++; }
    continue;
  }
  for (const [nom, fn] of Object.entries(ancien)) {
    const vieux = fn(c);
    // fiche-eleve.js ecrivait 'encours' la ou les trois autres ecrivent 'en cours'
    const normalise = (x) => (x === 'encours' ? 'en cours' : x);
    let memeChose = normalise(vieux) === neuf;
    // Deux defauts latents de fiche-eleve.js que l'unification repare :
    //  a) il ignorait l'etat 'libre' ;
    //  b) il ne lisait corrige_le QUE sur la ligne « fiche », donc une fiche
    //     d'avant le 20 septembre, corrigee via sa ligne libre, restait
    //     affichee « en cours » sur la fiche eleve du professeur.
    if (!memeChose && nom === 'api/prof/fiche-eleve.js' && normalise(vieux) === 'en cours'
        && (neuf === 'libre' || neuf === 'corrigee')) {
      attendus.push(neuf + ' au lieu de « en cours » : ' + JSON.stringify(c));
      memeChose = true;
    }
    verifies++;
    if (!memeChose) {
      // divergence connue et voulue : fiche-eleve.js ignorait l'etat 'libre'
      console.log('!! ECART  %s : ancien=%s  neuf=%s  pour %j', nom, vieux, neuf, c);
      ecarts++;
    }
  }
}
console.log('%d comparaisons, %d ecart(s) non voulu(s)', verifies, ecarts);
console.log('%d cas ou fiche-eleve.js disait « encours » et dira « libre » (correction voulue)', attendus.length);
process.exit(ecarts ? 1 : 0);
