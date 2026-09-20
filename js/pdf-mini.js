/* =============================================================
   TECHNOLOGIE LFT : PdfMini
   Module PDF autonome, sans aucune dépendance. Il écrit un PDF 1.4
   valide (pages A4, polices standard Helvetica et Helvetica-Bold non
   incorporées, flux non compressés, table xref exacte).

   Le module tourne aussi sous Node : rien ne touche « window » ni
   « document » en dehors de PdfMini.telecharger. C'est ce qui permet
   de le tester hors navigateur.

   API :
     var pdf = PdfMini.nouveau({ titre, auteur, marges:{haut,bas,gauche,droite} });
     pdf.texte('…', { taille, gras, gris, retrait, apres, aligner });
     pdf.espace(mm); pdf.trait(); pdf.garder(mm);   // garder : nouvelle page s'il reste moins de mm
     pdf.pied('à gauche', 'page {n} / {N}');
     var octets = pdf.octets();                 // Uint8Array
     PdfMini.telecharger(octets, 'fichier.pdf'); // true si lancé
     PdfMini.mesurer('texte', taille, gras);     // largeur en pt
   ============================================================= */
(function () {
  'use strict';

  // ---- Constantes de page (A4 en points PostScript) ----
  var PAGE_LARGEUR = 595.28;
  var PAGE_HAUTEUR = 841.89;
  var PT_PAR_MM = 72 / 25.4;
  var INTERLIGNE = 1.32;          // hauteur de ligne = taille x INTERLIGNE
  var LARGEUR_INCONNUE = 556;     // largeur d'un caractère absent des tables

  // ---- Largeurs AFM (Adobe), WinAnsiEncoding, codes 32..255, en millièmes d'em ----
  // Valeurs extraites des fichiers Helvetica.afm et Helvetica-Bold.afm
  // livrés avec les 14 polices standard. Les codes non affectés (0x81,
  // 0x8D, 0x8F, 0x90, 0x9D) valent « bullet », comme dans la norme PDF.
  var LARGEURS_NORMAL = [
    278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,     // 0x20
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,     // 0x30
    1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,    // 0x40
    667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,     // 0x50
    333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,     // 0x60
    556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,     // 0x70
    556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,  // 0x80
    350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,   // 0x90
    278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,     // 0xA0
    400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,     // 0xB0
    667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,    // 0xC0
    722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,     // 0xD0
    556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,     // 0xE0
    556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500      // 0xF0
  ];
  var LARGEURS_GRAS = [
    278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,     // 0x20
    556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,     // 0x30
    975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,     // 0x40
    667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,     // 0x50
    333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,     // 0x60
    611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,     // 0x70
    556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,  // 0x80
    350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,   // 0x90
    278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,     // 0xA0
    400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,     // 0xB0
    722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,    // 0xC0
    722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,     // 0xD0
    556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,     // 0xE0
    611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556      // 0xF0
  ];

  // ---- Encodage cp1252 (WinAnsi) ----
  // Points de code Unicode qui occupent la plage 0x80..0x9F de cp1252.
  // Les caractères sont écrits en séquences \u pour que le fichier source
  // ne contienne aucun tiret typographique (règle du site).
  var CP1252_HAUT = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F
  };
  var POINT_INTERROGATION = 0x3F;

  // Un caractère (point de code) devient un octet cp1252, ou « ? ».
  function octetDe(cp) {
    if (cp >= 0x20 && cp <= 0x7E) return cp;
    if (cp >= 0xA0 && cp <= 0xFF) return cp;
    if (CP1252_HAUT[cp] !== undefined) return CP1252_HAUT[cp];
    if (cp === 0x09) return 0x20;            // tabulation : une espace
    return POINT_INTERROGATION;
  }

  // Chaîne JavaScript vers tableau d'octets cp1252 (gère les paires
  // de substitution : un emoji devient un seul « ? »).
  function encoder(txt) {
    var octets = [];
    var s = String(txt);
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i);
      if (cp > 0xFFFF) i++;                  // paire de substitution consommée
      octets.push(octetDe(cp));
    }
    return octets;
  }

  // Largeur en points d'un texte à une taille donnée.
  function mesurer(txt, taille, gras) {
    var table = gras ? LARGEURS_GRAS : LARGEURS_NORMAL;
    var octets = encoder(txt);
    var total = 0;
    for (var i = 0; i < octets.length; i++) {
      var w = table[octets[i] - 32];
      total += (w === undefined ? LARGEUR_INCONNUE : w);
    }
    return total * taille / 1000;
  }

  // Coupe un paragraphe (sans retour à la ligne) en lignes qui tiennent
  // dans « largeur » points : coupure aux espaces, et un mot plus long que
  // la ligne est coupé caractère par caractère.
  function couperParagraphe(paragraphe, largeur, taille, gras) {
    var mots = paragraphe.split(' ').filter(function (m) { return m.length > 0; });
    var lignes = [];
    var courante = '';
    var largeurEspace = mesurer(' ', taille, gras);

    function pousser() {
      lignes.push(courante);
      courante = '';
    }

    for (var i = 0; i < mots.length; i++) {
      var mot = mots[i];
      var lMot = mesurer(mot, taille, gras);
      if (lMot > largeur) {
        // Mot trop long : on le découpe en morceaux qui tiennent sur la ligne
        var morceau = '';
        var caracteres = Array.from(mot);
        for (var k = 0; k < caracteres.length; k++) {
          var essai = morceau + caracteres[k];
          var base = courante ? mesurer(courante, taille, gras) + largeurEspace : 0;
          if (base + mesurer(essai, taille, gras) > largeur && (morceau || courante)) {
            if (morceau) courante = courante ? courante + ' ' + morceau : morceau;
            pousser();
            morceau = caracteres[k];
          } else {
            morceau = essai;
          }
        }
        courante = courante ? courante + ' ' + morceau : morceau;
        continue;
      }
      if (!courante) {
        courante = mot;
      } else if (mesurer(courante, taille, gras) + largeurEspace + lMot <= largeur) {
        courante += ' ' + mot;
      } else {
        pousser();
        courante = mot;
      }
    }
    if (courante || lignes.length === 0) lignes.push(courante);
    return lignes;
  }

  // Coupe un texte complet : chaque « \n » ouvre un nouveau paragraphe,
  // une ligne vide reste une ligne vide.
  function couperTexte(txt, largeur, taille, gras) {
    var paragraphes = String(txt).replace(/\r\n?/g, '\n').split('\n');
    var lignes = [];
    for (var i = 0; i < paragraphes.length; i++) {
      var p = paragraphes[i].trim();
      if (p === '') { lignes.push(''); continue; }
      lignes = lignes.concat(couperParagraphe(p, largeur, taille, gras));
    }
    return lignes;
  }

  // ---- Écriture des chaînes PDF ----
  // Échappe ( ) et \ puis renvoie les octets « (…) » prêts pour le flux.
  function chainePdf(txt) {
    var octets = encoder(txt);
    var sortie = [0x28];                                 // (
    for (var i = 0; i < octets.length; i++) {
      var o = octets[i];
      if (o === 0x28 || o === 0x29 || o === 0x5C) sortie.push(0x5C);
      sortie.push(o);
    }
    sortie.push(0x29);                                   // )
    return sortie;
  }

  // Chaîne de métadonnées (/Title, /Author) en UTF-16BE avec marque
  // d'ordre des octets : lisible par tous les lecteurs, accents compris.
  function chaineHexUtf16(txt) {
    var hex = 'FEFF';
    var s = String(txt);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i).toString(16).toUpperCase();
      hex += ('0000' + c).slice(-4);
    }
    return '<' + hex + '>';
  }

  // Nombre au format PDF (pas de notation exponentielle, 3 décimales).
  function nombre(n) {
    var s = (Math.round(n * 1000) / 1000).toString();
    return s.indexOf('e') >= 0 ? n.toFixed(3) : s;
  }

  // Texte ASCII structurel vers octets.
  function ascii(txt) {
    var octets = [];
    for (var i = 0; i < txt.length; i++) octets.push(txt.charCodeAt(i) & 0xFF);
    return octets;
  }

  function dateCreation(d) {
    function deux(n) { return (n < 10 ? '0' : '') + n; }
    return 'D:' + d.getFullYear() + deux(d.getMonth() + 1) + deux(d.getDate()) +
      deux(d.getHours()) + deux(d.getMinutes()) + deux(d.getSeconds());
  }

  // ---- Document ----
  function nouveau(options) {
    var opts = options || {};
    var m = opts.marges || {};
    var marges = {
      haut: (m.haut === undefined ? 18 : m.haut) * PT_PAR_MM,
      bas: (m.bas === undefined ? 18 : m.bas) * PT_PAR_MM,
      gauche: (m.gauche === undefined ? 18 : m.gauche) * PT_PAR_MM,
      droite: (m.droite === undefined ? 18 : m.droite) * PT_PAR_MM
    };
    var largeurUtile = PAGE_LARGEUR - marges.gauche - marges.droite;

    // Chaque page : liste de fragments d'octets (opérateurs de contenu)
    var pages = [];
    var y = 0;                         // position courante, depuis le HAUT de la page
    var pied = null;                   // { gauche, droite }

    function nouvellePage() {
      pages.push([]);
      y = marges.haut;
    }
    nouvellePage();

    function page() { return pages[pages.length - 1]; }

    // Place une ligne de texte : x, y (depuis le haut), taille, gras, gris
    function poserLigne(cible, txt, x, yHaut, taille, gras, gris) {
      var yPdf = PAGE_HAUTEUR - yHaut;
      var police = gras ? '/F2' : '/F1';
      var ops = 'BT ' + (gris ? '0.42 g ' : '0 g ') + police + ' ' + nombre(taille) + ' Tf 1 0 0 1 ' +
        nombre(x) + ' ' + nombre(yPdf) + ' Tm ';
      cible.push(ascii(ops));
      cible.push(chainePdf(txt));
      cible.push(ascii(' Tj ET\n'));
    }

    // Saute de page si la prochaine ligne dépasserait la marge basse
    function assurerPlace(hauteur) {
      if (y + hauteur > PAGE_HAUTEUR - marges.bas && page().length > 0) nouvellePage();
    }

    var doc = {
      // Paragraphe(s) de texte avec retour à la ligne et pagination
      texte: function (txt, o) {
        o = o || {};
        var taille = o.taille || 10.5;
        var gras = !!o.gras;
        var gris = !!o.gris;
        var retrait = (o.retrait || 0) * PT_PAR_MM;
        var apres = (o.apres === undefined ? 1.5 : o.apres) * PT_PAR_MM;
        var aligner = o.aligner || 'gauche';
        var hauteurLigne = taille * INTERLIGNE;
        var largeur = largeurUtile - retrait;
        var lignes = couperTexte(txt, largeur, taille, gras);
        for (var i = 0; i < lignes.length; i++) {
          assurerPlace(hauteurLigne);
          var ligne = lignes[i];
          if (ligne !== '') {
            var x = marges.gauche + retrait;
            if (aligner === 'droite') x = PAGE_LARGEUR - marges.droite - mesurer(ligne, taille, gras);
            else if (aligner === 'centre') x = marges.gauche + retrait + (largeur - mesurer(ligne, taille, gras)) / 2;
            // la ligne de base est posée à ~80 % de la hauteur de ligne
            poserLigne(page(), ligne, x, y + taille * 0.8 + (hauteurLigne - taille) / 2, taille, gras, gris);
          }
          y += hauteurLigne;
        }
        y += apres;
        return doc;
      },

      // Espace vertical, en mm
      espace: function (mm) {
        y += (mm || 0) * PT_PAR_MM;
        return doc;
      },

      // Garde « mm » millimètres disponibles avant la marge basse : sinon,
      // nouvelle page (sert à ne pas laisser un titre seul en bas de page).
      // Sans effet sur une page encore vide.
      garder: function (mm) {
        assurerPlace((mm || 0) * PT_PAR_MM);
        return doc;
      },

      // Trait horizontal fin sur toute la largeur utile
      trait: function () {
        assurerPlace(4 * PT_PAR_MM);
        y += 1.2 * PT_PAR_MM;
        var yPdf = PAGE_HAUTEUR - y;
        page().push(ascii('q 0.6 G 0.6 w ' + nombre(marges.gauche) + ' ' + nombre(yPdf) + ' m ' +
          nombre(PAGE_LARGEUR - marges.droite) + ' ' + nombre(yPdf) + ' l S Q\n'));
        y += 2.5 * PT_PAR_MM;
        return doc;
      },

      // Pied de page : « droite » peut contenir {n} et {N}
      pied: function (gauche, droite) {
        pied = { gauche: gauche || '', droite: droite || '' };
        return doc;
      },

      nombrePages: function () { return pages.length; },

      // Assemble le fichier et renvoie ses octets
      octets: function () {
        var fragments = [];      // tableau de tableaux d'octets
        var longueur = 0;
        var offsets = [];        // offset de chaque objet, index = numéro d'objet

        function ecrire(octets) {
          fragments.push(octets);
          longueur += octets.length;
        }
        function objet(num, corps) {
          offsets[num] = longueur;
          ecrire(ascii(num + ' 0 obj\n'));
          if (Array.isArray(corps)) ecrire(corps); else ecrire(ascii(corps));
          ecrire(ascii('\nendobj\n'));
        }

        // Pied de chaque page, posé maintenant que le total est connu
        var N = pages.length;
        var contenus = [];
        for (var p = 0; p < N; p++) {
          var cible = pages[p].slice();
          if (pied) {
            var taillePied = 8.5;
            var yPied = PAGE_HAUTEUR - marges.bas * 0.5;
            var droite = pied.droite.replace(/\{n\}/g, String(p + 1)).replace(/\{N\}/g, String(N));
            // Le texte de gauche est raccourci (avec « … ») pour ne jamais
            // chevaucher le numéro de page ni sortir de la page
            var gauche = pied.gauche;
            var placeGauche = largeurUtile - (droite ? mesurer(droite, taillePied, false) + 8 : 0);
            if (gauche && mesurer(gauche, taillePied, false) > placeGauche) {
              while (gauche.length > 0 && mesurer(gauche + '…', taillePied, false) > placeGauche) gauche = gauche.slice(0, -1);
              gauche = gauche.replace(/\s+$/, '') + '…';
            }
            if (gauche) poserLigne(cible, gauche, marges.gauche, yPied, taillePied, false, true);
            if (droite) poserLigne(cible, droite, PAGE_LARGEUR - marges.droite - mesurer(droite, taillePied, false), yPied, taillePied, false, true);
          }
          var flux = [];
          for (var f = 0; f < cible.length; f++) flux = flux.concat(cible[f]);
          contenus.push(flux);
        }

        // Numérotation : 1 catalogue, 2 pages, 3 police, 4 police grasse,
        // 5 info, puis pour chaque page (page, contenu)
        var premierObjetPage = 6;
        var total = 5 + 2 * N;
        var kids = [];
        for (var k = 0; k < N; k++) kids.push((premierObjetPage + 2 * k) + ' 0 R');

        ecrire(ascii('%PDF-1.4\n'));
        ecrire([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]);   // ligne binaire conventionnelle
        objet(1, '<< /Type /Catalog /Pages 2 0 R >>');
        objet(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + N + ' >>');
        objet(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        objet(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        var info = '<< /Producer (techlft.egd.mg)';
        if (opts.titre) info += ' /Title ' + chaineHexUtf16(opts.titre);
        if (opts.auteur) info += ' /Author ' + chaineHexUtf16(opts.auteur);
        if (opts.date !== null) info += ' /CreationDate (' + dateCreation(opts.date instanceof Date ? opts.date : new Date()) + ')';
        info += ' >>';
        objet(5, info);

        for (var i = 0; i < N; i++) {
          var numPage = premierObjetPage + 2 * i;
          var numContenu = numPage + 1;
          objet(numPage, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + nombre(PAGE_LARGEUR) + ' ' + nombre(PAGE_HAUTEUR) + ']' +
            ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + numContenu + ' 0 R >>');
          var flux2 = contenus[i];
          offsets[numContenu] = longueur;
          ecrire(ascii(numContenu + ' 0 obj\n<< /Length ' + flux2.length + ' >>\nstream\n'));
          ecrire(flux2);
          ecrire(ascii('\nendstream\nendobj\n'));
        }

        // Table xref : une entrée de 20 octets exactement par objet
        var xref = longueur;
        var lignes = ['xref', '0 ' + (total + 1), '0000000000 65535 f '];
        for (var n = 1; n <= total; n++) lignes.push(('0000000000' + offsets[n]).slice(-10) + ' 00000 n ');
        ecrire(ascii(lignes.join('\n') + '\n'));
        ecrire(ascii('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'));

        var sortie = new Uint8Array(longueur);
        var pos = 0;
        for (var g = 0; g < fragments.length; g++) {
          sortie.set(fragments[g], pos);
          pos += fragments[g].length;
        }
        return sortie;
      }
    };
    return doc;
  }

  // ---- Téléchargement (navigateur seulement) ----
  // Crée un lien <a download> vers un Blob et le clique ; l'URL est révoquée
  // après 10 s. Renvoie false si le navigateur ne le permet pas.
  function telecharger(octets, nom) {
    try {
      if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return false;
      var blob = new Blob([octets], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = nom || 'document.pdf';
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 60000);   // une minute : Safari iOS ouvre parfois le PDF dans un onglet, sans se presser
      return true;
    } catch (e) {
      return false;
    }
  }

  var PdfMini = {
    nouveau: nouveau,
    telecharger: telecharger,
    mesurer: mesurer,
    encoder: encoder,
    couperTexte: couperTexte,
    PAGE_LARGEUR: PAGE_LARGEUR,
    PAGE_HAUTEUR: PAGE_HAUTEUR
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PdfMini;
  if (typeof window !== 'undefined') window.PdfMini = PdfMini;
})();
