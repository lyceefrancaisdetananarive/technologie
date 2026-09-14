// =====================================================================
// L'œil des mots de passe : un bouton qui montre ou masque ce que l'on tape.
//
// Chaque champ type="password" de la page reçoit un bouton à sa droite. Le
// mot de passe est masqué par défaut et le redevient à l'envoi du
// formulaire : sur un poste de salle informatique, un écran projeté ne doit
// pas rester avec un mot de passe en clair. Le bouton porte un libellé pour
// les lecteurs d'écran et son état (aria-pressed). Script classique, sans
// dépendance, chargé par les pages qui ont un mot de passe.
// =====================================================================
(function () {
  var OEIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var OEIL_BARRE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2"/><path d="M6.6 6.6A16.8 16.8 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  function equiper(champ) {
    if (champ.dataset.oeil) return;
    champ.dataset.oeil = '1';
    var cadre = document.createElement('div');
    cadre.className = 'champ-mdp';
    champ.parentNode.insertBefore(cadre, champ);
    cadre.appendChild(champ);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'oeil';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', 'Afficher le mot de passe');
    b.title = 'Afficher le mot de passe';
    b.innerHTML = OEIL;
    cadre.appendChild(b);

    function poser(visible) {
      champ.type = visible ? 'text' : 'password';
      b.setAttribute('aria-pressed', visible ? 'true' : 'false');
      var texte = visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
      b.setAttribute('aria-label', texte);
      b.title = texte;
      b.innerHTML = visible ? OEIL_BARRE : OEIL;
    }
    b.addEventListener('click', function () {
      poser(champ.type === 'password');
      champ.focus({ preventScroll: true });
    });
    // À l'envoi, le mot de passe redevient masqué : l'écran peut être projeté.
    if (champ.form) champ.form.addEventListener('submit', function () { poser(false); });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('input[type="password"]'), equiper);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
