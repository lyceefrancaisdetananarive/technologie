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
    { title: 'Activité S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-activite.html`, level: '5eme', tags: 'activite activité séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année équipe sujet et cahier des charges croquis cotés modélisation 3d sur tinkercad fabrication du prototype tests et améliorations présentation du projet et bilan' },
    { title: 'Cours S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-structuration.html`, level: '5eme', tags: 'structuration cours cours séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année équipe sujet et cahier des charges croquis cotés modélisation 3d sur tinkercad fabrication du prototype tests et améliorations présentation du projet et bilan' },
    { title: 'Quiz S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-quiz.html`, level: '5eme', tags: 'quiz quiz séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année équipe sujet et cahier des charges croquis cotés modélisation 3d sur tinkercad fabrication du prototype tests et améliorations présentation du projet et bilan' },
    { title: 'Évaluation S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-eval.html`, level: '5eme', tags: 'eval évaluation séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année équipe sujet et cahier des charges croquis cotés modélisation 3d sur tinkercad fabrication du prototype tests et améliorations présentation du projet et bilan' },
    { title: 'Révision S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-revision.html`, level: '5eme', tags: 'revision révision séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année équipe sujet et cahier des charges croquis cotés modélisation 3d sur tinkercad fabrication du prototype tests et améliorations présentation du projet et bilan' },
    { title: 'Version adaptée S9, Projet de groupe : concevoir un objet technique (5e)', url: `${ROOT}/5eme/p5/seq9-ebep.html`, level: '5eme', tags: 'ebep version adaptée séquence 9 période 5 démarche de projet prototype fablab imprimante 3d bilan de l année équipe sujet et cahier des charges croquis cotés modélisation 3d sur tinkercad fabrication du prototype tests et améliorations présentation du projet et bilan' },
    { title: 'Fiche de révision : Trimestre 1 (5e)', url: `${ROOT}/5eme/p2/revision-t1.html`, level: '5eme', tags: 'trimestre bilan revision révision' },
    { title: 'Évaluation bilan : Trimestre 2 (5e)', url: `${ROOT}/5eme/p4/eval-t2.html`, level: '5eme', tags: 'trimestre bilan eval révision' },
    { title: 'Fiche de révision : Trimestre 2 (5e)', url: `${ROOT}/5eme/p4/revision-t2.html`, level: '5eme', tags: 'trimestre bilan revision révision' },
    { title: 'Fiche de révision : Trimestre 3 (5e)', url: `${ROOT}/5eme/p5/revision-t3.html`, level: '5eme', tags: 'trimestre bilan revision révision' },
    { title: 'Évaluation diagnostique · Ce que tu sais déjà (4e)', url: `${ROOT}/4eme/p1/diagnostique-eleve.html`, level: '4eme', tags: 'diagnostique rentrée évaluation' },
    { title: 'Activité S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-activite.html`, level: '4eme', tags: 'activite activité séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique observer le tourniquet et analyser ses fonctions dessin technique du tourniquet notion d algorithme : le fonctionnement du tourniquet' },
    { title: 'Cours S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-structuration.html`, level: '4eme', tags: 'structuration cours cours séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique observer le tourniquet et analyser ses fonctions dessin technique du tourniquet notion d algorithme : le fonctionnement du tourniquet' },
    { title: 'Quiz S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-quiz.html`, level: '4eme', tags: 'quiz quiz séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique observer le tourniquet et analyser ses fonctions dessin technique du tourniquet notion d algorithme : le fonctionnement du tourniquet' },
    { title: 'Évaluation S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-eval.html`, level: '4eme', tags: 'eval évaluation séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique observer le tourniquet et analyser ses fonctions dessin technique du tourniquet notion d algorithme : le fonctionnement du tourniquet' },
    { title: 'Révision S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-revision.html`, level: '4eme', tags: 'revision révision séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique observer le tourniquet et analyser ses fonctions dessin technique du tourniquet notion d algorithme : le fonctionnement du tourniquet' },
    { title: 'Version adaptée S1, Analyse fonctionnelle d\'un système automatisé (4e)', url: `${ROOT}/4eme/p1/seq1-ebep.html`, level: '4eme', tags: 'ebep version adaptée séquence 1 période 1 tourniquet pleine hauteur zkteco observation analyse fonctionnelle fiche technique observer le tourniquet et analyser ses fonctions dessin technique du tourniquet notion d algorithme : le fonctionnement du tourniquet' },
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
    { title: 'Activité S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-activite.html`, level: '3eme', tags: 'activite activité séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb préparer la soutenance orale répétition et capsule vidéo soutenances et bilan de l année' },
    { title: 'Cours S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-structuration.html`, level: '3eme', tags: 'structuration cours cours séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb préparer la soutenance orale répétition et capsule vidéo soutenances et bilan de l année' },
    { title: 'Quiz S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-quiz.html`, level: '3eme', tags: 'quiz quiz séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb préparer la soutenance orale répétition et capsule vidéo soutenances et bilan de l année' },
    { title: 'Évaluation S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-eval.html`, level: '3eme', tags: 'eval évaluation séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb préparer la soutenance orale répétition et capsule vidéo soutenances et bilan de l année' },
    { title: 'Révision S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-revision.html`, level: '3eme', tags: 'revision révision séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb préparer la soutenance orale répétition et capsule vidéo soutenances et bilan de l année' },
    { title: 'Version adaptée S9, Soutenance et présentation du projet (3e)', url: `${ROOT}/3eme/p5/seq9-ebep.html`, level: '3eme', tags: 'ebep version adaptée séquence 9 période 5 soutenance orale capsule vidéo bilan et dnb préparer la soutenance orale répétition et capsule vidéo soutenances et bilan de l année' },
    { title: 'Évaluation : Trimestre 1 (3e)', url: `${ROOT}/3eme/p2/eval-t1.html`, level: '3eme', tags: 'trimestre bilan eval révision' },
    { title: 'Fiche de révision : Trimestre 1 (3e)', url: `${ROOT}/3eme/p2/revision-t1.html`, level: '3eme', tags: 'trimestre bilan revision révision' },
    { title: 'Évaluation : Trimestre 2 (3e)', url: `${ROOT}/3eme/p4/eval-t2.html`, level: '3eme', tags: 'trimestre bilan eval révision' },
    { title: 'Fiche de révision : Trimestre 2 (3e)', url: `${ROOT}/3eme/p4/revision-t2.html`, level: '3eme', tags: 'trimestre bilan revision révision' },
    { title: 'Fiche de révision : Trimestre 3 & DNB (3e)', url: `${ROOT}/3eme/p5/revision-t3.html`, level: '3eme', tags: 'trimestre bilan revision révision' },
// catalogue:fin recherche
  ];

  // ---- PICTOGRAMMES ----
  // Les pages portent des emojis dans des <span class="ico">. Ils s'affichent
  // différemment selon Windows, Android ou l'imprimante. À l'écran, ceux qui
  // ont un équivalent sont remplacés par un tracé SVG en couleur courante ;
  // les autres restent tels quels. Le HTML des 234 pages n'est pas touché.
  const TRAIT = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const PICTOS = {
    '⬜': '<rect x="4" y="4" width="16" height="16" rx="3"/>',                                   // case à cocher
    '✅': '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12.5l2.7 2.7L16.5 9"/>', // coché
    '\u{1F5A8}': '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
    '\u{1F4DD}': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',      // activité
    '✏': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    '\u{1F517}': '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
    '❓': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7"/><path d="M12 17h.01"/>', // quiz
    '\u{1F4D8}': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', // cours
    '\u{1F4D7}': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h7"/>', // prof
    '\u{1F4D2}': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    '\u{1F4D6}': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', // révision
    '\u{1F4DA}': '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    '\u{1F4A1}': '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
    '\u{1F4CC}': '<path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    '\u{1F3AC}': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M7 4v5M12 4v5M17 4v5"/>',
    '\u{1F4E4}': '<path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/>',
    '♿': '<circle cx="12" cy="4.5" r="2"/><path d="M8.5 9.5l3.5.5v5l3.5 4"/><path d="M15.5 10.5H12"/><path d="M6.5 13a5.5 5.5 0 0 0 8 6.5"/>',
    '\u{1F4CA}': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    '\u{1F4CB}': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 11h6M9 15h4"/>',
    '\u{1F3AF}': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    '\u{1F4C5}': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    '→': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    '⬇': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    '\u{1F4CE}': '<path d="M21 11.5 12.5 20a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.5 3.5 0 0 1 5 5L9.7 17.2a1.5 1.5 0 0 1-2.1-2.1L15.5 7"/>',
    '⭐': '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/>',
    '\u{1F9ED}': '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    '\u{1F511}': '<circle cx="8" cy="15" r="4"/><path d="M10.9 12.1 20 3M15 8l3 3M12 11l3 3"/>',
    '\u{1F4F1}': '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 18h.01"/>',
    '⚡': '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    '⚠': '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/>',
    '\u{1F393}': '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>',
    '\u{1F9F0}': '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V4h8v3M2 13h20"/>',
    '\u{1F50D}': '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    '\u{1F501}': '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    '⚙': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    '\u{1F3E0}': '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    '\u{1F4CF}': '<path d="M3 17 17 3l4 4L7 21z"/><path d="M14 6l1.5 1.5M11 9l1.5 1.5M8 12l1.5 1.5"/>',
    '\u{1F5A5}': '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    '\u{1F4BE}': '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    '\u{1F512}': '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    '\u{1F513}': '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    '\u{1F4FD}': '<circle cx="8" cy="8" r="4"/><circle cx="16" cy="8" r="4"/><path d="M4 12h16v7H4zM12 19v3"/>',
    '\u{1F465}': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    '\u{1F5D1}': '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    '\u{1F441}': '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    '\u{1F4C4}': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    '\u{1F9EA}': '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/>',
    '\u{1F535}': 'point', '\u{1F7E2}': 'point', '\u{1F7E0}': 'point',
  };
  function svgPicto(cle) {
    const p = PICTOS[cle];
    if (!p) return null;
    if (p === 'point') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>';
    return `<svg viewBox="0 0 24 24" ${TRAIT} aria-hidden="true">${p}</svg>`;
  }
  function remplacerPictos(racine) {
    (racine || document).querySelectorAll('span.ico').forEach(function (sp) {
      if (sp.querySelector('svg')) return;
      const t = sp.textContent.trim().replace(/️/g, '');
      const svg = svgPicto(t);
      if (svg) { sp.innerHTML = svg; sp.classList.add('ico-svg'); }
    });
  }

  // ---- HEADER ----
  function renderHeader() {
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `
      <div class="header-inner">
        <a href="${ROOT}/index.html" class="header-brand">
          <img src="${ROOT}/img/logo-lft.png" alt="" class="header-logo">
          <div class="header-title">
            <span class="header-title-main">Technologie</span>
            <span class="header-title-sub">Lycée Français de Tananarive</span>
          </div>
        </a>
        <div class="header-search">
          <span class="header-search-icon">${svgPicto('\u{1F50D}')}</span>
          <input type="search" placeholder="Rechercher une séquence, un quiz…" id="search-input" autocomplete="off" aria-label="Rechercher dans le site">
          <div class="search-results" id="search-results"></div>
        </div>
        <div class="header-session" id="header-session"></div>
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu" aria-expanded="false">
          <svg viewBox="0 0 24 24" ${TRAIT}><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
    `;
    return header;
  }

  // ---- NAVIGATION ----
  function renderNav(activePage) {
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.id = 'site-nav';
    nav.setAttribute('aria-label', 'Navigation principale');
    const item = (href, page, label, level) =>
      `<a href="${ROOT}/${href}" class="nav-item ${activePage === page ? 'active' : ''}"${level ? ` data-level="${level}"` : ''}${activePage === page ? ' aria-current="page"' : ''}>${level ? '<span class="pastille-niveau" aria-hidden="true"></span>' : ''}${label}</a>`;
    nav.innerHTML = `
      <div class="nav-inner">
        ${item('index.html', 'home', 'Accueil')}
        <div class="nav-separator"></div>
        ${item('5eme/index.html', '5eme', '5e', '5eme')}
        ${item('4eme/index.html', '4eme', '4e', '4eme')}
        ${item('3eme/index.html', '3eme', '3e', '3eme')}
        <div class="nav-separator"></div>
        ${item('structuration/index.html', 'structuration', 'Cours')}
        ${item('outils/index.html', 'outils', 'Outils')}
      </div>
    `;
    return nav;
  }

  // ---- BREADCRUMB ----
  function renderBreadcrumb(items) {
    if (!items || items.length === 0) return null;
    const bc = document.createElement('div');
    bc.className = 'breadcrumb';
    bc.setAttribute('aria-label', 'Fil d’Ariane');
    const parts = items.map((item, i) => {
      if (i === items.length - 1) return `<span class="breadcrumb-current">${item.label}</span>`;
      if (item.url) return `<a href="${item.url}">${item.label}</a><span class="breadcrumb-sep">›</span>`;
      return `<span>${item.label}</span><span class="breadcrumb-sep">›</span>`;
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
          <img src="${ROOT}/img/logo-lft.png" alt="" class="footer-logo">
          <div class="footer-text">
            <strong>Technologie · Lycée Français de Tananarive</strong><br>
            Ambatobe, Antananarivo, Madagascar · réseau AEFE
            <div class="footer-liens">
              <a href="${ROOT}/structuration/index.html">Cours</a>
              <a href="${ROOT}/outils/index.html">Outils</a>
              <a href="${ROOT}/parents.html">Parents</a>
              <a href="${ROOT}/enseignant/index.html">Espace enseignant</a>
            </div>
          </div>
        </div>
        <div class="footer-right">
          techlft.egd.mg · ${year}<br>
          <span class="text-xs">Site pédagogique du cycle 4, public par défaut : aucun compte n’est nécessaire pour lire un cours.</span>
        </div>
      </div>
    `;
    return footer;
  }

  // ---- SESSION ----
  // Le cookie de session est HttpOnly : ce script ne peut ni le lire ni
  // l'effacer. Un temoin non-HttpOnly pose a cote de lui dit seulement le
  // role et l'echeance. C'EST UN VOYANT, PAS UNE BARRIERE : l'eleve peut
  // l'effacer, il n'y gagne rien, le portier decide sur le cookie scelle.
  // Cout reseau au chargement : zero. La seule requete part au clic sur
  // « fermer ».
  function lireTemoin() {
    try {
      const m = document.cookie.match(/(?:^|;\s*)lft_ouvert=(prof|eleve)\.(\d+)(?:;|$)/);
      if (!m) return null;
      if (Number(m[2]) * 1000 < Date.now()) return null;
      return m[1];
    } catch (e) { return null; }
  }

  function renderSession(activePage) {
    const zone = document.getElementById('header-session');
    if (!zone) return;
    const role = lireTemoin();
    if (!role) {
      if (activePage === 'connexion') return;
      // Chaque eleve ouvre sa session a chaque seance (decision D15) : le
      // bouton est dans l'en-tete de toutes les pages, et ramene ici apres.
      const suite = encodeURIComponent(location.pathname + location.search);
      zone.innerHTML = `<a class="btn btn-sm" href="${ROOT}/connexion.html?suite=${suite}">${svgPicto('\u{1F511}')}<span class="txt">Se connecter</span></a>`;
      return;
    }
    const prof = role === 'prof';
    const pile = document.createElement('span');
    pile.className = 'session-pile' + (prof ? ' prof' : '');
    pile.setAttribute('role', 'status');
    pile.innerHTML = `<span class="ini">${prof ? 'P' : 'E'}</span><span class="txt">Session ${prof ? 'professeur' : 'élève'} ouverte</span>`;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fermer'; b.textContent = 'Fermer ma session';
    b.title = 'Fermer la session sur cet ordinateur';
    // N'EFFACER LE TEMOIN QUE SUR UN 200 CONFIRME : sinon le voyant
    // disparaitrait en laissant la session vivante, et l'occupant suivant
    // du poste ne serait plus averti. fetch() ne rejette pas sur un 4xx.
    function echec() {
      b.disabled = false; b.textContent = 'Fermer ma session';
      let avis = document.getElementById('session-avis');
      if (!avis) {
        avis = document.createElement('div'); avis.id = 'session-avis'; avis.className = 'session-avis no-print';
        avis.style.cssText = 'text-align:center;padding:.4rem 1rem;background:#FEE2E2;border-bottom:1px solid #F5B7BF';
        document.querySelector('.site-header').insertAdjacentElement('afterend', avis);
      }
      avis.textContent = 'La session n’a PAS été fermée. Fermez complètement le navigateur : la session meurt avec lui.';
    }
    b.addEventListener('click', function () {
      b.disabled = true; b.textContent = 'Fermeture…';
      fetch('/api/auth/deconnexion', { method: 'POST', credentials: 'same-origin', keepalive: true })
        .then(function (r) {
          if (!r || !r.ok) return echec();
          document.cookie = 'lft_ouvert=; Path=/; Max-Age=0; SameSite=Strict';
          location.reload();
        })
        .catch(echec);
    });
    pile.appendChild(b);
    zone.innerHTML = '';
    zone.appendChild(pile);
    document.documentElement.dataset.session = role;

    // Sur l'accueil, un raccourci vers l'espace de la personne connectee
    const reprise = document.getElementById('accueil-reprise');
    if (reprise) {
      reprise.hidden = false;
      reprise.innerHTML = prof
        ? `<div><b>Session professeur ouverte</b><span>Vos groupes, les dépôts à corriger, les fiches professeur.</span></div><a class="btn" href="${ROOT}/enseignant/index.html">Mon espace</a>`
        : `<div><b>Session élève ouverte</b><span>Ton classeur : déposer un travail, retrouver les retours de ton professeur.</span></div><a class="btn" href="${ROOT}/classeur/index.html">Mon classeur</a>`;
    }
  }

  // ---- EN-TETE DE SEQUENCE ----
  // Sur une page de sequence, le catalogue (js/catalogue.js) dit tout ce que
  // la page hesitait a dire elle-meme : theme, nombre de seances, place dans
  // l'annee, et les documents freres. Un seul endroit a corriger.
  function trouverSequence() {
    const m = location.pathname.match(/\/([345]eme)\/p(\d)\/(seq\d+)-(activite|structuration|quiz|eval|revision|ebep|prof)\.html$/);
    if (!m || !window.CATALOGUE) return null;
    const niv = window.CATALOGUE.niveaux[m[1]];
    if (!niv) return null;
    const seq = niv.sequences.find(s => s.cle === m[3] && s.periode === Number(m[2]));
    if (!seq) return null;
    const doc = m[4] === 'structuration' ? 'cours' : m[4];
    return { niveau: m[1], niv, seq, doc, total: niv.sequences.length };
  }

  function renderFicheTete(ctx) {
    const { niveau, niv, seq, doc, total } = ctx;
    const theme = window.CATALOGUE.themes[String(seq.theme)] || (seq.theme === 0 ? 'Transversal' : '');
    const libelles = { activite: ['Activité', 'ce que tu fais en classe'], cours: ['Cours', 'structuration des connaissances'],
      quiz: ['Quiz', 'pour vérifier'], eval: ['Évaluation', 'en classe'], revision: ['Révision', 'avant l’évaluation'],
      ebep: ['Version adaptée', 'même activité, autrement'], prof: ['Fiche professeur', 'réservée'] };
    const prof = lireTemoin() === 'prof';
    const onglets = ['activite', 'cours', 'quiz', 'eval', 'revision', 'ebep', 'prof'].filter(k => seq.documents[k]).filter(k => {
      if (k === 'prof') return prof || doc === 'prof';
      if (k === 'ebep') return prof || doc === 'ebep';
      return true;
    }).map(k => {
      const f = seq.documents[k].fichier;
      const href = ROOT + '/' + f;
      const cur = k === doc ? ' aria-current="page"' : '';
      return `<a href="${href}" class="${k === 'prof' ? 'reserve' : ''}"${cur}>${libelles[k][0]}<small>${libelles[k][1]}</small></a>`;
    }).join('');
    const tete = document.createElement('div');
    tete.className = 'fiche-tete-bloc';
    tete.innerHTML = `
      <div class="fiche-tete">
        <div class="meta">
          <span class="chip level-${niveau}">${niv.libelle} · Période ${seq.periode}</span>
          <span class="chip">Séquence ${seq.n} sur ${total}</span>
          <span class="chip">${seq.seances} séances</span>
          ${theme ? `<span class="chip">${seq.theme ? 'Thème ' + seq.theme + ' · ' : ''}${theme}</span>` : ''}
        </div>
      </div>
      <nav class="docs" aria-label="Documents de la séquence">${onglets}</nav>`;
    return tete;
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
    // La version adaptee est remise a l'eleve comme les autres fiches (elle
    // ne porte plus d'etiquette, decision D15) : elle recoit le bloc identite.
    // Les fiches professeur et les corriges, non.
    const pourEleve = !/professeur|fiche prof|corrig/i.test(title || '');
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

    const labels = { '5eme': '5e', '4eme': '4e', '3eme': '3e' };

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
        results.innerHTML = '<div class="search-result-item text-muted">Aucun r\u00e9sultat</div>';
      } else {
        results.innerHTML = matches.map(item => {
          const badge = item.level && labels[item.level]
            ? `<span class="search-result-badge level-${item.level}">${labels[item.level]}</span>` : '';
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

    const ouvert = `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M6 6l12 12M18 6 6 18"/></svg>`;
    const ferme = `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;
    toggle.addEventListener('click', function () {
      const o = nav.classList.toggle('open');
      this.innerHTML = o ? ouvert : ferme;
      this.setAttribute('aria-expanded', o ? 'true' : 'false');
    });
    nav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => { nav.classList.remove('open'); toggle.innerHTML = ferme; toggle.setAttribute('aria-expanded', 'false'); });
    });
  }

  // ---- TAB SYSTEM ----
  function initTabs() {
    document.querySelectorAll('.trimester-tabs, .period-tabs').forEach(tabContainer => {
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
  // Le moteur de quiz reconstruit ses boutons apres le chargement : il
  // rappelle le remplacement des pictos sur son propre conteneur.
  window.remplacerPictos = remplacerPictos;
  window.lireTemoin = lireTemoin;

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
    const parent = app.parentNode;

    // Accent du niveau sur toute la page
    const niv = (location.pathname.match(/\/([345]eme)\//) || [])[1];
    if (niv) document.body.classList.add('niveau-' + niv);

    // Impression : en-tete cosigne, bloc identite, pied de fiche
    parent.insertBefore(renderPrintHeader(printTitle, printSubtitle), app);
    const mainPourImpression = app.querySelector('.site-main');
    if (mainPourImpression) {
      const ident = renderPrintIdentite(printTitle);
      const entete = mainPourImpression.querySelector('.page-header');
      if (ident && entete) entete.insertAdjacentElement('afterend', ident);
      mainPourImpression.appendChild(renderPrintPied());
    }

    parent.insertBefore(renderHeader(), app);
    parent.insertBefore(renderNav(activePage), app);
    renderSession(activePage);

    if (breadcrumbData) {
      const mainEl = app.querySelector('.site-main') || app;
      const bc = renderBreadcrumb(breadcrumbData);
      if (bc) mainEl.insertBefore(bc, mainEl.firstChild);
    }

    // En-tete de sequence, apres le titre de la page, depuis le catalogue
    function poserFicheTete() {
      const ctx = trouverSequence();
      if (!ctx) return;
      const entete = app.querySelector('.page-header');
      if (!entete || app.querySelector('.fiche-tete-bloc')) return;
      entete.insertAdjacentElement('afterend', renderFicheTete(ctx));
      entete.classList.add('avec-fiche-tete');
    }
    if (window.CATALOGUE) poserFicheTete();
    else if (/\/[345]eme\/p\d\/seq\d+-/.test(location.pathname)) {
      const sc = document.createElement('script');
      sc.src = ROOT + '/js/catalogue.js';
      sc.onload = poserFicheTete;
      document.head.appendChild(sc);
    }

    parent.insertBefore(renderFooter(), app.nextSibling);

    // Un tableau large defile dans son propre cadre plutot que d'elargir la
    // page : sur un telephone, le bandeau de depot restait hors de l'ecran.
    document.querySelectorAll('.site-main table').forEach(function (t) {
      if (t.closest('.table-scroll')) return;
      const w = document.createElement('div'); w.className = 'table-scroll';
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });

    remplacerPictos(document);
    initSearch();
    initMobileMenu();
    initTabs();
    initCardLinks();
    marquerProgressionEleve();
  }

  // ---- LA CARTE DE L'ANNEE SUR LES PAGES DE NIVEAU ----
  // Un eleve dont la session est ouverte voit, sur l'index de son niveau,
  // l'etat de chaque sequence pour SON groupe : fait, en cours, a venir,
  // pas cette annee, et son badge. C'est un affichage : les liens restent
  // ouverts, la page reste publique, rien n'est ecrit dans le navigateur.
  // Aucune requete sans temoin de session eleve : les visiteurs anonymes et
  // les professeurs ne paient rien.
  function marquerProgressionEleve() {
    if (lireTemoin() !== 'eleve') return;
    const cartes = document.querySelectorAll('.seq-card[data-id]');
    if (!cartes.length) return;
    fetch('/api/classeur/progression', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.groupes || !d.groupes.length) return;
        const libelle = { fait: 'Fait', encours: 'En cours', avenir: '\u00c0 venir', masquee: 'Pas cette ann\u00e9e' };
        cartes.forEach(function (c) {
          const id = c.getAttribute('data-id');
          // Le premier groupe dont le plan porte cette sequence decide.
          let g = null, p = null;
          for (const gr of d.groupes) {
            p = gr.plan.find(function (x) { return x.sequence === id; });
            if (p) { g = gr; break; }
          }
          if (!g) return;
          let etat = 'masquee';
          if (p.visible) {
            const faites = g.avancement.filter(function (a) { return a.sequence === id; }).length;
            const total = p.seances || 0;
            etat = total && faites >= total ? 'fait' : faites > 0 ? 'encours' : 'avenir';
          }
          c.classList.add('seq-' + etat);
          const s = document.createElement('span');
          s.className = 'seq-etat seq-etat-' + etat;
          s.textContent = libelle[etat];
          const h = c.querySelector('h3');
          if (h) h.parentNode.insertBefore(s, h);
          if ((g.badges || []).indexOf(id) >= 0) {
            const b = document.createElement('span');
            b.className = 'seq-badge';
            b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5"/></svg> Badge';
            if (h) h.appendChild(b);
          }
        });
      })
      .catch(function () { /* la carte est un plus, jamais une barriere */ });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
