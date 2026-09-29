-- =====================================================================
-- D21 bis, 29 septembre 2026 : LA FERMETURE LAISSE UNE TRACE
--
-- Premiere version : fermer une evaluation SUPPRIMAIT la ligne. L'ouverture
-- etait donc datee et signee, la fermeture n'existait nulle part. Pour
-- trancher une contestation, savoir qu'une evaluation a ete ouverte a 16 h 34
-- puis refermee a 16 h 47 vaut mieux que de constater qu'elle est fermee.
--
-- CHANGEMENT DE FORME. La table portait une ligne par EVALUATION ; elle
-- porte desormais une ligne par GESTE d'ouverture. Une evaluation ouverte,
-- fermee, puis rouverte laisse trois etats dans deux lignes, et chacun est
-- date et signe. C'est la seule forme qui conserve l'histoire : un drapeau
-- sur une ligne unique n'aurait garde que le dernier cycle.
--
-- CE QUI REMPLACE LA CLE PRIMAIRE. Elle valait (groupe, sequence, document)
-- et interdisait donc deux lignes pour la meme evaluation, ce qui est
-- exactement ce qu'on veut maintenant. Elle est remplacee par un identifiant,
-- et par un INDEX UNIQUE PARTIEL qui garde la seule regle qui compte :
-- au plus UNE ouverture non fermee a la fois. Deux ouvertures simultanees de
-- la meme evaluation seraient une incoherence, pas une histoire.
--
-- La table est vide au moment de jouer ce fichier (verifie le 29 septembre
-- 2026 : l'ouverture d'essai sur 5M2 TECHNO a ete refermee, donc supprimee).
-- Si elle ne l'etait pas, l'ajout de la colonne identifiante resterait sans
-- danger : `default gen_random_uuid()` remplit les lignes existantes.
--
-- A JOUER DANS L'EDITEUR SQL DE SUPABASE, projet bumyriwwysycbrngtzhk.
-- Ce fichier est INTEGRALEMENT ASCII.
-- =====================================================================

-- 1. L'HISTOIRE : qui a ferme, et quand.
alter table publications add column if not exists retire_le  timestamptz;
alter table publications add column if not exists retire_par uuid references profils(id) on delete set null;

-- 2. LA CLE. On ne peut plus interdire deux lignes par evaluation : c'est
--    l'historique lui-meme. La contrainte se deplace vers l'index partiel du
--    point 3, qui dit la vraie regle.
alter table publications drop constraint if exists publications_pkey;
alter table publications add column if not exists id uuid not null default gen_random_uuid();
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'publications_pkey'
  ) then
    alter table publications add primary key (id);
  end if;
end $$;

-- 3. LA SEULE REGLE QUI RESTE : au plus une ouverture non fermee a la fois.
--    Un index partiel, donc les lignes fermees ne genent jamais une nouvelle
--    ouverture, et deux ouvertures simultanees restent impossibles.
create unique index if not exists publications_ouverte_unique
  on publications (groupe_id, sequence, document)
  where retire_le is null;

-- L'index de lecture du portier ne porte plus que sur les lignes ouvertes :
-- il ne lit jamais l'historique, et n'a donc pas a le parcourir.
drop index if exists publications_sequence_idx;
create index if not exists publications_ouvertes_idx
  on publications (sequence, document) where retire_le is null;

-- 4. LA QUESTION DU PORTIER tient compte de la fermeture. Sans cette
--    reecriture, une evaluation refermee resterait ouverte pour toujours :
--    c'est LA ligne a ne pas oublier dans ce fichier.
create or replace function eval_publiee(p_profil uuid, p_sequence text)
  returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from publications p
    join appartenances a on a.groupe_id = p.groupe_id
    where a.profil_id = p_profil
      and p.sequence  = p_sequence
      and p.document  = 'eval'
      and p.retire_le is null
  );
$$;

-- 5. LES POLITIQUES. Le professeur ne SUPPRIME plus, il ferme : la politique
--    de suppression cede la place a une politique de mise a jour. Supprimer
--    reste interdit a tout le monde, y compris a lui : un historique qu'on
--    peut effacer n'est pas un historique.
drop policy if exists "publication: lecture" on publications;
drop policy if exists "publication: le prof publie" on publications;
drop policy if exists "publication: le prof retire" on publications;
drop policy if exists "publication: le prof ferme" on publications;

create policy "publication: lecture" on publications
  for select using (
    membre_de(groupe_id)
    or exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()));

create policy "publication: le prof publie" on publications
  for insert with check (
    exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid())
    and par = auth.uid()
    and retire_le is null);

-- La fermeture est une mise a jour, et elle ne peut aller que dans un sens :
-- << using >> exige une ligne encore ouverte, << with check >> exige qu'elle
-- soit fermee apres. Rouvrir en effacant retire_le est donc impossible ; il
-- faut poser une nouvelle ligne, qui sera datee et signee comme la premiere.
create policy "publication: le prof ferme" on publications
  for update
  using (
    exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid())
    and retire_le is null)
  with check (retire_le is not null);

grant select, insert, update on publications to service_role;
grant execute on function eval_publiee(uuid, text) to service_role;

-- =====================================================================
-- VERIFICATION, a lancer juste apres
-- =====================================================================
-- 1. Les colonnes sont la :
--    select column_name from information_schema.columns
--     where table_name = 'publications' order by ordinal_position;
--
-- 2. L'index partiel existe et il est unique :
--    select indexname, indexdef from pg_indexes where tablename = 'publications';
--
-- 3. LE TEST QUI VAUT, en trois temps : ouvrir une evaluation depuis
--    l'espace enseignant, verifier eval_publiee() a true pour un eleve du
--    groupe ; la fermer, verifier false ; puis
--    select sequence, publie_le, retire_le from publications;
--    doit montrer UNE ligne, avec les deux dates. Si la ligne a disparu,
--    l'API ferme encore en supprimant : c'est api/prof/publier.js qu'il
--    faut corriger, pas ce fichier.
