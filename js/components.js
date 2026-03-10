/* =============================================
   TECHNOLOGIE LFT — Shared Components
   Injects header, nav, footer, breadcrumb
   ============================================= */

(function () {
  'use strict';

  // Determine base path relative to current page
  const scripts = document.getElementsByTagName('script');
  const currentScript = scripts[scripts.length - 1];
  const scriptSrc = currentScript.getAttribute('src') || '';
  const depth = (scriptSrc.match(/\.\.\//g) || []).length;
  const BASE = depth === 0 ? '.' : Array(depth).fill('..').join('/');

  const ROOT = BASE;

  // Site data for search
  const SITE_DATA = [
    { title: 'Accueil', url: `${ROOT}/index.html`, level: '', tags: 'accueil home' },
    { title: '5\u00e8me — Progression', url: `${ROOT}/5eme/index.html`, level: '5eme', tags: 'cinqui\u00e8me progression' },
    { title: '4\u00e8me — Progression', url: `${ROOT}/4eme/index.html`, level: '4eme', tags: 'quatri\u00e8me progression' },
    { title: '3\u00e8me — Progression', url: `${ROOT}/3eme/index.html`, level: '3eme', tags: 'troisi\u00e8me progression dnb brevet' },
    { title: 'Espace Enseignant', url: `${ROOT}/enseignant/index.html`, level: '', tags: 'prof professeur enseignant' },
    { title: 'Outils', url: `${ROOT}/outils/index.html`, level: '', tags: 'quiz r\u00e9vision outils' },
    { title: 'Fiches de structuration', url: `${ROOT}/structuration/index.html`, level: '', tags: 'structuration cours résumé connaissances' },
    // Structuration pages
    { title: 'Structuration S1 — Objets techniques (5ème)', url: `${ROOT}/5eme/t1/seq1-structuration.html`, level: '5eme', tags: 'structuration cours résumé objet technique besoin' },
    { title: 'Structuration S2 — Évolution (5ème)', url: `${ROOT}/5eme/t1/seq2-structuration.html`, level: '5eme', tags: 'structuration cours résumé évolution innovation' },
    { title: 'Structuration S3 — Cycle de vie (5ème)', url: `${ROOT}/5eme/t1/seq3-structuration.html`, level: '5eme', tags: 'structuration cours résumé cycle vie environnement' },
    { title: 'Structuration S4 — Structure interne (5ème)', url: `${ROOT}/5eme/t2/seq4-structuration.html`, level: '5eme', tags: 'structuration cours résumé matériaux chaîne énergie' },
    { title: 'Structuration S5 — Transmission (5ème)', url: `${ROOT}/5eme/t2/seq5-structuration.html`, level: '5eme', tags: 'structuration cours résumé engrenage transmission mouvement' },
    { title: 'Structuration S6 — Programmation (5ème)', url: `${ROOT}/5eme/t2/seq6-structuration.html`, level: '5eme', tags: 'structuration cours résumé programmation algorithme micro:bit' },
    { title: 'Structuration S7 — Modélisation 3D (5ème)', url: `${ROOT}/5eme/t3/seq7-structuration.html`, level: '5eme', tags: 'structuration cours résumé modélisation 3D CAO STL' },
    { title: 'Structuration S8 — Projet de groupe (5ème)', url: `${ROOT}/5eme/t3/seq8-structuration.html`, level: '5eme', tags: 'structuration cours résumé projet prototype Gantt' },
    { title: 'Structuration S9 — IA et IoT (5ème)', url: `${ROOT}/5eme/t3/seq9-structuration.html`, level: '5eme', tags: 'structuration cours résumé IA IoT RGPD' },
    { title: 'Structuration S1 — Innovation (4ème)', url: `${ROOT}/4eme/t1/seq1-structuration.html`, level: '4eme', tags: 'structuration cours résumé innovation brevet' },
    { title: 'Structuration S2 — IA (4ème)', url: `${ROOT}/4eme/t1/seq2-structuration.html`, level: '4eme', tags: 'structuration cours résumé IA machine learning biais' },
    { title: 'Structuration S3 — IoT (4ème)', url: `${ROOT}/4eme/t1/seq3-structuration.html`, level: '4eme', tags: 'structuration cours résumé IoT cybersécurité RGPD' },
    { title: 'Structuration S4 — Énergie (4ème)', url: `${ROOT}/4eme/t2/seq4-structuration.html`, level: '4eme', tags: 'structuration cours résumé énergie rendement conversion' },
    { title: 'Structuration S5 — Arduino (4ème)', url: `${ROOT}/4eme/t2/seq5-structuration.html`, level: '4eme', tags: 'structuration cours résumé Arduino mBlock capteur' },
    { title: 'Structuration S6 — Réparabilité (4ème)', url: `${ROOT}/4eme/t2/seq6-structuration.html`, level: '4eme', tags: 'structuration cours résumé réparabilité diagnostic obsolescence' },
    { title: 'Structuration S7 — Projet collaboratif (4ème)', url: `${ROOT}/4eme/t3/seq7-structuration.html`, level: '4eme', tags: 'structuration cours résumé projet CdC Gantt' },
    { title: 'Structuration S8 — IA automatisée (4ème)', url: `${ROOT}/4eme/t3/seq8-structuration.html`, level: '4eme', tags: 'structuration cours résumé IA automatisé Teachable Machine' },
    { title: 'Structuration S9 — FabLab (4ème)', url: `${ROOT}/4eme/t3/seq9-structuration.html`, level: '4eme', tags: 'structuration cours résumé FabLab fabrication additive CNC' },
    { title: 'Structuration S1 — Objet connecté (3ème)', url: `${ROOT}/3eme/t1/seq1-structuration.html`, level: '3eme', tags: 'structuration cours résumé analyse fonctionnelle pieuvre' },
    { title: 'Structuration S2 — IA embarquée (3ème)', url: `${ROOT}/3eme/t1/seq2-structuration.html`, level: '3eme', tags: 'structuration cours résumé IA embarquée SLAM PDA' },
    { title: 'Structuration S3 — Éthique (3ème)', url: `${ROOT}/3eme/t1/seq3-structuration.html`, level: '3eme', tags: 'structuration cours résumé éthique empreinte carbone fracture' },
    { title: 'Structuration S4 — Automatisés (3ème)', url: `${ROOT}/3eme/t2/seq4-structuration.html`, level: '3eme', tags: 'structuration cours résumé organigramme décomposition pseudo-code' },
    { title: 'Structuration S5 — Prog. avancée (3ème)', url: `${ROOT}/3eme/t2/seq5-structuration.html`, level: '3eme', tags: 'structuration cours résumé variables opérateurs logiques table vérité' },
    { title: 'Structuration S6 — Tests (3ème)', url: `${ROOT}/3eme/t2/seq6-structuration.html`, level: '3eme', tags: 'structuration cours résumé tests débogage protocole erreurs' },
    { title: 'Structuration S7 — Smart Object (3ème)', url: `${ROOT}/3eme/t3/seq7-structuration.html`, level: '3eme', tags: 'structuration cours résumé smart object câblage ESP32' },
    { title: 'Structuration S8 — Fabrication (3ème)', url: `${ROOT}/3eme/t3/seq8-structuration.html`, level: '3eme', tags: 'structuration cours résumé fabrication Tinkercad G-code impression 3D' },
    { title: 'Structuration S9 — Soutenance (3ème)', url: `${ROOT}/3eme/t3/seq9-structuration.html`, level: '3eme', tags: 'structuration cours résumé soutenance diaporama capsule vidéo' },
    // 5ème T1 sequences
    { title: 'S\u00e9q. 1 — D\u00e9couverte des objets techniques', url: `${ROOT}/5eme/t1/seq1-activite.html`, level: '5eme', tags: 'objet technique besoin s\u00e9quence 1 activit\u00e9' },
    { title: 'S\u00e9q. 1 — Fiche professeur', url: `${ROOT}/5eme/t1/seq1-prof.html`, level: '5eme', tags: 'corrig\u00e9 professeur s\u00e9quence 1' },
    { title: 'S\u00e9q. 1 — Quiz', url: `${ROOT}/5eme/t1/seq1-quiz.html`, level: '5eme', tags: 'quiz qcm s\u00e9quence 1 entra\u00eenement' },
    { title: 'Séq. 1 — Évaluation', url: `${ROOT}/5eme/t1/seq1-eval.html`, level: '5eme', tags: 'évaluation contrôle séquence 1' },
    { title: 'Séq. 1 — EBEP', url: `${ROOT}/5eme/t1/seq1-ebep.html`, level: '5eme', tags: 'ebep adapté dys tdah séquence 1' },
    { title: 'Séq. 2 — Évolution des objets techniques', url: `${ROOT}/5eme/t1/seq2-activite.html`, level: '5eme', tags: 'évolution téléphone vélo innovation séquence 2 activité' },
    { title: 'Séq. 2 — Fiche professeur', url: `${ROOT}/5eme/t1/seq2-prof.html`, level: '5eme', tags: 'corrigé professeur séquence 2' },
    { title: 'Séq. 2 — Quiz', url: `${ROOT}/5eme/t1/seq2-quiz.html`, level: '5eme', tags: 'quiz qcm séquence 2 entraînement' },
    { title: 'Séq. 3 — Cycle de vie & impact environnemental', url: `${ROOT}/5eme/t1/seq3-activite.html`, level: '5eme', tags: 'cycle vie environnement développement durable séquence 3 activité' },
    { title: 'Séq. 3 — Fiche professeur', url: `${ROOT}/5eme/t1/seq3-prof.html`, level: '5eme', tags: 'corrigé professeur séquence 3' },
    { title: 'Séq. 3 — Quiz', url: `${ROOT}/5eme/t1/seq3-quiz.html`, level: '5eme', tags: 'quiz qcm séquence 3 entraînement' },
    { title: 'Fiche de révision T1', url: `${ROOT}/5eme/t1/revision.html`, level: '5eme', tags: 'révision trimestre 1 vocabulaire méthode' },
    // 5ème T2 sequences
    { title: 'Séq. 4 — Structure interne', url: `${ROOT}/5eme/t2/seq4-activite.html`, level: '5eme', tags: 'composants matériaux chaîne énergie séquence 4 activité' },
    { title: 'Séq. 4 — Fiche professeur', url: `${ROOT}/5eme/t2/seq4-prof.html`, level: '5eme', tags: 'corrigé professeur séquence 4' },
    { title: 'Séq. 4 — Quiz', url: `${ROOT}/5eme/t2/seq4-quiz.html`, level: '5eme', tags: 'quiz qcm séquence 4 entraînement' },
    { title: 'Séq. 5 — Transmission de mouvement', url: `${ROOT}/5eme/t2/seq5-activite.html`, level: '5eme', tags: 'engrenage transmission transformation mouvement séquence 5 activité' },
    { title: 'Séq. 5 — Fiche professeur', url: `${ROOT}/5eme/t2/seq5-prof.html`, level: '5eme', tags: 'corrigé professeur séquence 5' },
    { title: 'Séq. 5 — Quiz', url: `${ROOT}/5eme/t2/seq5-quiz.html`, level: '5eme', tags: 'quiz qcm séquence 5 entraînement' },
    { title: 'Séq. 6 — Programmation', url: `${ROOT}/5eme/t2/seq6-activite.html`, level: '5eme', tags: 'programmation mblock micro:bit blocs séquence 6 activité' },
    { title: 'Séq. 6 — Fiche professeur', url: `${ROOT}/5eme/t2/seq6-prof.html`, level: '5eme', tags: 'corrigé professeur séquence 6' },
    { title: 'Séq. 6 — Quiz', url: `${ROOT}/5eme/t2/seq6-quiz.html`, level: '5eme', tags: 'quiz qcm séquence 6 entraînement programmation' },
    { title: 'Fiche de révision T2', url: `${ROOT}/5eme/t2/revision.html`, level: '5eme', tags: 'révision trimestre 2 matériaux mécanismes programmation' },
    { title: 'Évaluation T2', url: `${ROOT}/5eme/t2/eval-t2.html`, level: '5eme', tags: 'évaluation contrôle trimestre 2' },
    // 5ème T3 sequences
    { title: 'Séq. 7 — Modélisation 3D', url: `${ROOT}/5eme/t3/seq7-activite.html`, level: '5eme', tags: 'tinkercad modélisation 3D cahier charges séquence 7 activité' },
    { title: 'Séq. 7 — Fiche professeur', url: `${ROOT}/5eme/t3/seq7-prof.html`, level: '5eme', tags: 'corrigé professeur séquence 7' },
    { title: 'Séq. 7 — Quiz', url: `${ROOT}/5eme/t3/seq7-quiz.html`, level: '5eme', tags: 'quiz qcm séquence 7 entraînement' },
    { title: 'Séq. 8 — Projet de groupe', url: `${ROOT}/5eme/t3/seq8-activite.html`, level: '5eme', tags: 'projet groupe prototype impression 3D FabLab séquence 8' },
    { title: 'Séq. 8 — Fiche professeur', url: `${ROOT}/5eme/t3/seq8-prof.html`, level: '5eme', tags: 'corrigé professeur séquence 8 projet' },
    { title: 'Séq. 9 — IA et objets connectés', url: `${ROOT}/5eme/t3/seq9-activite.html`, level: '5eme', tags: 'intelligence artificielle IoT réparabilité séquence 9 activité' },
    { title: 'Séq. 9 — Fiche professeur', url: `${ROOT}/5eme/t3/seq9-prof.html`, level: '5eme', tags: 'corrigé professeur séquence 9' },
    { title: 'Séq. 9 — Quiz', url: `${ROOT}/5eme/t3/seq9-quiz.html`, level: '5eme', tags: 'quiz qcm séquence 9 IA IoT réparabilité' },
    { title: 'Fiche de révision T3', url: `${ROOT}/5eme/t3/revision.html`, level: '5eme', tags: 'révision trimestre 3 conception IA réparabilité' },
    // 4ème T1 sequences
    { title: 'Séq. 1 — Innovations technologiques et évolution', url: `${ROOT}/4eme/t1/seq1-activite.html`, level: '4eme', tags: 'innovation évolution vélo cycle vie séquence 1 activité' },
    { title: 'Séq. 1 — Fiche professeur (4ème)', url: `${ROOT}/4eme/t1/seq1-prof.html`, level: '4eme', tags: 'corrigé professeur séquence 1 innovation' },
    { title: 'Séq. 1 — Quiz (4ème)', url: `${ROOT}/4eme/t1/seq1-quiz.html`, level: '4eme', tags: 'quiz qcm séquence 1 innovation cycle vie' },
    { title: 'Séq. 2 — Intelligence Artificielle et automatisation', url: `${ROOT}/4eme/t1/seq2-activite.html`, level: '4eme', tags: 'IA intelligence artificielle automatisation machine learning séquence 2 activité' },
    { title: 'Séq. 2 — Fiche professeur (4ème)', url: `${ROOT}/4eme/t1/seq2-prof.html`, level: '4eme', tags: 'corrigé professeur séquence 2 IA' },
    { title: 'Séq. 2 — Quiz (4ème)', url: `${ROOT}/4eme/t1/seq2-quiz.html`, level: '4eme', tags: 'quiz qcm séquence 2 IA automatisation' },
    { title: 'Séq. 3 — Objets connectés', url: `${ROOT}/4eme/t1/seq3-activite.html`, level: '4eme', tags: 'objets connectés IoT impact environnemental séquence 3 activité' },
    { title: 'Séq. 3 — Fiche professeur (4ème)', url: `${ROOT}/4eme/t1/seq3-prof.html`, level: '4eme', tags: 'corrigé professeur séquence 3 IoT' },
    { title: 'Séq. 3 — Quiz (4ème)', url: `${ROOT}/4eme/t1/seq3-quiz.html`, level: '4eme', tags: 'quiz qcm séquence 3 IoT objets connectés' },
    { title: 'Fiche de révision T1 (4ème)', url: `${ROOT}/4eme/t1/revision.html`, level: '4eme', tags: 'révision trimestre 1 innovation IA IoT' },
    { title: 'Évaluation T1 (4ème)', url: `${ROOT}/4eme/t1/eval-t1.html`, level: '4eme', tags: 'évaluation contrôle trimestre 1' },
    // 4ème T2 sequences
    { title: 'Séq. 4 — Systèmes d\'énergie et conversions', url: `${ROOT}/4eme/t2/seq4-activite.html`, level: '4eme', tags: 'énergie conversion chaîne rendement séquence 4 activité' },
    { title: 'Séq. 4 — Fiche professeur (4ème)', url: `${ROOT}/4eme/t2/seq4-prof.html`, level: '4eme', tags: 'corrigé professeur séquence 4 énergie' },
    { title: 'Séq. 4 — Quiz (4ème)', url: `${ROOT}/4eme/t2/seq4-quiz.html`, level: '4eme', tags: 'quiz qcm séquence 4 énergie rendement' },
    { title: 'Séq. 5 — Programmation Arduino / mBlock', url: `${ROOT}/4eme/t2/seq5-activite.html`, level: '4eme', tags: 'programmation Arduino mBlock mBot capteur actionneur séquence 5 activité' },
    { title: 'Séq. 5 — Fiche professeur (4ème)', url: `${ROOT}/4eme/t2/seq5-prof.html`, level: '4eme', tags: 'corrigé professeur séquence 5 programmation' },
    { title: 'Séq. 5 — Quiz (4ème)', url: `${ROOT}/4eme/t2/seq5-quiz.html`, level: '4eme', tags: 'quiz qcm séquence 5 programmation capteur' },
    { title: 'Séq. 6 — Réparabilité et diagnostic', url: `${ROOT}/4eme/t2/seq6-activite.html`, level: '4eme', tags: 'réparabilité diagnostic obsolescence séquence 6 activité' },
    { title: 'Séq. 6 — Fiche professeur (4ème)', url: `${ROOT}/4eme/t2/seq6-prof.html`, level: '4eme', tags: 'corrigé professeur séquence 6 diagnostic' },
    { title: 'Séq. 6 — Quiz (4ème)', url: `${ROOT}/4eme/t2/seq6-quiz.html`, level: '4eme', tags: 'quiz qcm séquence 6 réparabilité obsolescence' },
    { title: 'Fiche de révision T2 (4ème)', url: `${ROOT}/4eme/t2/revision.html`, level: '4eme', tags: 'révision trimestre 2 énergie programmation diagnostic' },
    { title: 'Évaluation T2 (4ème)', url: `${ROOT}/4eme/t2/eval-t2.html`, level: '4eme', tags: 'évaluation contrôle trimestre 2' },
    // 4ème T3 sequences
    { title: 'Séq. 7 — Projet collaboratif', url: `${ROOT}/4eme/t3/seq7-activite.html`, level: '4eme', tags: 'projet collaboratif système détection cahier charges séquence 7 activité' },
    { title: 'Séq. 7 — Fiche professeur (4ème)', url: `${ROOT}/4eme/t3/seq7-prof.html`, level: '4eme', tags: 'corrigé professeur séquence 7 projet' },
    { title: 'Séq. 8 — IA et systèmes automatisés', url: `${ROOT}/4eme/t3/seq8-activite.html`, level: '4eme', tags: 'IA systèmes automatisés Teachable Machine séquence 8 activité' },
    { title: 'Séq. 8 — Fiche professeur (4ème)', url: `${ROOT}/4eme/t3/seq8-prof.html`, level: '4eme', tags: 'corrigé professeur séquence 8 IA automatisé' },
    { title: 'Séq. 8 — Quiz (4ème)', url: `${ROOT}/4eme/t3/seq8-quiz.html`, level: '4eme', tags: 'quiz qcm séquence 8 IA Teachable Machine' },
    { title: 'Séq. 9 — Fabrication numérique (FabLab)', url: `${ROOT}/4eme/t3/seq9-activite.html`, level: '4eme', tags: 'FabLab fabrication numérique impression 3D CNC séquence 9 activité' },
    { title: 'Séq. 9 — Fiche professeur (4ème)', url: `${ROOT}/4eme/t3/seq9-prof.html`, level: '4eme', tags: 'corrigé professeur séquence 9 FabLab' },
    { title: 'Séq. 9 — Quiz (4ème)', url: `${ROOT}/4eme/t3/seq9-quiz.html`, level: '4eme', tags: 'quiz qcm séquence 9 FabLab impression 3D' },
    { title: 'Fiche de révision T3 (4ème)', url: `${ROOT}/4eme/t3/revision.html`, level: '4eme', tags: 'révision trimestre 3 projet IA FabLab' },
    // 3ème T1 sequences
    { title: 'Séq. 1 — Étude critique d\'un objet connecté (3ème)', url: `${ROOT}/3eme/t1/seq1-activite.html`, level: '3eme', tags: 'analyse fonctionnelle objet connecté IoT architecture séquence 1 activité' },
    { title: 'Séq. 1 — Fiche professeur (3ème)', url: `${ROOT}/3eme/t1/seq1-prof.html`, level: '3eme', tags: 'corrigé professeur séquence 1 objet connecté' },
    { title: 'Séq. 1 — Quiz (3ème)', url: `${ROOT}/3eme/t1/seq1-quiz.html`, level: '3eme', tags: 'quiz qcm séquence 1 objet connecté IoT' },
    { title: 'Séq. 2 — IA embarquée — Études de cas (3ème)', url: `${ROOT}/3eme/t1/seq2-activite.html`, level: '3eme', tags: 'IA embarquée voiture autonome robot aspirateur PDA SLAM séquence 2 activité' },
    { title: 'Séq. 2 — Fiche professeur (3ème)', url: `${ROOT}/3eme/t1/seq2-prof.html`, level: '3eme', tags: 'corrigé professeur séquence 2 IA embarquée' },
    { title: 'Séq. 2 — Quiz (3ème)', url: `${ROOT}/3eme/t1/seq2-quiz.html`, level: '3eme', tags: 'quiz qcm séquence 2 IA embarquée PDA SLAM' },
    { title: 'Séq. 3 — Éthique et impacts des technologies (3ème)', url: `${ROOT}/3eme/t1/seq3-activite.html`, level: '3eme', tags: 'éthique impacts développement durable RGPD débat séquence 3 activité' },
    { title: 'Séq. 3 — Fiche professeur (3ème)', url: `${ROOT}/3eme/t1/seq3-prof.html`, level: '3eme', tags: 'corrigé professeur séquence 3 éthique impacts' },
    { title: 'Séq. 3 — Quiz (3ème)', url: `${ROOT}/3eme/t1/seq3-quiz.html`, level: '3eme', tags: 'quiz qcm séquence 3 éthique RGPD CO2' },
    { title: 'Fiche de révision T1 (3ème)', url: `${ROOT}/3eme/t1/revision.html`, level: '3eme', tags: 'révision trimestre 1 IoT IA impacts PDA' },
    { title: 'Évaluation T1 (3ème)', url: `${ROOT}/3eme/t1/eval-t1.html`, level: '3eme', tags: 'évaluation contrôle trimestre 1' },
    // 3ème T2 sequences
    { title: 'Séq. 4 — Systèmes automatisés complexes (3ème)', url: `${ROOT}/3eme/t2/seq4-activite.html`, level: '3eme', tags: 'décomposition fonctionnelle organigramme serre barrière séquence 4 activité' },
    { title: 'Séq. 4 — Fiche professeur (3ème)', url: `${ROOT}/3eme/t2/seq4-prof.html`, level: '3eme', tags: 'corrigé professeur séquence 4 systèmes automatisés' },
    { title: 'Séq. 4 — Quiz (3ème)', url: `${ROOT}/3eme/t2/seq4-quiz.html`, level: '3eme', tags: 'quiz qcm séquence 4 organigramme décomposition' },
    { title: 'Séq. 5 — Programmation avancée (3ème)', url: `${ROOT}/3eme/t2/seq5-activite.html`, level: '3eme', tags: 'programmation variables opérateurs logiques ET OU NON Arduino séquence 5 activité' },
    { title: 'Séq. 5 — Fiche professeur (3ème)', url: `${ROOT}/3eme/t2/seq5-prof.html`, level: '3eme', tags: 'corrigé professeur séquence 5 programmation logique' },
    { title: 'Séq. 5 — Quiz (3ème)', url: `${ROOT}/3eme/t2/seq5-quiz.html`, level: '3eme', tags: 'quiz qcm séquence 5 variables opérateurs logiques' },
    { title: 'Séq. 6 — Tests et mise au point (3ème)', url: `${ROOT}/3eme/t2/seq6-activite.html`, level: '3eme', tags: 'tests débogage protocole erreurs syntaxe logique séquence 6 activité' },
    { title: 'Séq. 6 — Fiche professeur (3ème)', url: `${ROOT}/3eme/t2/seq6-prof.html`, level: '3eme', tags: 'corrigé professeur séquence 6 tests débogage' },
    { title: 'Séq. 6 — Quiz (3ème)', url: `${ROOT}/3eme/t2/seq6-quiz.html`, level: '3eme', tags: 'quiz qcm séquence 6 tests erreurs protocole' },
    { title: 'Fiche de révision T2 (3ème)', url: `${ROOT}/3eme/t2/revision.html`, level: '3eme', tags: 'révision trimestre 2 organigramme logique tests' },
    { title: 'Évaluation T2 (3ème)', url: `${ROOT}/3eme/t2/eval-t2.html`, level: '3eme', tags: 'évaluation contrôle trimestre 2' },
    // 3ème T3 sequences
    { title: 'Séq. 7 — Projet Smart Object (3ème)', url: `${ROOT}/3eme/t3/seq7-activite.html`, level: '3eme', tags: 'projet smart object cahier charges conception séquence 7 activité' },
    { title: 'Séq. 7 — Fiche professeur (3ème)', url: `${ROOT}/3eme/t3/seq7-prof.html`, level: '3eme', tags: 'corrigé professeur séquence 7 projet' },
    { title: 'Séq. 8 — Fabrication et prototypage (3ème)', url: `${ROOT}/3eme/t3/seq8-activite.html`, level: '3eme', tags: 'fabrication prototypage impression 3D Tinkercad FabLab séquence 8 activité' },
    { title: 'Séq. 8 — Fiche professeur (3ème)', url: `${ROOT}/3eme/t3/seq8-prof.html`, level: '3eme', tags: 'corrigé professeur séquence 8 fabrication' },
    { title: 'Séq. 8 — Quiz (3ème)', url: `${ROOT}/3eme/t3/seq8-quiz.html`, level: '3eme', tags: 'quiz qcm séquence 8 STL G-code impression 3D' },
    { title: 'Séq. 9 — Soutenance et présentation (3ème)', url: `${ROOT}/3eme/t3/seq9-activite.html`, level: '3eme', tags: 'soutenance oral présentation projet DNB séquence 9 activité' },
    { title: 'Séq. 9 — Fiche professeur (3ème)', url: `${ROOT}/3eme/t3/seq9-prof.html`, level: '3eme', tags: 'corrigé professeur séquence 9 soutenance' },
    { title: 'Séq. 9 — Quiz (3ème)', url: `${ROOT}/3eme/t3/seq9-quiz.html`, level: '3eme', tags: 'quiz qcm séquence 9 soutenance projet bilan' },
    { title: 'Fiche de révision T3 & DNB (3ème)', url: `${ROOT}/3eme/t3/revision.html`, level: '3eme', tags: 'révision trimestre 3 DNB brevet projet vocabulaire méthode' },
    // EBEP (adaptations élèves à besoins éducatifs particuliers)
    { title: 'EBEP S2 — Évolution (5ème)', url: `${ROOT}/5eme/t1/seq2-ebep.html`, level: '5eme', tags: 'ebep adapté dys tdah séquence 2 évolution' },
    { title: 'EBEP S3 — Cycle de vie (5ème)', url: `${ROOT}/5eme/t1/seq3-ebep.html`, level: '5eme', tags: 'ebep adapté dys tdah séquence 3 cycle vie' },
    { title: 'EBEP S4 — Structure interne (5ème)', url: `${ROOT}/5eme/t2/seq4-ebep.html`, level: '5eme', tags: 'ebep adapté dys tdah séquence 4 matériaux' },
    { title: 'EBEP S5 — Transmission (5ème)', url: `${ROOT}/5eme/t2/seq5-ebep.html`, level: '5eme', tags: 'ebep adapté dys tdah séquence 5 mouvement' },
    { title: 'EBEP S6 — Programmation (5ème)', url: `${ROOT}/5eme/t2/seq6-ebep.html`, level: '5eme', tags: 'ebep adapté dys tdah séquence 6 programmation' },
    { title: 'EBEP S7 — Modélisation 3D (5ème)', url: `${ROOT}/5eme/t3/seq7-ebep.html`, level: '5eme', tags: 'ebep adapté dys tdah séquence 7 3D' },
    { title: 'EBEP S8 — Projet (5ème)', url: `${ROOT}/5eme/t3/seq8-ebep.html`, level: '5eme', tags: 'ebep adapté dys tdah séquence 8 projet' },
    { title: 'EBEP S9 — IA et IoT (5ème)', url: `${ROOT}/5eme/t3/seq9-ebep.html`, level: '5eme', tags: 'ebep adapté dys tdah séquence 9 IA IoT' },
    { title: 'EBEP S1 — Innovation (4ème)', url: `${ROOT}/4eme/t1/seq1-ebep.html`, level: '4eme', tags: 'ebep adapté dys tdah séquence 1 innovation' },
    { title: 'EBEP S2 — IA (4ème)', url: `${ROOT}/4eme/t1/seq2-ebep.html`, level: '4eme', tags: 'ebep adapté dys tdah séquence 2 IA' },
    { title: 'EBEP S3 — IoT (4ème)', url: `${ROOT}/4eme/t1/seq3-ebep.html`, level: '4eme', tags: 'ebep adapté dys tdah séquence 3 IoT' },
    { title: 'EBEP S4 — Énergie (4ème)', url: `${ROOT}/4eme/t2/seq4-ebep.html`, level: '4eme', tags: 'ebep adapté dys tdah séquence 4 énergie' },
    { title: 'EBEP S5 — Arduino (4ème)', url: `${ROOT}/4eme/t2/seq5-ebep.html`, level: '4eme', tags: 'ebep adapté dys tdah séquence 5 Arduino' },
    { title: 'EBEP S6 — Réparabilité (4ème)', url: `${ROOT}/4eme/t2/seq6-ebep.html`, level: '4eme', tags: 'ebep adapté dys tdah séquence 6 réparabilité' },
    { title: 'EBEP S7 — Projet (4ème)', url: `${ROOT}/4eme/t3/seq7-ebep.html`, level: '4eme', tags: 'ebep adapté dys tdah séquence 7 projet' },
    { title: 'EBEP S8 — IA automatisée (4ème)', url: `${ROOT}/4eme/t3/seq8-ebep.html`, level: '4eme', tags: 'ebep adapté dys tdah séquence 8 IA automatisé' },
    { title: 'EBEP S9 — FabLab (4ème)', url: `${ROOT}/4eme/t3/seq9-ebep.html`, level: '4eme', tags: 'ebep adapté dys tdah séquence 9 FabLab' },
    { title: 'EBEP S1 — Objet connecté (3ème)', url: `${ROOT}/3eme/t1/seq1-ebep.html`, level: '3eme', tags: 'ebep adapté dys tdah séquence 1 objet connecté' },
    { title: 'EBEP S2 — IA embarquée (3ème)', url: `${ROOT}/3eme/t1/seq2-ebep.html`, level: '3eme', tags: 'ebep adapté dys tdah séquence 2 IA embarquée' },
    { title: 'EBEP S3 — Éthique (3ème)', url: `${ROOT}/3eme/t1/seq3-ebep.html`, level: '3eme', tags: 'ebep adapté dys tdah séquence 3 éthique' },
    { title: 'EBEP S4 — Automatisés (3ème)', url: `${ROOT}/3eme/t2/seq4-ebep.html`, level: '3eme', tags: 'ebep adapté dys tdah séquence 4 automatisés' },
    { title: 'EBEP S5 — Prog. avancée (3ème)', url: `${ROOT}/3eme/t2/seq5-ebep.html`, level: '3eme', tags: 'ebep adapté dys tdah séquence 5 programmation' },
    { title: 'EBEP S6 — Tests (3ème)', url: `${ROOT}/3eme/t2/seq6-ebep.html`, level: '3eme', tags: 'ebep adapté dys tdah séquence 6 tests' },
    { title: 'EBEP S7 — Smart Object (3ème)', url: `${ROOT}/3eme/t3/seq7-ebep.html`, level: '3eme', tags: 'ebep adapté dys tdah séquence 7 smart object' },
    { title: 'EBEP S8 — Fabrication (3ème)', url: `${ROOT}/3eme/t3/seq8-ebep.html`, level: '3eme', tags: 'ebep adapté dys tdah séquence 8 fabrication' },
    { title: 'EBEP S9 — Soutenance (3ème)', url: `${ROOT}/3eme/t3/seq9-ebep.html`, level: '3eme', tags: 'ebep adapté dys tdah séquence 9 soutenance' },
    // Évaluations par séquence
    { title: 'Éval S2 — Évolution (5ème)', url: `${ROOT}/5eme/t1/seq2-eval.html`, level: '5eme', tags: 'évaluation contrôle séquence 2 évolution' },
    { title: 'Éval S3 — Cycle de vie (5ème)', url: `${ROOT}/5eme/t1/seq3-eval.html`, level: '5eme', tags: 'évaluation contrôle séquence 3 cycle vie' },
    { title: 'Éval S4 — Structure interne (5ème)', url: `${ROOT}/5eme/t2/seq4-eval.html`, level: '5eme', tags: 'évaluation contrôle séquence 4 matériaux' },
    { title: 'Éval S5 — Transmission (5ème)', url: `${ROOT}/5eme/t2/seq5-eval.html`, level: '5eme', tags: 'évaluation contrôle séquence 5 mouvement' },
    { title: 'Éval S6 — Programmation (5ème)', url: `${ROOT}/5eme/t2/seq6-eval.html`, level: '5eme', tags: 'évaluation contrôle séquence 6 programmation' },
    { title: 'Éval S7 — Modélisation 3D (5ème)', url: `${ROOT}/5eme/t3/seq7-eval.html`, level: '5eme', tags: 'évaluation contrôle séquence 7 3D' },
    { title: 'Éval S8 — Projet (5ème)', url: `${ROOT}/5eme/t3/seq8-eval.html`, level: '5eme', tags: 'évaluation contrôle séquence 8 projet' },
    { title: 'Éval S9 — IA et IoT (5ème)', url: `${ROOT}/5eme/t3/seq9-eval.html`, level: '5eme', tags: 'évaluation contrôle séquence 9 IA IoT' },
    { title: 'Éval S1 — Innovation (4ème)', url: `${ROOT}/4eme/t1/seq1-eval.html`, level: '4eme', tags: 'évaluation contrôle séquence 1 innovation' },
    { title: 'Éval S2 — IA (4ème)', url: `${ROOT}/4eme/t1/seq2-eval.html`, level: '4eme', tags: 'évaluation contrôle séquence 2 IA' },
    { title: 'Éval S3 — IoT (4ème)', url: `${ROOT}/4eme/t1/seq3-eval.html`, level: '4eme', tags: 'évaluation contrôle séquence 3 IoT' },
    { title: 'Éval S4 — Énergie (4ème)', url: `${ROOT}/4eme/t2/seq4-eval.html`, level: '4eme', tags: 'évaluation contrôle séquence 4 énergie' },
    { title: 'Éval S5 — Arduino (4ème)', url: `${ROOT}/4eme/t2/seq5-eval.html`, level: '4eme', tags: 'évaluation contrôle séquence 5 Arduino' },
    { title: 'Éval S6 — Réparabilité (4ème)', url: `${ROOT}/4eme/t2/seq6-eval.html`, level: '4eme', tags: 'évaluation contrôle séquence 6 réparabilité' },
    { title: 'Éval S7 — Projet (4ème)', url: `${ROOT}/4eme/t3/seq7-eval.html`, level: '4eme', tags: 'évaluation contrôle séquence 7 projet' },
    { title: 'Éval S8 — IA automatisée (4ème)', url: `${ROOT}/4eme/t3/seq8-eval.html`, level: '4eme', tags: 'évaluation contrôle séquence 8 IA automatisé' },
    { title: 'Éval S9 — FabLab (4ème)', url: `${ROOT}/4eme/t3/seq9-eval.html`, level: '4eme', tags: 'évaluation contrôle séquence 9 FabLab' },
    { title: 'Éval S1 — Objet connecté (3ème)', url: `${ROOT}/3eme/t1/seq1-eval.html`, level: '3eme', tags: 'évaluation contrôle séquence 1 objet connecté' },
    { title: 'Éval S2 — IA embarquée (3ème)', url: `${ROOT}/3eme/t1/seq2-eval.html`, level: '3eme', tags: 'évaluation contrôle séquence 2 IA embarquée' },
    { title: 'Éval S3 — Éthique (3ème)', url: `${ROOT}/3eme/t1/seq3-eval.html`, level: '3eme', tags: 'évaluation contrôle séquence 3 éthique' },
    { title: 'Éval S4 — Automatisés (3ème)', url: `${ROOT}/3eme/t2/seq4-eval.html`, level: '3eme', tags: 'évaluation contrôle séquence 4 automatisés' },
    { title: 'Éval S5 — Prog. avancée (3ème)', url: `${ROOT}/3eme/t2/seq5-eval.html`, level: '3eme', tags: 'évaluation contrôle séquence 5 programmation' },
    { title: 'Éval S6 — Tests (3ème)', url: `${ROOT}/3eme/t2/seq6-eval.html`, level: '3eme', tags: 'évaluation contrôle séquence 6 tests' },
    { title: 'Éval S7 — Smart Object (3ème)', url: `${ROOT}/3eme/t3/seq7-eval.html`, level: '3eme', tags: 'évaluation contrôle séquence 7 smart object' },
    { title: 'Éval S8 — Fabrication (3ème)', url: `${ROOT}/3eme/t3/seq8-eval.html`, level: '3eme', tags: 'évaluation contrôle séquence 8 fabrication' },
    { title: 'Éval S9 — Soutenance (3ème)', url: `${ROOT}/3eme/t3/seq9-eval.html`, level: '3eme', tags: 'évaluation contrôle séquence 9 soutenance' },

    // --- Révision par séquence — 5ème ---
    { title: 'Révision S1 — Objets techniques (5ème)', url: `${ROOT}/5eme/t1/seq1-revision.html`, level: '5eme', tags: 'révision séquence 1 objets techniques besoin fonction' },
    { title: 'Révision S2 — Évolution des objets (5ème)', url: `${ROOT}/5eme/t1/seq2-revision.html`, level: '5eme', tags: 'révision séquence 2 évolution innovation invention' },
    { title: 'Révision S3 — Cycle de vie (5ème)', url: `${ROOT}/5eme/t1/seq3-revision.html`, level: '5eme', tags: 'révision séquence 3 cycle vie environnement recyclage' },
    { title: 'Révision S4 — Structure interne (5ème)', url: `${ROOT}/5eme/t2/seq4-revision.html`, level: '5eme', tags: 'révision séquence 4 structure matériaux énergie information' },
    { title: 'Révision S5 — Transmission mouvement (5ème)', url: `${ROOT}/5eme/t2/seq5-revision.html`, level: '5eme', tags: 'révision séquence 5 transmission transformation engrenage' },
    { title: 'Révision S6 — Programmation (5ème)', url: `${ROOT}/5eme/t2/seq6-revision.html`, level: '5eme', tags: 'révision séquence 6 programmation algorithme scratch boucle' },
    { title: 'Révision S7 — Modélisation 3D (5ème)', url: `${ROOT}/5eme/t3/seq7-revision.html`, level: '5eme', tags: 'révision séquence 7 modélisation 3D CAO impression' },
    { title: 'Révision S8 — Projet de groupe (5ème)', url: `${ROOT}/5eme/t3/seq8-revision.html`, level: '5eme', tags: 'révision séquence 8 projet groupe cahier charges' },
    { title: 'Révision S9 — IA et objets connectés (5ème)', url: `${ROOT}/5eme/t3/seq9-revision.html`, level: '5eme', tags: 'révision séquence 9 IA objets connectés capteur' },

    // --- Révision par séquence — 4ème ---
    { title: 'Révision S1 — Innovations (4ème)', url: `${ROOT}/4eme/t1/seq1-revision.html`, level: '4eme', tags: 'révision séquence 1 innovations brevet veille' },
    { title: 'Révision S2 — IA et automatisation (4ème)', url: `${ROOT}/4eme/t1/seq2-revision.html`, level: '4eme', tags: 'révision séquence 2 IA automatisation apprentissage' },
    { title: 'Révision S3 — Objets connectés IoT (4ème)', url: `${ROOT}/4eme/t1/seq3-revision.html`, level: '4eme', tags: 'révision séquence 3 IoT protocole cloud données' },
    { title: 'Révision S4 — Énergie et conversions (4ème)', url: `${ROOT}/4eme/t2/seq4-revision.html`, level: '4eme', tags: 'révision séquence 4 énergie conversion rendement' },
    { title: 'Révision S5 — Programmation Arduino (4ème)', url: `${ROOT}/4eme/t2/seq5-revision.html`, level: '4eme', tags: 'révision séquence 5 Arduino mBlock capteur variable' },
    { title: 'Révision S6 — Réparabilité (4ème)', url: `${ROOT}/4eme/t2/seq6-revision.html`, level: '4eme', tags: 'révision séquence 6 réparabilité diagnostic obsolescence' },
    { title: 'Révision S7 — Projet collaboratif (4ème)', url: `${ROOT}/4eme/t3/seq7-revision.html`, level: '4eme', tags: 'révision séquence 7 projet collaboratif Gantt' },
    { title: 'Révision S8 — IA systèmes automatisés (4ème)', url: `${ROOT}/4eme/t3/seq8-revision.html`, level: '4eme', tags: 'révision séquence 8 IA neurones biais éthique' },
    { title: 'Révision S9 — Fabrication numérique (4ème)', url: `${ROOT}/4eme/t3/seq9-revision.html`, level: '4eme', tags: 'révision séquence 9 FabLab impression 3D découpe laser' },

    // --- Révision par séquence — 3ème ---
    { title: 'Révision S1 — Étude critique (3ème)', url: `${ROOT}/3eme/t1/seq1-revision.html`, level: '3eme', tags: 'révision séquence 1 analyse fonctionnelle pieuvre critique' },
    { title: 'Révision S2 — IA embarquée (3ème)', url: `${ROOT}/3eme/t1/seq2-revision.html`, level: '3eme', tags: 'révision séquence 2 IA embarquée cloud edge computing' },
    { title: 'Révision S3 — Éthique et impacts (3ème)', url: `${ROOT}/3eme/t1/seq3-revision.html`, level: '3eme', tags: 'révision séquence 3 éthique RGPD sobriété numérique' },
    { title: 'Révision S4 — Systèmes automatisés (3ème)', url: `${ROOT}/3eme/t2/seq4-revision.html`, level: '3eme', tags: 'révision séquence 4 domotique Grafcet rétroaction' },
    { title: 'Révision S5 — Programmation avancée (3ème)', url: `${ROOT}/3eme/t2/seq5-revision.html`, level: '3eme', tags: 'révision séquence 5 Python fonction liste débogage' },
    { title: 'Révision S6 — Tests mise au point (3ème)', url: `${ROOT}/3eme/t2/seq6-revision.html`, level: '3eme', tags: 'révision séquence 6 tests protocole itération validation' },
    { title: 'Révision S7 — Smart Object (3ème)', url: `${ROOT}/3eme/t3/seq7-revision.html`, level: '3eme', tags: 'révision séquence 7 smart object architecture maquette' },
    { title: 'Révision S8 — Fabrication prototypage (3ème)', url: `${ROOT}/3eme/t3/seq8-revision.html`, level: '3eme', tags: 'révision séquence 8 fabrication prototype gamme assemblage' },
    { title: 'Révision S9 — Soutenance (3ème)', url: `${ROOT}/3eme/t3/seq9-revision.html`, level: '3eme', tags: 'révision séquence 9 soutenance dossier technique présentation' },
  ];

  // ---- HEADER ----
  function renderHeader() {
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `
      <div class="header-inner">
        <a href="${ROOT}/index.html" class="header-brand">
          <img src="${ROOT}/img/logo-lft.png" alt="Logo LFT" class="header-logo">
          <div class="header-title">
            <span class="header-title-main">Technologie LFT</span>
            <span class="header-title-sub">Lyc\u00e9e Fran\u00e7ais de Tananarive</span>
          </div>
        </a>
        <div class="header-search">
          <span class="header-search-icon">\u{1F50D}</span>
          <input type="text" placeholder="Rechercher une s\u00e9quence, un quiz..." id="search-input" autocomplete="off">
          <div class="search-results" id="search-results"></div>
        </div>
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu">\u2630</button>
      </div>
    `;
    return header;
  }

  // ---- NAVIGATION ----
  function renderNav(activePage) {
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.id = 'site-nav';
    nav.innerHTML = `
      <div class="nav-inner">
        <a href="${ROOT}/index.html" class="nav-item ${activePage === 'home' ? 'active' : ''}">\u{1F3E0} Accueil</a>
        <div class="nav-separator"></div>
        <a href="${ROOT}/5eme/index.html" class="nav-item ${activePage === '5eme' ? 'active' : ''}" data-level="5eme">\u{1F535} 5\u00e8me</a>
        <a href="${ROOT}/4eme/index.html" class="nav-item ${activePage === '4eme' ? 'active' : ''}" data-level="4eme">\u{1F7E2} 4\u00e8me</a>
        <a href="${ROOT}/3eme/index.html" class="nav-item ${activePage === '3eme' ? 'active' : ''}" data-level="3eme">\u{1F7E0} 3\u00e8me</a>
        <div class="nav-separator"></div>
        <a href="${ROOT}/structuration/index.html" class="nav-item ${activePage === 'structuration' ? 'active' : ''}">\u{1F4D8} Structuration</a>
        <a href="${ROOT}/enseignant/index.html" class="nav-item ${activePage === 'enseignant' ? 'active' : ''}">\u{1F4DA} Espace Enseignant</a>
        <a href="${ROOT}/outils/index.html" class="nav-item ${activePage === 'outils' ? 'active' : ''}">\u{1F9F0} Outils</a>
      </div>
    `;
    return nav;
  }

  // ---- BREADCRUMB ----
  function renderBreadcrumb(items) {
    if (!items || items.length === 0) return null;

    // Auto-add URLs for trimester breadcrumb items (T1/T2/T3)
    items = items.map((item, i) => {
      if (!item.url && item.label && /^T[1-3]\s/.test(item.label) && i > 0) {
        const prevItem = items[i - 1];
        if (prevItem && prevItem.url) {
          const trimNum = item.label.match(/^T([1-3])/)[1];
          let tabId = 't' + trimNum;
          if (prevItem.label.includes('4')) tabId += '-4';
          else if (prevItem.label.includes('3')) tabId += '-3';
          return { label: item.label, url: prevItem.url + '#' + tabId };
        }
      }
      return item;
    });

    const bc = document.createElement('div');
    bc.className = 'breadcrumb';
    const parts = items.map((item, i) => {
      if (i === items.length - 1) {
        return `<span class="breadcrumb-current">${item.label}</span>`;
      }
      if (item.url) {
        return `<a href="${item.url}">${item.label}</a><span class="breadcrumb-sep">\u203A</span>`;
      }
      return `<span>${item.label}</span><span class="breadcrumb-sep">\u203A</span>`;
    });
    bc.innerHTML = parts.join('');
    return bc;
  }

  // ---- FOOTER ----
  function renderFooter() {
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    const year = new Date().getFullYear();
    footer.innerHTML = `
      <div class="footer-inner">
        <div class="footer-left">
          <img src="${ROOT}/img/logo-lft.png" alt="LFT" class="footer-logo">
          <div class="footer-text">
            <strong>Technologie — Lyc\u00e9e Fran\u00e7ais de Tananarive</strong><br>
            Ambatobe, Antananarivo, Madagascar
            <div class="footer-aefe">
              R\u00e9seau AEFE — Enseignement fran\u00e7ais \u00e0 l'\u00e9tranger
            </div>
          </div>
        </div>
        <div class="footer-right">
          \u00a9 ${year} Technologie LFT<br>
          <span class="text-xs">Site p\u00e9dagogique — Cycle 4</span>
        </div>
      </div>
    `;
    return footer;
  }

  // ---- PRINT HEADER ----
  function renderPrintHeader(title, subtitle) {
    const ph = document.createElement('div');
    ph.className = 'print-header';
    ph.innerHTML = `
      <div>
        <img src="${ROOT}/img/logo-lft.png" alt="LFT">
      </div>
      <div class="print-header-text">
        <strong>${title || 'Technologie'}</strong><br>
        ${subtitle || 'Lyc\u00e9e Fran\u00e7ais de Tananarive'}
      </div>
    `;
    return ph;
  }

  // ---- SEARCH FUNCTIONALITY ----
  function initSearch() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    const levelColors = {
      '5eme': { bg: 'var(--color-5eme-light)', color: 'var(--color-5eme-dark)', label: '5\u00e8me' },
      '4eme': { bg: 'var(--color-4eme-light)', color: 'var(--color-4eme-dark)', label: '4\u00e8me' },
      '3eme': { bg: 'var(--color-3eme-light)', color: 'var(--color-3eme-dark)', label: '3\u00e8me' },
    };

    input.addEventListener('input', function () {
      const query = this.value.toLowerCase().trim();
      if (query.length < 2) {
        results.classList.remove('active');
        return;
      }

      const matches = SITE_DATA.filter(item => {
        const searchText = (item.title + ' ' + item.tags).toLowerCase();
        return query.split(' ').every(word => searchText.includes(word));
      }).slice(0, 8);

      if (matches.length === 0) {
        results.innerHTML = '<div class="search-result-item" style="color:var(--gray-400);cursor:default">Aucun r\u00e9sultat</div>';
      } else {
        results.innerHTML = matches.map(item => {
          const badge = item.level && levelColors[item.level]
            ? `<span class="search-result-badge" style="background:${levelColors[item.level].bg};color:${levelColors[item.level].color}">${levelColors[item.level].label}</span>`
            : '';
          return `<a href="${item.url}" class="search-result-item">${badge}<span>${item.title}</span></a>`;
        }).join('');
      }
      results.classList.add('active');
    });

    // Close on click outside
    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.remove('active');
      }
    });

    // Close on Escape
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        results.classList.remove('active');
        input.blur();
      }
    });
  }

  // ---- MOBILE MENU ----
  function initMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      this.textContent = nav.classList.contains('open') ? '\u2715' : '\u2630';
    });

    // Close menu on nav item click (mobile)
    nav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.textContent = '\u2630';
      });
    });
  }

  // ---- TAB SYSTEM ----
  function initTabs() {
    document.querySelectorAll('.trimester-tabs').forEach(tabContainer => {
      const buttons = tabContainer.querySelectorAll('.tab-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', function () {
          const target = this.dataset.tab;
          const parent = this.closest('.tab-system');
          if (!parent) return;

          // Deactivate all
          parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

          // Activate target
          this.classList.add('active');
          const targetEl = parent.querySelector(`#${target}`);
          if (targetEl) targetEl.classList.add('active');
        });
      });
    });

    // Activate tab from URL hash (e.g. #t3, #t2-4)
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      document.querySelectorAll('.tab-system').forEach(system => {
        const targetEl = system.querySelector('#' + hash);
        if (targetEl) {
          system.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          system.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          const btn = system.querySelector('.tab-btn[data-tab="' + hash + '"]');
          if (btn) btn.classList.add('active');
          targetEl.classList.add('active');
        }
      });
    }
  }

  // ---- CLICKABLE SEQ CARDS ----
  function initCardLinks() {
    document.querySelectorAll('.seq-card').forEach(card => {
      const firstLink = card.querySelector('.seq-card-links a');
      if (!firstLink) return;
      card.style.cursor = 'pointer';
      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        firstLink.click();
      });
    });
  }

  // ---- PRINT FUNCTION ----
  window.printPage = function () {
    window.print();
  };

  // ---- INIT ----
  function init() {
    const app = document.getElementById('app');
    if (!app) return;

    const activePage = app.dataset.page || '';
    const breadcrumbData = app.dataset.breadcrumb ? JSON.parse(app.dataset.breadcrumb) : null;
    const printTitle = app.dataset.printTitle || '';
    const printSubtitle = app.dataset.printSubtitle || '';

    // Insert elements before #app
    const parent = app.parentNode;

    // Print header (visible only when printing)
    parent.insertBefore(renderPrintHeader(printTitle, printSubtitle), app);

    // Header
    parent.insertBefore(renderHeader(), app);

    // Nav
    parent.insertBefore(renderNav(activePage), app);

    // Breadcrumb
    if (breadcrumbData) {
      const mainEl = app.querySelector('.site-main') || app;
      const bc = renderBreadcrumb(breadcrumbData);
      if (bc) mainEl.insertBefore(bc, mainEl.firstChild);
    }

    // Footer (after #app)
    parent.insertBefore(renderFooter(), app.nextSibling);

    // Initialize interactions
    initSearch();
    initMobileMenu();
    initTabs();
    initCardLinks();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
