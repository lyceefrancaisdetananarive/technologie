/* =============================================
   TECHNOLOGIE LFT — Quiz Engine
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

    this.render();
  }

  render() {
    const q = this.questions[this.currentIndex];
    const total = this.questions.length;
    const progress = ((this.currentIndex + 1) / total) * 100;
    const answeredCount = this.answered.filter(Boolean).length;

    let html = `
      <div class="quiz-header">
        <div class="quiz-progress">
          <div>Question ${this.currentIndex + 1} / ${total}</div>
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width: ${progress}%"></div>
          </div>
        </div>
        <div class="quiz-score">Score : ${this.score} / ${answeredCount}</div>
      </div>
    `;

    html += `<div class="quiz-question">`;
    html += `<div class="quiz-question-number">Question ${this.currentIndex + 1}</div>`;
    html += `<h3>${q.question}</h3>`;

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
        <strong>${isCorrect ? '&#x2705; Correct !' : '&#x274C; Incorrect'}</strong><br>
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

    if (pct >= 80) {
      category = 'excellent';
      message = 'Excellent travail ! Tu maîtrises bien les notions de cette séquence.';
    } else if (pct >= 60) {
      category = 'good';
      message = 'Bien ! Quelques points sont encore à revoir.';
    } else if (pct >= 40) {
      category = 'average';
      message = 'Des efforts à fournir. Relis la synthèse et réessaie !';
    } else {
      category = 'low';
      message = 'Il faut retravailler cette séquence. Relis bien le cours et la fiche de révision.';
    }

    // Mastery level
    let mastery;
    if (pct >= 80) mastery = '<span class="mastery-tres-bonne">Très bonne maîtrise</span>';
    else if (pct >= 60) mastery = '<span class="mastery-satisfaisant">Maîtrise satisfaisante</span>';
    else if (pct >= 40) mastery = '<span class="mastery-fragile">Maîtrise fragile</span>';
    else mastery = '<span class="mastery-insuffisant">Maîtrise insuffisante</span>';

    let html = `
      <div class="quiz-results">
        <div class="quiz-results-score ${category}">${this.score} / ${total}</div>
        <div style="margin-bottom: var(--space-md);">${mastery}</div>
        <div class="quiz-results-message">${message}</div>
        <div style="display: flex; gap: var(--space-sm); justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="quiz.restart()">&#x1F504; Recommencer</button>
          <button class="btn btn-outline" onclick="quiz.showReview()">&#x1F4CB; Revoir les réponses</button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }

  restart() {
    this.currentIndex = 0;
    this.score = 0;
    this.answered = new Array(this.questions.length).fill(false);
    this.userAnswers = new Array(this.questions.length).fill(null);
    this.render();
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
        <button class="btn btn-primary" onclick="quiz.restart()">&#x1F504; Recommencer</button>
        <button class="btn btn-ghost" onclick="quiz.showResults()">&#x2190; Retour aux résultats</button>
      </div>
    `;

    this.container.innerHTML = html;
  }
}

// Export for global access
window.QuizEngine = QuizEngine;
