-- =====================================================================
-- db/17-pix.sql - Le releve Pix de l'eleve
-- Technologie, Lycee Francais de Tananarive. 1er octobre 2026.
--
-- A EXECUTER DANS L'EDITEUR SQL DE SUPABASE, une fois.
-- Integralement en ASCII, comme tous les scripts de ce dossier : l'editeur
-- de Supabase a deja mange des accents par le passe.
--
-- POURQUOI CETTE TABLE EXISTE
--
-- Pix Orga sait ce que l'eleve a fait, le site sait qui est l'eleve, et les
-- deux ne se connaissent pas. Pix n'expose aucun identifiant stable : le
-- participant tape lui-meme son nom, et il le tape mal. Sur une classe
-- releve le 1er octobre, 6 noms sur 23 correspondaient exactement a ceux de
-- la base. On a donc besoin d'un endroit ou INSCRIRE le rapprochement une
-- fois pour toutes, au lieu de le recalculer a chaque import et de risquer
-- d'afficher le score d'un eleve sur le classeur d'un autre.
--
-- CE QUE LA TABLE PORTE, ET CE QU'ELLE NE PORTE PAS
--
-- Elle porte le resultat public du travail de l'eleve : son nombre de pix,
-- sa certifiabilite, ses pourcentages de parcours. Ce sont des resultats
-- scolaires, pas des donnees sensibles : rien a voir avec le drapeau de
-- version adaptee, dont db/16 rappelle qu'il ne doit jamais porter de motif.
--
-- Elle porte AUSSI le nom tel que l'eleve l'a tape dans Pix. C'est
-- indispensable : sans lui, personne ne peut verifier un rapprochement
-- douteux, ni comprendre pourquoi un eleve n'a pas de score.
--
-- Elle ne porte PAS le detail epreuve par epreuve. Le site n'en a pas
-- l'usage et Pix Orga reste la source.
--
-- LA COLONNE QUI COMPTE : appariement
--
--   'automatique' : rapproche par le nom, dans la meme classe, sans
--                   ambiguite. Reversible, et re-calcule a chaque import.
--   'confirme'    : le professeur a tranche. L'import ne le touche plus
--                   JAMAIS, meme si le calcul automatique dit autre chose.
--   'refuse'      : le professeur a dit que ce rapprochement est faux.
--                   L'eleve reste sans score, et l'import ne represente
--                   plus la proposition.
--
-- Sans cette distinction, chaque import ecraserait les arbitrages humains :
-- c'est l'erreur a ne pas commettre.
-- =====================================================================

create table if not exists public.pix (
  profil_id    uuid primary key references public.profils(id) on delete cascade,

  -- Le nom tel qu'il apparait dans Pix Orga, et la classe de la campagne.
  -- Les deux servent a verifier un rapprochement a l'oeil nu.
  nom_pix      text not null,
  classe       text not null,

  -- Le profil Pix, au dernier envoi. Un eleve peut envoyer son profil
  -- plusieurs fois : 87 des 203 participants releves l'ont fait. On garde
  -- le plus RECENT, jamais le dernier lu dans le fichier.
  score        integer,
  certifiable  boolean,
  envoi        timestamptz,

  -- Les parcours, sous la forme { "rentree": 0.72, "cyberharcelement": 0.65 }.
  -- Un objet plutot que des colonnes : la liste des parcours change chaque
  -- annee, et une colonne par parcours obligerait a migrer la table.
  parcours     jsonb not null default '{}'::jsonb,

  -- Les 16 competences du cadre de reference, niveau et nombre de pix.
  competences  jsonb not null default '{}'::jsonb,

  appariement  text not null default 'automatique'
                 check (appariement in ('automatique', 'confirme', 'refuse')),
  releve_le    timestamptz not null default now()
);

comment on table  public.pix is
  'Releve Pix par eleve, importe des exports de Pix Orga. Voir db/17-pix.sql.';
comment on column public.pix.appariement is
  'automatique = calcule par le nom ; confirme = tranche par le professeur, l import n y touche plus ; refuse = rapprochement ecarte.';
comment on column public.pix.nom_pix is
  'Le nom tel que l eleve l a tape dans Pix. Sert a verifier le rapprochement.';

-- Un eleve n'a qu'une ligne : la cle primaire suffit. On indexe la classe,
-- qui est le filtre de tous les ecrans du professeur.
create index if not exists pix_classe_idx on public.pix (classe);

-- ---------------------------------------------------------------------
-- LES POLITIQUES. Memes regles que le reste du classeur : l'eleve ne voit
-- que sa ligne, le professeur voit celles de ses groupes, et la cle de
-- service passe outre pour l'import.
-- ---------------------------------------------------------------------
alter table public.pix enable row level security;

drop policy if exists pix_eleve_lit_la_sienne on public.pix;
create policy pix_eleve_lit_la_sienne on public.pix
  for select using (profil_id = auth.uid());

drop policy if exists pix_prof_lit_ses_groupes on public.pix;
create policy pix_prof_lit_ses_groupes on public.pix
  for select using (
    exists (
      select 1
      from public.appartenances a
      join public.groupes g on g.id = a.groupe_id
      where a.profil_id = public.pix.profil_id
        and g.prof_id   = auth.uid()
    )
  );

grant select on public.pix to authenticated;
grant all    on public.pix to service_role;
