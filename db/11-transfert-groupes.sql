-- =====================================================================
-- TRANSFERT DES GROUPES D'UN PROFESSEUR A UN AUTRE
--
-- Un groupe appartient a UN professeur (decision D15, question 8). Quand un
-- collegue part ou est absent longtemps, ses groupes deviennent invisibles
-- pour tout le monde : ce script les transfere. A executer par
-- l'administrateur, consigner la date et les groupes dans DECISIONS.md.
-- Fichier integralement ASCII.
-- =====================================================================

-- 1. Reperer les deux professeurs
-- select id, email, role, actif from profils where role = 'prof' order by email;

-- 2. Les groupes du partant
-- select id, code, libelle, niveau, annee from groupes where prof_id = '<id du partant>';

-- 3. Transferer (tous, ou une liste d'identifiants)
-- update groupes set prof_id = '<id du repreneur>' where prof_id = '<id du partant>';

-- 4. Verifier
-- select code, prof_id from groupes where prof_id = '<id du repreneur>';
