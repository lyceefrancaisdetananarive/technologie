// Deblocage progressif des sequences, reglage cote professeur.
// Panneau de reglage : enseignant/index.html

(function () {
  var CLE = 'techno-lft-progression';

  function lire() {
    try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch (e) { return {}; }
  }
  function ecrire(o) {
    try { localStorage.setItem(CLE, JSON.stringify(o)); return true; } catch (e) { return false; }
  }

  // Un reglage publie pour tout le site peut etre depose dans window.PROGRESSION_PUBLIEE
  // (fichier progression-publiee.js, charge avant celui-ci). Le reglage local du
  // navigateur, s'il existe, a la priorite : le professeur voit toujours le sien.
  function etatNiveau(niv) {
    var d = lire();
    if (d[niv]) return d[niv];
    var p = (window.PROGRESSION_PUBLIEE || {})[niv];
    if (p) return p;
    return { actif: false, jusqu: 0 };
  }

  // Applique le marquage aux cartes de sequence de l'index affiche.
  function appliquer() {
    var app = document.getElementById('app');
    if (!app) return;
    var niv = app.getAttribute('data-page');
    if (!/^[345]eme$/.test(niv || '')) return;
    var e = etatNiveau(niv);
    document.querySelectorAll('.seq-card[data-seq]').forEach(function (c) {
      var n = parseInt(c.getAttribute('data-seq'), 10);
      c.classList.remove('seq-faite', 'seq-encours', 'seq-avenir');
      var etiq = c.querySelector('.seq-etat');
      if (etiq) etiq.remove();
      if (!e.actif) return;                        // deblocage non active : tout reste visible
      var etat = n < e.jusqu ? 'faite' : (n === e.jusqu ? 'encours' : 'avenir');
      c.classList.add('seq-' + etat);
      var s = document.createElement('span');
      s.className = 'seq-etat seq-etat-' + etat;
      s.textContent = etat === 'faite' ? 'Fait' : (etat === 'encours' ? 'En cours' : 'À venir');
      var h = c.querySelector('h3');
      if (h) h.parentNode.insertBefore(s, h);
    });
  }

  window.Progression = { lire: lire, ecrire: ecrire, etatNiveau: etatNiveau,
                         appliquer: appliquer, CLE: CLE };
  document.addEventListener('DOMContentLoaded', appliquer);
})();
