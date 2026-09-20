// =====================================================================
// LE BLOC « MA RÉPONSE » AU PIED D'UNE FICHE D'ACTIVITÉ (décision D16, f).
//
// Chargé après components.js sur les 27 fiches -activite et les 27 -ebep,
// par outils/migrer.py. Le bloc est dans le HTML, caché (hidden). Ce script
// ne l'ouvre que pour une session ÉLÈVE, lue dans le témoin lft_ouvert :
// un visiteur sans session ne provoque AUCUNE requête, la fiche reste
// publique et anonyme (même règle que marquerProgressionEleve dans
// components.js). Un professeur voit un aperçu grisé, sans réseau non plus.
//
// Rien ici n'est une barrière : c'est /api/classeur/reponse qui décide, le
// groupe est déduit côté serveur, la fiche est vérifiée contre le catalogue.
// Les textes reçus passent par textContent ou .value, jamais par innerHTML.
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
  function lienConnexion(avant) {
    msg.textContent = avant + ' ';
    const a = document.createElement('a');
    a.href = '/connexion.html?suite=' + encodeURIComponent(location.pathname);
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Reconnecte-toi dans un nouvel onglet';
    msg.appendChild(a);
    msg.appendChild(document.createTextNode(', puis reviens ici et clique à nouveau sur Envoyer : ton texte est toujours dans le champ.'));
    msg.className = 'ma-reponse-msg err';
  }

  /** Affiche l'état d'une réponse reçue (ou l'absence de réponse). */
  function afficher(r, prenom) {
    const qui = prenom ? ' Tu es connecté comme ' + prenom + '. Ce n’est pas toi ? Ferme la session en haut de la page.' : '';
    if (!r) {
      zone.value = '';
      zone.disabled = false;
      envoyer.hidden = false;
      if (supprimer) supprimer.hidden = true;
      if (correction) { correction.hidden = true; correction.textContent = ''; }
      etat.textContent = 'Aucune réponse envoyée pour cette fiche.' + qui;
      compter();
      return;
    }
    zone.value = r.texte || '';
    compter();
    if (r.corrige_le) {
      // Corrigée : la réponse se fige, la correction se lit sous le texte.
      zone.disabled = true;
      envoyer.hidden = true;
      if (supprimer) supprimer.hidden = true;
      etat.textContent = 'Réponse corrigée par ton professeur le ' + quand(r.corrige_le) + '. Elle ne se modifie plus.' + qui;
      if (correction) {
        correction.hidden = false;
        correction.textContent = '';
        const titre = document.createElement('strong');
        titre.textContent = 'Correction : ';
        correction.appendChild(titre);
        correction.appendChild(document.createTextNode(r.correction || ''));
      }
      return;
    }
    zone.disabled = false;
    envoyer.hidden = false;
    if (supprimer) supprimer.hidden = false;
    if (correction) { correction.hidden = true; correction.textContent = ''; }
    etat.textContent = 'Réponse envoyée le ' + quand(r.modifie_le || r.redige_le) + '. Tu peux encore la modifier tant qu’elle n’est pas corrigée.' + qui;
  }

  const role = temoin();

  // ---- Professeur : un aperçu grisé, aucune requête -------------------
  if (role === 'prof') {
    bloc.hidden = false;
    bloc.classList.add('apercu');
    zone.disabled = true;
    zone.placeholder = '';
    envoyer.hidden = true;
    if (supprimer) supprimer.hidden = true;
    if (compteur) compteur.hidden = true;
    etat.textContent = 'Les élèves rédigent ici. Leurs réponses arrivent dans « Classeur des élèves », section « Réponses rédigées ».';
    return;
  }
  if (role !== 'eleve') return;

  // ---- Élève : lire, puis envoyer ou retirer ---------------------------
  bloc.hidden = false;
  zone.addEventListener('input', compter);
  compter();
  etat.textContent = 'Chargement de ta réponse…';

  fetch('/api/classeur/reponse?page=' + encodeURIComponent(page), { credentials: 'same-origin' })
    .then(function (r) {
      if (r.status === 401) { lienConnexion('Ta session a expiré.'); return null; }
      return r.ok ? r.json() : null;
    })
    .then(function (d) {
      if (!d) {
        if (!msg.textContent) etat.textContent = 'Ta réponse n’a pas pu être lue pour le moment. Tu peux quand même en écrire une.';
        return;
      }
      afficher((d.reponses || [])[0] || null, d.prenom);
    })
    .catch(function () {
      etat.textContent = 'Ta réponse n’a pas pu être lue pour le moment. Tu peux quand même en écrire une.';
    });

  /** Un appel JSON vers notre API ; renvoie {statut, corps}. */
  function appeler(methode, corps) {
    return fetch('/api/classeur/reponse', {
      method: methode,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps),
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
        afficher(res.corps.reponse, res.corps.prenom);
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
          afficher(null, null);
          dire('Réponse supprimée.', 'ok');
        })
        .catch(function () { dire('La suppression n’a pas abouti : vérifie la connexion et réessaie.', 'err'); })
        .then(function () { supprimer.disabled = false; });
    });
  }
})();
