-- =====================================================================
-- REPONSES REDIGEES (decision D16 du 17 septembre 2026, point f)
--
-- Une ligne par eleve, par fiche et par question : le texte que l'eleve
-- redige au pied d'une fiche d'activite (ou de sa version adaptee), puis la
-- correction ecrite par le professeur du groupe. Table SEPAREE de rendus :
-- une reponse sans fichier rangee dans rendus passerait partout pour un
-- "envoi incomplet", supprimable par le professeur d'un clic.
--
-- Calque sur rendus (db/01, politiques en vigueur dans db/09) :
--   - lecture par l'eleve ou par son professeur (enseigne_a) ;
--   - l'eleve ecrit et modifie la sienne tant qu'elle n'est pas corrigee,
--     jamais les champs du professeur ;
--   - la correction passe par /api/prof/reponses avec la cle de service ;
--   - aucun effacement par le professeur : le travail d'un mineur ne
--     disparait pas par un bouton (regle de supprimer-depot.js). L'eleve
--     supprime la sienne tant qu'elle n'est pas corrigee.
-- Aucune note, aucun classement : production scolaire (fiche de
-- traitement a completer). Pas de colonne prof_id : une seconde cle vers
-- profils rendrait l'embed profils(...) ambigu pour PostgREST ; le
-- professeur est celui du groupe (groupes.prof_id), comme pour rendus.
--
-- A executer dans l'editeur SQL de Supabase, puis rejouer
-- db/02-verification.sql. Fichier integralement ASCII (voir db/01-schema.sql).
-- =====================================================================

create table if not exists reponses (
  id          uuid primary key default gen_random_uuid(),
  profil_id   uuid not null references profils(id) on delete cascade,
  groupe_id   uuid not null references groupes(id) on delete cascade,
  -- chemin de la fiche tel que le catalogue l'ecrit : 5eme/p1/seq1-activite.html
  page        text not null
              check (page ~ '^[345]eme/p[1-5]/seq[0-9]{1,2}-(activite|ebep)\.html$'),
  -- 'reponse' tant qu'il n'y a qu'un bloc par fiche ; reserve a une
  -- version ulterieure a une reponse par question (a, b, c...)
  question    text not null default 'reponse'
              check (question ~ '^[a-z0-9_-]{1,24}$'),
  -- 4000 caracteres au plus, tronques par /api/ avant l'ecriture
  texte       text not null check (char_length(texte) between 1 and 4000),
  redige_le   timestamptz not null default now(),
  modifie_le  timestamptz not null default now(),
  correction  text check (correction is null or char_length(correction) <= 4000),
  corrige_le  timestamptz,
  unique (profil_id, page, question)
);

-- Le compteur "a corriger" du tableau de bord lit par groupe et par etat.
create index if not exists reponses_groupe_idx on reponses (groupe_id, corrige_le);

alter table reponses enable row level security;

-- On repart de zero : rejouer ce fichier ne doit pas empiler les politiques.
drop policy if exists "reponse: lecture" on reponses;
drop policy if exists "reponse: l'eleve redige" on reponses;
drop policy if exists "reponse: l'eleve corrige tant que non relevee" on reponses;
drop policy if exists "reponse: l'eleve supprime tant que non relevee" on reponses;

create policy "reponse: lecture" on reponses
  for select using (profil_id = auth.uid() or enseigne_a(profil_id));

-- Comme pour rendus : l'eleve ecrit dans un groupe dont il est membre, et
-- les champs reserves au professeur restent vides.
create policy "reponse: l'eleve redige" on reponses
  for insert with check (
    profil_id = auth.uid()
    and membre_de(groupe_id)
    and correction is null
    and corrige_le is null
  );

-- Apres correction, la ligne se fige : sinon un eleve pourrait reecrire sa
-- reponse apres avoir lu la correction.
create policy "reponse: l'eleve corrige tant que non relevee" on reponses
  for update
  using  (profil_id = auth.uid() and corrige_le is null)
  with check (
    profil_id = auth.uid()
    and correction is null
    and corrige_le is null
  );

create policy "reponse: l'eleve supprime tant que non relevee" on reponses
  for delete using (profil_id = auth.uid() and corrige_le is null);

-- Pas de politique d'ecriture pour le professeur : la correction passe par
-- /api/ avec la cle de service (meme regle que rendus, db/01). Les
-- privileges par defaut de db/01 couvrent deja service_role ; le grant
-- explicite est une ceinture.
grant select, insert, update, delete on reponses to service_role;
