-- =====================================================================
-- PROGRESSION PAR GROUPE (phase 3 de la refonte, decision D15)
--
-- Trois tables, toutes rattachees a un groupe, donc a UN professeur.
--
--   plans       l'ordre des sequences de l'annee pour ce groupe, tel que le
--               professeur l'a choisi (question 3 : chaque professeur
--               reordonne, saute ou ajoute pour ses groupes). Le catalogue
--               du site n'est que le plan propose a la creation du groupe.
--   avancement  les seances cochees "faite en classe" pour tout le groupe
--               (question 1 : le professeur coche, l'eleve ne coche rien).
--   exceptions  ce qui, pour un eleve donne, deroge a la coche du groupe :
--               absent, a reprendre, rattrape.
--
-- La cle "sequence" est l'identifiant du catalogue (ex. 5eme/p1/seq1) :
-- pas de table de sequences en base, le catalogue.json du site fait foi.
-- Le badge de fin de sequence n'est pas stocke : il se DEDUIT (toutes les
-- seances de la sequence cochees pour le groupe, et l'eleve sans exception
-- non rattrapee).
--
-- Fichier integralement ASCII : l'editeur SQL de Supabase abime les accents
-- colles depuis le navigateur (voir db/01-schema.sql).
-- =====================================================================

create table if not exists plans (
  groupe_id uuid    not null references groupes(id) on delete cascade,
  sequence  text    not null,
  position  integer not null,
  visible   boolean not null default true,   -- false : non traitee cette annee
  primary key (groupe_id, sequence)
);
create index if not exists plans_ordre_idx on plans (groupe_id, position);

create table if not exists avancement (
  groupe_id uuid    not null references groupes(id) on delete cascade,
  sequence  text    not null,
  seance    integer not null check (seance between 1 and 12),
  fait_le   timestamptz not null default now(),
  par       uuid references profils(id) on delete set null,
  primary key (groupe_id, sequence, seance)
);

create table if not exists exceptions (
  groupe_id uuid    not null references groupes(id) on delete cascade,
  sequence  text    not null,
  seance    integer not null check (seance between 1 and 12),
  profil_id uuid    not null references profils(id) on delete cascade,
  etat      text    not null check (etat in ('absent', 'a_reprendre', 'rattrape')),
  note      text,
  par       uuid references profils(id) on delete set null,
  le        timestamptz not null default now(),
  primary key (groupe_id, sequence, seance, profil_id)
);
create index if not exists exceptions_eleve_idx on exceptions (profil_id);

-- RLS active, sans quoi une table nouvelle serait lisible par tous si le
-- navigateur parlait un jour a Supabase. Les fonctions /api/ passent par
-- service_role, qui ignore ces politiques : elles sont la seconde barriere.
alter table plans      enable row level security;
alter table avancement enable row level security;
alter table exceptions enable row level security;

drop policy if exists "plan: lecture par le prof ou les membres" on plans;
create policy "plan: lecture par le prof ou les membres" on plans
  for select using (
    exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid())
    or membre_de(groupe_id));
drop policy if exists "plan: ecriture par le prof" on plans;
create policy "plan: ecriture par le prof" on plans
  for all using (exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()))
  with check (exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()));

drop policy if exists "avancement: lecture par le prof ou les membres" on avancement;
create policy "avancement: lecture par le prof ou les membres" on avancement
  for select using (
    exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid())
    or membre_de(groupe_id));
drop policy if exists "avancement: ecriture par le prof" on avancement;
create policy "avancement: ecriture par le prof" on avancement
  for all using (exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()))
  with check (exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()));

-- Une exception ne se lit que par le professeur du groupe et par l'eleve
-- qu'elle concerne : un camarade n'a pas a savoir qui etait absent.
drop policy if exists "exception: lecture par le prof ou l'eleve concerne" on exceptions;
create policy "exception: lecture par le prof ou l'eleve concerne" on exceptions
  for select using (
    profil_id = auth.uid()
    or exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()));
drop policy if exists "exception: ecriture par le prof" on exceptions;
create policy "exception: ecriture par le prof" on exceptions
  for all using (exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()))
  with check (exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()));

-- Les privileges par defaut poses dans 01-schema.sql couvrent ces tables
-- pour service_role ; on les repete par securite, l'oubli coute un 403 muet.
grant select, insert, update, delete on plans, avancement, exceptions to service_role;
