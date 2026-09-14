// =====================================================================
// Le journal des gestes qui touchent une personne (CNIL, « Tracer les
// opérations et gérer les incidents »).
//
// Qui a fait quoi, sur qui, quand : création ou rattachement d'un compte,
// retrait, désactivation, réactivation, changement de mot de passe, import
// d'une liste, suppression d'un dépôt, consultation d'un fichier d'élève par
// un professeur. Jamais d'adresse IP, jamais de contenu : des identifiants
// et un mot. Lu par le seul administrateur, avec la clé de service ; aucune
// page ne l'affiche. Une écriture qui échoue ne bloque jamais le geste
// journalisé : le journal est un témoin, pas une barrière.
// =====================================================================

import { ecrire } from './supabase.js';

export const ACTIONS = [
  'compte.cree', 'compte.rattache', 'compte.reactive', 'compte.retire', 'compte.desactive',
  'compte.promu', 'mdp.change', 'mdp.reinitialise', 'liste.importee',
  'depot.supprime', 'fichier.consulte', 'mot.efface', 'groupe.supprime', 'essai.supprime',
];

export async function journaliser(acteur, action, cible = null, detail = null) {
  if (!ACTIONS.includes(action)) return;
  await ecrire('journal', '', {
    acteur: acteur ?? null, action, cible: cible ?? null,
    detail: detail ? String(detail).slice(0, 200) : null,
  }, 'POST').catch((e) => console.error('journal :', action, e.message));
}
