-- =====================================================================
-- FICHE D'ACTIVITE INTERACTIVE : UNE LIGNE PAR CHAMP (20 septembre 2026)
--
-- L'eleve repond desormais DANS la fiche (questions, cases vides des
-- tableaux, textes a trous), et chaque champ part dans son classeur au
-- fil de l'eau. La table reponses (db/12) le permettait deja : la colonne
-- question etait reservee a "une reponse par question". Ce fichier ajoute
-- seulement ce qui manquait, et fige les conventions de la colonne question
-- pour une meme (profil_id, page) :
--
--   'reponse'     le bloc libre "Ma reponse" au pied de la fiche (inchange)
--   'fiche'       L'ETAT DE LA FICHE : texte = 'en cours' des le premier
--                 champ enregistre, 'terminee' quand l'eleve clique sur
--                 "J'ai termine". La correction GLOBALE du professeur est
--                 portee par cette ligne (correction, corrige_le).
--   'z1', 'z2'    une zone de reponse sous une question
--   't2-r3-c2'    une case vide d'un tableau (2e tableau, 3e ligne, 2e col.)
--   'b4'          le 4e trou d'une synthese a completer
--
-- La nouvelle colonne intitule porte le libelle du champ tel que la fiche
-- l'affiche (la question, "Fiche technique . Materiau", la phrase autour
-- du trou), pour que le classeur du professeur soit lisible sans ouvrir la
-- fiche. C'est du TEXTE BRUT envoye par le navigateur : les pages
-- l'affichent par textContent, jamais en HTML, et rien ne s'en deduit.
--
-- Quand la ligne 'fiche' porte corrige_le, TOUS les champs de la page sont
-- figes : /api/classeur/reponse refuse toute ecriture (409), et le RLS
-- ci-dessous le repete en seconde barriere (fiche_figee). Le commentaire
-- par question est la colonne correction de la ligne du champ, sans
-- corrige_le propre : il ne fige rien tout seul. "Retirer la correction"
-- remet correction et corrige_le a null sur la ligne 'fiche' ET sur tous
-- les champs de la page (api/prof/reponses.js).
--
-- Rejouable. A executer dans l'editeur SQL de Supabase apres db/12, puis
-- rejouer db/02-verification.sql. Fichier integralement ASCII.
-- =====================================================================

-- ---- La colonne intitule -------------------------------------------------
alter table reponses add column if not exists intitule text;

-- La contrainte est posee a part : "add column if not exists ... check"
-- ne la reposerait pas si la colonne existait deja sans elle.
alter table reponses drop constraint if exists reponses_intitule_check;
alter table reponses add constraint reponses_intitule_check
  check (intitule is null or char_length(intitule) <= 200);

comment on column reponses.intitule is
  'Libelle du champ tel que la fiche l affiche (question, case de tableau, trou), pour le classeur du professeur';

comment on column reponses.question is
  'reponse = bloc libre ; fiche = etat de la fiche (en cours / terminee) et correction globale ; z<n>, t<i>-r<j>-c<k>, b<n> = champs de la fiche interactive';

-- Le classeur de l'eleve et la page de correction lisent une fiche par
-- (eleve, page) ; la contrainte unique (profil_id, page, question) de db/12
-- sert deja d'index sur ce prefixe. L'agregation du compteur du tableau de
-- bord lit par groupe et par question : cet index couvre la lecture
-- "fiches non corrigees d'un groupe" sans parcourir les champs.
create index if not exists reponses_groupe_question_idx
  on reponses (groupe_id, question, corrige_le);

-- ---- La fiche est-elle figee ? -------------------------------------------
-- Vraie quand la ligne 'fiche' de cet eleve pour cette page porte corrige_le.
-- security definer, comme membre_de et enseigne_a (db/01) : la fonction lit
-- reponses depuis une politique de reponses, ce qui bouclerait sous le RLS.
create or replace function fiche_figee(p_page text) returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from reponses
    where profil_id = auth.uid()
      and page = p_page
      and question = 'fiche'
      and corrige_le is not null
  );
$$;

-- ---- Politiques : le gel par la fiche, en seconde barriere ---------------
-- L'eleve passe par /api/ avec la cle de service, qui ignore le RLS ; ces
-- politiques ne servent que si un jour le navigateur parle a Supabase. On
-- les recree telles que db/12 les posait, plus la condition fiche_figee.
drop policy if exists "reponse: l'eleve redige" on reponses;
drop policy if exists "reponse: l'eleve corrige tant que non relevee" on reponses;
drop policy if exists "reponse: l'eleve supprime tant que non relevee" on reponses;

create policy "reponse: l'eleve redige" on reponses
  for insert with check (
    profil_id = auth.uid()
    and membre_de(groupe_id)
    and correction is null
    and corrige_le is null
    and not fiche_figee(page)
  );

create policy "reponse: l'eleve corrige tant que non relevee" on reponses
  for update
  using  (profil_id = auth.uid() and corrige_le is null and not fiche_figee(page))
  with check (
    profil_id = auth.uid()
    and correction is null
    and corrige_le is null
  );

create policy "reponse: l'eleve supprime tant que non relevee" on reponses
  for delete using (
    profil_id = auth.uid() and corrige_le is null and not fiche_figee(page)
  );
