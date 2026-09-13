/* =============================================
   TECHNOLOGIE LFT : Quiz Engine
   Moteur de quiz interactif réutilisable
   ============================================= */

class QuizEngine {
  constructor(containerId, questions, options = {}) {
    this.container = document.getElementById(containerId);
    this.questions = questions;
    this.currentIndex = 0;
    this.score = 0;
    this.answered = new Array(questions.length).fill(false);
    this.userAnswers = new Array(questions.length).fill(null);
    this.showFeedback = options.showFeedback !== false;
    this.shuffleOptions = options.shuffleOptions || false;
    this.levelColor = options.levelColor || 'var(--primary)';

    if (this.shuffleOptions) {
      this.questions.forEach(q => {
        if (q.type === 'qcm') {
          const correct = q.options[q.correct];
          const shuffled = [...q.options].sort(() => Math.random() - 0.5);
          q.correct = shuffled.indexOf(correct);
          q.options = shuffled;
        }
      });
    }

    // Les boutons du quiz appellent « quiz.… » : le moteur pose lui-même la
    // globale, une page qui oublie « const quiz = » n'est plus inerte.
    window.quiz = this;
    // Le quiz du catalogue s'identifie par la page : /5eme/p1/seq1-quiz.html
    // -> 5eme/p1/seq1. Ailleurs (page de test, quiz hors catalogue), rien
    // n'est jamais envoyé.
    const m = location.pathname.match(/\/([345]eme\/p\d\/seq\d{1,2})-quiz\.html$/);
    this.quizId = m ? m[1] : null;

    this.render();
    this.renderPapier();
  }

  /** Le rôle de la session ouverte (temoin non-HttpOnly), ou null. */
  temoin() {
    if (window.lireTemoin) return window.lireTemoin();
    try {
      const m = document.cookie.match(/(?:^|;\s*)lft_ouvert=(prof|eleve)\.(\d+)(?:;|$)/);
      return m && Number(m[2]) * 1000 > Date.now() ? m[1] : null;
    } catch (e) { return null; }
  }

  /** L'élève est connecté et sur un quiz du catalogue : son score sera gardé. */
  scoreGarde() {
    return Boolean(this.quizId) && this.temoin() === 'eleve';
  }

  /* Version papier : le quiz interactif n'affiche qu'une question a la fois.
     Imprime tel quel, il ne donnait qu'une question sur douze, avec une barre
     de progression et un score sans objet sur du papier. On genere ici la liste
     complete des questions, visible uniquement a l'impression. Les reponses ne
     figurent pas : la feuille se distribue aux eleves. */
  renderPapier() {
    if (!this.container || document.querySelector('.quiz-papier')) return;
    const lettres = ['A', 'B', 'C', 'D', 'E', 'F'];
    const esc = s => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let h = '<ol class="quiz-papier-liste">';
    this.questions.forEach(q => {
      h += '<li class="quiz-papier-q"><p class="quiz-papier-enonce">' + esc(q.question) + '</p>';
      if (q.type === 'vrai_faux') {
        h += '<ul class="quiz-papier-opts"><li>Vrai</li><li>Faux</li></ul>';
      } else if (Array.isArray(q.options)) {
        h += '<ul class="quiz-papier-opts">'
           + q.options.map((o, i) => '<li><span class="qp-lettre">' + (lettres[i] || '?')
                                     + '</span> ' + esc(o) + '</li>').join('')
           + '</ul>';
      }
      h += '</li>';
    });
    h += '</ol>';
    const d = document.createElement('div');
    d.className = 'quiz-papier';
    d.innerHTML = '<p class="quiz-papier-consigne">Coche une seule réponse par question.</p>' + h;
    this.container.insertAdjacentElement('afterend', d);
  }

  render() {
    const q = this.questions[this.currentIndex];
    const total = this.questions.length;
    const progress = ((this.currentIndex + 1) / total) * 100;
    const answeredCount = this.answered.filter(Boolean).length;

    let html = '';
    if (this.currentIndex === 0 && this.scoreGarde()) {
      html += `<p class="quiz-avis">Tu es connecté : ton meilleur score sera gardé dans ton classeur
        et ton professeur pourra le voir. Tes réponses, elles, ne sont pas enregistrées.</p>`;
    }
    html += `
      <div class="quiz-header">
        <div class="quiz-progress">
          <div>Question ${this.currentIndex + 1} / ${total}</div>
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width: ${progress}%"></div>
          </div>
        </div>
        <div class="quiz-score">Score : ${this.score} / ${answeredCount}</div>
      </div>
    `;

    html += `<div class="quiz-question">`;
    html += `<div class="quiz-question-number">Question ${this.currentIndex + 1}</div>`;
    html += `<h3 tabindex="-1" id="quiz-question-titre">${q.question}</h3>`;

    if (q.type === 'qcm') {
      html += this.renderQCM(q);
    } else if (q.type === 'vrai_faux') {
      html += this.renderVraiFaux(q);
    }

    // Feedback area
    html += `<div class="quiz-feedback" id="quiz-feedback"></div>`;
    html += `</div>`;

    // Navigation
    html += `<div class="quiz-actions">`;
    if (this.currentIndex > 0) {
      html += `<button class="btn btn-ghost" onclick="quiz.prev()">&larr; Précédent</button>`;
    }
    if (!this.answered[this.currentIndex]) {
      html += `<button class="btn btn-primary" id="btn-validate" onclick="quiz.validate()">Valider</button>`;
    }
    if (this.currentIndex < total - 1) {
      html += `<button class="btn btn-primary" onclick="quiz.next()">Suivant &rarr;</button>`;
    } else if (this.answered.every(Boolean)) {
      html += `<button class="btn btn-primary" onclick="quiz.showResults()">Voir les résultats</button>`;
    }
    html += `</div>`;

    this.container.innerHTML = html;

    // Restore selection if already answered
    if (this.answered[this.currentIndex] && this.userAnswers[this.currentIndex] !== null) {
      this.showAnswerState(this.userAnswers[this.currentIndex], q);
    }
  }

  renderQCM(q) {
    const letters = ['A', 'B', 'C', 'D', 'E'];
    let html = `<div class="quiz-options">`;
    q.options.forEach((opt, i) => {
      const selected = this.userAnswers[this.currentIndex] === i;
      html += `
        <div class="quiz-option ${selected ? 'selected' : ''}" data-index="${i}" onclick="quiz.selectOption(${i})">
          <div class="quiz-option-indicator">${letters[i]}</div>
          <div>${opt}</div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  }

  renderVraiFaux(q) {
    let html = `<div class="quiz-options">`;
    ['Vrai', 'Faux'].forEach((opt, i) => {
      const val = i === 0;
      const selected = this.userAnswers[this.currentIndex] === val;
      html += `
        <div class="quiz-option ${selected ? 'selected' : ''}" data-value="${val}" onclick="quiz.selectOption(${val})">
          <div class="quiz-option-indicator">${opt[0]}</div>
          <div>${opt}</div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  }

  selectOption(value) {
    if (this.answered[this.currentIndex]) return;

    this.userAnswers[this.currentIndex] = value;

    // Update visual selection
    const options = this.container.querySelectorAll('.quiz-option');
    options.forEach(opt => opt.classList.remove('selected'));

    const q = this.questions[this.currentIndex];
    if (q.type === 'qcm') {
      options[value].classList.add('selected');
    } else {
      const target = value === true ? 0 : 1;
      options[target].classList.add('selected');
    }
  }

  validate() {
    const q = this.questions[this.currentIndex];
    const answer = this.userAnswers[this.currentIndex];

    if (answer === null) return;

    this.answered[this.currentIndex] = true;
    let isCorrect = false;

    if (q.type === 'qcm') {
      isCorrect = answer === q.correct;
    } else if (q.type === 'vrai_faux') {
      isCorrect = answer === q.correct;
    }

    if (isCorrect) this.score++;

    this.showAnswerState(answer, q);

    // Disable validate button
    const btn = document.getElementById('btn-validate');
    if (btn) btn.style.display = 'none';
  }

  showAnswerState(answer, q) {
    const options = this.container.querySelectorAll('.quiz-option');
    const feedback = document.getElementById('quiz-feedback');

    let isCorrect;
    if (q.type === 'qcm') {
      isCorrect = answer === q.correct;
      options.forEach((opt, i) => {
        opt.classList.remove('selected');
        if (i === q.correct) opt.classList.add('correct');
        if (i === answer && !isCorrect) opt.classList.add('incorrect');
      });
    } else {
      isCorrect = answer === q.correct;
      const correctIdx = q.correct === true ? 0 : 1;
      const answerIdx = answer === true ? 0 : 1;
      options.forEach((opt, i) => {
        opt.classList.remove('selected');
        if (i === correctIdx) opt.classList.add('correct');
        if (i === answerIdx && !isCorrect) opt.classList.add('incorrect');
      });
    }

    // Show feedback
    if (this.showFeedback && feedback && q.explanation) {
      feedback.className = `quiz-feedback show ${isCorrect ? 'correct' : 'incorrect'}`;
      feedback.innerHTML = `
        <strong>${isCorrect ? '&#x2705; Correct\u00a0!' : '&#x274C; Incorrect'}</strong><br>
        ${q.explanation}
      `;
    }

    // Disable clicking
    options.forEach(opt => {
      opt.style.cursor = 'default';
      opt.onclick = null;
    });
  }

  next() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.render();
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
    }
  }

  showResults() {
    const total = this.questions.length;
    const pct = Math.round((this.score / total) * 100);
    let category, message;

    // Un message court, sans le vocabulaire du livret scolaire : le quiz est
    // un entraînement, le positionnement par compétence appartient au
    // professeur (décisions D14 et D15, questions 4 et 9).
    if (pct >= 80) {
      category = 'excellent';
      message = 'Excellent travail ! Tu maîtrises bien les notions de cette séquence.';
    } else if (pct >= 60) {
      category = 'good';
      message = 'Bien ! Quelques points sont encore à revoir.';
    } else if (pct >= 40) {
      category = 'average';
      message = 'Des efforts à fournir. Relis la synthèse de la fiche et réessaie !';
    } else {
      category = 'low';
      message = 'Il faut retravailler cette séquence. Relis bien le cours et la fiche de révision.';
    }

    let html = `
      <div class="quiz-results" tabindex="-1">
        <h3 class="visually-hidden">Résultats du quiz</h3>
        <div class="quiz-results-score ${category}"><span class="visually-hidden">Ton score : </span>${this.score} / ${total}</div>
        <div class="quiz-results-message">${message}
          <br><span class="text-sm">Tu peux recommencer autant de fois que tu veux : seul ton meilleur score compte.</span></div>
        <p class="quiz-meilleur" id="quiz-meilleur" role="status" aria-live="polite"></p>
        <div style="display: flex; gap: var(--space-sm); justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="quiz.restart()"><span class="ico">&#x1F501;</span> Recommencer</button>
          <button class="btn btn-outline" onclick="quiz.showReview()"><span class="ico">&#x1F4CB;</span> Revoir les réponses</button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    if (window.remplacerPictos) window.remplacerPictos(this.container);
    const bloc = this.container.querySelector('.quiz-results');
    if (bloc) bloc.focus();
    this.enregistrer(total);
  }

  /**
   * MEILLEUR SCORE, SI L'ELEVE A OUVERT SA SESSION (decision D15, question 10).
   * Rien n'est envoye sans le temoin de session eleve : le quiz public reste
   * anonyme. On envoie le score et le nombre de questions, jamais les
   * reponses. Un essai n'est envoye qu'une fois, meme si l'eleve revient aux
   * resultats depuis le recapitulatif. Le quiz du catalogue s'identifie par
   * la page : /5eme/p1/seq1-quiz.html -> 5eme/p1/seq1.
   */
  enregistrer(total) {
    if (!document.getElementById('quiz-meilleur')) return;
    if (this.envoye) {
      const z = document.getElementById('quiz-meilleur');
      if (z) z.textContent = this.meilleurTexte || '';
      return;
    }
    if (!this.scoreGarde()) return;
    this.envoye = true;
    const self = this;
    fetch('/api/classeur/score', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quiz: this.quizId, score: this.score, total: total }),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        // La zone est relue au moment de la réponse : l'élève a pu changer
        // d'écran pendant la requête.
        const z = document.getElementById('quiz-meilleur');
        if (!d || !d.ok) {
          self.meilleurTexte = 'Ton score n\u2019a pas pu être enregistré cette fois. Le quiz, lui, est bien fait.';
        } else {
          const qui = d.prenom ? ' dans le classeur de ' + d.prenom : ' dans ton classeur';
          self.meilleurTexte = (d.record
            ? 'Meilleur score enregistré' + qui + '\u00a0: ' + d.meilleur + ' / ' + d.total + '.'
            : 'Ton meilleur score' + qui + ' reste ' + d.meilleur + ' / ' + d.total + '.')
            + (d.prenom ? ' Ce n\u2019est pas toi\u00a0? Ferme la session en haut de la page.' : '');
        }
        if (z) z.textContent = self.meilleurTexte;
      })
      .catch(function () {
        const z = document.getElementById('quiz-meilleur');
        self.meilleurTexte = 'Ton score n\u2019a pas pu être enregistré cette fois. Le quiz, lui, est bien fait.';
        if (z) z.textContent = self.meilleurTexte;
      });
  }

  restart() {
    this.currentIndex = 0;
    this.score = 0;
    this.envoye = false;
    this.meilleurTexte = null;
    this.answered = new Array(this.questions.length).fill(false);
    this.userAnswers = new Array(this.questions.length).fill(null);
    this.render();
    const h = document.getElementById('quiz-question-titre');
    if (h) h.focus();
  }

  showReview() {
    let html = '<h3 style="margin-bottom: var(--space-lg);">Récapitulatif des réponses</h3>';

    this.questions.forEach((q, i) => {
      const answer = this.userAnswers[i];
      let isCorrect;
      let userAnswer, correctAnswer;

      if (q.type === 'qcm') {
        isCorrect = answer === q.correct;
        userAnswer = q.options[answer];
        correctAnswer = q.options[q.correct];
      } else {
        isCorrect = answer === q.correct;
        userAnswer = answer ? 'Vrai' : 'Faux';
        correctAnswer = q.correct ? 'Vrai' : 'Faux';
      }

      html += `
        <div style="padding: var(--space-md); margin-bottom: var(--space-sm); border-radius: var(--radius-sm);
          background: ${isCorrect ? 'var(--success-light)' : 'var(--error-light)'}; border-left: 3px solid ${isCorrect ? 'var(--success)' : 'var(--error)'};">
          <strong>Q${i + 1}. ${q.question}</strong><br>
          <span style="color: ${isCorrect ? 'var(--success)' : 'var(--error)'}">
            Ta réponse : ${userAnswer} ${isCorrect ? '&#x2705;' : '&#x274C;'}
          </span>
          ${!isCorrect ? `<br><span style="color: var(--success)">Bonne réponse : ${correctAnswer}</span>` : ''}
          ${q.explanation ? `<br><span class="text-sm text-muted">${q.explanation}</span>` : ''}
        </div>
      `;
    });

    html += `
      <div style="margin-top: var(--space-lg); display: flex; gap: var(--space-sm);">
        <button class="btn btn-primary" onclick="quiz.restart()"><span class="ico">&#x1F501;</span> Recommencer</button>
        <button class="btn btn-ghost" onclick="quiz.showResults()">&#x2190; Retour aux résultats</button>
      </div>
    `;

    this.container.innerHTML = html;
    if (window.remplacerPictos) window.remplacerPictos(this.container);
  }
}

// Export for global access
window.QuizEngine = QuizEngine;
