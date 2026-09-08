// =====================================================================
// Ce que les élèves peuvent déposer, par niveau.
//
// Volontairement un simple fichier, pas une table de base de données :
// ajouter une séquence en cours d'année doit se faire en une ligne, sans
// écran d'administration à construire ni à maintenir. Modifiez, poussez,
// c'est en ligne.
// =====================================================================

export const SEQUENCES = {
  '5eme': [
    { id: '5eme/p1/seq1', titre: 'Séquence 1 · Objets techniques du quotidien' },
    { id: '5eme/p1/seq2', titre: 'Séquence 2 · Besoin et fonction d’usage' },
    { id: '5eme/p2/seq3', titre: 'Séquence 3 · Matériaux et familles' },
  ],
  '4eme': [
    { id: '4eme/p1/seq1', titre: 'Séquence 1 · Chaîne d’énergie' },
    { id: '4eme/p1/seq2', titre: 'Séquence 2 · Chaîne d’information' },
    { id: '4eme/p2/seq3', titre: 'Séquence 3 · Programmation et capteurs' },
  ],
  '3eme': [
    { id: '3eme/p1/diagnostique', titre: 'Évaluation diagnostique de rentrée' },
    { id: '3eme/p1/seq1', titre: 'Séquence 1 · Analyser un objet technique' },
    { id: '3eme/p1/seq2', titre: 'Séquence 2 · Programmer un système' },
    { id: '3eme/p2/projet', titre: 'Projet · Mini-entreprise' },
  ],
};

export const DOCUMENTS = [
  { id: 'activite', titre: 'Fiche d’activité' },
  { id: 'eval', titre: 'Évaluation' },
  { id: 'projet', titre: 'Document de projet' },
  { id: 'autre', titre: 'Autre document' },
];
