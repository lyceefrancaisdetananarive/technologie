-- =====================================================================
-- RETOUR A LA DECISION D15, QUESTION 10 : "meilleur score seulement".
-- La premiere version de la table gardait le nombre d'essais et trois
-- dates ; c'etait plus que decide. On ne garde que le meilleur score, le
-- nombre de questions et la date de ce meilleur essai.
-- Fichier integralement ASCII (voir db/01-schema.sql).
-- =====================================================================
alter table scores drop column if exists essais;
alter table scores drop column if exists premier_le;
alter table scores drop column if exists dernier_le;
