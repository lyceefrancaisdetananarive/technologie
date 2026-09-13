/* =============================================
   TECHNOLOGIE LFT : Shared Components
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
    { title: '5\u00e8me, Progression', url: `${ROOT}/5eme/index.html`, level: '5eme', tags: 'cinqui\u00e8me progression' },
    { title: '4\u00e8me, Progression', url: `${ROOT}/4eme/index.html`, level: '4eme', tags: 'quatri\u00e8me progression' },
    { title: '3\u00e8me, Progression', url: `${ROOT}/3eme/index.html`, level: '3eme', tags: 'troisi\u00e8me progression dnb brevet' },
    { title: 'Outils', url: `${ROOT}/outils/index.html`, level: '', tags: 'quiz r\u00e9vision outils' },
    // catalogue:debut recherche
    { title: 'Cours, fiches de structuration', url: `${ROOT}/structuration/index.html`, level: '', tags: 'cours structuration résumé connaissances' },
    { title: 'Évaluation diagnostique · Ce que tu sais déjà (5e)', url: `${ROOT}/5eme/p1/diagnostique-eleve.html`, level: '5eme', tags: 'diagnostique rentrée évaluation' },
    { title: 'Activité S1, Découverte des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq1-activite.html`, level: '5eme', tags: 'activite activité séquence 1 période 1 qu est-ce qu un objet technique besoins et fonctions objet naturel ou objet technique le besoin fonction d usage et fonction d estime' },
    { title: 'Cours S1, Découverte des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq1-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 1 période 1 qu est-ce qu un objet technique besoins et fonctions objet naturel ou objet technique le besoin fonction d usage et fonction d estime' },
    { title: 'Quiz S1, Découverte des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq1-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 1 période 1 qu est-ce qu un objet technique besoins et fonctions objet naturel ou objet technique le besoin fonction d usage et fonction d estime' },
    { title: 'Évaluation S1, Découverte des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq1-eval.html`, level: '5eme', tags: 'eval évaluation séquence 1 période 1 qu est-ce qu un objet technique besoins et fonctions objet naturel ou objet technique le besoin fonction d usage et fonction d estime' },
    { title: 'Révision S1, Découverte des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq1-revision.html`, level: '5eme', tags: 'revision révision séquence 1 période 1 qu est-ce qu un objet technique besoins et fonctions objet naturel ou objet technique le besoin fonction d usage et fonction d estime' },
    { title: 'Version adaptée S1, Découverte des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq1-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 1 période 1 qu est-ce qu un objet technique besoins et fonctions objet naturel ou objet technique le besoin fonction d usage et fonction d estime' },
    { title: 'Activité S2, L\'évolution des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq2-activite.html`, level: '5eme', tags: 'activite activité séquence 2 période 1 frise chronologique innovations outils numériques la frise chronologique du téléphone l évolution du vélo réaliser une frise chronologique numérique' },
    { title: 'Cours S2, L\'évolution des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq2-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 2 période 1 frise chronologique innovations outils numériques la frise chronologique du téléphone l évolution du vélo réaliser une frise chronologique numérique' },
    { title: 'Quiz S2, L\'évolution des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq2-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 2 période 1 frise chronologique innovations outils numériques la frise chronologique du téléphone l évolution du vélo réaliser une frise chronologique numérique' },
    { title: 'Évaluation S2, L\'évolution des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq2-eval.html`, level: '5eme', tags: 'eval évaluation séquence 2 période 1 frise chronologique innovations outils numériques la frise chronologique du téléphone l évolution du vélo réaliser une frise chronologique numérique' },
    { title: 'Révision S2, L\'évolution des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq2-revision.html`, level: '5eme', tags: 'revision révision séquence 2 période 1 frise chronologique innovations outils numériques la frise chronologique du téléphone l évolution du vélo réaliser une frise chronologique numérique' },
    { title: 'Version adaptée S2, L\'évolution des objets techniques (5e)', url: `${ROOT}/5eme/p1/seq2-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 2 période 1 frise chronologique innovations outils numériques la frise chronologique du téléphone l évolution du vélo réaliser une frise chronologique numérique' },
    { title: 'Activité S3, Cycle de vie et impact environnemental (5e)', url: `${ROOT}/5eme/p2/seq3-activite.html`, level: '5eme', tags: 'activite activité séquence 3 période 2 cycle de vie ia et évolutions développement durable le cycle de vie d un objet l impact environnemental d un t-shirt développement durable et éco-conception' },
    { title: 'Cours S3, Cycle de vie et impact environnemental (5e)', url: `${ROOT}/5eme/p2/seq3-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 3 période 2 cycle de vie ia et évolutions développement durable le cycle de vie d un objet l impact environnemental d un t-shirt développement durable et éco-conception' },
    { title: 'Quiz S3, Cycle de vie et impact environnemental (5e)', url: `${ROOT}/5eme/p2/seq3-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 3 période 2 cycle de vie ia et évolutions développement durable le cycle de vie d un objet l impact environnemental d un t-shirt développement durable et éco-conception' },
    { title: 'Évaluation S3, Cycle de vie et impact environnemental (5e)', url: `${ROOT}/5eme/p2/seq3-eval.html`, level: '5eme', tags: 'eval évaluation séquence 3 période 2 cycle de vie ia et évolutions développement durable le cycle de vie d un objet l impact environnemental d un t-shirt développement durable et éco-conception' },
    { title: 'Révision S3, Cycle de vie et impact environnemental (5e)', url: `${ROOT}/5eme/p2/seq3-revision.html`, level: '5eme', tags: 'revision révision séquence 3 période 2 cycle de vie ia et évolutions développement durable le cycle de vie d un objet l impact environnemental d un t-shirt développement durable et éco-conception' },
    { title: 'Version adaptée S3, Cycle de vie et impact environnemental (5e)', url: `${ROOT}/5eme/p2/seq3-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 3 période 2 cycle de vie ia et évolutions développement durable le cycle de vie d un objet l impact environnemental d un t-shirt développement durable et éco-conception' },
    { title: 'Activité S4, Structure interne des objets techniques (5e)', url: `${ROOT}/5eme/p2/seq4-activite.html`, level: '5eme', tags: 'activite activité séquence 4 période 2 composants matériaux sources d énergie décomposer un objet technique matériaux et propriétés sources et chaînes d énergie' },
    { title: 'Cours S4, Structure interne des objets techniques (5e)', url: `${ROOT}/5eme/p2/seq4-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 4 période 2 composants matériaux sources d énergie décomposer un objet technique matériaux et propriétés sources et chaînes d énergie' },
    { title: 'Quiz S4, Structure interne des objets techniques (5e)', url: `${ROOT}/5eme/p2/seq4-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 4 période 2 composants matériaux sources d énergie décomposer un objet technique matériaux et propriétés sources et chaînes d énergie' },
    { title: 'Évaluation S4, Structure interne des objets techniques (5e)', url: `${ROOT}/5eme/p2/seq4-eval.html`, level: '5eme', tags: 'eval évaluation séquence 4 période 2 composants matériaux sources d énergie décomposer un objet technique matériaux et propriétés sources et chaînes d énergie' },
    { title: 'Révision S4, Structure interne des objets techniques (5e)', url: `${ROOT}/5eme/p2/seq4-revision.html`, level: '5eme', tags: 'revision révision séquence 4 période 2 composants matériaux sources d énergie décomposer un objet technique matériaux et propriétés sources et chaînes d énergie' },
    { title: 'Version adaptée S4, Structure interne des objets techniques (5e)', url: `${ROOT}/5eme/p2/seq4-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 4 période 2 composants matériaux sources d énergie décomposer un objet technique matériaux et propriétés sources et chaînes d énergie' },
    { title: 'Activité S5, Transmission et transformation de mouvement (5e)', url: `${ROOT}/5eme/p3/seq5-activite.html`, level: '5eme', tags: 'activite activité séquence 5 période 3 engrenages chaîne d information capteurs les engrenages transmission ou transformation chaîne d information' },
    { title: 'Cours S5, Transmission et transformation de mouvement (5e)', url: `${ROOT}/5eme/p3/seq5-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 5 période 3 engrenages chaîne d information capteurs les engrenages transmission ou transformation chaîne d information' },
    { title: 'Quiz S5, Transmission et transformation de mouvement (5e)', url: `${ROOT}/5eme/p3/seq5-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 5 période 3 engrenages chaîne d information capteurs les engrenages transmission ou transformation chaîne d information' },
    { title: 'Évaluation S5, Transmission et transformation de mouvement (5e)', url: `${ROOT}/5eme/p3/seq5-eval.html`, level: '5eme', tags: 'eval évaluation séquence 5 période 3 engrenages chaîne d information capteurs les engrenages transmission ou transformation chaîne d information' },
    { title: 'Révision S5, Transmission et transformation de mouvement (5e)', url: `${ROOT}/5eme/p3/seq5-revision.html`, level: '5eme', tags: 'revision révision séquence 5 période 3 engrenages chaîne d information capteurs les engrenages transmission ou transformation chaîne d information' },
    { title: 'Version adaptée S5, Transmission et transformation de mouvement (5e)', url: `${ROOT}/5eme/p3/seq5-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 5 période 3 engrenages chaîne d information capteurs les engrenages transmission ou transformation chaîne d information' },
    { title: 'Activité S6, Initiation à la programmation (5e)', url: `${ROOT}/5eme/p3/seq6-activite.html`, level: '5eme', tags: 'activite activité séquence 6 période 3 mblock micro:bit capteurs/actionneurs découvrir la programmation par blocs programmer un feu tricolore avec mblock programmer le micro:bit' },
    { title: 'Cours S6, Initiation à la programmation (5e)', url: `${ROOT}/5eme/p3/seq6-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 6 période 3 mblock micro:bit capteurs/actionneurs découvrir la programmation par blocs programmer un feu tricolore avec mblock programmer le micro:bit' },
    { title: 'Quiz S6, Initiation à la programmation (5e)', url: `${ROOT}/5eme/p3/seq6-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 6 période 3 mblock micro:bit capteurs/actionneurs découvrir la programmation par blocs programmer un feu tricolore avec mblock programmer le micro:bit' },
    { title: 'Évaluation S6, Initiation à la programmation (5e)', url: `${ROOT}/5eme/p3/seq6-eval.html`, level: '5eme', tags: 'eval évaluation séquence 6 période 3 mblock micro:bit capteurs/actionneurs découvrir la programmation par blocs programmer un feu tricolore avec mblock programmer le micro:bit' },
    { title: 'Révision S6, Initiation à la programmation (5e)', url: `${ROOT}/5eme/p3/seq6-revision.html`, level: '5eme', tags: 'revision révision séquence 6 période 3 mblock micro:bit capteurs/actionneurs découvrir la programmation par blocs programmer un feu tricolore avec mblock programmer le micro:bit' },
    { title: 'Version adaptée S6, Initiation à la programmation (5e)', url: `${ROOT}/5eme/p3/seq6-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 6 période 3 mblock micro:bit capteurs/actionneurs découvrir la programmation par blocs programmer un feu tricolore avec mblock programmer le micro:bit' },
    { title: 'Activité S7, Modélisation 3D et conception (5e)', url: `${ROOT}/5eme/p4/seq7-activite.html`, level: '5eme', tags: 'activite activité séquence 7 période 4 tinkercad cahier des charges prototype le cahier des charges découverte de tinkercad concevoir le support de smartphone' },
    { title: 'Cours S7, Modélisation 3D et conception (5e)', url: `${ROOT}/5eme/p4/seq7-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 7 période 4 tinkercad cahier des charges prototype le cahier des charges découverte de tinkercad concevoir le support de smartphone' },
    { title: 'Quiz S7, Modélisation 3D et conception (5e)', url: `${ROOT}/5eme/p4/seq7-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 7 période 4 tinkercad cahier des charges prototype le cahier des charges découverte de tinkercad concevoir le support de smartphone' },
    { title: 'Évaluation S7, Modélisation 3D et conception (5e)', url: `${ROOT}/5eme/p4/seq7-eval.html`, level: '5eme', tags: 'eval évaluation séquence 7 période 4 tinkercad cahier des charges prototype le cahier des charges découverte de tinkercad concevoir le support de smartphone' },
    { title: 'Révision S7, Modélisation 3D et conception (5e)', url: `${ROOT}/5eme/p4/seq7-revision.html`, level: '5eme', tags: 'revision révision séquence 7 période 4 tinkercad cahier des charges prototype le cahier des charges découverte de tinkercad concevoir le support de smartphone' },
    { title: 'Version adaptée S7, Modélisation 3D et conception (5e)', url: `${ROOT}/5eme/p4/seq7-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 7 période 4 tinkercad cahier des charges prototype le cahier des charges découverte de tinkercad concevoir le support de smartphone' },
    { title: 'Activité S8, IA, objets connectés et réparabilité (5e)', url: `${ROOT}/5eme/p5/seq8-activite.html`, level: '5eme', tags: 'activite activité séquence 8 période 5 ia objets connectés indice de réparabilité qu est-ce que l intelligence artificielle les objets connectés iot réparabilité et durabilité' },
    { title: 'Cours S8, IA, objets connectés et réparabilité (5e)', url: `${ROOT}/5eme/p5/seq8-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 8 période 5 ia objets connectés indice de réparabilité qu est-ce que l intelligence artificielle les objets connectés iot réparabilité et durabilité' },
    { title: 'Quiz S8, IA, objets connectés et réparabilité (5e)', url: `${ROOT}/5eme/p5/seq8-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 8 période 5 ia objets connectés indice de réparabilité qu est-ce que l intelligence artificielle les objets connectés iot réparabilité et durabilité' },
    { title: 'Évaluation S8, IA, objets connectés et réparabilité (5e)', url: `${ROOT}/5eme/p5/seq8-eval.html`, level: '5eme', tags: 'eval évaluation séquence 8 période 5 ia objets connectés indice de réparabilité qu est-ce que l intelligence artificielle les objets connectés iot réparabilité et durabilité' },
    { title: 'Révision S8, IA, objets connectés et réparabilité (5e)', url: `${ROOT}/5eme/p5/seq8-revision.html`, level: '5eme', tags: 'revision révision séquence 8 période 5 ia objets connectés indice de réparabilité qu est-ce que l intelligence artificielle les objets connectés iot réparabilité et durabilité' },
    { title: 'Version adaptée S8, IA, objets connectés et réparabilité (5e)', url: `${ROOT}/5eme/p5/seq8-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 8 période 5 ia objets connectés indice de réparabilité qu est-ce que l intelligence artificielle les objets connectés iot réparabilité et durabilité' },
    { title: 'Activité S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-activite.html`, level: '5eme', tags: 'activite activité séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année' },
    { title: 'Cours S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année' },
    { title: 'Quiz S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année' },
    { title: 'Évaluation S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-eval.html`, level: '5eme', tags: 'eval évaluation séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année' },
    { title: 'Révision S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-revision.html`, level: '5eme', tags: 'revision révision séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année' },
    { title: 'Version adaptée S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année' },
    { title: 'Fiche de révision : Trimestre 1 (5e)', url: `${ROOT}/5eme/p2/revision-t1.html`, level: '5eme', tags: 'trimestre bilan revision révision' },
    { title: 'Évaluation bilan : Trimestre 2 (5e)', url: `${ROOT}/5eme/p4/eval-t2.html`, level: '5eme', tags: 'trimestre bilan eval révision' },
    { title: 'Fiche de révision : Trimestre 2 (5e)', url: `${ROOT}/5eme/p4/revision-t2.html`, level: '5eme', tags: 'trimestre bilan revision révision' },
    { title: 'Fiche de révision : Trimestre 3 (5e)', url: `${ROOT}/5eme/p5/revision-t3.html`, level: '5eme', tags: 'trimestre bilan revision révision' },
    { title: 'Évaluation diagnostique · Ce que tu sais déjà (4e)', url: `${ROOT}/4eme/p1/diagnostique-eleve.html`, level: '4eme', tags: 'diagnostique rentrée évaluation' },
    { title: 'Activité S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-activite.html`, level: '4eme', tags: 'activite activité séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique' },
    { title: 'Cours S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique' },
    { title: 'Quiz S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique' },
    { title: 'Évaluation S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-eval.html`, level: '4eme', tags: 'eval évaluation séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique' },
    { title: 'Révision S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-revision.html`, level: '4eme', tags: 'revision révision séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique' },
    { title: 'Version adaptée S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique' },
    { title: 'Activité S2, Algorithme et logique de programmation (4e)', url: `${ROOT}/4eme/p1/seq2-activite.html`, level: '4eme', tags: 'activite activité séquence 2 période 1 organigrammes conditions boucles algorithme du tourniquet algorithme du quotidien 15 min l organigramme du tourniquet 30 min algorithme d un feu tricolore 20 min pseudo-code 20 min' },
    { title: 'Cours S2, Algorithme et logique de programmation (4e)', url: `${ROOT}/4eme/p1/seq2-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 2 période 1 organigrammes conditions boucles algorithme du tourniquet algorithme du quotidien 15 min l organigramme du tourniquet 30 min algorithme d un feu tricolore 20 min pseudo-code 20 min' },
    { title: 'Quiz S2, Algorithme et logique de programmation (4e)', url: `${ROOT}/4eme/p1/seq2-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 2 période 1 organigrammes conditions boucles algorithme du tourniquet algorithme du quotidien 15 min l organigramme du tourniquet 30 min algorithme d un feu tricolore 20 min pseudo-code 20 min' },
    { title: 'Évaluation S2, Algorithme et logique de programmation (4e)', url: `${ROOT}/4eme/p1/seq2-eval.html`, level: '4eme', tags: 'eval évaluation séquence 2 période 1 organigrammes conditions boucles algorithme du tourniquet algorithme du quotidien 15 min l organigramme du tourniquet 30 min algorithme d un feu tricolore 20 min pseudo-code 20 min' },
    { title: 'Révision S2, Algorithme et logique de programmation (4e)', url: `${ROOT}/4eme/p1/seq2-revision.html`, level: '4eme', tags: 'revision révision séquence 2 période 1 organigrammes conditions boucles algorithme du tourniquet algorithme du quotidien 15 min l organigramme du tourniquet 30 min algorithme d un feu tricolore 20 min pseudo-code 20 min' },
    { title: 'Version adaptée S2, Algorithme et logique de programmation (4e)', url: `${ROOT}/4eme/p1/seq2-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 2 période 1 organigrammes conditions boucles algorithme du tourniquet algorithme du quotidien 15 min l organigramme du tourniquet 30 min algorithme d un feu tricolore 20 min pseudo-code 20 min' },
    { title: 'Activité S3, Programmation d\'objets connectés (Micro:bit) (4e)', url: `${ROOT}/4eme/p2/seq3-activite.html`, level: '4eme', tags: 'activite activité séquence 3 période 2 carte micro:bit capteurs actionneurs jeu de ludo découverte : afficher sur les leds 20 min les capteurs de la micro:bit 30 min projet : jeu de ludo micro:bit 40 min' },
    { title: 'Cours S3, Programmation d\'objets connectés (Micro:bit) (4e)', url: `${ROOT}/4eme/p2/seq3-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 3 période 2 carte micro:bit capteurs actionneurs jeu de ludo découverte : afficher sur les leds 20 min les capteurs de la micro:bit 30 min projet : jeu de ludo micro:bit 40 min' },
    { title: 'Quiz S3, Programmation d\'objets connectés (Micro:bit) (4e)', url: `${ROOT}/4eme/p2/seq3-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 3 période 2 carte micro:bit capteurs actionneurs jeu de ludo découverte : afficher sur les leds 20 min les capteurs de la micro:bit 30 min projet : jeu de ludo micro:bit 40 min' },
    { title: 'Évaluation S3, Programmation d\'objets connectés (Micro:bit) (4e)', url: `${ROOT}/4eme/p2/seq3-eval.html`, level: '4eme', tags: 'eval évaluation séquence 3 période 2 carte micro:bit capteurs actionneurs jeu de ludo découverte : afficher sur les leds 20 min les capteurs de la micro:bit 30 min projet : jeu de ludo micro:bit 40 min' },
    { title: 'Révision S3, Programmation d\'objets connectés (Micro:bit) (4e)', url: `${ROOT}/4eme/p2/seq3-revision.html`, level: '4eme', tags: 'revision révision séquence 3 période 2 carte micro:bit capteurs actionneurs jeu de ludo découverte : afficher sur les leds 20 min les capteurs de la micro:bit 30 min projet : jeu de ludo micro:bit 40 min' },
    { title: 'Version adaptée S3, Programmation d\'objets connectés (Micro:bit) (4e)', url: `${ROOT}/4eme/p2/seq3-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 3 période 2 carte micro:bit capteurs actionneurs jeu de ludo découverte : afficher sur les leds 20 min les capteurs de la micro:bit 30 min projet : jeu de ludo micro:bit 40 min' },
    { title: 'Activité S4, Cahier des charges et documentation technique (4e)', url: `${ROOT}/4eme/p2/seq4-activite.html`, level: '4eme', tags: 'activite activité séquence 4 période 2 cahier des charges feu tricolore dessin de définition nomenclature rédiger le cahier des charges du feu tricolore 30 min le dessin de définition 30 min la nomenclature 20 min' },
    { title: 'Cours S4, Cahier des charges et documentation technique (4e)', url: `${ROOT}/4eme/p2/seq4-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 4 période 2 cahier des charges feu tricolore dessin de définition nomenclature rédiger le cahier des charges du feu tricolore 30 min le dessin de définition 30 min la nomenclature 20 min' },
    { title: 'Quiz S4, Cahier des charges et documentation technique (4e)', url: `${ROOT}/4eme/p2/seq4-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 4 période 2 cahier des charges feu tricolore dessin de définition nomenclature rédiger le cahier des charges du feu tricolore 30 min le dessin de définition 30 min la nomenclature 20 min' },
    { title: 'Évaluation S4, Cahier des charges et documentation technique (4e)', url: `${ROOT}/4eme/p2/seq4-eval.html`, level: '4eme', tags: 'eval évaluation séquence 4 période 2 cahier des charges feu tricolore dessin de définition nomenclature rédiger le cahier des charges du feu tricolore 30 min le dessin de définition 30 min la nomenclature 20 min' },
    { title: 'Révision S4, Cahier des charges et documentation technique (4e)', url: `${ROOT}/4eme/p2/seq4-revision.html`, level: '4eme', tags: 'revision révision séquence 4 période 2 cahier des charges feu tricolore dessin de définition nomenclature rédiger le cahier des charges du feu tricolore 30 min le dessin de définition 30 min la nomenclature 20 min' },
    { title: 'Version adaptée S4, Cahier des charges et documentation technique (4e)', url: `${ROOT}/4eme/p2/seq4-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 4 période 2 cahier des charges feu tricolore dessin de définition nomenclature rédiger le cahier des charges du feu tricolore 30 min le dessin de définition 30 min la nomenclature 20 min' },
    { title: 'Activité S5, Programmation et automatisation (mBlock / Scratch) (4e)', url: `${ROOT}/4eme/p3/seq5-activite.html`, level: '4eme', tags: 'activite activité séquence 5 période 3 contrôle feu tricolore interfaces graphiques programmation par blocs programmer le feu tricolore avec mblock 40 min créer une interface graphique avec scratch 40 min mode piéton et variables 30 min' },
    { title: 'Cours S5, Programmation et automatisation (mBlock / Scratch) (4e)', url: `${ROOT}/4eme/p3/seq5-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 5 période 3 contrôle feu tricolore interfaces graphiques programmation par blocs programmer le feu tricolore avec mblock 40 min créer une interface graphique avec scratch 40 min mode piéton et variables 30 min' },
    { title: 'Quiz S5, Programmation et automatisation (mBlock / Scratch) (4e)', url: `${ROOT}/4eme/p3/seq5-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 5 période 3 contrôle feu tricolore interfaces graphiques programmation par blocs programmer le feu tricolore avec mblock 40 min créer une interface graphique avec scratch 40 min mode piéton et variables 30 min' },
    { title: 'Évaluation S5, Programmation et automatisation (mBlock / Scratch) (4e)', url: `${ROOT}/4eme/p3/seq5-eval.html`, level: '4eme', tags: 'eval évaluation séquence 5 période 3 contrôle feu tricolore interfaces graphiques programmation par blocs programmer le feu tricolore avec mblock 40 min créer une interface graphique avec scratch 40 min mode piéton et variables 30 min' },
    { title: 'Révision S5, Programmation et automatisation (mBlock / Scratch) (4e)', url: `${ROOT}/4eme/p3/seq5-revision.html`, level: '4eme', tags: 'revision révision séquence 5 période 3 contrôle feu tricolore interfaces graphiques programmation par blocs programmer le feu tricolore avec mblock 40 min créer une interface graphique avec scratch 40 min mode piéton et variables 30 min' },
    { title: 'Version adaptée S5, Programmation et automatisation (mBlock / Scratch) (4e)', url: `${ROOT}/4eme/p3/seq5-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 5 période 3 contrôle feu tricolore interfaces graphiques programmation par blocs programmer le feu tricolore avec mblock 40 min créer une interface graphique avec scratch 40 min mode piéton et variables 30 min' },
    { title: 'Activité S6, Programmation Arduino (4e)', url: `${ROOT}/4eme/p3/seq6-activite.html`, level: '4eme', tags: 'activite activité séquence 6 période 3 arduino : faire clignoter une led lire un capteur programmer le prototype de l équipe découvrir l arduino et faire clignoter une led lire un capteur et réagir programmer le prototype de l équipe' },
    { title: 'Cours S6, Programmation Arduino (4e)', url: `${ROOT}/4eme/p3/seq6-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 6 période 3 arduino : faire clignoter une led lire un capteur programmer le prototype de l équipe découvrir l arduino et faire clignoter une led lire un capteur et réagir programmer le prototype de l équipe' },
    { title: 'Quiz S6, Programmation Arduino (4e)', url: `${ROOT}/4eme/p3/seq6-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 6 période 3 arduino : faire clignoter une led lire un capteur programmer le prototype de l équipe découvrir l arduino et faire clignoter une led lire un capteur et réagir programmer le prototype de l équipe' },
    { title: 'Évaluation S6, Programmation Arduino (4e)', url: `${ROOT}/4eme/p3/seq6-eval.html`, level: '4eme', tags: 'eval évaluation séquence 6 période 3 arduino : faire clignoter une led lire un capteur programmer le prototype de l équipe découvrir l arduino et faire clignoter une led lire un capteur et réagir programmer le prototype de l équipe' },
    { title: 'Révision S6, Programmation Arduino (4e)', url: `${ROOT}/4eme/p3/seq6-revision.html`, level: '4eme', tags: 'revision révision séquence 6 période 3 arduino : faire clignoter une led lire un capteur programmer le prototype de l équipe découvrir l arduino et faire clignoter une led lire un capteur et réagir programmer le prototype de l équipe' },
    { title: 'Version adaptée S6, Programmation Arduino (4e)', url: `${ROOT}/4eme/p3/seq6-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 6 période 3 arduino : faire clignoter une led lire un capteur programmer le prototype de l équipe découvrir l arduino et faire clignoter une led lire un capteur et réagir programmer le prototype de l équipe' },
    { title: 'Activité S7, Modélisation 3D et fabrication numérique (4e)', url: `${ROOT}/4eme/p4/seq7-activite.html`, level: '4eme', tags: 'activite activité séquence 7 période 4 cahier des charges modélisation 3d prototypage fablab découverte de la modélisation 3d 40 min les outils de fabrication numérique 30 min du modèle à la fabrication 40 min' },
    { title: 'Cours S7, Modélisation 3D et fabrication numérique (4e)', url: `${ROOT}/4eme/p4/seq7-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 7 période 4 cahier des charges modélisation 3d prototypage fablab découverte de la modélisation 3d 40 min les outils de fabrication numérique 30 min du modèle à la fabrication 40 min' },
    { title: 'Quiz S7, Modélisation 3D et fabrication numérique (4e)', url: `${ROOT}/4eme/p4/seq7-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 7 période 4 cahier des charges modélisation 3d prototypage fablab découverte de la modélisation 3d 40 min les outils de fabrication numérique 30 min du modèle à la fabrication 40 min' },
    { title: 'Évaluation S7, Modélisation 3D et fabrication numérique (4e)', url: `${ROOT}/4eme/p4/seq7-eval.html`, level: '4eme', tags: 'eval évaluation séquence 7 période 4 cahier des charges modélisation 3d prototypage fablab découverte de la modélisation 3d 40 min les outils de fabrication numérique 30 min du modèle à la fabrication 40 min' },
    { title: 'Révision S7, Modélisation 3D et fabrication numérique (4e)', url: `${ROOT}/4eme/p4/seq7-revision.html`, level: '4eme', tags: 'revision révision séquence 7 période 4 cahier des charges modélisation 3d prototypage fablab découverte de la modélisation 3d 40 min les outils de fabrication numérique 30 min du modèle à la fabrication 40 min' },
    { title: 'Version adaptée S7, Modélisation 3D et fabrication numérique (4e)', url: `${ROOT}/4eme/p4/seq7-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 7 période 4 cahier des charges modélisation 3d prototypage fablab découverte de la modélisation 3d 40 min les outils de fabrication numérique 30 min du modèle à la fabrication 40 min' },
    { title: 'Activité S8, Chaîne d\'énergie et chaîne d\'information (4e)', url: `${ROOT}/4eme/p5/seq8-activite.html`, level: '4eme', tags: 'activite activité séquence 8 période 5 comment un objet technique reçoit son énergie et comment il prend ses décisions du ventilateur de table au lampadaire solaire de rue le ventilateur de table : suivre l énergie du doigt le lampadaire solaire de rue : ranger les composants en deux familles donner un nom à chaque étape : les sept maillons du lampadaire solaire atelier : tracer le schéma à blocs du portail automatique ou de la citerne d école entraînement par deux : la pompe d arrosage de rizière évaluation individuelle : le ventilateur de plafond à télécommande' },
    { title: 'Cours S8, Chaîne d\'énergie et chaîne d\'information (4e)', url: `${ROOT}/4eme/p5/seq8-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 8 période 5 comment un objet technique reçoit son énergie et comment il prend ses décisions du ventilateur de table au lampadaire solaire de rue le ventilateur de table : suivre l énergie du doigt le lampadaire solaire de rue : ranger les composants en deux familles donner un nom à chaque étape : les sept maillons du lampadaire solaire atelier : tracer le schéma à blocs du portail automatique ou de la citerne d école entraînement par deux : la pompe d arrosage de rizière évaluation individuelle : le ventilateur de plafond à télécommande' },
    { title: 'Quiz S8, Chaîne d\'énergie et chaîne d\'information (4e)', url: `${ROOT}/4eme/p5/seq8-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 8 période 5 comment un objet technique reçoit son énergie et comment il prend ses décisions du ventilateur de table au lampadaire solaire de rue le ventilateur de table : suivre l énergie du doigt le lampadaire solaire de rue : ranger les composants en deux familles donner un nom à chaque étape : les sept maillons du lampadaire solaire atelier : tracer le schéma à blocs du portail automatique ou de la citerne d école entraînement par deux : la pompe d arrosage de rizière évaluation individuelle : le ventilateur de plafond à télécommande' },
    { title: 'Évaluation S8, Chaîne d\'énergie et chaîne d\'information (4e)', url: `${ROOT}/4eme/p5/seq8-eval.html`, level: '4eme', tags: 'eval évaluation séquence 8 période 5 comment un objet technique reçoit son énergie et comment il prend ses décisions du ventilateur de table au lampadaire solaire de rue le ventilateur de table : suivre l énergie du doigt le lampadaire solaire de rue : ranger les composants en deux familles donner un nom à chaque étape : les sept maillons du lampadaire solaire atelier : tracer le schéma à blocs du portail automatique ou de la citerne d école entraînement par deux : la pompe d arrosage de rizière évaluation individuelle : le ventilateur de plafond à télécommande' },
    { title: 'Révision S8, Chaîne d\'énergie et chaîne d\'information (4e)', url: `${ROOT}/4eme/p5/seq8-revision.html`, level: '4eme', tags: 'revision révision séquence 8 période 5 comment un objet technique reçoit son énergie et comment il prend ses décisions du ventilateur de table au lampadaire solaire de rue le ventilateur de table : suivre l énergie du doigt le lampadaire solaire de rue : ranger les composants en deux familles donner un nom à chaque étape : les sept maillons du lampadaire solaire atelier : tracer le schéma à blocs du portail automatique ou de la citerne d école entraînement par deux : la pompe d arrosage de rizière évaluation individuelle : le ventilateur de plafond à télécommande' },
    { title: 'Version adaptée S8, Chaîne d\'énergie et chaîne d\'information (4e)', url: `${ROOT}/4eme/p5/seq8-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 8 période 5 comment un objet technique reçoit son énergie et comment il prend ses décisions du ventilateur de table au lampadaire solaire de rue le ventilateur de table : suivre l énergie du doigt le lampadaire solaire de rue : ranger les composants en deux familles donner un nom à chaque étape : les sept maillons du lampadaire solaire atelier : tracer le schéma à blocs du portail automatique ou de la citerne d école entraînement par deux : la pompe d arrosage de rizière évaluation individuelle : le ventilateur de plafond à télécommande' },
    { title: 'Activité S9, Du besoin au prototype : concevoir et fabriquer un objet technique programmé (4e)', url: `${ROOT}/4eme/p5/seq9-activite.html`, level: '4eme', tags: 'activite activité séquence 9 période 5 projet d équipe complet du cahier des charges à la soutenance séance 1 : choisir un projet réalisable : le besoin l équipe le matériel séance 2 : le cahier des charges le croquis coté et la nomenclature séance 3 : planifier le projet avec un diagramme de gantt puis démarrer la conception séance 4 : terminer la conception et préparer les fichiers de fabrication séance 5 : fabriquer assembler tester et valider le prototype séance 6 : préparer répéter et soutenir l exposé du projet' },
    { title: 'Cours S9, Du besoin au prototype : concevoir et fabriquer un objet technique programmé (4e)', url: `${ROOT}/4eme/p5/seq9-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 9 période 5 projet d équipe complet du cahier des charges à la soutenance séance 1 : choisir un projet réalisable : le besoin l équipe le matériel séance 2 : le cahier des charges le croquis coté et la nomenclature séance 3 : planifier le projet avec un diagramme de gantt puis démarrer la conception séance 4 : terminer la conception et préparer les fichiers de fabrication séance 5 : fabriquer assembler tester et valider le prototype séance 6 : préparer répéter et soutenir l exposé du projet' },
    { title: 'Quiz S9, Du besoin au prototype : concevoir et fabriquer un objet technique programmé (4e)', url: `${ROOT}/4eme/p5/seq9-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 9 période 5 projet d équipe complet du cahier des charges à la soutenance séance 1 : choisir un projet réalisable : le besoin l équipe le matériel séance 2 : le cahier des charges le croquis coté et la nomenclature séance 3 : planifier le projet avec un diagramme de gantt puis démarrer la conception séance 4 : terminer la conception et préparer les fichiers de fabrication séance 5 : fabriquer assembler tester et valider le prototype séance 6 : préparer répéter et soutenir l exposé du projet' },
    { title: 'Évaluation S9, Du besoin au prototype : concevoir et fabriquer un objet technique programmé (4e)', url: `${ROOT}/4eme/p5/seq9-eval.html`, level: '4eme', tags: 'eval évaluation séquence 9 période 5 projet d équipe complet du cahier des charges à la soutenance séance 1 : choisir un projet réalisable : le besoin l équipe le matériel séance 2 : le cahier des charges le croquis coté et la nomenclature séance 3 : planifier le projet avec un diagramme de gantt puis démarrer la conception séance 4 : terminer la conception et préparer les fichiers de fabrication séance 5 : fabriquer assembler tester et valider le prototype séance 6 : préparer répéter et soutenir l exposé du projet' },
    { title: 'Révision S9, Du besoin au prototype : concevoir et fabriquer un objet technique programmé (4e)', url: `${ROOT}/4eme/p5/seq9-revision.html`, level: '4eme', tags: 'revision révision séquence 9 période 5 projet d équipe complet du cahier des charges à la soutenance séance 1 : choisir un projet réalisable : le besoin l équipe le matériel séance 2 : le cahier des charges le croquis coté et la nomenclature séance 3 : planifier le projet avec un diagramme de gantt puis démarrer la conception séance 4 : terminer la conception et préparer les fichiers de fabrication séance 5 : fabriquer assembler tester et valider le prototype séance 6 : préparer répéter et soutenir l exposé du projet' },
    { title: 'Version adaptée S9, Du besoin au prototype : concevoir et fabriquer un objet technique programmé (4e)', url: `${ROOT}/4eme/p5/seq9-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 9 période 5 projet d équipe complet du cahier des charges à la soutenance séance 1 : choisir un projet réalisable : le besoin l équipe le matériel séance 2 : le cahier des charges le croquis coté et la nomenclature séance 3 : planifier le projet avec un diagramme de gantt puis démarrer la conception séance 4 : terminer la conception et préparer les fichiers de fabrication séance 5 : fabriquer assembler tester et valider le prototype séance 6 : préparer répéter et soutenir l exposé du projet' },
    { title: 'Évaluation de fin de trimestre 1 (4e)', url: `${ROOT}/4eme/p2/eval-t1.html`, level: '4eme', tags: 'trimestre bilan eval révision' },
    { title: 'Révision : Trimestre 1 (4e)', url: `${ROOT}/4eme/p2/revision-t1.html`, level: '4eme', tags: 'trimestre bilan revision révision' },
    { title: 'Évaluation de fin de trimestre 2 (4e)', url: `${ROOT}/4eme/p4/eval-t2.html`, level: '4eme', tags: 'trimestre bilan eval révision' },
    { title: 'Révision : Trimestre 2 (4e)', url: `${ROOT}/4eme/p4/revision-t2.html`, level: '4eme', tags: 'trimestre bilan revision révision' },
    { title: 'Évaluation de fin de trimestre 3 (4e)', url: `${ROOT}/4eme/p5/eval-t3.html`, level: '4eme', tags: 'trimestre bilan eval révision' },
    { title: 'Révision : Trimestre 3 (4e)', url: `${ROOT}/4eme/p5/revision-t3.html`, level: '4eme', tags: 'trimestre bilan revision révision' },
    { title: 'Évaluation diagnostique · Ce que tu sais déjà (3e)', url: `${ROOT}/3eme/p1/diagnostique-eleve.html`, level: '3eme', tags: 'diagnostique rentrée évaluation' },
    { title: 'Activité S1, Étude critique d\'un objet connecté (3e)', url: `${ROOT}/3eme/p1/seq1-activite.html`, level: '3eme', tags: 'activite activité séquence 1 période 1 analyse fonctionnelle architecture iot évaluation multicritères analyse fonctionnelle d un objet connecté architecture et flux de données évaluation critique multicritères' },
    { title: 'Cours S1, Étude critique d\'un objet connecté (3e)', url: `${ROOT}/3eme/p1/seq1-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 1 période 1 analyse fonctionnelle architecture iot évaluation multicritères analyse fonctionnelle d un objet connecté architecture et flux de données évaluation critique multicritères' },
    { title: 'Quiz S1, Étude critique d\'un objet connecté (3e)', url: `${ROOT}/3eme/p1/seq1-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 1 période 1 analyse fonctionnelle architecture iot évaluation multicritères analyse fonctionnelle d un objet connecté architecture et flux de données évaluation critique multicritères' },
    { title: 'Évaluation S1, Étude critique d\'un objet connecté (3e)', url: `${ROOT}/3eme/p1/seq1-eval.html`, level: '3eme', tags: 'eval évaluation séquence 1 période 1 analyse fonctionnelle architecture iot évaluation multicritères analyse fonctionnelle d un objet connecté architecture et flux de données évaluation critique multicritères' },
    { title: 'Révision S1, Étude critique d\'un objet connecté (3e)', url: `${ROOT}/3eme/p1/seq1-revision.html`, level: '3eme', tags: 'revision révision séquence 1 période 1 analyse fonctionnelle architecture iot évaluation multicritères analyse fonctionnelle d un objet connecté architecture et flux de données évaluation critique multicritères' },
    { title: 'Version adaptée S1, Étude critique d\'un objet connecté (3e)', url: `${ROOT}/3eme/p1/seq1-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 1 période 1 analyse fonctionnelle architecture iot évaluation multicritères analyse fonctionnelle d un objet connecté architecture et flux de données évaluation critique multicritères' },
    { title: 'Activité S2, IA embarquée : études de cas (3e)', url: `${ROOT}/3eme/p1/seq2-activite.html`, level: '3eme', tags: 'activite activité séquence 2 période 1 voiture autonome robot aspirateur modèle pda slam ia embarquée vs ia cloud étude de cas : la voiture autonome étude de cas : le robot aspirateur' },
    { title: 'Cours S2, IA embarquée : études de cas (3e)', url: `${ROOT}/3eme/p1/seq2-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 2 période 1 voiture autonome robot aspirateur modèle pda slam ia embarquée vs ia cloud étude de cas : la voiture autonome étude de cas : le robot aspirateur' },
    { title: 'Quiz S2, IA embarquée : études de cas (3e)', url: `${ROOT}/3eme/p1/seq2-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 2 période 1 voiture autonome robot aspirateur modèle pda slam ia embarquée vs ia cloud étude de cas : la voiture autonome étude de cas : le robot aspirateur' },
    { title: 'Évaluation S2, IA embarquée : études de cas (3e)', url: `${ROOT}/3eme/p1/seq2-eval.html`, level: '3eme', tags: 'eval évaluation séquence 2 période 1 voiture autonome robot aspirateur modèle pda slam ia embarquée vs ia cloud étude de cas : la voiture autonome étude de cas : le robot aspirateur' },
    { title: 'Révision S2, IA embarquée : études de cas (3e)', url: `${ROOT}/3eme/p1/seq2-revision.html`, level: '3eme', tags: 'revision révision séquence 2 période 1 voiture autonome robot aspirateur modèle pda slam ia embarquée vs ia cloud étude de cas : la voiture autonome étude de cas : le robot aspirateur' },
    { title: 'Version adaptée S2, IA embarquée : études de cas (3e)', url: `${ROOT}/3eme/p1/seq2-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 2 période 1 voiture autonome robot aspirateur modèle pda slam ia embarquée vs ia cloud étude de cas : la voiture autonome étude de cas : le robot aspirateur' },
    { title: 'Activité S3, Éthique et impacts des technologies (3e)', url: `${ROOT}/3eme/p2/seq3-activite.html`, level: '3eme', tags: 'activite activité séquence 3 période 2 débat argumenté cartographie des impacts éco-gestes numériques cartographie des impacts du numérique débat argumenté : faut-il limiter l ia agir pour un numérique responsable' },
    { title: 'Cours S3, Éthique et impacts des technologies (3e)', url: `${ROOT}/3eme/p2/seq3-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 3 période 2 débat argumenté cartographie des impacts éco-gestes numériques cartographie des impacts du numérique débat argumenté : faut-il limiter l ia agir pour un numérique responsable' },
    { title: 'Quiz S3, Éthique et impacts des technologies (3e)', url: `${ROOT}/3eme/p2/seq3-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 3 période 2 débat argumenté cartographie des impacts éco-gestes numériques cartographie des impacts du numérique débat argumenté : faut-il limiter l ia agir pour un numérique responsable' },
    { title: 'Évaluation S3, Éthique et impacts des technologies (3e)', url: `${ROOT}/3eme/p2/seq3-eval.html`, level: '3eme', tags: 'eval évaluation séquence 3 période 2 débat argumenté cartographie des impacts éco-gestes numériques cartographie des impacts du numérique débat argumenté : faut-il limiter l ia agir pour un numérique responsable' },
    { title: 'Révision S3, Éthique et impacts des technologies (3e)', url: `${ROOT}/3eme/p2/seq3-revision.html`, level: '3eme', tags: 'revision révision séquence 3 période 2 débat argumenté cartographie des impacts éco-gestes numériques cartographie des impacts du numérique débat argumenté : faut-il limiter l ia agir pour un numérique responsable' },
    { title: 'Version adaptée S3, Éthique et impacts des technologies (3e)', url: `${ROOT}/3eme/p2/seq3-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 3 période 2 débat argumenté cartographie des impacts éco-gestes numériques cartographie des impacts du numérique débat argumenté : faut-il limiter l ia agir pour un numérique responsable' },
    { title: 'Activité S4, Systèmes automatisés complexes (3e)', url: `${ROOT}/3eme/p2/seq4-activite.html`, level: '3eme', tags: 'activite activité séquence 4 période 2 décomposition fonctionnelle organigrammes serre intelligente décomposition fonctionnelle modélisation par organigramme étude de cas : la barrière automatique' },
    { title: 'Cours S4, Systèmes automatisés complexes (3e)', url: `${ROOT}/3eme/p2/seq4-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 4 période 2 décomposition fonctionnelle organigrammes serre intelligente décomposition fonctionnelle modélisation par organigramme étude de cas : la barrière automatique' },
    { title: 'Quiz S4, Systèmes automatisés complexes (3e)', url: `${ROOT}/3eme/p2/seq4-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 4 période 2 décomposition fonctionnelle organigrammes serre intelligente décomposition fonctionnelle modélisation par organigramme étude de cas : la barrière automatique' },
    { title: 'Évaluation S4, Systèmes automatisés complexes (3e)', url: `${ROOT}/3eme/p2/seq4-eval.html`, level: '3eme', tags: 'eval évaluation séquence 4 période 2 décomposition fonctionnelle organigrammes serre intelligente décomposition fonctionnelle modélisation par organigramme étude de cas : la barrière automatique' },
    { title: 'Révision S4, Systèmes automatisés complexes (3e)', url: `${ROOT}/3eme/p2/seq4-revision.html`, level: '3eme', tags: 'revision révision séquence 4 période 2 décomposition fonctionnelle organigrammes serre intelligente décomposition fonctionnelle modélisation par organigramme étude de cas : la barrière automatique' },
    { title: 'Version adaptée S4, Systèmes automatisés complexes (3e)', url: `${ROOT}/3eme/p2/seq4-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 4 période 2 décomposition fonctionnelle organigrammes serre intelligente décomposition fonctionnelle modélisation par organigramme étude de cas : la barrière automatique' },
    { title: 'Activité S5, Programmation avancée (Arduino / mBlock) (3e)', url: `${ROOT}/3eme/p3/seq5-activite.html`, level: '3eme', tags: 'activite activité séquence 5 période 3 variables opérateurs logiques conditions imbriquées défis variables et opérateurs logiques défis de programmation avancée du pseudo-code au programme mblock' },
    { title: 'Cours S5, Programmation avancée (Arduino / mBlock) (3e)', url: `${ROOT}/3eme/p3/seq5-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 5 période 3 variables opérateurs logiques conditions imbriquées défis variables et opérateurs logiques défis de programmation avancée du pseudo-code au programme mblock' },
    { title: 'Quiz S5, Programmation avancée (Arduino / mBlock) (3e)', url: `${ROOT}/3eme/p3/seq5-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 5 période 3 variables opérateurs logiques conditions imbriquées défis variables et opérateurs logiques défis de programmation avancée du pseudo-code au programme mblock' },
    { title: 'Évaluation S5, Programmation avancée (Arduino / mBlock) (3e)', url: `${ROOT}/3eme/p3/seq5-eval.html`, level: '3eme', tags: 'eval évaluation séquence 5 période 3 variables opérateurs logiques conditions imbriquées défis variables et opérateurs logiques défis de programmation avancée du pseudo-code au programme mblock' },
    { title: 'Révision S5, Programmation avancée (Arduino / mBlock) (3e)', url: `${ROOT}/3eme/p3/seq5-revision.html`, level: '3eme', tags: 'revision révision séquence 5 période 3 variables opérateurs logiques conditions imbriquées défis variables et opérateurs logiques défis de programmation avancée du pseudo-code au programme mblock' },
    { title: 'Version adaptée S5, Programmation avancée (Arduino / mBlock) (3e)', url: `${ROOT}/3eme/p3/seq5-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 5 période 3 variables opérateurs logiques conditions imbriquées défis variables et opérateurs logiques défis de programmation avancée du pseudo-code au programme mblock' },
    { title: 'Activité S6, Tests et mise au point de prototypes (3e)', url: `${ROOT}/3eme/p3/seq6-activite.html`, level: '3eme', tags: 'activite activité séquence 6 période 3 protocole de test 4 types d erreurs débogage méthodique protocole de test débogage méthodique validation et documentation' },
    { title: 'Cours S6, Tests et mise au point de prototypes (3e)', url: `${ROOT}/3eme/p3/seq6-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 6 période 3 protocole de test 4 types d erreurs débogage méthodique protocole de test débogage méthodique validation et documentation' },
    { title: 'Quiz S6, Tests et mise au point de prototypes (3e)', url: `${ROOT}/3eme/p3/seq6-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 6 période 3 protocole de test 4 types d erreurs débogage méthodique protocole de test débogage méthodique validation et documentation' },
    { title: 'Évaluation S6, Tests et mise au point de prototypes (3e)', url: `${ROOT}/3eme/p3/seq6-eval.html`, level: '3eme', tags: 'eval évaluation séquence 6 période 3 protocole de test 4 types d erreurs débogage méthodique protocole de test débogage méthodique validation et documentation' },
    { title: 'Révision S6, Tests et mise au point de prototypes (3e)', url: `${ROOT}/3eme/p3/seq6-revision.html`, level: '3eme', tags: 'revision révision séquence 6 période 3 protocole de test 4 types d erreurs débogage méthodique protocole de test débogage méthodique validation et documentation' },
    { title: 'Version adaptée S6, Tests et mise au point de prototypes (3e)', url: `${ROOT}/3eme/p3/seq6-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 6 période 3 protocole de test 4 types d erreurs débogage méthodique protocole de test débogage méthodique validation et documentation' },
    { title: 'Activité S7, Méthodologie du brevet (3e)', url: `${ROOT}/3eme/p4/seq7-activite.html`, level: '3eme', tags: 'activite activité séquence 7 période 4 lire un document technique justifier une réponse gérer son temps entraînement à la méthode session 2027 découverte : une seule question six copies à noter appliquer les 4 gestes : le kit solaire tsara-30 prélever dans un tableau de caractéristiques : quelle pompe pour la rizière lire un schéma et suivre un organigramme : le portail automatique de l école choisir une lampe pour la salle d étude et découvrir la réponse longue gérer 30 minutes préparer 15 minutes entraînement autonome à la maison : le lampadaire solaire hazavana-40' },
    { title: 'Cours S7, Méthodologie du brevet (3e)', url: `${ROOT}/3eme/p4/seq7-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 7 période 4 lire un document technique justifier une réponse gérer son temps entraînement à la méthode session 2027 découverte : une seule question six copies à noter appliquer les 4 gestes : le kit solaire tsara-30 prélever dans un tableau de caractéristiques : quelle pompe pour la rizière lire un schéma et suivre un organigramme : le portail automatique de l école choisir une lampe pour la salle d étude et découvrir la réponse longue gérer 30 minutes préparer 15 minutes entraînement autonome à la maison : le lampadaire solaire hazavana-40' },
    { title: 'Quiz S7, Méthodologie du brevet (3e)', url: `${ROOT}/3eme/p4/seq7-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 7 période 4 lire un document technique justifier une réponse gérer son temps entraînement à la méthode session 2027 découverte : une seule question six copies à noter appliquer les 4 gestes : le kit solaire tsara-30 prélever dans un tableau de caractéristiques : quelle pompe pour la rizière lire un schéma et suivre un organigramme : le portail automatique de l école choisir une lampe pour la salle d étude et découvrir la réponse longue gérer 30 minutes préparer 15 minutes entraînement autonome à la maison : le lampadaire solaire hazavana-40' },
    { title: 'Évaluation S7, Méthodologie du brevet (3e)', url: `${ROOT}/3eme/p4/seq7-eval.html`, level: '3eme', tags: 'eval évaluation séquence 7 période 4 lire un document technique justifier une réponse gérer son temps entraînement à la méthode session 2027 découverte : une seule question six copies à noter appliquer les 4 gestes : le kit solaire tsara-30 prélever dans un tableau de caractéristiques : quelle pompe pour la rizière lire un schéma et suivre un organigramme : le portail automatique de l école choisir une lampe pour la salle d étude et découvrir la réponse longue gérer 30 minutes préparer 15 minutes entraînement autonome à la maison : le lampadaire solaire hazavana-40' },
    { title: 'Révision S7, Méthodologie du brevet (3e)', url: `${ROOT}/3eme/p4/seq7-revision.html`, level: '3eme', tags: 'revision révision séquence 7 période 4 lire un document technique justifier une réponse gérer son temps entraînement à la méthode session 2027 découverte : une seule question six copies à noter appliquer les 4 gestes : le kit solaire tsara-30 prélever dans un tableau de caractéristiques : quelle pompe pour la rizière lire un schéma et suivre un organigramme : le portail automatique de l école choisir une lampe pour la salle d étude et découvrir la réponse longue gérer 30 minutes préparer 15 minutes entraînement autonome à la maison : le lampadaire solaire hazavana-40' },
    { title: 'Version adaptée S7, Méthodologie du brevet (3e)', url: `${ROOT}/3eme/p4/seq7-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 7 période 4 lire un document technique justifier une réponse gérer son temps entraînement à la méthode session 2027 découverte : une seule question six copies à noter appliquer les 4 gestes : le kit solaire tsara-30 prélever dans un tableau de caractéristiques : quelle pompe pour la rizière lire un schéma et suivre un organigramme : le portail automatique de l école choisir une lampe pour la salle d étude et découvrir la réponse longue gérer 30 minutes préparer 15 minutes entraînement autonome à la maison : le lampadaire solaire hazavana-40' },
    { title: 'Activité S8, Projet Smart Object : de la conception au prototype (3e)', url: `${ROOT}/3eme/p5/seq8-activite.html`, level: '3eme', tags: 'activite activité séquence 8 période 5 du cahier des charges au prototype testé : conception câblage programmation et validation en équipe séance 1 : constituer le groupe choisir le sujet répartir les tâches toutes les séances : le journal de bord du groupe et la ligne individuelle séance 1 : rédiger le cahier des charges du smart object séance 1 : mesurer les composants et calculer les dimensions intérieures du boîtier séance 2 : tableau des composants et schéma de câblage séance 2 : algorithme en pseudo-code puis organigramme séance 2 : croquis coté du boîtier en deux vues puis saisie de la façade sous freecad séance 3 : câbler le montage sur plaque d essai séance 3 : programmer le smart object bloc par bloc séance 4 : assembler le prototype dans son boîtier séance 4 : fiche d essai débogage et remise du dossier projet évalué' },
    { title: 'Cours S8, Projet Smart Object : de la conception au prototype (3e)', url: `${ROOT}/3eme/p5/seq8-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 8 période 5 du cahier des charges au prototype testé : conception câblage programmation et validation en équipe séance 1 : constituer le groupe choisir le sujet répartir les tâches toutes les séances : le journal de bord du groupe et la ligne individuelle séance 1 : rédiger le cahier des charges du smart object séance 1 : mesurer les composants et calculer les dimensions intérieures du boîtier séance 2 : tableau des composants et schéma de câblage séance 2 : algorithme en pseudo-code puis organigramme séance 2 : croquis coté du boîtier en deux vues puis saisie de la façade sous freecad séance 3 : câbler le montage sur plaque d essai séance 3 : programmer le smart object bloc par bloc séance 4 : assembler le prototype dans son boîtier séance 4 : fiche d essai débogage et remise du dossier projet évalué' },
    { title: 'Quiz S8, Projet Smart Object : de la conception au prototype (3e)', url: `${ROOT}/3eme/p5/seq8-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 8 période 5 du cahier des charges au prototype testé : conception câblage programmation et validation en équipe séance 1 : constituer le groupe choisir le sujet répartir les tâches toutes les séances : le journal de bord du groupe et la ligne individuelle séance 1 : rédiger le cahier des charges du smart object séance 1 : mesurer les composants et calculer les dimensions intérieures du boîtier séance 2 : tableau des composants et schéma de câblage séance 2 : algorithme en pseudo-code puis organigramme séance 2 : croquis coté du boîtier en deux vues puis saisie de la façade sous freecad séance 3 : câbler le montage sur plaque d essai séance 3 : programmer le smart object bloc par bloc séance 4 : assembler le prototype dans son boîtier séance 4 : fiche d essai débogage et remise du dossier projet évalué' },
    { title: 'Évaluation S8, Projet Smart Object : de la conception au prototype (3e)', url: `${ROOT}/3eme/p5/seq8-eval.html`, level: '3eme', tags: 'eval évaluation séquence 8 période 5 du cahier des charges au prototype testé : conception câblage programmation et validation en équipe séance 1 : constituer le groupe choisir le sujet répartir les tâches toutes les séances : le journal de bord du groupe et la ligne individuelle séance 1 : rédiger le cahier des charges du smart object séance 1 : mesurer les composants et calculer les dimensions intérieures du boîtier séance 2 : tableau des composants et schéma de câblage séance 2 : algorithme en pseudo-code puis organigramme séance 2 : croquis coté du boîtier en deux vues puis saisie de la façade sous freecad séance 3 : câbler le montage sur plaque d essai séance 3 : programmer le smart object bloc par bloc séance 4 : assembler le prototype dans son boîtier séance 4 : fiche d essai débogage et remise du dossier projet évalué' },
    { title: 'Révision S8, Projet Smart Object : de la conception au prototype (3e)', url: `${ROOT}/3eme/p5/seq8-revision.html`, level: '3eme', tags: 'revision révision séquence 8 période 5 du cahier des charges au prototype testé : conception câblage programmation et validation en équipe séance 1 : constituer le groupe choisir le sujet répartir les tâches toutes les séances : le journal de bord du groupe et la ligne individuelle séance 1 : rédiger le cahier des charges du smart object séance 1 : mesurer les composants et calculer les dimensions intérieures du boîtier séance 2 : tableau des composants et schéma de câblage séance 2 : algorithme en pseudo-code puis organigramme séance 2 : croquis coté du boîtier en deux vues puis saisie de la façade sous freecad séance 3 : câbler le montage sur plaque d essai séance 3 : programmer le smart object bloc par bloc séance 4 : assembler le prototype dans son boîtier séance 4 : fiche d essai débogage et remise du dossier projet évalué' },
    { title: 'Version adaptée S8, Projet Smart Object : de la conception au prototype (3e)', url: `${ROOT}/3eme/p5/seq8-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 8 période 5 du cahier des charges au prototype testé : conception câblage programmation et validation en équipe séance 1 : constituer le groupe choisir le sujet répartir les tâches toutes les séances : le journal de bord du groupe et la ligne individuelle séance 1 : rédiger le cahier des charges du smart object séance 1 : mesurer les composants et calculer les dimensions intérieures du boîtier séance 2 : tableau des composants et schéma de câblage séance 2 : algorithme en pseudo-code puis organigramme séance 2 : croquis coté du boîtier en deux vues puis saisie de la façade sous freecad séance 3 : câbler le montage sur plaque d essai séance 3 : programmer le smart object bloc par bloc séance 4 : assembler le prototype dans son boîtier séance 4 : fiche d essai débogage et remise du dossier projet évalué' },
    { title: 'Activité S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-activite.html`, level: '3eme', tags: 'activite activité séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb' },
    { title: 'Cours S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb' },
    { title: 'Quiz S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb' },
    { title: 'Évaluation S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-eval.html`, level: '3eme', tags: 'eval évaluation séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb' },
    { title: 'Révision S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-revision.html`, level: '3eme', tags: 'revision révision séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb' },
    { title: 'Version adaptée S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb' },
    { title: 'Évaluation : Trimestre 1 (3e)', url: `${ROOT}/3eme/p2/eval-t1.html`, level: '3eme', tags: 'trimestre bilan eval révision' },
    { title: 'Fiche de révision : Trimestre 1 (3e)', url: `${ROOT}/3eme/p2/revision-t1.html`, level: '3eme', tags: 'trimestre bilan revision révision' },
    { title: 'Évaluation : Trimestre 2 (3e)', url: `${ROOT}/3eme/p4/eval-t2.html`, level: '3eme', tags: 'trimestre bilan eval révision' },
    { title: 'Fiche de révision : Trimestre 2 (3e)', url: `${ROOT}/3eme/p4/revision-t2.html`, level: '3eme', tags: 'trimestre bilan revision révision' },
    { title: 'Fiche de révision : Trimestre 3 & DNB (3e)', url: `${ROOT}/3eme/p5/revision-t3.html`, level: '3eme', tags: 'trimestre bilan revision révision' },
// catalogue:fin recherche
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
        <a href="${ROOT}/structuration/index.html" class="nav-item ${activePage === 'structuration' ? 'active' : ''}">\u{1F4D8} Cours</a>
        <a href="${ROOT}/outils/index.html" class="nav-item ${activePage === 'outils' ? 'active' : ''}">\u{1F9F0} Outils</a>
      </div>
    `;
    return nav;
  }

  // ---- BREADCRUMB ----
  function renderBreadcrumb(items) {
    if (!items || items.length === 0) return null;

    // Auto-add URLs for trimester breadcrumb items (T1/T2/T3 or Trimestre 1/2/3)
    items = items.map((item, i) => {
      if (!item.url && item.label && i > 0 && i < items.length - 1) {
        const match = item.label.match(/^T([1-3])\s|^Trimestre\s([1-3])/);
        if (match) {
          const prevItem = items[i - 1];
          if (prevItem && prevItem.url) {
            const trimNum = match[1] || match[2];
            let tabId = 't' + trimNum;
            if (prevItem.label.includes('4')) tabId += '-4';
            else if (prevItem.label.includes('3')) tabId += '-3';
            return { label: item.label, url: prevItem.url + '#' + tabId };
          }
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
            <strong>Technologie · Lyc\u00e9e Fran\u00e7ais de Tananarive</strong><br>
            Ambatobe, Antananarivo, Madagascar
            <div class="footer-aefe">
              R\u00e9seau AEFE : Enseignement fran\u00e7ais \u00e0 l'\u00e9tranger
            </div>
          </div>
        </div>
        <div class="footer-right">
          \u00a9 ${year} Technologie LFT<br>
          <span class="text-xs">Site p\u00e9dagogique : Cycle 4</span>
        </div>
      </div>
    `;
    return footer;
  }

  // ---- VOYANT DE SESSION ----
  // Le cookie de session est HttpOnly : ce script ne peut ni le lire ni
  // l'effacer. Sans le temoin pose a cote de lui, une session laissee ouverte
  // sur un poste de salle informatique est totalement invisible : le bandeau
  // n'affiche rien, et l'eleve suivant en conclut que personne n'est connecte.
  //
  // C'EST UN VOYANT, PAS UNE BARRIERE. Le temoin ne contient ni jeton ni
  // identite, seulement le role. Un eleve peut l'effacer : il n'y gagne rien,
  // le portier decide toujours sur le cookie scelle, que lui ne voit pas.
  //
  // Cout reseau au chargement : ZERO. Lire document.cookie est local. La
  // seule requete part quand quelqu'un clique sur le bouton.
  function lireTemoin() {
    try {
      // Format « role.echeance », l'echeance en secondes Unix. Elle evite que
      // le bandeau survive a la session : un avertissement qui se trompe finit
      // par ne plus etre lu. Lecture purement locale, zero octet de reseau.
      const m = document.cookie.match(/(?:^|;\s*)lft_ouvert=(prof|eleve)\.(\d+)(?:;|$)/);
      if (!m) return null;
      if (Number(m[2]) * 1000 < Date.now()) return null;
      return m[1];
    } catch (e) { return null; }
  }

  function renderVoyantSession() {
    const role = lireTemoin();
    if (!role) return null;

    const prof = role === 'prof';
    const d = document.createElement('div');
    d.className = 'no-print';
    d.setAttribute('role', 'status');
    d.style.cssText =
      'padding:.6rem 1rem;font:500 .9rem/1.45 Roboto,system-ui,sans-serif;' +
      'display:flex;gap:.75rem;align-items:center;justify-content:center;' +
      'flex-wrap:wrap;text-align:center;' +
      (prof ? 'background:#fef2f2;color:#7f1d1d;border-bottom:2px solid #dc2626'
            : 'background:#eff6ff;color:#1e3a5f;border-bottom:2px solid #3b82f6');

    const texte = prof
      ? 'Une session <strong>professeur</strong> est ouverte sur cet ordinateur. '
        + 'Les corrigés et l’espace enseignant sont accessibles depuis ce navigateur.'
      : 'Une session <strong>élève</strong> est ouverte sur cet ordinateur.';

    d.innerHTML = '<span>' + texte + '</span>';

    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Fermer la session';
    b.style.cssText =
      'border:0;border-radius:6px;padding:.4rem .9rem;cursor:pointer;' +
      'font:500 .88rem Raleway,system-ui,sans-serif;color:#fff;' +
      (prof ? 'background:#dc2626' : 'background:#3b82f6');

    // N'EFFACER LE TEMOIN QUE SUR UN 200 CONFIRME.
    //
    // Le cookie de session est HttpOnly : cette page ne peut pas l'effacer.
    // Seul /api/auth/deconnexion le peut. Effacer le temoin sans avoir la
    // preuve que l'appel a abouti ferait donc disparaitre le bandeau en
    // laissant la session VIVANTE : le geste cense proteger supprimerait la
    // seule chose qui avertit l'occupant suivant.
    //
    // Deux pieges a eviter ici : fetch() ne rejette PAS sur un statut 4xx ou
    // 5xx, et un .catch() suivi d'un .then() rend une promesse resolue, donc
    // le .then s'execute aussi apres un echec reseau.
    function echec() {
      b.disabled = false;
      b.textContent = 'Fermer la session';
      const avis = d.querySelector('.lft-avis') || document.createElement('span');
      avis.className = 'lft-avis';
      avis.style.cssText = 'flex-basis:100%;font-weight:600';
      avis.textContent =
        'La session n’a PAS été fermée. Fermez complètement le navigateur : ' +
        'la session meurt avec lui.';
      if (!avis.parentNode) d.appendChild(avis);
    }

    b.addEventListener('click', function () {
      b.disabled = true;
      b.textContent = 'Fermeture…';
      // keepalive : la requete aboutit meme si la page est quittee dans la
      // foulee, ce qui arrive quand on ferme l'onglet juste apres.
      fetch('/api/auth/deconnexion', {
        method: 'POST', credentials: 'same-origin', keepalive: true
      })
      .then(function (r) {
        if (!r || !r.ok) return echec();
        document.cookie = 'lft_ouvert=; Path=/; Max-Age=0; SameSite=Strict';
        location.reload();
      })
      .catch(echec);
    });
    d.appendChild(b);
    return d;
  }

  // ---- PRINT HEADER ----
  // Cosignature conforme a la charte graphique de l'AEFE : logo de l'etablissement
  // a gauche, logo AEFE avec sa declinaison de statut a droite, sur une meme ligne.
  // Le logo AEFE est utilise avec l'ensemble de ses elements et au-dela de sa
  // taille minimale de 25 mm.
  function renderPrintHeader(title, subtitle) {
    const ph = document.createElement('div');
    ph.className = 'print-header';
    ph.innerHTML = `
      <div class="ph-etab">
        <img src="${ROOT}/img/logo-lft.png" alt="Lyc\u00e9e Fran\u00e7ais de Tananarive">
        <div class="ph-etab-texte">
          <strong>Lyc\u00e9e Fran\u00e7ais de Tananarive</strong>
          <span>Ambatobe, Antananarivo \u00b7 Madagascar</span>
        </div>
      </div>
      <div class="ph-doc">
        <strong>Technologie \u00b7 Cycle 4</strong>
        <span>Ann\u00e9e scolaire 2026-2027</span>
      </div>
      <img class="ph-aefe" src="${ROOT}/img/aefe-egd-monochrome.png"
           alt="AEFE \u2013 \u00e9tablissement en gestion directe">
    `;
    return ph;
  }

  // ---- BLOC IDENTITE ELEVE ----
  // Ajoute a l'impression sur les documents destines a l'eleve, jamais sur les
  // fiches professeur. Inspire des trames de l'academie de Bordeaux.
  function renderPrintIdentite(title) {
    // La fiche EBEP decrit les besoins nommes de l'eleve (« trouble du langage
    // ecrit », « trouble de l'attention ») : elle s'adresse au professeur et ne
    // se remet pas a l'eleve. Pas de bloc identite dessus.
    const pourEleve = !/professeur|fiche prof|corrig|ebep|adaptation/i.test(title || '');
    if (!pourEleve) return null;
    const d = document.createElement('div');
    d.className = 'print-identite';
    d.innerHTML = `
      <div class="pi-ligne">
        <span class="pi-champ">Nom : ....................................</span>
        <span class="pi-champ">Pr\u00e9nom : ....................................</span>
      </div>
      <div class="pi-ligne">
        <span class="pi-champ">Classe : ....................</span>
        <span class="pi-champ">Date : ........ / ........ / 20........</span>
        <span class="pi-champ">Groupe : ....................</span>
      </div>
    `;
    return d;
  }

  // ---- PIED DE FICHE ----
  function renderPrintPied() {
    const d = document.createElement('div');
    d.className = 'print-pied';
    const code = document.querySelector('.lien-code');
    d.innerHTML = `
      <span>Technologie \u00b7 Lyc\u00e9e Fran\u00e7ais de Tananarive \u00b7 2026-2027</span>
      <span>${code ? 'Fiche ' + code.textContent.trim() : ''}</span>
    `;
    return d;
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

    // Bloc identite eleve et pied de fiche, a l'impression uniquement
    const mainPourImpression = app.querySelector('.site-main');
    if (mainPourImpression) {
      const ident = renderPrintIdentite(printTitle);
      const entete = mainPourImpression.querySelector('.page-header');
      if (ident && entete) entete.insertAdjacentElement('afterend', ident);
      mainPourImpression.appendChild(renderPrintPied());
    }

    // Voyant de session, tout en haut : c'est la premiere chose que voit
    // l'eleve suivant qui s'installe devant le poste.
    const voyant = renderVoyantSession();
    if (voyant) parent.insertBefore(voyant, app);

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
