// =====================================================================
// L'état d'une fiche d'activité, écrit en un seul endroit.
//
// Quatre fichiers calculaient cet état chacun de leur côté : api/prof/
// reponses.js, api/prof/fiche-eleve.js, enseignant/classeur.html et
// classeur/index.html. Leurs étiquettes avaient fini par diverger d'un seul
// espace, « en cours » d'un côté, « encours » de l'autre. Le 30 septembre
// 2026, cette divergence a été retrouvée dans le tableau de bord de l'élève :
// le bloc « Ce que j'ai à faire » filtrait sur une valeur que plus rien ne
// produisait, et restait donc vide alors que soixante élèves avaient une
// fiche commencée. Une règle écrite une seule fois ne peut plus diverger
// d'elle-même : c'est toute la raison d'être de ce fichier.
//
// LES CLÉS SONT CELLES DE LA BASE, délibérément. La colonne reponses.texte de
// la ligne « fiche » vaut littéralement 'en cours' ou 'terminee' sur les 71
// lignes d'état en production au 30 septembre 2026. Les renommer imposerait
// une migration de ces lignes sans rien apporter ; les garder fait que le
// code et la base parlent la même langue.
//
// Ce fichier existe en deux exemplaires rigoureusement identiques :
// api/_lib/etats-fiche.js pour les fonctions serveur, js/etats-fiche.js pour
// les pages. C'est la convention déjà suivie par api/_lib/progression.js et
// js/progression-regles.js. outils/verifier-miroirs.py contrôle qu'ils ne
// divergent pas.
// =====================================================================

/** Les cinq états d'une fiche, du plus vide au plus abouti. */
export const A_FAIRE  = 'a faire';   // aucune ligne en base : jamais ouverte
export const EN_COURS = 'en cours';  // commencée, pas encore rendue
export const RENDU    = 'terminee';  // l'élève a cliqué « J'ai terminé »
export const LIBRE    = 'libre';     // réponse libre seule, fiche d'avant le 20 septembre
export const CORRIGE  = 'corrigee';  // le professeur a posé sa correction

export const ETATS = [A_FAIRE, EN_COURS, RENDU, LIBRE, CORRIGE];

/**
 * L'état d'une fiche, à partir des seules lignes que la base en porte.
 *
 * Les règles, de la plus forte à la plus faible :
 *  1. une correction posée gèle la fiche, quoi qu'il y ait par ailleurs ;
 *  2. la ligne « fiche » fait foi, son texte valant 'terminee' ou 'en cours' ;
 *  3. sans ligne « fiche », des champs remplis valent un travail en cours ;
 *  4. sans ligne « fiche » ni champ, une réponse libre seule est un travail
 *     rendu à l'ancienne, d'avant la mise en service des champs de fiche ;
 *  5. rien du tout : la fiche n'a jamais été ouverte.
 *
 * @param {object}  e
 * @param {*}       e.corrigeLe   la date de correction, ou rien
 * @param {object}  e.ligneFiche  la ligne question='fiche', ou rien
 * @param {number}  e.nbChamps    le nombre de champs de fiche remplis
 * @param {object}  e.ligneLibre  la ligne question='reponse', ou rien
 */
export function etatFiche({ corrigeLe, ligneFiche, nbChamps, ligneLibre } = {}) {
  if (corrigeLe) return CORRIGE;
  if (ligneFiche) return String(ligneFiche.texte ?? '').trim() === RENDU ? RENDU : EN_COURS;
  if (nbChamps > 0) return EN_COURS;
  if (ligneLibre) return LIBRE;
  return A_FAIRE;
}

/** Vrai quand la balle est dans le camp du professeur. */
export function attendCorrection(etat) { return etat === RENDU || etat === LIBRE; }

/** Vrai quand la balle est dans le camp de l'élève : à lui de s'y remettre. */
export function attendEleve(etat) { return etat === A_FAIRE || etat === EN_COURS; }

/**
 * Vrai si la fiche a sa place dans la pile à corriger. Une fiche jamais
 * ouverte n'y est pas : il n'y a rien à lire. Une fiche en cours y est,
 * parce que le professeur veut voir où en est l'élève avant la fin.
 */
export function estACorriger(etat) { return etat !== CORRIGE && etat !== A_FAIRE; }

/**
 * Ce que l'ÉLÈVE lit. « Rendu » désigne toujours son geste à lui, jamais
 * celui du professeur qui rend les copies : celui-là s'appelle « Corrigé ».
 * Ces quatre mots sont ceux de PRONOTE, que les élèves lisent déjà.
 */
export const LIBELLE_ELEVE = {
  [A_FAIRE]: 'À faire', [EN_COURS]: 'En cours', [RENDU]: 'Rendu',
  [LIBRE]: 'Rendu', [CORRIGE]: 'Corrigé',
};

/** Ce que le PROFESSEUR lit : la même chose, dite de son point de vue. */
export const LIBELLE_PROF = {
  [A_FAIRE]: 'Rien reçu', [EN_COURS]: 'En cours', [RENDU]: 'À corriger',
  [LIBRE]: 'À corriger', [CORRIGE]: 'Corrigée',
};

/** Le suffixe de classe CSS de l'étiquette, commun aux deux espaces. */
export const CLASSE_ETAT = {
  [A_FAIRE]: 'afaire', [EN_COURS]: 'encours', [RENDU]: 'rendu',
  [LIBRE]: 'rendu', [CORRIGE]: 'corrige',
};

/**
 * Le rang de tri : ce qui attend le professeur d'abord, le corrigé en
 * dernier. Les quatre écrans triaient déjà ainsi, chacun avec sa propre
 * comparaison.
 */
export function rangTri(etat) { return etat === CORRIGE ? 1 : 0; }
