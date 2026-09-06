// Videos ajoutees par le professeur, gardees dans son navigateur.
// Voir outils/videos.html pour la saisie et l'export.

(function () {
  var CLE = 'techno-lft-videos';

  function lire() {
    try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch (e) { return {}; }
  }
  function ecrire(o) {
    try { localStorage.setItem(CLE, JSON.stringify(o)); return true; } catch (e) { return false; }
  }

  // Toutes les adresses ne s'affichent pas en cadre integre : chaque plateforme
  // a sa forme d'integration, et beaucoup de sites la refusent purement et
  // simplement. On normalise ce qu'on sait faire, on met un lien pour le reste.
  function normaliser(u) {
    u = (u || '').trim();
    if (!u) return null;
    if (/^http:\/\//i.test(u)) {
      return { type: 'mixte', src: u, hote: '',
               note: "Adresse en http, non securisee : un navigateur la bloquera sur le site." };
    }
    if (!/^https:\/\//i.test(u)) {
      return { type: 'invalide', src: u, hote: '',
               note: "Ce n'est pas une adresse web. Collez l'adresse complete, qui commence par https://" };
    }
    var m;
    if ((m = /podeduc\.apps\.education\.fr\/video\/([^?#]+?)\/?(?:[?#]|$)/i.exec(u)))
      return { type: 'iframe', hote: 'PodEduc',
               src: 'https://podeduc.apps.education.fr/video/' + m[1] + '/?is_iframe=true' };
    if ((m = /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/i.exec(u)))
      return { type: 'iframe', hote: 'YouTube', src: 'https://www.youtube.com/embed/' + m[1] };
    if ((m = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(u)))
      return { type: 'iframe', hote: 'Vimeo', src: 'https://player.vimeo.com/video/' + m[1] };
    if ((m = /dailymotion\.com\/(?:embed\/)?video\/([\w]+)/i.exec(u)))
      return { type: 'iframe', hote: 'Dailymotion',
               src: 'https://www.dailymotion.com/embed/video/' + m[1] };
    if ((m = /^(https:\/\/[^\/]+)\/(?:w|videos\/watch)\/([\w-]{8,})/i.exec(u)))
      return { type: 'iframe', hote: 'PeerTube', src: m[1] + '/videos/embed/' + m[2] };
    return { type: 'lien', src: u, hote: '',
             note: "Plateforme inconnue : la video s'affichera en lien, pas en cadre integre." };
  }

  function ech(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function bloc(v) {
    var n = normaliser(v.url);
    if (!n) return '';
    var titre = ech(v.titre || 'Vidéo ajoutée par le professeur');
    var src = ech(v.source || '');
    var h = '<div class="info-box info-box-blue vp-bloc">'
          + '<div class="info-box-title"><span class="ico">&#x1F3AC;</span> Ma vidéo</div>';
    if (n.type === 'iframe') {
      h += '<iframe class="vid-cadre" src="' + ech(n.src) + '" loading="lazy" allowfullscreen '
         + 'title="' + titre + '"></iframe>';
    }
    h += '<p style="margin:.6rem 0 .2rem"><strong>' + titre + '</strong>'
       + (n.hote ? ' &middot; ' + ech(n.hote) : '') + '</p>';
    if (src) h += '<p class="vid-licence">' + src + '</p>';
    h += '<p class="vid-licence"><a href="' + ech(v.url) + '" target="_blank" rel="noopener">'
       + 'Ouvrir la page d\'origine</a></p>';
    if (n.note) h += '<p class="vid-licence vp-alerte">' + ech(n.note) + '</p>';
    return h + '</div>';
  }

  function rendre(racine) {
    var d = lire();
    (racine || document).querySelectorAll('[data-video-perso]').forEach(function (c) {
      var v = d[c.getAttribute('data-video-perso')];
      c.innerHTML = (v && v.url) ? bloc(v) : '';
    });
  }

  window.VideosPerso = { lire: lire, ecrire: ecrire, normaliser: normaliser,
                         rendre: rendre, bloc: bloc, CLE: CLE };
  document.addEventListener('DOMContentLoaded', function () { rendre(document); });
})();
