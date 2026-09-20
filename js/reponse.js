// =====================================================================
// LA FICHE D'ACTIVITÉ INTERACTIVE (décision D16, f, puis fiche interactive
// du 20 septembre 2026).
//
// Chargé après components.js sur les 27 fiches -activite et les 27 -ebep,
// par outils/migrer.py. Deux choses ici :
//
//   1. Le bloc « Ma réponse » au pied de la fiche (question 'reponse'),
//      présent dans le HTML, caché (hidden), ouvert pour une session ÉLÈVE,
//      en aperçu grisé pour un professeur.
//   2. Les CHAMPS DE LA FICHE : à l'ouverture, pour un élève seulement, le
//      script repère dans la page les endroits où l'on répond (zones de
//      réponse, cases vides des tableaux, trous des synthèses, questions
//      lettrées sans zone) et y pose un champ de saisie. Chaque champ est
//      enregistré dans le classeur dès que l'élève le quitte. Le HTML des
//      fiches ne change pas : sans session élève, ce script ne touche pas
//      au DOM, la fiche imprimée et la fiche vue sans compte restent celles
//      d'avant.
//
// Le rôle est lu dans le témoin lft_ouvert : un visiteur sans session ne
// provoque AUCUNE requête, la fiche reste publique et anonyme (même règle
// que marquerProgressionEleve dans components.js).
//
// Rien ici n'est une barrière : c'est /api/classeur/reponse qui décide, le
// groupe est déduit côté serveur, la fiche est vérifiée contre le catalogue.
// Les textes reçus passent par textContent ou .value, jamais par innerHTML.
//
// CLÉS DES CHAMPS (contrat partagé avec l'API et le classeur du professeur) :
//   z<n>           n-ième zone de réponse de la page (à partir de 1) ;
//   t<i>-r<j>-c<k> case vide : i-ième tableau, j-ième ligne, k-ième cellule ;
//   b<n>           n-ième trou (suite de points, ligne pointillée en blanc).
// Elles sont recalculées à chaque ouverture et ne dépendent que de l'ordre
// des éléments dans la page, qui ne bouge pas tant que la fiche n'est pas
// régénérée.
// =====================================================================
(function () {
  'use strict';

  const bloc = document.getElementById('ma-reponse');
  if (!bloc) return;

  const $ = (id) => document.getElementById(id);
  const zone = $('ma-reponse-texte');
  const envoyer = $('ma-reponse-envoyer');
  const supprimer = $('ma-reponse-supprimer');
  const etat = $('ma-reponse-etat');
  const msg = $('ma-reponse-msg');
  const compteur = $('ma-reponse-compteur');
  const correction = $('ma-reponse-correction');
  if (!zone || !envoyer || !etat || !msg) return;
  const MAX = Number(zone.getAttribute('maxlength')) || 4000;

  // La page s'identifie par son adresse : 5eme/p1/seq1-activite.html.
  // Ailleurs (copie, page de test), rien n'est jamais envoyé.
  const m = location.pathname.match(/\/([345]eme\/p\d\/seq\d{1,2}-(?:activite|ebep)\.html)$/);
  const page = m ? m[1] : null;
  if (!page) return;

  /**
   * Le rôle de la session ouverte, ou null. lireTemoin() de components.js
   * d'abord ; puis le cookie lui-même, avec une lecture TOLÉRANTE : le
   * témoin porte désormais les niveaux après l'échéance (eleve.<échéance>.5eme),
   * et une lecture trop stricte le prendrait pour une absence de session.
   * L'échéance est tout de même respectée : un témoin périmé ne vaut rien.
   */
  function temoin() {
    try {
      if (window.lireTemoin) {
        const t = window.lireTemoin();
        if (t) return t;
      }
      const c = document.cookie.match(/(?:^|;\s*)lft_ouvert=(prof|eleve)\.(\d+)/);
      if (!c) return null;
      if (Number(c[2]) * 1000 < Date.now()) return null;
      return c[1];
    } catch (e) { return null; }
  }

  /**
   * La page est-elle une fiche du catalogue ? js/catalogue.js est chargé
   * avant ce script sur les fiches ; s'il manque, l'adresse (déjà filtrée
   * par le motif ci-dessus) fait foi, et le serveur vérifie de toute façon.
   */
  function ficheDuCatalogue() {
    try {
      const cat = window.CATALOGUE;
      if (!cat || !cat.niveaux) return true;
      const p = page.match(/^([345]eme)\/(p\d)\/(seq\d{1,2})-(activite|ebep)\.html$/);
      const niv = cat.niveaux[p[1]];
      const seqs = (niv && (niv.sequences || niv.seqs)) || [];
      return seqs.some(function (s) {
        const docs = s.documents || {};
        const d = docs[p[4]];
        return d && (d.fichier === page || d.fichier === '/' + page);
      });
    } catch (e) { return true; }
  }

  function dire(texte, classe) {
    msg.textContent = texte || '';
    msg.className = 'ma-reponse-msg' + (classe ? ' ' + classe : '');
  }

  function quand(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
        + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function compter() {
    if (!compteur) return;
    const reste = MAX - Array.from(zone.value).length;
    compteur.textContent = reste < 0 ? '0 caractère restant' : reste + ' caractère' + (reste > 1 ? 's' : '') + ' restant' + (reste > 1 ? 's' : '');
  }

  /**
   * Le lien de reconnexion, construit en DOM : jamais d'innerHTML ici.
   * Il s'ouvre dans un NOUVEL onglet : dans le même onglet, la page de
   * connexion remplaçait la fiche et le texte non envoyé disparaissait,
   * alors que le message promettait le contraire. Le cookie posé dans
   * l'autre onglet vaut ici aussi : un second clic sur Envoyer aboutit.
   */
  function lienConnexion(avant, ou, court) {
    const cible = ou || msg;
    cible.textContent = avant + ' ';
    const a = document.createElement('a');
    a.href = '/connexion.html?suite=' + encodeURIComponent(location.pathname);
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Reconnecte-toi dans un nouvel onglet';
    cible.appendChild(a);
    cible.appendChild(document.createTextNode(court ? '.' : ou
      ? ', puis reviens ici : ton texte est toujours dans le champ, il repartira quand tu le modifieras.'
      : ', puis reviens ici et clique à nouveau sur Envoyer : ton texte est toujours dans le champ.'));
    if (!ou) cible.className = 'ma-reponse-msg err';
  }

  /** Un titre en DOM (strong) suivi d'un texte, dans un conteneur vidé. */
  function titrePlusTexte(conteneur, titre, texte) {
    conteneur.textContent = '';
    const t = document.createElement('strong');
    t.textContent = titre;
    conteneur.appendChild(t);
    conteneur.appendChild(document.createTextNode(texte || ''));
  }

  /**
   * Affiche l'état de la réponse libre (ou son absence). `fiche` est l'état
   * de la fiche : quand elle est corrigée, le bloc libre se fige aussi et la
   * correction globale se lit ici, même sans correction propre à ce bloc.
   */
  function afficher(r, prenom, fiche) {
    const qui = prenom ? ' Tu es connecté comme ' + prenom + '. Ce n’est pas toi ? Ferme la session en haut de la page.' : '';
    const ficheCorrigee = Boolean(fiche && (fiche.corrige || fiche.corrige_le));
    zone.value = r ? (r.texte || '') : '';
    compter();
    if ((r && r.corrige_le) || ficheCorrigee) {
      // Corrigée : la réponse se fige, la correction se lit sous le texte.
      zone.disabled = true;
      envoyer.hidden = true;
      if (supprimer) supprimer.hidden = true;
      const date = (r && r.corrige_le) || fiche.corrige_le;
      etat.textContent = (ficheCorrigee ? 'Fiche corrigée par ton professeur le ' : 'Réponse corrigée par ton professeur le ')
        + quand(date) + '. Elle ne se modifie plus.' + qui;
      if (correction) {
        const propre = r && r.correction;
        const globale = ficheCorrigee && fiche.correction;
        correction.hidden = !(propre || globale);
        correction.textContent = '';
        if (globale) {
          const p1 = document.createElement('div');
          titrePlusTexte(p1, 'Correction de la fiche : ', globale);
          correction.appendChild(p1);
        }
        if (propre) {
          const p2 = document.createElement('div');
          titrePlusTexte(p2, globale ? 'Commentaire sur cette réponse : ' : 'Correction : ', propre);
          correction.appendChild(p2);
        }
      }
      return;
    }
    zone.disabled = false;
    envoyer.hidden = false;
    if (correction) { correction.hidden = true; correction.textContent = ''; }
    if (!r) {
      if (supprimer) supprimer.hidden = true;
      etat.textContent = 'Aucune réponse envoyée pour cette fiche.' + qui;
      return;
    }
    if (supprimer) supprimer.hidden = false;
    etat.textContent = 'Réponse envoyée le ' + quand(r.modifie_le || r.redige_le) + '. Tu peux encore la modifier tant qu’elle n’est pas corrigée.' + qui;
  }

  const role = temoin();

  // ---- Professeur : un aperçu grisé, aucune requête, aucun champ ---------
  if (role === 'prof') {
    bloc.hidden = false;
    bloc.classList.add('apercu');
    zone.disabled = true;
    zone.placeholder = '';
    envoyer.hidden = true;
    if (supprimer) supprimer.hidden = true;
    if (compteur) compteur.hidden = true;
    etat.textContent = 'Les élèves répondent dans les champs de cette fiche et rédigent ici. Leurs réponses arrivent dans « Classeur des élèves », section « Réponses rédigées ».';
    return;
  }
  if (role !== 'eleve') return;

  // =====================================================================
  // LES CHAMPS DE LA FICHE
  // =====================================================================

  const MAX_INTITULE = 200;
  const CLE_CHAMP = /^(?:[zb]\d{1,3}|t\d{1,2}-r\d{1,3}-c\d{1,2})$/;
  // Un trou : au moins 4 points, ou des points de suspension ou des tirets
  // bas répétés. Trois points de prose (« une plante verte... ») ne comptent
  // pas. Le cahier des charges dit « au moins 6 » ; une fiche entière
  // (4eme/p5/seq9-ebep) écrit ses quinze trous avec cinq points et passait
  // au travers, et aucune des 54 fiches n'a de suite de 4 ou 5 points
  // ailleurs qu'en lieu de réponse : le seuil est abaissé à 4.
  const TROU = /\.{4,}|\u2026{2,}|_{3,}/g;
  const UN_TROU = /\.{4,}|\u2026{2,}|_{3,}/;
  // Un vrai dessin à faire : un verbe de tracé (dessine, trace) ou un verbe
  // d'action avec un nom de tracé, et pas de question rédigée (explique,
  // décris, pourquoi…) dans la même consigne. « Explique le fonctionnement
  // en utilisant l'organigramme » attend un texte, pas un dessin.
  const DESSIN_VERBE = /\b(dessine[rz]?|trace[rz]?|croquis)\b/i;
  const DESSIN_ACTION = /\b(r[eé]alise[rz]?|compl[eè]te[rz]?|fais|faites|cr[eé]e[rz]?|construis|construisez)\b/i;
  const DESSIN_NOM = /\b(dessins?|sch[eé]mas?|organigrammes?|croquis|figures?|diagrammes?|infographies?)\b/i;
  const REDIGE = /\b(explique[rz]?|d[eé]cris|d[eé]crivez|justifie[rz]?|pourquoi|cite[rz]?|nomme[rz]?|r[eé]dige[rz]?|[eé]cris|[eé]crivez|indique[rz]?|propose[rz]?)\b/i;
  const ZONE_DESSIN = /zone pour dessiner|à dessiner|a dessiner/i;
  // Une colonne qui appelle une phrase (textarea) plutôt qu'un mot (input).
  const COLONNE_LONGUE = /description|fonction|justification|explication|pourquoi|comment|r[oô]le|besoin|argument|avantage|inconv[eé]nient|proposition|solution|exemple|impact|contenu|risque|correction|crit[eè]re|difficult|erreur|principe|effet|cons[eé]quence|remarque|observation|hypoth[eè]se|analyse|am[eé]lioration|\?/i;
  const EXCLUS = '#ma-reponse, .note-prof, details, .lien-encart, .info-box, .champ-barre, .champ-correction, .page-header, .page-actions, .print-identite, .print-pied, .print-header, .rendre, .competences, script, style, textarea, input, select, button';

  /** Le texte d'un élément, balises retirées, espaces repliés, borné. */
  function texteDe(el, max) {
    const t = (el && el.textContent ? el.textContent : '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    return max && t.length > max ? t.slice(0, max - 1).trim() + '…' : t;
  }

  /** Vrai si l'élément est dans une partie de la page où l'on ne répond pas. */
  function exclu(el) {
    return Boolean(el && el.closest && el.closest(EXCLUS));
  }

  /** Vide : aucun texte (espaces et espaces insécables compris) et rien d'autre à voir. */
  function estVide(el) {
    if (texteDe(el)) return false;
    return !el.querySelector('img, svg, input, select, textarea, button, .ico, video, iframe, canvas, table, ul, ol');
  }

  /** a précède-t-il b dans le document ? (nœuds texte compris) */
  function avant(a, b) {
    if (a === b) return false;
    return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  /** Vrai si la consigne demande un tracé (et non une réponse rédigée). */
  function demandeDessin(intitule, legende) {
    if (ZONE_DESSIN.test(legende || '') || ZONE_DESSIN.test(intitule || '')) return true;
    const t = intitule || '';
    if (REDIGE.test(t)) return false;
    return DESSIN_VERBE.test(t) || (DESSIN_ACTION.test(t) && DESSIN_NOM.test(t));
  }

  /**
   * Le dernier <p>, <h4> ou <h3> qui précède l'élément, pour un intitulé ;
   * avec `seulementTitres`, le dernier titre (h4, h3, h2) seulement.
   */
  function titrePrecedent(el, aussiH2, seulementTitres) {
    const sel = seulementTitres ? 'h4, h3, h2' : aussiH2 ? 'p, h4, h3, h2' : 'p, h4, h3';
    let meilleur = null;
    const main = document.querySelector('.site-main');
    (main || document).querySelectorAll(sel).forEach(function (c) {
      if (c === el || c.contains(el) || !avant(c, el)) return;
      if (c.closest('#ma-reponse, details, .note-prof, .champ-barre, .champ-correction, .page-header')) return;
      if (c.querySelector('.champ-fiche')) return;
      // Une ligne à trou courte (« Test : ...... ») n'est pas une consigne.
      if (texteDe(c).length < 40 && (UN_TROU.test(c.textContent) || c.querySelector('span.ebep-fill, span[style*="dotted"]'))) return;
      meilleur = c;   // en ordre du document : le dernier gardé est le plus proche
    });
    return meilleur;
  }

  /**
   * Le contexte d'un tableau : le titre (h4, h3, h2) le plus proche qui le
   * précède dans la même carte, sinon le paragraphe le plus proche.
   */
  function contexteTableau(table) {
    const carte = table.closest('.content-card') || document.querySelector('.site-main');
    let proche = null, para = null;
    carte.querySelectorAll('h4, h3, h2, p').forEach(function (c) {
      if (!avant(c, table) || c.closest('details, .note-prof')) return;
      if (c.tagName !== 'P') proche = c;
      else if (questionLettree(c)) proche = c;
      else para = c;
    });
    return texteDe(proche || para, 60);
  }

  /** Une question lettrée : <p> commençant par <strong>a)</strong>. */
  function questionLettree(el) {
    if (!el || el.tagName !== 'P') return false;
    const s = el.firstElementChild;
    if (!s || s.tagName !== 'STRONG') return false;
    return /^[a-z]\)/.test(texteDe(s)) && /^[a-z]\)/.test(texteDe(el));
  }

  /** Le bloc (p, li, div, td…) qui contient un nœud texte. */
  function blocDe(noeud) {
    let el = noeud.parentNode;
    while (el && el.nodeType === 1 && /^(SPAN|STRONG|EM|B|I|U|CODE|SMALL|SUP|SUB|A|LABEL|MARK)$/.test(el.tagName)) el = el.parentNode;
    return el;
  }

  /**
   * La phrase autour d'un trou : le texte du bloc, coupé aux <br>, où ce
   * trou devient « […] » et les autres « … ». Borné à MAX_INTITULE autour du trou.
   */
  function phraseAutour(bloc, noeud, debut, fin) {
    const segments = [[]];
    (function parcourir(el) {
      for (let n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) segments[segments.length - 1].push(n);
        else if (n.nodeType !== 1) continue;
        else if (n.tagName === 'BR') segments.push([]);
        else if (n !== noeud && /^(SPAN|DIV)$/.test(n.tagName) && (n.classList.contains('ebep-fill') || /dotted|dashed/.test(n.getAttribute('style') || '')) && !texteDe(n)) segments[segments.length - 1].push({ nodeValue: ' … ' });   // un blanc en ligne se lit « … »
        else if (!/^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|TABLE|UL|OL)$/.test(n.tagName)) parcourir(n);
      }
    })(bloc);
    const segment = segments.find(function (seg) { return seg.indexOf(noeud) >= 0; });
    if (!segment) return '';
    let s = '', position = -1;
    segment.forEach(function (n) { if (n === noeud) position = s.length + debut; s += n.nodeValue; });
    let phrase = s.slice(0, position) + '[…]' + s.slice(position + (fin - debut));
    // Une ligne presque vide (« 1. […] ») ne dit rien : la consigne qui précède le bloc la complète.
    if (phrase.replace(/[\s\d.…\[\]:,;()-]/g, '').length < 12) {
      const consigne = texteDe(titrePrecedent(bloc), 120);
      if (consigne) phrase = consigne + ' · ' + phrase;
    }
    // Jamais TROU lui-même ici : replace remettrait son lastIndex à zéro pendant la boucle exec.
    phrase = phrase.replace(new RegExp(TROU.source, 'g'), '…').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    if (phrase.length > MAX_INTITULE) {
      const i = phrase.indexOf('[…]');
      const de = Math.max(0, Math.min(i - 90, phrase.length - MAX_INTITULE));
      phrase = (de > 0 ? '…' : '') + phrase.slice(de, de + MAX_INTITULE - 2) + '…';
    }
    return phrase;
  }

  /**
   * DÉTECTION. Rend la liste des champs {cle, type, hote, intitule, dessin,
   * long} sans encore les insérer, sauf les zones créées après une question
   * lettrée (il faut les placer pour les numéroter dans l'ordre).
   */
  function detecter() {
    const main = document.querySelector('.site-main');
    if (!main) return [];
    const champs = [];

    // ---- 1. Les zones : .zone-reponse, cadres pointillés vides ou à
    //         légende courte, lignes pointillées vides.
    const zones = [];
    main.querySelectorAll('.zone-reponse').forEach(function (z) { if (!exclu(z)) zones.push({ el: z, hote: z }); });
    main.querySelectorAll('div[style*="dashed"], div.ebep-fill, p[style*="dotted"]').forEach(function (d) {
      if (exclu(d) || d.classList.contains('zone-reponse') || d.closest('td') || d.querySelector('.zone-reponse, table')) return;
      const style = d.getAttribute('style') || '';
      if (UN_TROU.test(d.textContent)) return;
      const legende = texteDe(d);
      if (d.tagName === 'P') { if (legende) return; }
      else if (legende.length > 120) return;
      // « Figure à insérer, voir la fiche professeur » : une note d'auteur
      // en <em>, l'emplacement d'une figure, pas un lieu de réponse.
      if (legende && (/figure à ins[ée]rer/i.test(legende)
        || (d.firstElementChild && d.firstElementChild.tagName === 'EM' && texteDe(d.firstElementChild) === legende))) return;
      // Un petit cadre (lettre à placer, symbole) est un trou, pas une zone.
      const w = style.match(/(?:^|;)\s*width\s*:\s*(\d+)px/);
      if (w && Number(w[1]) <= 120) return;
      zones.push({ el: d, hote: d, legende: legende });
    });

    // ---- 2. Les cases vides des tableaux.
    const tables = [];
    main.querySelectorAll('table').forEach(function (t) { if (!exclu(t) && !t.closest('table table')) tables.push(t); });
    tables.forEach(function (table, ti) {
      const lignes = Array.prototype.filter.call(table.querySelectorAll('tr'), function (tr) { return tr.closest('table') === table; });
      const entetes = lignes.find(function (tr) { return tr.children.length && Array.prototype.every.call(tr.children, function (c) { return c.tagName === 'TH'; }); });
      const contexte = contexteTableau(table);
      lignes.forEach(function (tr, ri) {
        const cellules = Array.prototype.filter.call(tr.children, function (c) { return c.tagName === 'TD' || c.tagName === 'TH'; });
        const libelle = cellules.map(function (c) { return texteDe(c, 60); }).find(Boolean) || '';
        cellules.forEach(function (td, ci) {
          if (td.tagName !== 'TD' || !estVide(td)) return;
          const enTete = entetes && entetes !== tr && entetes.children[ci] ? texteDe(entetes.children[ci], 60) : '';
          const colonne = entetes && entetes !== tr ? entetes.children.length : cellules.length;
          const morceaux = [contexte, libelle, enTete].filter(Boolean);
          // Le champ va au fond d'un cadre vide (div.ebep-fill) s'il y en a un.
          let hote = td;
          while (hote.children.length === 1 && /^(DIV|SPAN)$/.test(hote.children[0].tagName) && estVide(hote.children[0])) hote = hote.children[0];
          champs.push({
            cle: 't' + (ti + 1) + '-r' + (ri + 1) + '-c' + (ci + 1),
            type: 'case', hote: hote, cellule: td,
            intitule: morceaux.join(' · ').slice(0, MAX_INTITULE),
            // Par la structure seulement, jamais par la largeur rendue : une
            // même case doit être du même type sur PC et sur téléphone, sinon
            // un texte à plusieurs lignes saisi ici serait relu dans un input
            // là-bas, sans ses retours à la ligne (voir aussi allonger()).
            long: COLONNE_LONGUE.test(enTete) || colonne <= 3 || td.colSpan > 1,
          });
        });
      });
    });

    // ---- 3. Les trous : suites de points dans le texte, et blancs en ligne
    //         (span pointillé vide, span.ebep-fill vide, petit cadre).
    const trous = [];
    const marcheur = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !/[.…_]{3}/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        return exclu(n.parentNode) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      const bloc = blocDe(n);
      let r;
      TROU.lastIndex = 0;
      while ((r = TROU.exec(n.nodeValue))) {
        trous.push({ type: 'trou', noeud: n, debut: r.index, fin: r.index + r[0].length, intitule: phraseAutour(bloc, n, r.index, r.index + r[0].length) });
      }
    }
    main.querySelectorAll('span[style*="dotted"], span.ebep-fill, div[style*="dashed"]').forEach(function (s) {
      if (exclu(s) || !estVide(s) || s.closest('td')) return;
      if (s.tagName === 'DIV') {
        const w = (s.getAttribute('style') || '').match(/(?:^|;)\s*width\s*:\s*(\d+)px/);
        if (!w || Number(w[1]) > 120) return;
      }
      const bloc = blocDe(s);
      const temoinTexte = document.createTextNode('......');
      s.appendChild(temoinTexte);
      const phrase = phraseAutour(bloc, temoinTexte, 0, 6);
      s.removeChild(temoinTexte);
      trous.push({ type: 'blanc', hote: s, intitule: phrase || texteDe(titrePrecedent(s), MAX_INTITULE) });
    });
    // Un petit cadre pointillé à légende (« 1876 », « Étape 1 ») : la légende
    // reste, le champ vient à côté, l'intitulé dit la consigne et la légende.
    main.querySelectorAll('div[style*="dashed"]').forEach(function (d) {
      if (exclu(d) || estVide(d) || d.closest('td')) return;
      const w = (d.getAttribute('style') || '').match(/(?:^|;)\s*width\s*:\s*(\d+)px/);
      if (!w || Number(w[1]) > 120) return;
      const legende = texteDe(d, 40);
      if (!legende || legende.length > 40) return;
      trous.push({ type: 'blanc', hote: d, apres: true, intitule: (texteDe(titrePrecedent(d), 150) + ' · ' + legende).slice(0, MAX_INTITULE) });
    });
    trous.sort(function (a, b) {
      const na = a.noeud || a.hote, nb = b.noeud || b.hote;
      if (na === nb) return a.debut - b.debut;
      return avant(na, nb) ? -1 : 1;
    });

    // ---- 4. Les questions lettrées sans réponse prévue avant la question
    //         suivante (ou la fin de la carte) : une zone est créée après.
    const supports = zones.map(function (z) { return z.el; })
      .concat(champs.map(function (c) { return c.cellule; }))
      .concat(trous.map(function (t) { return t.noeud || t.hote; }));
    main.querySelectorAll('p').forEach(function (p) {
      if (exclu(p) || !questionLettree(p)) return;
      const plage = [p];
      for (let s = p.nextElementSibling; s; s = s.nextElementSibling) {
        if (questionLettree(s) || /^H[1-4]$/.test(s.tagName)) break;
        plage.push(s);
      }
      // Servie : un champ détecté dans la plage, ou un tableau ou une liste
      // juste après (même déjà remplis : la question porte sur eux).
      const servi = supports.some(function (n) { return plage.some(function (el) { return el === n || el.contains(n); }); })
        || plage.some(function (el) { return el !== p && (/^(TABLE|UL|OL)$/.test(el.tagName) || el.querySelector('table, ul, ol')); });
      if (servi) return;
      const z = document.createElement('div');
      z.className = 'zone-reponse champ-zone-creee';
      const dernier = plage[plage.length - 1];
      dernier.parentNode.insertBefore(z, dernier.nextSibling);
      zones.push({ el: z, hote: z, question: p });
    });

    // ---- 5. Les clés, dans l'ordre du document.
    zones.sort(function (a, b) { return avant(a.el, b.el) ? -1 : 1; });
    zones.forEach(function (z, i) {
      const titre = z.question || titrePrecedent(z.el);
      let intitule = texteDe(titre, MAX_INTITULE);
      // Un simple libellé (« Pseudo-code : », « Mon choix : ») ne dit pas de
      // quoi il s'agit dans le classeur du professeur : le titre (h3, h4)
      // qui précède le complète (« Défi A : … · Pseudo-code : »).
      if (intitule && intitule.length < 25 && !questionLettree(titre)) {
        const h = texteDe(titrePrecedent(z.el, true, true), 150);
        if (h) intitule = (h + ' · ' + intitule).slice(0, MAX_INTITULE);
      }
      if (z.legende) intitule = (intitule ? intitule + ' (' + z.legende + ')' : z.legende).slice(0, MAX_INTITULE);
      champs.push({
        cle: 'z' + (i + 1), type: 'zone', hote: z.hote, intitule: intitule,
        dessin: demandeDessin(intitule, texteDe(z.el)),
        haute: z.el.classList.contains('zone-reponse-haute'),
      });
    });
    trous.forEach(function (t, i) { t.cle = 'b' + (i + 1); champs.push(t); });
    return champs;
  }

  // ---- Le rendu d'un champ ---------------------------------------------

  const registre = {};        // clé -> {champ, element, etat, valeur enregistrée, file}
  let ordre = [];             // les clés dans l'ordre de la page

  function elementEtat(court) {
    const e = document.createElement('span');
    e.className = 'champ-etat' + (court ? ' champ-etat-court' : '');
    e.setAttribute('aria-live', 'polite');
    return e;
  }

  /** Le miroir imprimable d'un textarea (les navigateurs coupent l'impression d'un textarea). */
  function miroir(textarea) {
    const d = document.createElement('div');
    d.className = 'champ-imprime';
    textarea.addEventListener('input', function () { d.textContent = textarea.value; });
    return d;
  }

  function poser(champ) {
    let el, etatEl;
    if (champ.type === 'zone') {
      el = document.createElement('textarea');
      el.className = 'champ-fiche champ-zone';
      el.rows = champ.dessin ? 2 : (champ.haute ? 5 : 3);
      el.maxLength = 4000;
      if (champ.dessin) {
        const p = document.createElement('p');
        p.className = 'champ-consigne';
        p.textContent = 'À faire sur ton cahier, puis à déposer en photo avec « Rendre mon travail ». Tu peux laisser un commentaire ici.';
        champ.hote.appendChild(p);
      }
      champ.hote.classList.add('champ-hote');
      champ.hote.appendChild(el);
      champ.hote.appendChild(miroir(el));
      etatEl = elementEtat(false);
      champ.hote.appendChild(etatEl);
    } else if (champ.type === 'case') {
      el = document.createElement(champ.long ? 'textarea' : 'input');
      if (champ.long) { el.rows = 2; el.maxLength = 4000; } else { el.type = 'text'; el.maxLength = 400; }
      el.className = 'champ-fiche champ-case';
      champ.hote.classList.add('champ-hote');
      champ.hote.appendChild(el);
      if (champ.long) champ.hote.appendChild(miroir(el));
      etatEl = elementEtat(true);
      champ.hote.appendChild(etatEl);
    } else {
      el = document.createElement('input');
      el.type = 'text';
      el.className = 'champ-fiche champ-trou';
      el.size = 16;
      el.maxLength = 120;
      etatEl = elementEtat(true);
      if (champ.type === 'blanc' && champ.apres) {
        // Un petit cadre à légende (« 1876 ») : le champ vient juste après.
        el.size = 6;
        champ.hote.parentNode.insertBefore(el, champ.hote.nextSibling);
        el.parentNode.insertBefore(etatEl, el.nextSibling);
      } else if (champ.type === 'blanc') {
        el.classList.add('champ-trou-plein');
        champ.hote.classList.add('champ-hote');
        // Le blanc (span pointillé, cadre) accueille le champ ; son espace
        // insécable de remplissage s'en va.
        Array.prototype.slice.call(champ.hote.childNodes).forEach(function (n) { if (n.nodeType === 3 && !texteDe({ textContent: n.nodeValue })) champ.hote.removeChild(n); });
        champ.hote.appendChild(el);
        champ.hote.appendChild(etatEl);
      } else {
        // Le nœud texte est coupé en trois : avant, le champ, après. Les
        // champs sont posés du dernier au premier (voir la mise en place),
        // si bien que les positions des trous précédents du même nœud
        // restent justes.
        const n = champ.noeud;
        const texte = n.nodeValue;
        const apres = document.createTextNode(texte.slice(champ.fin));
        n.nodeValue = texte.slice(0, champ.debut);
        n.parentNode.insertBefore(el, n.nextSibling);
        el.parentNode.insertBefore(etatEl, el.nextSibling);
        etatEl.parentNode.insertBefore(apres, etatEl.nextSibling);
      }
    }
    registre[champ.cle] = { champ: champ, el: el, etat: etatEl, enregistre: '', enVol: false, attente: null, minuteur: null };
    brancher(el, champ);
  }

  /** Les attributs et les écouteurs communs à tout champ. */
  function brancher(el, champ) {
    el.setAttribute('aria-label', champ.intitule || 'Réponse');
    el.dataset.cle = champ.cle;
    el.autocomplete = 'off';
    el.spellcheck = true;
    el.addEventListener('change', function () { programmer(champ.cle, 0); });
    el.addEventListener('input', function () {
      compterRemplis();
      if (el.tagName === 'TEXTAREA') programmer(champ.cle, 1500);
    });
    el.addEventListener('blur', function () { programmer(champ.cle, 0); });
  }

  /**
   * Remplace l'input d'une case par un textarea : la réponse reçue tient
   * sur plusieurs lignes ou dépasse 400 caractères (saisie sur un autre
   * appareil, ou avant que le type des cases ne dépende de la structure).
   * Un input effacerait les retours à la ligne et bloquerait la frappe.
   */
  function allonger(r) {
    if (r.el.tagName !== 'INPUT' || r.champ.type !== 'case') return;
    const ta = document.createElement('textarea');
    ta.className = r.el.className;
    ta.rows = 2;
    ta.maxLength = 4000;
    ta.disabled = r.el.disabled;
    r.el.parentNode.insertBefore(ta, r.el);
    r.el.parentNode.removeChild(r.el);
    ta.parentNode.insertBefore(miroir(ta), ta.nextSibling);
    r.el = ta;
    r.champ.long = true;
    brancher(ta, r.champ);
  }

  // ---- La barre de la fiche ----------------------------------------------

  const barre = { el: null, compteur: null, bouton: null, message: null, texte: null };
  let ficheEtat = null;     // {corrige, corrige_le, correction, texte, modifie_le}
  let figee = false;

  function construireBarre() {
    const main = document.querySelector('.site-main');
    const entete = main && main.querySelector('.page-header');
    if (!main) return;
    const b = document.createElement('div');
    b.className = 'champ-barre no-print';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Réponses dans la fiche');
    const p = document.createElement('p');
    p.className = 'champ-barre-texte';
    p.textContent = 'Tu réponds directement dans cette fiche : chaque champ est enregistré dans ton classeur dès que tu le quittes.';
    const ligne = document.createElement('div');
    ligne.className = 'champ-barre-ligne';
    const c = document.createElement('span');
    c.className = 'champ-barre-compteur';
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btn btn-primary btn-sm';
    bouton.textContent = 'J’ai terminé';
    const message = document.createElement('span');
    message.className = 'champ-barre-message';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    ligne.appendChild(c);
    ligne.appendChild(bouton);
    ligne.appendChild(message);
    b.appendChild(p);
    b.appendChild(ligne);
    if (entete && entete.parentNode === main) main.insertBefore(b, entete.nextSibling);
    else main.insertBefore(b, main.firstChild);
    barre.el = b; barre.compteur = c; barre.bouton = bouton; barre.message = message; barre.texte = p;
    bouton.addEventListener('click', terminer);
  }

  function compterRemplis() {
    if (!barre.compteur) return;
    let remplis = 0;
    ordre.forEach(function (k) { if (registre[k].el.value.trim()) remplis += 1; });
    const total = ordre.length;
    barre.compteur.textContent = remplis + ' champ' + (remplis > 1 ? 's' : '') + ' rempli' + (remplis > 1 ? 's' : '') + ' sur ' + total;
    return remplis;
  }

  function direBarre(texte, classe) {
    if (!barre.message) return;
    barre.message.textContent = texte || '';
    barre.message.className = 'champ-barre-message' + (classe ? ' ' + classe : '');
  }

  /** Reflète l'état de la fiche dans la barre (et fige tout si corrigée). */
  function refleterFiche(f) {
    ficheEtat = f || null;
    if (!barre.el) return;
    if (f && (f.corrige || f.corrige_le)) {
      figer(FIGEE);
      barre.texte.textContent = 'Corrigée le ' + quand(f.corrige_le) + ' : lis la correction ci-dessous.';
      barre.bouton.hidden = true;
      direBarre('');
      afficherCorrection(f.correction);
      return;
    }
    if (f && f.texte === 'terminee') {
      barre.bouton.hidden = true;
      direBarre('Fiche envoyée à ton professeur le ' + quand(f.modifie_le) + '. Tu peux encore modifier tes réponses tant qu’elle n’est pas corrigée.', 'ok');
    } else {
      barre.bouton.hidden = false;
    }
  }

  /** La correction globale, en haut de la fiche (textContent). */
  function afficherCorrection(texte) {
    if (!barre.el) return;
    let c = document.querySelector('.champ-correction');
    if (!c) {
      c = document.createElement('div');
      c.className = 'champ-correction';
      barre.el.parentNode.insertBefore(c, barre.el.nextSibling);
    }
    titrePlusTexte(c, 'Correction de ton professeur : ', texte || '(sans texte)');
  }

  const FIGEE = 'Ton professeur a corrigé cette fiche : elle ne se modifie plus.';
  const RECHARGER = 'Recharge la page pour lire la correction.';

  /** Fige toute la fiche : les champs, le bouton, et le bloc « Ma réponse ». */
  function figer(message) {
    figee = true;
    ordre.forEach(function (k) {
      const r = registre[k];
      r.el.disabled = true;
      if (r.minuteur) { clearTimeout(r.minuteur); r.minuteur = null; }
      r.attente = null;
    });
    if (barre.bouton) barre.bouton.disabled = true;
    if (message) direBarre(message, 'err');
    // Le bloc libre se fige avec la fiche : l'API refuserait de toute façon
    // (409), autant ne pas laisser l'élève y rédiger pour rien.
    zone.disabled = true;
    envoyer.hidden = true;
    if (supprimer) supprimer.hidden = true;
    if (message) etat.textContent = message;
  }

  function terminer() {
    if (figee || !barre.bouton) return;
    ordre.forEach(function (k) { programmer(k, 0); });
    barre.bouton.disabled = true;
    direBarre('Envoi…');
    appeler('POST', { page: page, fini: true })
      .then(function (res) {
        if (res.statut === 401) { lienConnexion('Ta session a expiré, la fiche n’a pas été envoyée.', barre.message); barre.message.className = 'champ-barre-message err'; return; }
        if (res.statut === 409) { const m = res.corps.message || FIGEE; figer(m); barre.bouton.hidden = true; direBarre(m + ' ' + RECHARGER, 'err'); return; }
        if (res.statut !== 200 || !res.corps.ok) { direBarre(res.corps.message || 'La fiche n’a pas été envoyée. Réessaie dans un instant.', 'err'); return; }
        refleterFiche(res.corps.fiche || { texte: 'terminee', modifie_le: new Date().toISOString() });
      })
      .catch(function () { direBarre('La fiche n’a pas été envoyée : vérifie la connexion et réessaie.', 'err'); })
      .then(function () { if (!figee) barre.bouton.disabled = false; });
  }

  // ---- L'enregistrement au fil de l'eau ------------------------------------

  function direEtat(r, texte, classe) {
    r.etat.textContent = texte || '';
    r.etat.className = 'champ-etat' + (r.etat.classList.contains('champ-etat-court') ? ' champ-etat-court' : '') + (classe ? ' ' + classe : '');
    if (classe === 'ok' && texte) r.etat.title = 'Enregistré dans ton classeur';
  }

  /** Programme l'envoi d'un champ : tout de suite (delai 0) ou après la dernière frappe. */
  function programmer(cle, delai) {
    const r = registre[cle];
    if (!r || figee || r.el.disabled) return;
    if (r.minuteur) { clearTimeout(r.minuteur); r.minuteur = null; }
    if (delai) { r.minuteur = setTimeout(function () { r.minuteur = null; envoyerChamp(cle); }, delai); return; }
    envoyerChamp(cle);
  }

  function envoyerChamp(cle) {
    const r = registre[cle];
    if (!r || figee) return;
    const valeur = r.el.value.replace(/\r\n?/g, '\n').trim();
    if (valeur === r.enregistre && !r.enVol) { if (valeur) direEtat(r, r.etat.classList.contains('champ-etat-court') ? 'ok' : 'enregistré', 'ok'); return; }
    // Une seule requête en vol par champ : la valeur suivante attend son
    // tour, sauf si c'est celle qui est déjà en route (change puis blur sur
    // le même texte) : rien à renvoyer.
    if (r.enVol) { r.attente = valeur === r.enCours ? null : valeur; return; }
    r.enVol = true;
    r.enCours = valeur;
    r.attente = null;
    direEtat(r, r.etat.classList.contains('champ-etat-court') ? '…' : 'enregistrement…', 'attente');
    appeler('POST', { page: page, question: cle, texte: valeur, intitule: r.champ.intitule || '' }, true)
      .then(function (res) {
        if (res.statut === 401) {
          // Le message complet est dans la barre ; à côté du champ, le lien suffit.
          lienConnexion('Session expirée.', r.etat, true);
          lienConnexion('Ta session a expiré.', barre.message);
          barre.message.className = 'champ-barre-message err';
          r.etat.className = 'champ-etat err';
          r.attente = null;
          return;
        }
        if (res.statut === 409) {
          const m = res.corps.message || FIGEE;
          figer(m);
          if (barre.bouton) barre.bouton.hidden = true;
          direBarre(m + ' ' + RECHARGER, 'err');
          direEtat(r, 'figé', 'err');
          return;
        }
        if (res.statut !== 200 || !res.corps.ok) {
          direEtat(r, (res.corps && res.corps.message) || 'erreur : non enregistré', 'err');
          return;
        }
        r.enregistre = valeur;
        if (res.corps.fiche) refleterFiche(res.corps.fiche);
        direEtat(r, valeur ? (r.etat.classList.contains('champ-etat-court') ? 'ok' : 'enregistré') : '', 'ok');
      })
      .catch(function () { direEtat(r, 'erreur : vérifie la connexion', 'err'); })
      .then(function () {
        r.enVol = false;
        // Une valeur a changé pendant l'envoi : on repart avec la dernière.
        if (r.attente !== null) { r.attente = null; envoyerChamp(cle); }
      });
  }

  /**
   * Remplit les champs avec les lignes reçues, et pose les commentaires. Un
   * champ qui porte son propre corrige_le (commentaire figé par l'ancien
   * PATCH {reponse:id}) se désactive seul, sans figer la fiche. Les lignes
   * dont la clé n'existe plus dans la page (fiche régénérée) sont comptées
   * et signalées dans la barre, plutôt qu'ignorées en silence.
   */
  function remplir(lignes, f) {
    let orphelines = 0;
    (lignes || []).forEach(function (l) {
      if (!l || !CLE_CHAMP.test(String(l.question || ''))) return;
      const r = registre[l.question];
      if (!r) { orphelines += 1; return; }
      const texte = String(l.texte || '');
      if (/\n/.test(texte) || Array.from(texte).length > 400) allonger(r);
      r.el.value = texte;
      r.enregistre = r.el.value.replace(/\r\n?/g, '\n').trim();
      const mir = r.el.nextElementSibling;
      if (mir && mir.classList.contains('champ-imprime')) mir.textContent = r.el.value;
      if (l.texte) direEtat(r, r.etat.classList.contains('champ-etat-court') ? 'ok' : 'enregistré', 'ok');
      if (l.corrige_le) {
        r.el.disabled = true;
        direEtat(r, 'corrigé', 'ok');
      }
      if (l.correction) {
        const c = document.createElement(r.champ.type === 'trou' ? 'span' : 'div');
        c.className = 'champ-commentaire' + (r.champ.type === 'trou' ? ' champ-commentaire-ligne' : '');
        titrePlusTexte(c, 'Commentaire du professeur : ', l.correction);
        r.etat.parentNode.insertBefore(c, r.etat.nextSibling);
      }
    });
    compterRemplis();
    refleterFiche(f);
    if (orphelines && barre.message && !barre.message.textContent) {
      direBarre(orphelines + (orphelines > 1 ? ' réponses enregistrées ne correspondent' : ' réponse enregistrée ne correspond')
        + ' plus à cette version de la fiche : demande à ton professeur.', 'err');
    }
  }

  /**
   * À la fermeture de la page (onglet fermé, application quittée sur
   * téléphone), les envois encore en attente partent tout de suite, en
   * keepalive : sans cela, une frappe de moins de 1,5 s avant la fermeture
   * était perdue.
   */
  function vider() {
    ordre.forEach(function (k) { if (registre[k].minuteur) programmer(k, 0); });
  }
  window.addEventListener('pagehide', vider);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') vider(); });

  // ---- Mise en place ------------------------------------------------------

  let champsPoses = false;
  if (ficheDuCatalogue()) {
    try {
      const champs = detecter();
      if (champs.length) {
        construireBarre();
        const uniques = champs.filter(function (c) { return !registre[c.cle] && (registre[c.cle] = true); });
        uniques.forEach(function (c) { ordre.push(c.cle); });
        // Du dernier au premier : deux trous d'un même nœud texte gardent
        // ainsi des positions justes quand le nœud est coupé.
        uniques.slice().reverse().forEach(poser);
        compterRemplis();
        champsPoses = true;
      }
    } catch (e) {
      // La fiche reste lisible et le bloc « Ma réponse » fonctionne quand même.
      if (window.console) console.error('champs de la fiche :', e);
    }
  }
  // Pour les tests (outils, console) : les champs détectés, dans l'ordre.
  window.champsFiche = ordre.map(function (k) { const c = registre[k].champ; return { cle: k, type: c.type, intitule: c.intitule, long: Boolean(c.long), dessin: Boolean(c.dessin) }; });

  // ---- Élève : lire, puis envoyer ou retirer ---------------------------
  bloc.hidden = false;
  zone.addEventListener('input', compter);
  compter();
  etat.textContent = 'Chargement de ta réponse…';

  fetch('/api/classeur/reponse?page=' + encodeURIComponent(page), { credentials: 'same-origin' })
    .then(function (r) {
      if (r.status === 401) {
        lienConnexion('Ta session a expiré.');
        if (champsPoses) { lienConnexion('Ta session a expiré.', barre.message); barre.message.className = 'champ-barre-message err'; }
        return null;
      }
      return r.ok ? r.json() : null;
    })
    .then(function (d) {
      if (!d) {
        if (!msg.textContent) etat.textContent = 'Ta réponse n’a pas pu être lue pour le moment. Tu peux quand même en écrire une.';
        if (champsPoses && !barre.message.textContent) direBarre('Tes réponses déjà enregistrées n’ont pas pu être relues pour le moment.', 'err');
        return;
      }
      const lignes = d.reponses || [];
      const libre = lignes.find(function (l) { return !l.question || l.question === 'reponse'; }) || null;
      afficher(libre, d.prenom, d.fiche);
      if (champsPoses) remplir(lignes, d.fiche);
    })
    .catch(function () {
      etat.textContent = 'Ta réponse n’a pas pu être lue pour le moment. Tu peux quand même en écrire une.';
    });

  /**
   * Un appel JSON vers notre API ; renvoie {statut, corps}. Avec `survit`,
   * la requête est envoyée en keepalive : elle aboutit même si l'onglet se
   * ferme juste après (un champ enregistré à la fermeture de la page).
   */
  function appeler(methode, corps, survit) {
    return fetch('/api/classeur/reponse', {
      method: methode,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps),
      keepalive: Boolean(survit),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { statut: r.status, corps: d };
      });
    });
  }

  envoyer.addEventListener('click', function () {
    const texte = zone.value.trim();
    if (!texte) { dire('Écris ta réponse avant de l’envoyer.', 'err'); zone.focus(); return; }
    envoyer.disabled = true;
    dire('Envoi…');
    appeler('POST', { page: page, texte: texte })
      .then(function (res) {
        if (res.statut === 401) { lienConnexion('Ta session a expiré, rien n’a été envoyé.'); return; }
        if (res.statut !== 200 || !res.corps.ok) {
          // 400, 403 (sans groupe, pas de ton niveau), 409 (déjà corrigée) :
          // le message du serveur dit quoi faire ; le texte reste dans le champ.
          dire(res.corps.message || 'Rien n’a été envoyé. Réessaie dans un instant.', 'err');
          return;
        }
        afficher(res.corps.reponse, res.corps.prenom, res.corps.fiche);
        if (champsPoses && res.corps.fiche) refleterFiche(res.corps.fiche);
        dire('Réponse envoyée' + (res.corps.groupe ? ' dans le groupe ' + res.corps.groupe : '') + '. Ton professeur la lira dans ton classeur.', 'ok');
      })
      .catch(function () {
        dire('Rien n’a été envoyé : vérifie la connexion et réessaie. Ton texte est toujours là.', 'err');
      })
      .then(function () { envoyer.disabled = false; });
  });

  if (supprimer) {
    supprimer.addEventListener('click', function () {
      if (!confirm('Supprimer ta réponse ? Ton professeur ne la verra plus. Tu pourras en écrire une autre.')) return;
      supprimer.disabled = true;
      dire('Suppression…');
      appeler('DELETE', { page: page })
        .then(function (res) {
          if (res.statut === 401) { lienConnexion('Ta session a expiré, rien n’a été supprimé.'); return; }
          if (res.statut !== 200 || !res.corps.ok) {
            dire(res.corps.message || 'La suppression n’a pas abouti.', 'err');
            return;
          }
          afficher(null, null, res.corps.fiche);
          dire('Réponse supprimée.', 'ok');
        })
        .catch(function () { dire('La suppression n’a pas abouti : vérifie la connexion et réessaie.', 'err'); })
        .then(function () { supprimer.disabled = false; });
    });
  }
})();
