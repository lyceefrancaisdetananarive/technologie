-- =====================================================================
-- AJUSTEMENTS APRES LA REVUE DE LA PHASE 3 (13 septembre 2026)
--
-- 1. Les politiques RLS de rendus verrouillent aussi competence et maitrise :
--    ce sont des champs reserves au professeur, comme note et appreciation.
--    Sans cela, le jour ou le navigateur parlerait a PostgREST avec une
--    session eleve, un eleve pourrait se situer lui-meme sur une competence.
-- 2. La colonne exceptions.note disparait. Champ libre, jamais affiche,
--    jamais saisi : il n'attendait qu'un "certificat medical" pour devenir
--    une donnee de sante d'un mineur dans une table qui n'a pas cette
--    finalite. On la retire tant qu'aucun besoin n'est exprime.
--
-- Fichier integralement ASCII (voir db/01-schema.sql).
-- =====================================================================

drop policy if exists "rendu: l'eleve depose" on rendus;
create policy "rendu: l'eleve depose" on rendus
  for insert with check (
    profil_id = auth.uid()
    and membre_de(groupe_id)
    and note is null
    and appreciation is null
    and competence is null
    and maitrise is null
    and corrige_le is null
  );

drop policy if exists "rendu: l'eleve corrige tant que non releve" on rendus;
create policy "rendu: l'eleve corrige tant que non releve" on rendus
  for update
  using  (profil_id = auth.uid() and corrige_le is null)
  with check (
    profil_id = auth.uid()
    and note is null
    and appreciation is null
    and competence is null
    and maitrise is null
    and corrige_le is null
  );

alter table exceptions drop column if exists note;
