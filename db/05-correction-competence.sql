-- =====================================================================
-- CORRECTION PAR COMPETENCE (phase 3 de la refonte, decision D15, question 4)
--
-- La note sur 20 disparait des ecrans : les notes vivent dans PRONOTE
-- (decision D14). A la place, une correction peut, facultativement, situer
-- le travail sur UNE competence de la sequence (libelle du catalogue) et
-- un niveau de maitrise du LSU. La colonne note reste en base pour les
-- lignes anciennes ; plus rien ne l'ecrit ni ne la lit.
--
-- Fichier integralement ASCII (voir db/01-schema.sql).
-- =====================================================================

alter table rendus add column if not exists competence text;
alter table rendus add column if not exists maitrise text
  check (maitrise in ('insuffisante', 'fragile', 'satisfaisante', 'tres_bonne'));
