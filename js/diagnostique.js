/* =============================================================
   TECHNOLOGIE LFT : évaluation diagnostique de rentrée EN LIGNE
   Moteur de formulaire commun aux trois niveaux (5e, 4e, 3e).

   La page fournit window.DIAG (données du niveau, voir le cahier des
   charges) ; le moteur se monte seul sur #diag. L'élève répond, ses
   réponses sont gardées dans localStorage (jamais envoyées à un
   serveur), puis il télécharge un PDF (module PdfMini) et l'envoie par
   courriel à son professeur (lien mailto, destinataire lu dans ?prof=).

   Les fonctions formater, nomFichier, lienCourriel et lireProf sont
   pures : le fichier se charge sous Node sans DOM pour les tester.
   ============================================================= */
(function () {
  'use strict';

  var ANNEE = '2026';
  var ANNEE_SCOLAIRE = '2026-2027';
  var DOMAINE_PROF = '@egd.mg';
  var MAX_TEXTE_PDF = 1200;
  var SANS_REPONSE = '(sans réponse)';
  var JSP = 'jsp';

  // ============================================================
  // Utilitaires purs
  // ============================================================

  // Échappe un texte pour l'insérer dans du HTML (textes de confiance).
  // Le rendu ci-dessous passe par textContent et ne l'appelle pas ; la
  // fonction est exportée pour une page qui voudrait insérer du HTML échappé.
  function echapper(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Retire les accents (é -> e, œ -> oe) pour un nom de fichier.
  function sansAccent(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
      .replace(/ß/g, 'ss');
  }

  function dateFr(d) {
    d = d instanceof Date ? d : new Date();
    var j = d.getDate(), m = d.getMonth() + 1;
    return (j < 10 ? '0' : '') + j + '/' + (m < 10 ? '0' : '') + m + '/' + d.getFullYear();
  }

  function tronquer(s, n) {
    s = String(s);
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function propre(s) {
    return String(s === undefined || s === null ? '' : s).trim();
  }

  // Valeur d'un champ (chaîne vide si absent)
  function val(champs, nom) {
    return propre(champs && champs[nom]);
  }

  function nomChamp(item, suffixe) {
    return 'q' + item.num + (suffixe === undefined ? '' : ':' + suffixe);
  }

  // Cherche dans une liste {val, texte} l'entrée dont val correspond
  function trouver(liste, v) {
    for (var i = 0; i < (liste || []).length; i++) {
      if (String(liste[i].val) === String(v)) return liste[i];
    }
    return null;
  }

  // Identité normalisée : nom en majuscules, prénom tel quel, classe
  function identiteDepuis(champs, date) {
    return {
      nom: val(champs, 'nom').toLocaleUpperCase('fr'),
      prenom: val(champs, 'prenom'),
      classe: val(champs, 'classe'),
      date: dateFr(date)
    };
  }

  // Colle une suite (avant, [mot], après) en une phrase lisible
  function phraseTrou(avant, mot, apres) {
    var s = propre(avant) + ' [' + mot + ']';
    var a = propre(apres);
    if (a) s += (/^[.,;:!?)…]/.test(a) ? '' : ' ') + a;
    return s;
  }

  // Noms de tous les champs d'un item (pour le compteur et l'effacement)
  function champsItem(item) {
    var noms = [];
    switch (item.type) {
      case 'qcm': noms.push(nomChamp(item)); break;
      case 'classement': (item.elements || []).forEach(function (e) { noms.push(nomChamp(item, e.val)); }); break;
      case 'lignes_choix': (item.phrases || []).forEach(function (p) { noms.push(nomChamp(item, p.val)); }); break;
      case 'appariement': (item.gauche || []).forEach(function (g) { noms.push(nomChamp(item, g.val)); }); break;
      case 'ordre': (item.etapes || []).forEach(function (e) { noms.push(nomChamp(item, e.val)); }); break;
      case 'texte': (item.champs || []).forEach(function (c) { noms.push(nomChamp(item, c.cle)); }); break;
      case 'trous': (item.phrases || []).forEach(function (p) { noms.push(nomChamp(item, p.val)); }); break;
      case 'cadres': (item.cadres || []).forEach(function (c) { noms.push(nomChamp(item, c.val)); }); break;
    }
    return noms;
  }

  // Un item est « répondu » dès qu'un de ses champs a une valeur
  function estRepondu(item, champs) {
    return champsItem(item).some(function (n) { return val(champs, n) !== ''; });
  }

  // ---- Lignes de réponse d'un item, lisibles sans le sujet sous les yeux ----
  function lignesItem(item, champs) {
    var lignes = [];
    var v, e, i;
    switch (item.type) {

      case 'qcm':
        v = val(champs, nomChamp(item));
        if (v === '') lignes.push(SANS_REPONSE);
        else if (v === JSP) lignes.push('Je ne sais pas');
        else {
          e = trouver(item.options, v);
          lignes.push(e ? e.val + ') ' + e.texte : v);
        }
        break;

      case 'classement':
        (item.elements || []).forEach(function (el) {
          v = val(champs, nomChamp(item, el.val));
          var col = (v !== '' && item.colonnes && item.colonnes[Number(v)] !== undefined) ? item.colonnes[Number(v)] : SANS_REPONSE;
          lignes.push(el.val + '. ' + el.texte + ' : ' + col);
        });
        break;

      case 'lignes_choix':
        (item.phrases || []).forEach(function (p) {
          v = val(champs, nomChamp(item, p.val));
          e = v === '' ? null : trouver(item.choix, v);
          lignes.push(p.val + ') ' + p.texte + ' : ' + (e ? e.texte : (v === '' ? SANS_REPONSE : v)));
        });
        break;

      case 'appariement':
        (item.gauche || []).forEach(function (g) {
          v = val(champs, nomChamp(item, g.val));
          e = v === '' ? null : trouver(item.droite, v);
          lignes.push(g.val + '. ' + g.texte + ' : ' + (e ? e.val + '. ' + e.texte : (v === '' ? SANS_REPONSE : v)));
        });
        break;

      case 'ordre':
        var numerotees = [], sans = [];
        (item.etapes || []).forEach(function (et, idx) {
          v = val(champs, nomChamp(item, et.val));
          var n = parseInt(v, 10);
          if (v !== '' && !isNaN(n)) numerotees.push({ n: n, idx: idx, texte: et.texte });
          else sans.push(et.texte);
        });
        numerotees.sort(function (a, b) { return a.n - b.n || a.idx - b.idx; });
        numerotees.forEach(function (x) { lignes.push(x.n + '. ' + x.texte); });
        sans.forEach(function (t) { lignes.push('(sans numéro) ' + t); });
        break;

      case 'texte':
        (item.champs || []).forEach(function (c) {
          v = val(champs, nomChamp(item, c.cle)).replace(/\r\n?/g, '\n');
          lignes.push(c.label + ' : ' + (v === '' ? SANS_REPONSE : tronquer(v, MAX_TEXTE_PDF)));
        });
        break;

      case 'trous':
        (item.phrases || []).forEach(function (p) {
          v = val(champs, nomChamp(item, p.val));
          var mot;
          if (v === '') mot = SANS_REPONSE;
          else if (/^\d+$/.test(v) && item.liste && item.liste[Number(v)] !== undefined && item.liste.indexOf(v) < 0) mot = item.liste[Number(v)];
          else mot = v;
          lignes.push(p.val + ') ' + phraseTrou(p.avant, mot, p.apres));
        });
        break;

      case 'cadres':
        (item.cadres || []).forEach(function (c) {
          v = val(champs, nomChamp(item, c.val));
          e = v === '' ? null : trouver(item.liste, v);
          lignes.push(c.label + ' : ' + (e ? e.texte : (v === '' ? SANS_REPONSE : v)));
        });
        break;

      default:
        lignes.push(SANS_REPONSE);
    }
    for (i = 0; i < lignes.length; i++) lignes[i] = tronquer(lignes[i], MAX_TEXTE_PDF + 80);
    return lignes;
  }

  // ---- formater(config, champs[, date]) : fonction pure ----
  function formater(config, champs, date) {
    champs = champs || {};
    var repondus = 0, total = 0;
    var parties = (config.parties || []).map(function (partie) {
      return {
        titre: partie.titre,
        items: (partie.items || []).map(function (item) {
          total++;
          if (estRepondu(item, champs)) repondus++;
          return { num: String(item.num), resume: item.resume || '', lignes: lignesItem(item, champs) };
        })
      };
    });
    return { identite: identiteDepuis(champs, date), parties: parties, repondus: repondus, total: total };
  }

  // ---- Nom du fichier PDF ----
  function morceauFichier(s, majuscules) {
    s = sansAccent(propre(s));
    if (majuscules) s = s.toUpperCase();
    s = s.replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return s.slice(0, 24).replace(/-$/, '');
  }

  function nomFichier(config, identite) {
    var nom = morceauFichier(identite.nom, true) || 'NOM';
    var prenom = morceauFichier(identite.prenom, false) || 'Prenom';
    var classe = morceauFichier(identite.classe, false) || 'classe-inconnue';
    return 'Diagnostique-' + config.court + '_' + nom + '-' + prenom + '_' + classe + '.pdf';
  }

  // ---- Destinataire : ?prof=xxx -> xxx suivi du domaine des professeurs ----
  function lireProf(recherche) {
    if (recherche === undefined) {
      recherche = (typeof location !== 'undefined' && location.search) ? location.search : '';
    }
    var m = /[?&]prof=([^&#]*)/.exec(String(recherche));
    if (!m) return '';
    var p;
    try { p = decodeURIComponent(m[1]).trim().toLowerCase(); } catch (e) { return ''; }
    // Les adresses egd.mg sont en minuscules : un lien tape avec des majuscules reste valable.
    return /^[a-z][a-z0-9.-]{1,40}$/.test(p) ? p + DOMAINE_PROF : '';
  }

  // ---- Lien mailto ----
  function lienCourriel(config, identite, prof) {
    var nom = propre(identite.nom).toLocaleUpperCase('fr');
    var prenom = propre(identite.prenom);
    var classe = propre(identite.classe) || 'classe inconnue';
    var sujet = 'Diagnostique ' + config.court + ' : ' + nom + ' ' + prenom + ', ' + classe;
    var corps = 'Bonjour,\n\nVoici mes réponses à l’évaluation diagnostique de rentrée, en pièce jointe (fichier ' +
      nomFichier(config, identite) + ').\n\n' + nom + ' ' + prenom + ', classe ' + classe + '\n';
    return 'mailto:' + (prof ? encodeURIComponent(prof).replace(/%40/g, '@') : '') +
      '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
  }

  // ---- Construction du PDF (PdfMini) ----
  function construirePdf(config, resultat, PdfMini) {
    var id = resultat.identite;
    var pdf = PdfMini.nouveau({
      titre: 'Évaluation diagnostique ' + config.libelle + ' : ' + id.nom + ' ' + id.prenom,
      auteur: id.nom + ' ' + id.prenom,
      marges: { haut: 18, bas: 18, gauche: 18, droite: 18 }
    });
    pdf.texte('Lycée Français de Tananarive · Technologie · Année scolaire ' + ANNEE_SCOLAIRE, { taille: 10, gras: true, apres: 2 });
    pdf.texte('Évaluation diagnostique de rentrée · ' + config.libelle, { taille: 16, gras: true, apres: 1 });
    if (config.titre) pdf.texte(config.titre, { taille: 12, apres: 2 });
    pdf.texte(id.nom + ' ' + id.prenom + ' · classe ' + (id.classe || 'inconnue') + ' · rempli en ligne le ' + id.date, { taille: 11, apres: 1 });
    pdf.texte('Ce travail n’est pas noté.', { taille: 10, gris: true, apres: 1 });
    pdf.trait();
    resultat.parties.forEach(function (partie) {
      pdf.espace(2);
      // Le titre de partie reste avec le premier item ; un titre d'item
      // reste avec sa première ligne de réponse (pas de titre orphelin)
      if (pdf.garder) pdf.garder(20);
      pdf.texte(partie.titre, { taille: 12, gras: true, apres: 2 });
      partie.items.forEach(function (item) {
        if (pdf.garder) pdf.garder(12);
        pdf.texte(item.num + '. ' + item.resume, { taille: 10.5, gras: true, apres: 0.5 });
        item.lignes.forEach(function (l) { pdf.texte(l, { taille: 10.5, retrait: 6, apres: 0.6 }); });
        pdf.espace(2);
      });
    });
    pdf.pied('Diagnostique ' + config.court + ' · ' + id.nom + ' ' + id.prenom, 'page {n} / {N}');
    return pdf.octets();
  }

  // ============================================================
  // Rendu DOM (uniquement en présence de document)
  // ============================================================

  // Petit constructeur d'éléments : el('p', {class:'x'}, ['texte', autreEl])
  function el(tag, attrs, enfants) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) return;
        if (k === 'class') e.className = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];   // SVG de confiance uniquement
        else e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      });
    }
    (enfants || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function idTitre(item) {
    return 'item-' + item.num + '-titre';
  }

  function idSur(item, suffixe) {
    return 'ch-' + String(item.num).replace(/[^A-Za-z0-9]/g, '_') + '-' + String(suffixe).replace(/[^A-Za-z0-9]/g, '_');
  }

  // Un bouton radio habillé : <label class="diag-choix"><input><span>…</span></label>
  function choix(nom, valeur, lettre, texte) {
    var input = el('input', { type: 'radio', name: nom, value: valeur });
    return el('label', { class: 'diag-choix' }, [
      input,
      lettre ? el('span', { class: 'diag-lettre', text: lettre }) : null,
      el('span', { class: 'diag-choix-texte', text: texte })
    ]);
  }

  function selectAvec(nom, id, options, premiere) {
    var s = el('select', { name: nom, id: id });
    s.appendChild(el('option', { value: '', text: premiere }));
    options.forEach(function (o) { s.appendChild(el('option', { value: o.val, text: o.texte })); });
    return s;
  }

  // Paragraphes depuis un texte avec \n
  function paragraphes(texte, classe) {
    return String(texte || '').split('\n').filter(function (l) { return l.trim() !== ''; })
      .map(function (l) { return el('p', { class: classe || null, text: l }); });
  }

  // ---- Documents supports ----
  function rendreSupport(s) {
    var bloc = el('div', { class: 'diag-support diag-support-' + s.type });
    if (s.titre) bloc.appendChild(el('h4', { text: s.titre }));
    if (s.type === 'pre') {
      bloc.appendChild(el('pre', { class: 'diag-pre', text: s.texte || '' }));
    } else if (s.type === 'tableau') {
      var table = el('table', { class: 'diag-tableau' });
      if (s.entetes && s.entetes.length) {
        table.appendChild(el('thead', null, [el('tr', null, s.entetes.map(function (h) { return el('th', { scope: 'col', text: h }); }))]));
      }
      table.appendChild(el('tbody', null, (s.lignes || []).map(function (l) {
        return el('tr', null, l.map(function (c) { return el('td', { text: c }); }));
      })));
      bloc.appendChild(el('div', { class: 'diag-defile' }, [table]));
    } else if (s.type === 'liste') {
      bloc.appendChild(el('ul', null, (s.lignes || []).map(function (l) { return el('li', { text: l }); })));
      (s.notes || []).forEach(function (n) { bloc.appendChild(el('p', { class: 'diag-note', text: n })); });
    } else {
      paragraphes(s.texte).forEach(function (p) { bloc.appendChild(p); });
    }
    return bloc;
  }

  function rendreFigure(item) {
    if (!item.figure) return null;
    // Le SVG vient du code de la page (données de confiance), inséré tel quel
    return el('figure', { class: 'diag-figure', html: item.figure });
  }

  // ---- Zones de réponse par type ----
  function rendreQcm(item) {
    var fs = el('fieldset', { class: 'diag-champ diag-qcm' }, [el('legend', { text: 'Question ' + item.num + ' : coche une seule réponse' })]);
    (item.options || []).forEach(function (o) { fs.appendChild(choix(nomChamp(item), o.val, o.val + ')', o.texte)); });
    fs.appendChild(choix(nomChamp(item), JSP, '', 'Je ne sais pas'));
    return fs;
  }

  // classement et lignes_choix : une ligne (fieldset) par élément, une
  // pastille radio par colonne ou par choix
  function rendreLignes(item, lignes, options, classe) {
    // role group + aria-labelledby : un lecteur d'écran qui navigue de groupe
    // en groupe entend « Question n » avant les fieldsets de chaque ligne
    var conteneur = el('div', { class: 'diag-lignes ' + classe, role: 'group', 'aria-labelledby': idTitre(item) });
    if (item.legende && item.legende.length) {
      conteneur.appendChild(el('ul', { class: 'diag-legende' }, item.legende.map(function (l) { return el('li', { text: l }); })));
    }
    lignes.forEach(function (l) {
      var fs = el('fieldset', { class: 'diag-ligne' }, [el('legend', { text: l.legende })]);
      var zone = el('div', { class: 'diag-ligne-choix' });
      options.forEach(function (o) { zone.appendChild(choix(nomChamp(item, l.val), o.val, '', o.texte)); });
      fs.appendChild(zone);
      conteneur.appendChild(fs);
    });
    return conteneur;
  }

  function rendreClassement(item) {
    var lignes = (item.elements || []).map(function (e) { return { val: e.val, legende: e.val + '. ' + e.texte }; });
    var options = (item.colonnes || []).map(function (c, i) { return { val: String(i), texte: c }; });
    return rendreLignes(item, lignes, options, 'diag-classement');
  }

  function rendreLignesChoix(item) {
    var lignes = (item.phrases || []).map(function (p) { return { val: p.val, legende: p.val + ') ' + p.texte }; });
    return rendreLignes(item, lignes, item.choix || [], 'diag-lignes-choix');
  }

  function rendreAppariement(item) {
    var bloc = el('div', { class: 'diag-appariement' });
    if (item.consigne) bloc.appendChild(el('p', { class: 'diag-consigne', text: item.consigne }));
    bloc.appendChild(el('ul', { class: 'diag-legende' }, (item.droite || []).map(function (d) {
      return el('li', null, [el('b', { text: d.val + '. ' }), d.texte]);
    })));
    var options = (item.droite || []).map(function (d) { return { val: d.val, texte: d.val + '. ' + d.texte }; });
    (item.gauche || []).forEach(function (g) {
      var id = idSur(item, g.val);
      bloc.appendChild(el('div', { class: 'diag-champ-ligne' }, [
        el('label', { for: id, text: g.val + '. ' + g.texte }),
        selectAvec(nomChamp(item, g.val), id, options, 'choisir')
      ]));
    });
    return bloc;
  }

  function rendreOrdre(item) {
    var etapes = item.etapes || [];
    var options = etapes.map(function (e, i) { return { val: String(i + 1), texte: String(i + 1) }; });
    var bloc = el('div', { class: 'diag-ordre' });
    etapes.forEach(function (e) {
      var id = idSur(item, e.val);
      bloc.appendChild(el('div', { class: 'diag-champ-ligne diag-ordre-ligne' }, [
        selectAvec(nomChamp(item, e.val), id, options, 'n°'),
        el('label', { for: id, text: e.texte })
      ]));
    });
    var avert = el('p', { class: 'diag-avert', 'aria-live': 'polite' });
    bloc.appendChild(avert);
    // Un numéro utilisé deux fois : on le signale sans bloquer
    bloc.addEventListener('change', function () {
      var vus = {}, doublons = [];
      Array.prototype.forEach.call(bloc.querySelectorAll('select'), function (s) {
        if (!s.value) return;
        if (vus[s.value] && doublons.indexOf(s.value) < 0) doublons.push(s.value);
        vus[s.value] = true;
      });
      avert.textContent = doublons.length
        ? 'Attention : le numéro ' + doublons.join(' et le numéro ') + ' est utilisé plusieurs fois.'
        : '';
    });
    return bloc;
  }

  function rendreTexte(item) {
    var bloc = el('div', { class: 'diag-texte' });
    (item.champs || []).forEach(function (c) {
      var id = idSur(item, c.cle);
      var lignes = c.lignes || 1;
      var champ;
      if (lignes <= 1) {
        champ = el('input', { type: 'text', name: nomChamp(item, c.cle), id: id, maxlength: '600', autocomplete: 'off' });
      } else {
        champ = el('textarea', { name: nomChamp(item, c.cle), id: id, rows: String(lignes), maxlength: lignes >= 3 ? '1200' : '600' });
      }
      bloc.appendChild(el('div', { class: 'diag-champ-ligne diag-champ-texte' }, [el('label', { for: id, text: c.label }), champ]));
    });
    return bloc;
  }

  function rendreTrous(item) {
    var bloc = el('div', { class: 'diag-trous' });
    var options = (item.liste || []).map(function (m) { return { val: m, texte: m }; });
    if (item.liste && item.liste.length) {
      bloc.appendChild(el('p', { class: 'diag-consigne' }, [
        el('b', { text: 'Mots à utiliser : ' }), item.liste.join(', ')
      ]));
    }
    (item.phrases || []).forEach(function (p) {
      var id = idSur(item, p.val);
      var s = selectAvec(nomChamp(item, p.val), id, options, '…');
      s.setAttribute('aria-label', 'Phrase ' + p.val + ', mot manquant');
      bloc.appendChild(el('p', { class: 'diag-trou' }, [
        el('span', { class: 'diag-lettre', text: p.val + ')' }), ' ',
        el('span', { text: p.avant || '' }), ' ', s, ' ',
        el('span', { text: p.apres || '' })
      ]));
    });
    return bloc;
  }

  function rendreCadres(item) {
    var bloc = el('div', { class: 'diag-cadres' });
    var options = (item.liste || []).map(function (m) { return { val: m.val, texte: m.texte }; });
    (item.cadres || []).forEach(function (c) {
      var id = idSur(item, c.val);
      var aideId = id + '-aide';
      var s = selectAvec(nomChamp(item, c.val), id, options, 'choisir');
      if (c.aide) s.setAttribute('aria-describedby', aideId);
      bloc.appendChild(el('div', { class: 'diag-champ-ligne' }, [
        el('label', { for: id }, [c.label, c.aide ? el('small', { id: aideId, class: 'diag-aide-champ', text: ' (' + c.aide + ')' }) : null]),
        s
      ]));
    });
    return bloc;
  }

  var RENDUS = {
    qcm: rendreQcm, classement: rendreClassement, lignes_choix: rendreLignesChoix,
    appariement: rendreAppariement, ordre: rendreOrdre, texte: rendreTexte,
    trous: rendreTrous, cadres: rendreCadres
  };

  function rendreItem(item) {
    var art = el('article', { class: 'diag-item', id: 'item-' + item.num });
    art.appendChild(el('h3', { id: idTitre(item) }, [el('span', { class: 'diag-num', text: 'Question ' + item.num })]));
    paragraphes(item.enonce, 'diag-enonce').forEach(function (p) { art.appendChild(p); });
    (item.supports || []).forEach(function (s) { art.appendChild(rendreSupport(s)); });
    var fig = rendreFigure(item);
    if (fig) art.appendChild(fig);
    var rendu = RENDUS[item.type];
    if (rendu) art.appendChild(rendu(item));
    else art.appendChild(el('p', { class: 'diag-avert', text: 'Type de question inconnu : ' + item.type }));
    return art;
  }

  // ============================================================
  // Montage de la page
  // ============================================================
  function monter(conteneur, config) {
    if (!conteneur || !config) return;
    var PdfMini = (typeof window !== 'undefined') ? window.PdfMini : null;
    var cle = 'diag-' + config.niveau + '-' + ANNEE;
    var stockageOk = true;
    var minuterie = null;
    var pdfTelecharge = false;

    // --- localStorage protégé (navigation privée, quota, refus) ---
    function lireStockage() {
      try {
        var brut = localStorage.getItem(cle);
        return brut ? JSON.parse(brut) : null;
      } catch (e) { stockageOk = false; return null; }
    }
    function ecrireStockage(champs) {
      try {
        localStorage.setItem(cle, JSON.stringify({ champs: champs, quand: new Date().toISOString() }));
        return true;
      } catch (e) { stockageOk = false; return false; }
    }
    function effacerStockage() {
      try { localStorage.removeItem(cle); } catch (e) { /* rien à faire */ }
    }

    // --- Zone d'état ---
    var etat = el('p', { class: 'diag-etat', role: 'status', 'aria-live': 'polite' });
    function dire(msg, genre) {
      var classe = 'diag-etat' + (genre ? ' diag-etat-' + genre : '');
      // Un message discret déjà affiché (enregistrement automatique) n'est
      // pas réécrit : la zone aria-live ne le ré-annonce pas à chaque frappe
      if (genre === 'discret' && etat.textContent === msg && etat.className === classe) return;
      etat.textContent = msg;
      etat.className = classe;
    }

    // --- Formulaire ---
    var form = el('form', { class: 'diag-form', novalidate: true, autocomplete: 'on' });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });

    // Bandeau « copie rechargée »
    var boutonNouvelleCopieBandeau = el('button', { type: 'button', class: 'btn btn-outline btn-sm', text: 'Nouvelle copie' });
    var bandeau = el('div', { class: 'info-box info-box-orange diag-bandeau', hidden: true }, [
      el('p', { text: 'Des réponses déjà enregistrées sur cet appareil ont été rechargées. Si ce n’est pas ta copie, clique sur Nouvelle copie.' }),
      boutonNouvelleCopieBandeau
    ]);

    // Carte identité
    var classes = (config.classes || []).map(function (c) { return { val: c, texte: c }; });
    classes.push({ val: 'autre', texte: 'autre' });
    var champNom = el('input', { type: 'text', name: 'nom', id: 'diag-nom', required: true, autocomplete: 'family-name', maxlength: '60' });
    var champPrenom = el('input', { type: 'text', name: 'prenom', id: 'diag-prenom', required: true, autocomplete: 'given-name', maxlength: '60' });
    var champClasse = selectAvec('classe', 'diag-classe', classes, 'choisir ta classe');
    champClasse.required = true;
    var carteIdentite = el('section', { class: 'content-card diag-identite' }, [
      el('h2', { text: 'Qui es-tu ?' }),
      el('div', { class: 'diag-identite-grille' }, [
        el('div', { class: 'diag-champ-ligne' }, [el('label', { for: 'diag-nom', text: 'Nom' }), champNom]),
        el('div', { class: 'diag-champ-ligne' }, [el('label', { for: 'diag-prenom', text: 'Prénom' }), champPrenom]),
        el('div', { class: 'diag-champ-ligne' }, [el('label', { for: 'diag-classe', text: 'Classe' }), champClasse]),
        el('div', { class: 'diag-champ-ligne' }, [el('span', { class: 'diag-label', text: 'Date' }), el('p', { class: 'diag-date', text: dateFr(new Date()) })])
      ]),
      el('p', { class: 'diag-rappel', text: 'Ce travail n’est pas noté. Il ne compte pas dans ta moyenne.' })
    ]);

    // Carte mot du professeur
    var carteMot = el('section', { class: 'content-card diag-mot' }, [el('h2', { text: 'Mot du professeur' })]);
    (config.mot || []).forEach(function (p) { carteMot.appendChild(el('p', { text: p })); });
    if (config.duree) carteMot.appendChild(el('p', { class: 'diag-duree', text: 'Durée indicative totale : ' + config.duree + ' minutes.' }));

    // Parties et items
    var sections = (config.parties || []).map(function (partie) {
      var sec = el('section', { class: 'content-card diag-partie' }, [el('h2', { text: partie.titre })]);
      if (partie.duree) sec.appendChild(el('p', { class: 'diag-duree', text: 'Durée indicative : ' + partie.duree + ' minutes' }));
      (partie.items || []).forEach(function (item) { sec.appendChild(rendreItem(item)); });
      return sec;
    });

    // Barre d'actions
    var compteur = el('span', { class: 'diag-compteur', 'aria-live': 'polite' });
    var boutonPdf = el('button', { type: 'button', class: 'btn btn-primary', text: 'Télécharger mon PDF' });
    var boutonCourriel = el('button', { type: 'button', class: 'btn btn-outline', text: 'Envoyer par courriel' });
    var boutonNouvelle = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Nouvelle copie' });
    // « Nouvelle copie » reste hors de .diag-boutons : sur mobile il se place
    // à côté du compteur, les deux boutons principaux occupant la ligne du bas
    var barre = el('div', { class: 'diag-actions' }, [compteur, boutonNouvelle, el('div', { class: 'diag-boutons' }, [boutonPdf, boutonCourriel])]);
    var boutonImprimer = el('button', { type: 'button', class: 'diag-lien', text: 'Si le téléchargement ne marche pas, imprime cette page en PDF.' });
    var aide = el('div', { class: 'diag-sous-barre' }, [
      el('p', { class: 'diag-aide', text: '1. Télécharge ton PDF. 2. Clique sur « Envoyer par courriel » et joins le fichier téléchargé au message (ou réponds au courriel de ton professeur en joignant le PDF).' }),
      el('p', null, [boutonImprimer])
    ]);

    form.appendChild(etat);
    form.appendChild(bandeau);
    form.appendChild(carteIdentite);
    form.appendChild(carteMot);
    sections.forEach(function (s) { form.appendChild(s); });
    form.appendChild(barre);
    form.appendChild(aide);
    conteneur.innerHTML = '';
    conteneur.appendChild(form);

    // --- Lecture et écriture des champs ---
    function lireChamps() {
      var champs = {};
      Array.prototype.forEach.call(form.elements, function (c) {
        if (!c.name) return;
        if (c.type === 'radio') { if (c.checked) champs[c.name] = c.value; return; }
        if (c.type === 'checkbox') { if (c.checked) champs[c.name] = c.value; return; }
        if (c.tagName === 'BUTTON') return;
        if (propre(c.value) !== '') champs[c.name] = c.value;
      });
      return champs;
    }
    function ecrireChamps(champs) {
      Array.prototype.forEach.call(form.elements, function (c) {
        if (!c.name || c.tagName === 'BUTTON') return;
        var v = champs[c.name];
        if (c.type === 'radio') c.checked = (v !== undefined && String(v) === c.value);
        else if (v !== undefined) c.value = String(v);
      });
      majCoches();
    }

    // Repli pour les navigateurs sans :has() : classe sur le label coché
    function majCoches() {
      Array.prototype.forEach.call(form.querySelectorAll('.diag-choix'), function (l) {
        var i = l.querySelector('input');
        l.classList.toggle('diag-coche', !!(i && i.checked));
      });
    }

    function majCompteur() {
      var r = formater(config, lireChamps());
      compteur.textContent = r.repondus + (r.repondus > 1 ? ' réponses sur ' : ' réponse sur ') + r.total;
      return r;
    }

    function enregistrer() {
      var champs = lireChamps();
      if (ecrireStockage(champs)) dire('Réponses enregistrées dans ce navigateur.', 'discret');
      else dire('Enregistrement automatique indisponible : ne ferme pas cette page avant d’avoir téléchargé ton PDF.', 'attention');
    }

    function surSaisie() {
      majCoches();
      majCompteur();
      clearTimeout(minuterie);
      minuterie = setTimeout(enregistrer, 300);
    }
    form.addEventListener('input', surSaisie);
    form.addEventListener('change', surSaisie);

    // --- Rechargement ---
    var sauvegarde = lireStockage();
    if (sauvegarde && sauvegarde.champs && Object.keys(sauvegarde.champs).length) {
      ecrireChamps(sauvegarde.champs);
      bandeau.hidden = false;
    }
    if (!stockageOk) {
      dire('Enregistrement automatique indisponible : ne ferme pas cette page avant d’avoir téléchargé ton PDF.', 'attention');
    }
    majCompteur();

    // Sans enregistrement, on prévient avant de quitter une copie commencée
    window.addEventListener('beforeunload', function (ev) {
      if (stockageOk || pdfTelecharge || propre(champNom.value) === '') return;
      ev.preventDefault();
      ev.returnValue = '';
    });

    // --- Nouvelle copie ---
    function nouvelleCopie() {
      if (!window.confirm('Effacer toutes les réponses de cette copie ?')) return;
      // Une saisie faite juste avant le clic ne doit pas réenregistrer après l'effacement
      clearTimeout(minuterie);
      minuterie = null;
      effacerStockage();
      form.reset();
      Array.prototype.forEach.call(form.querySelectorAll('.diag-avert'), function (a) { a.textContent = ''; });
      majCoches();
      bandeau.hidden = true;
      pdfTelecharge = false;
      boutonCourriel.className = 'btn btn-outline';
      majCompteur();
      dire('Nouvelle copie : les réponses ont été effacées.', 'ok');
      champNom.focus();
    }
    boutonNouvelle.addEventListener('click', nouvelleCopie);
    boutonNouvelleCopieBandeau.addEventListener('click', nouvelleCopie);

    // --- Identité exigée avant PDF et courriel ---
    function exigerIdentite() {
      var manquants = [
        { champ: champNom, nom: 'ton nom' },
        { champ: champPrenom, nom: 'ton prénom' },
        { champ: champClasse, nom: 'ta classe' }
      ].filter(function (x) { return propre(x.champ.value) === ''; });
      if (!manquants.length) return true;
      dire('Avant de continuer, indique ' + manquants.map(function (x) { return x.nom; }).join(', ') + ' dans la carte « Qui es-tu ? ».', 'erreur');
      // La carte est en haut de page : la centrer est impossible, on la cale
      // sous le message d'etat (scroll-margin-top dans style.css), puis focus.
      carteIdentite.scrollIntoView({ block: 'start' });
      manquants[0].champ.focus({ preventScroll: true });
      return false;
    }

    // --- PDF ---
    boutonPdf.addEventListener('click', function () {
      if (!exigerIdentite()) return;
      var resultat = formater(config, lireChamps());
      var reste = resultat.total - resultat.repondus;
      if (reste > 0 && !window.confirm('Il reste ' + reste + (reste > 1 ? ' questions' : ' question') + ' sans réponse. Télécharger quand même ?')) return;
      if (!PdfMini) { dire('Le module PDF n’est pas chargé. Utilise l’impression en PDF.', 'erreur'); return; }
      var nom = nomFichier(config, resultat.identite);
      var octets;
      try { octets = construirePdf(config, resultat, PdfMini); }
      catch (e) { dire('La fabrication du PDF a échoué. Utilise l’impression en PDF.', 'erreur'); return; }
      if (PdfMini.telecharger(octets, nom)) {
        pdfTelecharge = true;
        boutonCourriel.className = 'btn btn-primary';
        dire('PDF téléchargé : ' + nom + '. Envoie-le maintenant à ton professeur.', 'ok');
      } else {
        dire('Le téléchargement ne marche pas sur ce navigateur. Utilise l’impression en PDF.', 'erreur');
      }
    });

    // --- Courriel ---
    boutonCourriel.addEventListener('click', function () {
      if (!exigerIdentite()) return;
      var identite = identiteDepuis(lireChamps());
      var prof = lireProf();
      var lien = lienCourriel(config, identite, prof);
      dire('N’oublie pas de joindre le PDF téléchargé (' + nomFichier(config, identite) + ') au message.' +
        (prof ? '' : ' Aucun destinataire n’est pré-rempli : choisis l’adresse de ton professeur.'), 'ok');
      window.location.href = lien;
    });

    // --- Impression de secours ---
    boutonImprimer.addEventListener('click', function () { window.print(); });
    window.addEventListener('beforeprint', function () {
      Array.prototype.forEach.call(form.querySelectorAll('textarea'), function (t) {
        var d = t.nextElementSibling;
        if (!d || !d.classList.contains('diag-imprime')) {
          d = el('div', { class: 'diag-imprime' });
          t.parentNode.insertBefore(d, t.nextSibling);
        }
        d.textContent = t.value;
      });
    });
  }

  // ============================================================
  // Exports
  // ============================================================
  var DiagEnLigne = {
    monter: monter,
    formater: formater,
    nomFichier: nomFichier,
    lienCourriel: lienCourriel,
    lireProf: lireProf,
    echapper: echapper,
    construirePdf: construirePdf
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DiagEnLigne;
  if (typeof window !== 'undefined') {
    window.DiagEnLigne = DiagEnLigne;
    if (typeof document !== 'undefined') {
      var demarrer = function () { monter(document.getElementById('diag'), window.DIAG); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
      else demarrer();
    }
  }
})();
