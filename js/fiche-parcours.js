// =====================================================================
// LIRE UNE FICHE SANS SE PERDRE : le volet document, et une activité à la fois.
//
// Deux plaintes d'élèves, les mêmes depuis la rentrée : « c'est long », et
// « je dois remonter tout en haut pour relire le document ». Ce fichier
// répond aux deux sans toucher au contenu des fiches.
//
//   1. UN VOLET. Un clic sur « document 3 » dans une consigne ouvre le
//      document À CÔTÉ de la question, au lieu de faire défiler la page
//      jusqu'en haut. L'élève lit et répond sans perdre sa place. C'est
//      l'effet d'attention partagée : quand la question et son support sont
//      éloignés, l'élève dépense à chercher ce qu'il devrait dépenser à
//      comprendre.
//
//   2. UNE ACTIVITÉ À LA FOIS. Les activités sont masquées sauf celle en
//      cours, avec un fil « Activité 2 sur 3 » et deux boutons. Une fiche de
//      trois mille mots déroulée d'un coup décourage ; la même, découpée en
//      trois, se termine.
//
// CONTRAINTE ABSOLUE, ET RAISON DE LA FORME DE CE FICHIER.
// js/reponse.js recalcule les clés des champs à chaque ouverture, à partir du
// SEUL ordre des éléments de <main>. Deux mille six cent trente-neuf réponses
// d'élèves sont enregistrées sur ces clés. Ce fichier ne doit donc jamais
// ajouter, retirer ni déplacer un élément de <main> avant que reponse.js ait
// fini : il se charge APRÈS lui, n'ajoute rien dans <main> (le volet et le fil
// sont posés sur <body>), et ne fait que poser l'attribut hidden, qui ne
// change pas l'ordre du document.
//
// Ce qu'il ne fait pas : enregistrer. L'enregistrement reste celui de
// reponse.js, au fil de la frappe. « Suivant » fait avancer la lecture, pas
// la remise : le dire à l'élève plutôt que de le laisser croire qu'il vient
// de rendre son travail.
// =====================================================================
(function () {
  'use strict';

  const main = document.querySelector('main');
  if (!main) return;

  const activites = Array.prototype.slice.call(
    document.querySelectorAll('[id^="activite-"]'));
  const liens = Array.prototype.slice.call(document.querySelectorAll('a.va-au-doc'));
  // window.afficherActivite est posee plus bas par le parcours : elle permet
  // au volet de faire venir une activite masquee quand l'eleve veut y aller.
  window.afficherActivite = null;
  if (!activites.length && !liens.length) return;

  const el = function (balise, attrs, enfants) {
    const e = document.createElement(balise);
    Object.keys(attrs || {}).forEach(function (k) {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v; else e.setAttribute(k, v === true ? '' : v);
    });
    (enfants || []).forEach(function (c) { if (c != null) e.append(c); });
    return e;
  };

  // =====================================================================
  // 1. LE VOLET
  // =====================================================================
  let rendreLeFocus = null;

  const titreVolet = el('h2', { id: 'volet-titre' }, []);
  const corpsVolet = el('div', { class: 'volet-corps' }, []);
  const fermer = el('button', { type: 'button', class: 'volet-fermer' }, ['Fermer']);
  const allerAu = el('a', { class: 'volet-aller', href: '#' },
    ['Voir ce document dans la page']);

  const feuille = el('div', { class: 'volet-feuille' },
    [el('div', { class: 'volet-tete' }, [titreVolet, fermer]), corpsVolet,
     el('p', { class: 'volet-pied' }, [allerAu])]);
  const panneau = el('div', { class: 'volet-doc', role: 'dialog', 'aria-modal': 'true',
                              'aria-labelledby': 'volet-titre' },
    [el('div', { class: 'volet-fond' }, []), feuille]);
  panneau.hidden = true;
  document.body.appendChild(panneau);

  /**
   * La feuille de style du site n'a pas de version dans son URL : un élève
   * qui revient avec l'ancienne en cache aurait le script sans ses styles, et
   * le volet s'afficherait comme un bloc quelconque au bas de la page. On
   * vérifie donc que les styles sont bien là AVANT de prendre la main sur les
   * liens ; sinon on ne fait rien, et le lien redescend au document comme une
   * ancre ordinaire, ce qu'il a toujours su faire.
   */
  function stylesPresents() {
    panneau.hidden = false;
    const ok = getComputedStyle(panneau).position === 'fixed';
    panneau.hidden = true;
    return ok;
  }

  function ouvrir(id, depuis) {
    const source = document.getElementById(id);
    if (!source) return false;
    // Le volet sert aussi a montrer une AUTRE activite, quand une consigne y
    // renvoie : le titre vient alors du h2 de la carte.
    const titre = source.querySelector('.info-box-title') || source.querySelector('h2');
    titreVolet.textContent = titre ? titre.textContent.trim() : 'Document';
    // Une COPIE : l'original reste en place dans la page, donc l'ordre des
    // éléments de <main> ne bouge pas d'un iota.
    const copie = source.cloneNode(true);
    const t = copie.querySelector('.info-box-title') || copie.querySelector('h2');
    if (t) t.remove();
    copie.removeAttribute('id');
    copie.querySelectorAll('[id]').forEach(function (x) { x.removeAttribute('id'); });
    // Le volet EST la lecture en entier : le document s'y montre déplié, et
    // sans le bouton qui n'aurait plus rien à commander.
    copie.querySelectorAll('.doc-plus').forEach(function (b) { b.remove(); });
    // La copie elle-meme peut porter hidden : une carte d'activite masquee
    // par le parcours donnait un volet au titre juste et au corps vide.
    copie.hidden = false;
    copie.querySelectorAll('[hidden]').forEach(function (x) { x.hidden = false; });
    corpsVolet.replaceChildren(copie);
    allerAu.href = '#' + id;
    allerAu.textContent = /^activite-/.test(id)
      ? 'Revenir à cette activité' : 'Voir ce document dans la page';
    rendreLeFocus = depuis || null;
    panneau.hidden = false;
    document.body.classList.add('volet-ouvert');
    // Le volet s'ouvre toujours au DÉBUT du document : il garde sinon la
    // position de la lecture précédente, et l'élève croit avoir ouvert le
    // mauvais document.
    feuille.scrollTop = 0;
    fermer.focus({ preventScroll: true });
    return true;
  }

  function refermer() {
    if (panneau.hidden) return;
    panneau.hidden = true;
    document.body.classList.remove('volet-ouvert');
    corpsVolet.replaceChildren();
    if (rendreLeFocus && document.contains(rendreLeFocus)) rendreLeFocus.focus();
    rendreLeFocus = null;
  }

  fermer.addEventListener('click', refermer);
  panneau.querySelector('.volet-fond').addEventListener('click', refermer);
  allerAu.addEventListener('click', function () {
    const id = (allerAu.getAttribute('href') || '').replace('#', '');
    refermer();
    // Aller vers une activite masquee demande de l'afficher d'abord.
    if (/^activite-/.test(id) && typeof window.afficherActivite === 'function') {
      window.afficherActivite(id);
    }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') refermer();
    // Le focus ne sort pas du volet tant qu'il est ouvert.
    if (ev.key !== 'Tab' || panneau.hidden) return;
    const f = panneau.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const premier = f[0], dernier = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
    else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus(); }
  });

  const habille = stylesPresents();
  if (habille) {
    liens.forEach(function (a) {
      a.addEventListener('click', function (ev) {
        const id = (a.getAttribute('href') || '').replace('#', '');
        // Si le volet ne peut pas s'ouvrir, le lien reprend son office : il
        // descend jusqu'au document, comme un lien ordinaire.
        if (ouvrir(id, a)) ev.preventDefault();
      });
    });
  } else {
    panneau.remove();
  }

  // =====================================================================
  // 2. LES DOCUMENTS SE REPLIENT DERRIÈRE LEUR RÉSUMÉ
  //
  // Chaque document porte en tête un résumé de trois lignes, écrit dans la
  // page. Le texte complet est juste en dessous, replié. L'élève pressé lit
  // le résumé et répond ; celui qui a besoin du détail ouvre.
  //
  // UN DOCUMENT FAIT EXCEPTION, et ce n'est pas un oubli. Le programme de
  // Technologie du cycle 4, arrêté du 9 février 2024, porte une connaissance
  // exigible explicite sur « les composantes d'une notice et d'une
  // documentation technique et leur organisation ». Un élève qui ne
  // rencontrerait plus que des résumés n'apprendrait jamais à lire une vraie
  // documentation. Le document qui en est une, les fiches produit, reste donc
  // entier et sans résumé : c'est celui-là qu'il faut apprendre à lire.
  // =====================================================================
  if (habille) {
    document.querySelectorAll('.info-box > .doc-resume').forEach(function (resume) {
      const boite = resume.parentElement;
      const apres = [];
      let n = resume.nextElementSibling;
      while (n) { apres.push(n); n = n.nextElementSibling; }
      if (!apres.length) return;

      const bouton = el('button', { type: 'button', class: 'doc-plus', 'aria-expanded': 'false' }, []);
      const corpsId = (boite.id || 'doc') + '-entier';
      apres.forEach(function (x, i) { if (i === 0) x.id = x.id || corpsId; });
      bouton.setAttribute('aria-controls', corpsId);
      let ouvert = false;
      function peindre() {
        apres.forEach(function (x) { x.hidden = !ouvert; });
        bouton.setAttribute('aria-expanded', String(ouvert));
        bouton.textContent = ouvert ? 'Replier le document' : 'Lire le document en entier';
      }
      bouton.addEventListener('click', function () { ouvert = !ouvert; peindre(); });
      resume.after(bouton);
      peindre();
    });

    // Le lexique n'est pas un texte qu'on lit, c'est un texte qu'on consulte :
    // il se replie en entier, sans résumé, ce qui n'aurait aucun sens pour une
    // liste de définitions.
    const lexique = Array.prototype.find.call(
      document.querySelectorAll('.info-box'),
      function (b) {
        const t = b.querySelector('.info-box-title');
        return t && /lexique/i.test(t.textContent) && !b.querySelector('.doc-resume');
      });
    if (lexique) {
      const corps = [];
      let n = lexique.querySelector('.info-box-title');
      n = n && n.nextElementSibling;
      while (n) { corps.push(n); n = n.nextElementSibling; }
      if (corps.length) {
        const b = el('button', { type: 'button', class: 'doc-plus', 'aria-expanded': 'false' }, []);
        // Le nombre de mots se compte, il ne s'ecrit pas en dur : une fiche a
        // cinq entrees annoncait huit mots a chaque ouverture.
        const entrees = lexique.querySelectorAll('li').length;
        const combien = entrees ? entrees + (entrees > 1 ? ' mots' : ' mot') : 'les mots de la fiche';
        // Sur une fiche adaptee, le lexique est une aide au vocabulaire posee
        // la expres : elle reste ouverte, l'eleve n'a pas a savoir qu'un
        // bouton la cache.
        let ouvert = /-ebep\.html$/.test(location.pathname);
        function peindreLex() {
          corps.forEach(function (x) { x.hidden = !ouvert; });
          b.setAttribute('aria-expanded', String(ouvert));
          b.textContent = ouvert ? 'Replier le lexique' : 'Ouvrir le lexique, ' + combien;
        }
        b.addEventListener('click', function () { ouvert = !ouvert; peindreLex(); });
        lexique.querySelector('.info-box-title').after(b);
        peindreLex();
      }
    }

    // Un document replié doit s'ouvrir quand on arrive dessus, par le volet
    // comme par une ancre : sinon l'élève atterrit sur un titre seul.
    document.querySelectorAll('.info-box .doc-plus').forEach(function (b) {
      const boite = b.closest('.info-box');
      if (!boite || !boite.id) return;
      window.addEventListener('hashchange', function () {
        if (location.hash === '#' + boite.id && b.getAttribute('aria-expanded') === 'false') b.click();
      });
    });

    // À l'impression, la fiche papier porte tous les documents en entier.
    window.addEventListener('beforeprint', function () {
      document.querySelectorAll('.info-box .doc-plus[aria-expanded="false"]')
        .forEach(function (b) { b.click(); });
    });
  }

  // =====================================================================
  // 3. UNE ACTIVITÉ À LA FOIS
  // =====================================================================
  // Masquer des activités sans pouvoir afficher la barre qui permet d'en
  // changer enfermerait l'élève dans la première : on s'en abstient.
  if (activites.length < 2 || !habille) return;

  const titreDe = function (carte) {
    const h = carte.querySelector('h2');
    return h ? h.textContent.trim() : 'Activité';
  };

  let courante = 0;
  const fil = el('nav', { class: 'fil-activites', 'aria-label': 'Parcours des activités' }, []);
  const rang = el('p', { class: 'fil-rang', role: 'status', 'aria-live': 'polite' }, []);
  const precedent = el('button', { type: 'button', class: 'fil-bouton' }, ['← Activité précédente']);
  const suivant = el('button', { type: 'button', class: 'fil-bouton principal' }, []);
  const tout = el('button', { type: 'button', class: 'fil-tout' }, ['Tout afficher']);
  fil.append(el('div', { class: 'fil-dedans' }, [rang, precedent, suivant, tout]));
  // Posé sur <body>, jamais dans <main> : l'ordre des éléments scannés par
  // js/reponse.js doit rester exactement celui du fichier.
  document.body.appendChild(fil);

  let deroule = false;

  function montrer(i, focaliser) {
    courante = Math.max(0, Math.min(activites.length - 1, i));
    activites.forEach(function (c, k) { c.hidden = !deroule && k !== courante; });
    rang.textContent = deroule
      ? 'Toutes les activités sont affichées.'
      : 'Activité ' + (courante + 1) + ' sur ' + activites.length;
    precedent.disabled = deroule || courante === 0;
    suivant.disabled = deroule || courante === activites.length - 1;
    suivant.textContent = courante === activites.length - 1
      ? 'Dernière activité' : 'Activité suivante →';
    tout.textContent = deroule ? 'Une activité à la fois' : 'Tout afficher';
    tout.setAttribute('aria-pressed', String(deroule));
    if (focaliser) {
      const c = activites[courante];
      c.scrollIntoView({ block: 'start', behavior: 'smooth' });
      const h = c.querySelector('h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }

  precedent.addEventListener('click', function () { montrer(courante - 1, true); });
  suivant.addEventListener('click', function () { montrer(courante + 1, true); });
  tout.addEventListener('click', function () {
    deroule = !deroule;
    montrer(courante, true);
  });

  // Un élève qui revient sur sa fiche reprend où il s'était arrêté. Le
  // navigateur peut refuser de stocker (navigation privée) : on s'en passe.
  const memoire = 'activite:' + location.pathname;
  try {
    const n = Number(sessionStorage.getItem(memoire));
    if (n >= 0 && n < activites.length) courante = n;
  } catch (e) { /* sans mémoire, on commence au début */ }

  window.afficherActivite = function (id) {
    const i = activites.findIndex(function (c) { return c.id === id; });
    if (i >= 0) montrer(i, true);
  };

  montrer(courante, false);
  window.addEventListener('pagehide', function () {
    try { sessionStorage.setItem(memoire, String(courante)); } catch (e) { /* tant pis */ }
  });

  // Une activité masquée reste imprimable : la fiche papier doit être entière.
  window.addEventListener('beforeprint', function () {
    activites.forEach(function (c) { c.hidden = false; });
  });
  window.addEventListener('afterprint', function () { montrer(courante, false); });
})();
