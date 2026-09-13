-- =====================================================================
-- MEILLEUR SCORE DE QUIZ (phase 5 de la refonte, decision D15, question 10)
--
-- Une ligne par eleve et par quiz : le meilleur score, le nombre de
-- questions et la date de ce meilleur essai, rien de plus (db/08 retire le
-- nombre d'essais et les autres dates, ajoutes a tort). JAMAIS LES
-- REPONSES : le quiz reste un entrainement, pas une evaluation, et rien ici
-- ne dit quelle question a ete ratee.
--
-- Le quiz s'identifie par la sequence du catalogue (ex. 5eme/p1/seq1), un
-- quiz par sequence. Le score n'est enregistre que si l'eleve a ouvert sa
-- session : un visiteur anonyme fait le quiz sans que rien ne soit ecrit.
--
-- Fichier integralement ASCII (voir db/01-schema.sql).
-- =====================================================================

create table if not exists scores (
  profil_id  uuid    not null references profils(id) on delete cascade,
  quiz       text    not null,
  meilleur   integer not null check (meilleur >= 0),
  total      integer not null check (total between 1 and 60),
  meilleur_le timestamptz not null default now(),
  primary key (profil_id, quiz),
  check (meilleur <= total)
);

alter table scores enable row level security;

-- L'eleve lit ses scores ; le professeur ceux des eleves de ses groupes.
-- L'ecriture passe par /api/ avec la cle de service : aucune politique
-- d'ecriture, un eleve ne s'invente pas un score.
drop policy if exists "score: lecture par l'eleve ou son professeur" on scores;
create policy "score: lecture par l'eleve ou son professeur" on scores
  for select using (profil_id = auth.uid() or enseigne_a(profil_id));

grant select, insert, update, delete on scores to service_role;
