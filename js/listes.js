// =====================================================================
// Lecture d'une liste d'élèves à TROIS colonnes : nom, prénom, adresse.
//
// Décision D15, question 6 : un fichier par groupe, trois colonnes, et
// toute colonne supplémentaire est rejetée PAR LE SERVEUR. L'export complet
// d'EDUKA porte des dates de naissance, le sexe, des allergies, des projets
// d'accompagnement : rien de tout cela ne doit entrer ici, même par
// inadvertance.
//
// UN SEUL CODE POUR LA PAGE ET POUR LE SERVEUR. La page (enseignant/comptes.html)
// s'en sert pour écarter avant l'envoi ce que le serveur refuserait, et pour
// montrer au professeur comment la première ligne sera lue ; le serveur
// (api/prof/importer.js) s'en sert pour refuser, quoi qu'ait fait la page.
//
// Sans dépendance : le séparateur est deviné entre point-virgule, virgule
// et tabulation ; les guillemets doubles protègent un champ qui contient le
// séparateur. Une ligne que DEUX séparateurs découpent est ambiguë et
// refusée : c'est le signe d'une colonne cachée dans un champ.
// =====================================================================

const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEPARATEURS = [';', ',', '\t'];
// Un nom ou un prénom ne contient ni séparateur, ni retour à la ligne, ni
// chiffre, ni caractère de remplacement (fichier mal encodé) : ce sont les
// traces d'une colonne supplémentaire ou d'un fichier illisible.
const SUSPECT = /[;,\t\r\n\d�]/;

/** Découpe une ligne en champs, en respectant les guillemets doubles. */
export function decouper(ligne, sep) {
  const champs = [];
  let courant = '';
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (entreGuillemets) {
      if (c === '"' && ligne[i + 1] === '"') { courant += '"'; i++; }
      else if (c === '"') entreGuillemets = false;
      else courant += c;
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === sep) {
      champs.push(courant); courant = '';
    } else {
      courant += c;
    }
  }
  champs.push(courant);
  // Les colonnes vides de fin de ligne (points-virgules finaux d'Excel) ne
  // sont pas des colonnes.
  while (champs.length > 1 && champs[champs.length - 1].trim() === '') champs.pop();
  return champs.map((x) => x.trim());
}

/**
 * Le séparateur de cette ligne, ou null si la ligne est ambiguë : deux
 * séparateurs différents la découpent chacun en plusieurs champs.
 */
export function separateur(ligne) {
  const decoupes = SEPARATEURS.map((s) => [s, decouper(ligne, s).length]);
  const actifs = decoupes.filter(([, n]) => n > 1);
  if (actifs.length === 1) return actifs[0][0];
  if (!actifs.length) return SEPARATEURS[0];
  // Plusieurs séparateurs : acceptable seulement si un seul donne trois
  // champs exactement et que les autres n'apparaissent que DANS des champs
  // protégés par des guillemets. On tranche simplement : ambiguë.
  return null;
}

const sansAccent = (m) => m.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Une ligne d'en-tête : aucune adresse, et des mots de colonne (nom, prénom,
 * adresse, courriel, mail...). Renvoie l'ordre des deux colonnes de texte
 * quand il se lit dans l'en-tête, pour que « Prénom;Nom;Adresse » ne soit
 * pas lu à l'envers.
 */
export function lireEnTete(champs) {
  if (champs.some((c) => c.includes('@'))) return null;
  const mots = champs.map(sansAccent);
  const iNom = mots.findIndex((m) => m === 'nom' || m.startsWith('nom de famille') || m === 'nom de l\'eleve' || m === 'noms');
  const iPrenom = mots.findIndex((m) => m.startsWith('prenom'));
  const iMail = mots.findIndex((m) => ['mail', 'courriel', 'adresse', 'e-mail', 'email', 'mel'].some((x) => m.includes(x)));
  if (iMail < 0 && iNom < 0 && iPrenom < 0) return null;
  if (iNom >= 0 && iPrenom >= 0) return { ordre: iPrenom < iNom ? 'prenom-nom' : 'nom-prenom' };
  return { ordre: null };
}

/**
 * Lit une ligne et renvoie { nom, prenom, email }, { entete, ordre },
 * { vide } ou { erreur }. `ordre` vaut 'nom-prenom' (par défaut) ou
 * 'prenom-nom' quand l'en-tête du fichier l'a indiqué.
 */
export function lireLigne(ligne, ordre = 'nom-prenom') {
  const texte = String(ligne ?? '').replace(/\r$/, '');
  if (!texte.trim()) return { vide: true };
  if (/[\r\n]/.test(texte)) return { erreur: 'retour à la ligne dans la ligne : refusée' };
  if (texte.includes('�')) return { erreur: 'caractères illisibles : réenregistrez le fichier au format CSV UTF-8' };
  const sep = separateur(texte);
  if (sep === null) {
    return { erreur: 'plusieurs séparateurs sur la même ligne (point-virgule, virgule ou tabulation) : colonne cachée probable, ligne refusée' };
  }
  const champs = decouper(texte, sep);
  const entete = lireEnTete(champs);
  if (entete) return { entete: true, ordre: entete.ordre };
  if (champs.length !== 3) {
    const extra = champs.length > 3 ? ` (la quatrième contient « ${champs[3].slice(0, 30)} »)` : '';
    return { erreur: `${champs.length} colonne${champs.length > 1 ? 's' : ''} au lieu de 3 (nom, prénom, adresse)${extra} : ligne refusée` };
  }
  const iMail = champs.findIndex((c) => c.includes('@'));
  if (iMail < 0) return { erreur: 'aucune adresse sur cette ligne' };
  const email = champs[iMail].toLowerCase();
  if (!ADRESSE.test(email)) return { erreur: `adresse invalide : ${email}` };
  const reste = champs.filter((_, i) => i !== iMail);
  const [nom, prenom] = ordre === 'prenom-nom' ? [reste[1], reste[0]] : [reste[0], reste[1]];
  if (!nom || !prenom) return { erreur: 'nom ou prénom vide' };
  if (SUSPECT.test(nom) || SUSPECT.test(prenom)) {
    return { erreur: 'le nom ou le prénom contient un chiffre, un séparateur ou un caractère illisible : colonne supplémentaire probable, ligne refusée' };
  }
  return { nom: nom.slice(0, 80), prenom: prenom.slice(0, 80), email };
}

/**
 * Lit un fichier entier : détecte l'en-tête et l'ordre des colonnes, numérote
 * les lignes comme dans le fichier, et sépare ce qui peut partir de ce qui
 * est refusé d'avance. Utilisé par la page ; le serveur relit chaque ligne.
 */
export function lireFichier(texte) {
  const lignes = String(texte ?? '').split(/\r?\n/);
  let ordre = 'nom-prenom';
  const aEnvoyer = [];
  const refusees = [];
  let premiere = null;
  lignes.forEach((brute, k) => {
    const numero = k + 1;
    const l = lireLigne(brute, ordre);
    if (l.vide) return;
    if (l.entete) { if (l.ordre) ordre = l.ordre; return; }
    if (l.erreur) { refusees.push({ numero, message: l.erreur }); return; }
    if (!premiere) premiere = { numero, ...l };
    aEnvoyer.push({ numero, texte: brute });
  });
  return { ordre, aEnvoyer, refusees, premiere };
}
