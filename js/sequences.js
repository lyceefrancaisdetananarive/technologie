// =====================================================================
// Ce que les élèves peuvent déposer, par niveau.
//
// Volontairement un simple fichier, pas une table de base de données :
// ajouter une séquence en cours d'année doit se faire en une ligne, sans
// écran d'administration à construire ni à maintenir. Modifiez, poussez,
// c'est en ligne.
// =====================================================================

// catalogue:debut sequences
export const SEQUENCES = {
  '5eme': [
    { id: '5eme/p1/diagnostique', titre: 'Évaluation diagnostique · Ce que tu sais déjà' },
    { id: '5eme/p1/seq1', titre: 'Séquence 1 · Découverte des objets techniques' },
    { id: '5eme/p1/seq2', titre: 'Séquence 2 · L\'évolution des objets techniques' },
    { id: '5eme/p2/seq3', titre: 'Séquence 3 · Cycle de vie et impact environnemental' },
    { id: '5eme/p2/seq4', titre: 'Séquence 4 · Structure interne des objets techniques' },
    { id: '5eme/p3/seq5', titre: 'Séquence 5 · Transmission et transformation de mouvement' },
    { id: '5eme/p3/seq6', titre: 'Séquence 6 · Initiation à la programmation' },
    { id: '5eme/p4/seq7', titre: 'Séquence 7 · Modélisation 3D et conception' },
    { id: '5eme/p5/seq8', titre: 'Séquence 8 · IA, objets connectés et réparabilité' },
    { id: '5eme/p5/seq9', titre: 'Séquence 9 · Projet de groupe : concevoir un objet technique' },
  ],
  '4eme': [
    { id: '4eme/p1/diagnostique', titre: 'Évaluation diagnostique · Ce que tu sais déjà' },
    { id: '4eme/p1/seq1', titre: 'Séquence 1 · Analyse fonctionnelle d\'un système automatisé' },
    { id: '4eme/p1/seq2', titre: 'Séquence 2 · Algorithme et logique de programmation' },
    { id: '4eme/p2/seq3', titre: 'Séquence 3 · Programmation d\'objets connectés (Micro:bit)' },
    { id: '4eme/p2/seq4', titre: 'Séquence 4 · Cahier des charges et documentation technique' },
    { id: '4eme/p3/seq5', titre: 'Séquence 5 · Programmation et automatisation (mBlock / Scratch)' },
    { id: '4eme/p3/seq6', titre: 'Séquence 6 · Programmation Arduino' },
    { id: '4eme/p4/seq7', titre: 'Séquence 7 · Modélisation 3D et fabrication numérique' },
    { id: '4eme/p5/seq8', titre: 'Séquence 8 · Chaîne d\'énergie et chaîne d\'information' },
    { id: '4eme/p5/seq9', titre: 'Séquence 9 · Du besoin au prototype : concevoir et fabriquer un objet technique programmé' },
  ],
  '3eme': [
    { id: '3eme/p1/diagnostique', titre: 'Évaluation diagnostique · Ce que tu sais déjà' },
    { id: '3eme/p1/seq1', titre: 'Séquence 1 · Étude critique d\'un objet connecté' },
    { id: '3eme/p1/seq2', titre: 'Séquence 2 · IA embarquée : études de cas' },
    { id: '3eme/p2/seq3', titre: 'Séquence 3 · Éthique et impacts des technologies' },
    { id: '3eme/p2/seq4', titre: 'Séquence 4 · Systèmes automatisés complexes' },
    { id: '3eme/p3/seq5', titre: 'Séquence 5 · Programmation avancée (Arduino / mBlock)' },
    { id: '3eme/p3/seq6', titre: 'Séquence 6 · Tests et mise au point de prototypes' },
    { id: '3eme/p4/seq7', titre: 'Séquence 7 · Méthodologie du brevet' },
    { id: '3eme/p5/seq8', titre: 'Séquence 8 · Projet Smart Object : de la conception au prototype' },
    { id: '3eme/p5/seq9', titre: 'Séquence 9 · Soutenance et présentation du projet' },
  ],
};
// catalogue:fin sequences

export const DOCUMENTS = [
  { id: 'activite', titre: 'Fiche d’activité' },
  { id: 'eval', titre: 'Évaluation' },
  { id: 'projet', titre: 'Document de projet' },
  { id: 'autre', titre: 'Autre document' },
];
