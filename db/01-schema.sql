-- =====================================================================
-- Classeur numérique de Technologie · Lycée Français de Tananarive
-- Schéma Supabase (PostgreSQL) — version 2, après audit
--
-- MODÈLE DE SÉCURITÉ, en une phrase :
--   le navigateur ne peut que LIRE, et seulement ce qui le concerne ;
--   la seule écriture qu'un élève fait directement est le dépôt de son
--   propre travail ; tout le reste passe par /api/ avec la clé de service,
--   où l'autorisation est écrite en JavaScript relu, pas en SQL dispersé.
--
-- Ce choix vient d'une contrainte humaine : un seul professeur maintient
-- ce système. Concentrer les écritures dans quatre fonctions relues vaut
-- mieux que vingt politiques dont une seule oubliée ouvre tout.
--
-- La clé anon est PUBLIQUE (dépôt GitHub public). Toute la confidentialité
-- repose donc sur les politiques ci-dessous. Une table ajoutée plus tard
-- sans « enable row level security » expose tout son contenu au monde.
-- Le fichier db/02-verification.sql existe pour attraper cet oubli.
-- =====================================================================

-- ---------------------------------------------------------------- profils
-- Une ligne par personne autorisée, liée au compte Supabase Auth.
create table if not exists profils (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null unique,
  role           text not null check (role in ('eleve', 'prof')),
  nom            text,
  prenom         text,
  actif          boolean not null default true,
  -- vrai tant que la personne n'a pas remplacé son mot de passe provisoire
  mdp_provisoire boolean not null default true,
  cree_le        timestamptz not null default now(),
  derniere_connexion timestamptz
);

-- Le domaine de l'adresse doit correspondre au rôle. Garde-fou en base :
-- l'export EDUKA contient au moins une élève dont l'adresse est en @egd.mg,
-- et sans cette contrainte elle serait créée avec le rôle professeur.
alter table profils drop constraint if exists profils_domaine_coherent;
alter table profils add constraint profils_domaine_coherent check (
  (role = 'eleve' and email like '%@eleve.egd.mg') or
  (role = 'prof'  and email like '%@egd.mg' and email not like '%@eleve.egd.mg')
);

-- ---------------------------------------------------------------- groupes
create table if not exists groupes (
  id      uuid primary key default gen_random_uuid(),
  code    text not null unique,          -- ex. « 5M2 TECHNO »
  libelle text not null,
  niveau  text not null check (niveau in ('5eme', '4eme', '3eme')),
  prof_id uuid not null references profils(id) on delete restrict,
  annee   text not null default '2026-2027'
);

create table if not exists appartenances (
  profil_id uuid references profils(id) on delete cascade,
  groupe_id uuid references groupes(id) on delete cascade,
  primary key (profil_id, groupe_id)
);

-- ---------------------------------------------------------------- rendus
-- Le classeur numérique : ce que l'élève dépose, séquence par séquence.
create table if not exists rendus (
  id           uuid primary key default gen_random_uuid(),
  profil_id    uuid not null references profils(id) on delete cascade,
  groupe_id    uuid not null references groupes(id) on delete cascade,
  sequence     text not null,            -- ex. « 3eme/p1/seq1 »
  document     text not null,            -- « activite », « eval », « quiz »
  fichier      text,                     -- chemin dans Supabase Storage
  commentaire  text,                     -- mot de l'élève à son professeur
  -- Les binômes sont la règle, faute d'ordinateurs. Sans ce champ, tout le
  -- travail est attribué à un seul des deux et la traçabilité que le registre
  -- des traitements décrira serait un mensonge.
  binome       text,
  -- Les NOTES vivent dans PRONOTE. Cette colonne reste facultative pour une
  -- appréciation chiffrée de séance ; la dupliquer systématiquement créerait
  -- un second registre de notes à conserver et à justifier.
  note         numeric(4,2),
  appreciation text,                     -- correction écrite par le professeur
  depose_le    timestamptz not null default now(),
  corrige_le   timestamptz
);

create index if not exists rendus_profil_idx on rendus (profil_id);
create index if not exists rendus_groupe_idx on rendus (groupe_id, sequence);

-- =====================================================================
-- FONCTIONS D'AIDE
--
-- Elles sont « security definer » DÉLIBÉRÉMENT : elles s'exécutent avec les
-- droits du propriétaire et ignorent donc le RLS des tables qu'elles lisent.
-- C'est exactement ce qu'il faut ici. Sans cela, la politique « le prof voit
-- ses élèves » interrogeait « appartenances », elle-même protégée par une
-- politique ne laissant voir que sa propre ligne : le professeur ne voyait
-- alors AUCUN élève. C'était le défaut n°1 du premier jet.
--
-- « set search_path » est obligatoire sur toute fonction security definer :
-- sans lui, un utilisateur peut créer une table « profils » dans son propre
-- schéma et détourner la fonction.
-- =====================================================================

create or replace function est_prof() returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profils
    where id = auth.uid() and role = 'prof' and actif
  );
$$;

-- L'appelant est-il le professeur d'un groupe où cet élève est inscrit ?
create or replace function enseigne_a(eleve uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from appartenances a
    join groupes g on g.id = a.groupe_id
    where a.profil_id = eleve and g.prof_id = auth.uid()
  );
$$;

-- L'appelant est-il inscrit dans ce groupe ?
create or replace function membre_de(g uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from appartenances
    where profil_id = auth.uid() and groupe_id = g
  );
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table profils       enable row level security;
alter table groupes       enable row level security;
alter table appartenances enable row level security;
alter table rendus        enable row level security;

-- On repart de zéro : rejouer ce fichier ne doit pas empiler les politiques.
drop policy if exists "profil: le sien ou celui de ses élèves" on profils;
drop policy if exists "groupe: le sien"                        on groupes;
drop policy if exists "appartenance: la sienne ou celle de ses élèves" on appartenances;
drop policy if exists "rendu: lecture"                         on rendus;
drop policy if exists "rendu: l'élève dépose"                  on rendus;
drop policy if exists "rendu: l'élève corrige tant que non relevé" on rendus;
-- politiques du premier jet, supprimées
drop policy if exists "profil: chacun le sien"          on profils;
drop policy if exists "profil: le prof voit ses élèves" on profils;
drop policy if exists "groupe: élève membre"            on groupes;
drop policy if exists "groupe: prof propriétaire"       on groupes;
drop policy if exists "appartenance: la sienne"         on appartenances;
drop policy if exists "rendu: l'élève le sien"          on rendus;
drop policy if exists "rendu: le prof du groupe"        on rendus;

-- --- profils ---------------------------------------------------------
create policy "profil: le sien ou celui de ses élèves" on profils
  for select using (id = auth.uid() or enseigne_a(id));

-- AUCUNE politique d'insertion, de mise à jour ni de suppression sur profils.
-- Ce n'est pas un oubli : c'était le défaut n°3 du premier jet, et le
-- correctif retenu est de refuser toute écriture depuis le navigateur.
-- Créer un compte, abaisser « mdp_provisoire », désactiver quelqu'un :
-- tout cela passe par /api/ avec la clé de service, qui ignore le RLS.
-- Un élève ne peut donc pas se promouvoir professeur en écrivant son rôle.

-- --- groupes ---------------------------------------------------------
create policy "groupe: le sien" on groupes
  for select using (prof_id = auth.uid() or membre_de(id));

-- --- appartenances ---------------------------------------------------
create policy "appartenance: la sienne ou celle de ses élèves" on appartenances
  for select using (profil_id = auth.uid() or enseigne_a(profil_id));

-- --- rendus ----------------------------------------------------------
create policy "rendu: lecture" on rendus
  for select using (profil_id = auth.uid() or enseigne_a(profil_id));

-- Défaut n°2 du premier jet : « with check (profil_id = auth.uid()) » laissait
-- l'élève insérer une ligne avec note = 20 et appreciation = « excellent ».
-- On vérifie donc AUSSI qu'il dépose dans un groupe dont il est membre, et
-- que les champs réservés au professeur restent vides.
create policy "rendu: l'élève dépose" on rendus
  for insert with check (
    profil_id = auth.uid()
    and membre_de(groupe_id)
    and note is null
    and appreciation is null
    and corrige_le is null
  );

-- L'élève peut corriger son dépôt tant que le professeur ne l'a pas relevé.
-- Après correction, la ligne se fige : sinon un élève pourrait réécrire son
-- travail après avoir lu l'appréciation.
create policy "rendu: l'élève corrige tant que non relevé" on rendus
  for update
  using  (profil_id = auth.uid() and corrige_le is null)
  with check (
    profil_id = auth.uid()
    and note is null
    and appreciation is null
    and corrige_le is null
  );

-- La correction par le professeur passe par /api/, avec la clé de service :
-- une politique d'écriture pour les professeurs ouvrirait la porte à une
-- erreur de politique, alors que le besoin est rare et déjà authentifié.

-- =====================================================================
-- STOCKAGE DES FICHIERS DÉPOSÉS
--
-- Angle mort classique : on protège les tables et on oublie le bucket.
-- Des politiques de bucket mal réglées feraient fuir les copies des élèves
-- indépendamment de tout le reste.
--
-- Convention de chemin :
--     rendus/<uuid de l'élève>/<uuid du rendu>.<ext>
-- Le premier segment EST l'identifiant du propriétaire.
--
-- ATTENTION — le contrôle d'accès principal N'EST PAS ici. Le navigateur n'a
-- aucune session Supabase : il ne détient qu'un cookie signé par nous. Les
-- fichiers ne sont donc accessibles que par des URL signées, émises par
-- /api/ après vérification du cookie ET du lien professeur-élève.
-- Le bucket est privé ; les politiques ci-dessous sont une seconde barrière,
-- utile le jour où quelque chose s'authentifierait directement.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('rendus', 'rendus', false, 5242880,
          array['image/jpeg','image/png','image/webp','application/pdf'])
  on conflict (id) do update set
    public = false,
    file_size_limit = 5242880,          -- 5 Mo : le client réduit déjà, ceci
    allowed_mime_types = array[         -- est le filet si le client est trafiqué
      'image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "rendus: l'élève dépose sous son dossier" on storage.objects;
drop policy if exists "rendus: lecture par l'élève ou son prof" on storage.objects;

create policy "rendus: l'élève dépose sous son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rendus'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "rendus: lecture par l'élève ou son prof" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rendus'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or enseigne_a(((storage.foldername(name))[1])::uuid)
    )
  );

-- Aucune suppression depuis le navigateur : la purge de fin d'année est un
-- travail de /api/, journalisé, pas un bouton qu'un élève peut trouver.

-- =====================================================================
-- TABLES DE SERVICE
-- =====================================================================

-- Verrou de compte. Une ligne par échec de connexion. Le comptage se fait
-- par COMPTE et non par adresse IP : l'établissement sort par une seule IP
-- publique, un verrou par IP punirait une classe entière.
create table if not exists tentatives (
  id        bigserial primary key,
  profil_id uuid not null references profils(id) on delete cascade,
  quand     timestamptz not null default now()
);
create index if not exists tentatives_idx on tentatives (profil_id, quand desc);

-- Journal du repli professeur. Ce pouvoir — reprendre la main sur le compte
-- d'un mineur — doit laisser une trace consultable. L'élève voit la mention
-- à sa connexion suivante : il ne peut pas distinguer « on m'a débloqué » de
-- « on a lu mon classeur », mais il sait au moins que c'est arrivé.
create table if not exists journal_repli (
  id        bigserial primary key,
  prof_id   uuid not null references profils(id) on delete restrict,
  eleve_id  uuid not null references profils(id) on delete cascade,
  motif     text,
  quand     timestamptz not null default now(),
  vu_par_eleve boolean not null default false
);

alter table tentatives    enable row level security;
alter table journal_repli enable row level security;

drop policy if exists "journal: l'élève voit ce qui le concerne" on journal_repli;
create policy "journal: l'élève voit ce qui le concerne" on journal_repli
  for select using (eleve_id = auth.uid() or prof_id = auth.uid());

-- tentatives : aucune politique. Table de service, lue et écrite uniquement
-- par /api/ avec la clé de service. Le navigateur n'a rien à y voir.
