// =====================================================================
// LA GRAMMAIRE DES CLÉS DE CHAMP, EN UN SEUL EXEMPLAIRE.
//
// C'est la règle la plus critique du site : elle décide quelle réponse
// d'élève est acceptée, et sous quel nom elle est rangée. Elle était écrite
// SIX fois, à l'identique au caractère près, et rien ne surveillait les six.
// Une divergence d'un seul caractère entre la validation à l'écriture et la
// lecture du professeur, et des réponses déjà écrites deviennent
// inatteignables, sans message nulle part.
//
// Trois formes, et elles viennent de js/reponse.js, qui les fabrique :
//   z<n>            une zone de réponse        (z1 … z999)
//   b<n>            une case à cocher          (b1 … b999)
//   t<i>-r<j>-c<k>  une cellule de tableau     (tableau i, ligne j, colonne k)
//
// CE FICHIER EST TENU EN DOUBLE, ici et dans js/cles-champs.js, parce que les
// fonctions Vercel ne remontent dans aucun dossier voisin. Les deux copies
// sont comparées octet pour octet par outils/verifier-miroirs.py : elles ne
// peuvent plus diverger en silence. C'est la convention de la maison, déjà
// appliquée à api/_lib/etats-fiche.js.
//
// js/reponse.js, lui, est un script classique qui ne peut pas importer. Il
// garde donc son propre littéral, et verifier-miroirs.py le CONFRONTE à
// celui-ci : surveillé à défaut d'être partagé.
// =====================================================================

export const CLE_CHAMP = /^(?:[zb]\d{1,3}|t\d{1,2}-r\d{1,3}-c\d{1,2})$/;
