-- =====================================================================
-- SUITES DE L'AUDIT DU 14 SEPTEMBRE 2026 (securite d'acces, RGPD)
--
-- 1. tentatives accepte une troisieme origine, 'lien' : les demandes de
--    lien de premiere connexion sont comptees par compte, pour limiter les
--    envois de courriel (CNIL 2022-100, pas d'enumeration, pas d'abus).
-- 2. Une table journal : creations et rattachements de comptes, retraits,
--    desactivations, suppressions de depots, imports, changements de mot de
--    passe, consultations de fichiers par un professeur. Sans adresse IP,
--    sans contenu ; l'acteur et la cible sont des identifiants. Lue par le
--    seul administrateur (aucune politique : service_role uniquement).
-- 3. rendus.note disparait : la fiche de traitement dit "aucune note
--    chiffree", le schema doit le dire aussi.
--
-- Fichier integralement ASCII (voir db/01-schema.sql).
-- =====================================================================

alter table tentatives drop constraint if exists tentatives_origine_check;
alter table tentatives add constraint tentatives_origine_check
  check (origine in ('connexion', 'ressaisie', 'lien'));

create table if not exists journal (
  id      bigserial primary key,
  quand   timestamptz not null default now(),
  acteur  uuid references profils(id) on delete set null,
  action  text not null,
  cible   uuid,
  detail  text
);
create index if not exists journal_quand_idx on journal (quand desc);
create index if not exists journal_cible_idx on journal (cible);
alter table journal enable row level security;
grant select, insert, delete on journal to service_role;
grant usage, select on sequence journal_id_seq to service_role;

-- Les deux politiques eleve citent la colonne note : on les recree sans elle.
drop policy if exists "rendu: l'eleve depose" on rendus;
drop policy if exists "rendu: l'eleve corrige tant que non releve" on rendus;
alter table rendus drop column if exists note;
create policy "rendu: l'eleve depose" on rendus
  for insert with check (
    profil_id = auth.uid()
    and membre_de(groupe_id)
    and appreciation is null
    and competence is null
    and maitrise is null
    and corrige_le is null
  );
create policy "rendu: l'eleve corrige tant que non releve" on rendus
  for update
  using  (profil_id = auth.uid() and corrige_le is null)
  with check (
    profil_id = auth.uid()
    and appreciation is null
    and competence is null
    and maitrise is null
    and corrige_le is null
  );
