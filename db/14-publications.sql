-- =====================================================================
-- D21, 29 septembre 2026 : LE VERROU DE PUBLICATION DES EVALUATIONS
--
-- Jusqu'ici, toute evaluation etait lisible par tout eleve du bon niveau
-- des qu'il ouvrait une session. Les 27 codes de cahier en "E" (51E, 52E...)
-- y menent directement, et un eleve qui connait le motif de l'adresse la
-- trouve en trente secondes. L'evaluation du 12 janvier etait donc lisible
-- le 3 septembre.
--
-- Une evaluation n'apparait desormais que si le professeur du groupe l'a
-- PUBLIEE. Le geste est date et signe : savoir QUI a ouvert une evaluation
-- et QUAND n'est pas une precaution administrative, c'est ce qui permet de
-- trancher une contestation.
--
-- POURQUOI UNE TABLE ET NON UN DRAPEAU SUR plans. La table `plans` dit ce
-- qu'un groupe traite cette annee, a l'echelle de la SEQUENCE. La
-- publication porte sur un DOCUMENT de cette sequence. Les confondre
-- reviendrait a ne plus pouvoir traiter une sequence sans en ouvrir
-- l'evaluation, ce qui est exactement l'inverse du besoin.
--
-- LE PERIMETRE EST VOLONTAIREMENT ETROIT : seul le document 'eval' se
-- publie. L'activite, le cours, le quiz, la revision et la version adaptee
-- restent ouverts des que l'eleve a une session, comme avant. Fermer ce qui
-- n'a pas besoin de l'etre creerait 130 gestes de plus par an, et la premiere
-- fois qu'un professeur oublie d'ouvrir un cours, c'est le site qu'on
-- accuse. La contrainte CHECK l'ecrit noir sur blanc : elargir le perimetre
-- demandera de la modifier, donc d'y penser.
--
-- A JOUER DANS L'EDITEUR SQL DE SUPABASE, projet bumyriwwysycbrngtzhk.
-- Ce fichier est INTEGRALEMENT ASCII : coller du texte accentue depuis le
-- navigateur abime l'UTF-8 (piege verifie le 8 septembre 2026).
-- =====================================================================

create table if not exists publications (
  groupe_id uuid not null references groupes(id) on delete cascade,
  sequence  text not null,                 -- ex. << 5eme/p1/seq1 >>
  document  text not null check (document in ('eval')),
  publie_le timestamptz not null default now(),
  par       uuid references profils(id) on delete set null,
  primary key (groupe_id, sequence, document)
);

-- Le portier interroge cette table a chaque ouverture d'une evaluation :
-- l'index sert le chemin le plus chaud du site.
create index if not exists publications_sequence_idx
  on publications (sequence, document);

alter table publications enable row level security;

-- On repart de zero : rejouer ce fichier ne doit pas empiler les politiques.
drop policy if exists "publication: lecture" on publications;
drop policy if exists "publication: le prof publie" on publications;
drop policy if exists "publication: le prof retire" on publications;

-- L'ELEVE LIT LES PUBLICATIONS DE SES GROUPES. Il en a besoin : c'est ce
-- qui fait apparaitre ou disparaitre le lien dans son classeur. Il ne lit
-- rien des autres groupes, donc rien du calendrier d'une autre classe.
create policy "publication: lecture" on publications
  for select using (
    membre_de(groupe_id)
    or exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()));

-- Le professeur publie et retire, dans SES groupes seulement, et signe.
create policy "publication: le prof publie" on publications
  for insert with check (
    exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid())
    and par = auth.uid());

create policy "publication: le prof retire" on publications
  for delete using (
    exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()));

-- =====================================================================
-- LA QUESTION DU PORTIER, EN UN SEUL APPEL
--
-- Le portier (middleware.js) tourne a chaque requete de page. Sur une
-- evaluation, et sur elle seule, il doit savoir si CET eleve peut ouvrir
-- CETTE sequence. Sans cette fonction il lui faudrait deux appels, un pour
-- les groupes de l'eleve, un pour les publications : deux allers-retours
-- depuis Tananarive vers Francfort avant d'afficher une page, pour vingt-huit
-- eleves en meme temps au debut d'une evaluation.
--
-- << security definer >> est ici indispensable et sans danger : la fonction
-- ne renvoie qu'un booleen, jamais une ligne, et elle ne repond que sur le
-- couple (profil, sequence) qu'on lui donne. Le << set search_path >> est
-- obligatoire sur toute fonction security definer, sans quoi un utilisateur
-- peut creer sa propre table << publications >> et detourner la fonction.
-- =====================================================================

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
  );
$$;

-- Le portier appelle cette fonction avec la cle de service, hors de toute
-- session Supabase : c'est le role service_role qui doit pouvoir l'executer.
-- Le projet a ete cree avec << Automatically expose new tables >> decoche,
-- ce qui est le bon reglage mais retire aussi ses privileges a service_role :
-- sans ces deux lignes, l'appel repond << permission denied >> avec une cle
-- pourtant valide. Meme piege que le bloc grant de db/01-schema.sql.
grant execute on function eval_publiee(uuid, text) to service_role;
grant select, insert, delete on publications to service_role;

-- =====================================================================
-- VERIFICATION, a lancer juste apres
-- =====================================================================
-- 1. La table existe et elle est vide :
--    select count(*) from publications;
--
-- 2. La fonction repond false pour n'importe quel couple :
--    select eval_publiee('00000000-0000-0000-0000-000000000000', '5eme/p1/seq1');
--
-- 3. Apres avoir publie une evaluation depuis l'espace enseignant, elle doit
--    repondre true pour un eleve du groupe et false pour un eleve d'un autre
--    groupe. C'est CE test qui vaut, pas le precedent.
