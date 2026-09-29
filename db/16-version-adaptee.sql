-- =====================================================================
-- D23, 29 septembre 2026 : LA VERSION ADAPTEE SE SERT TOUTE SEULE
--
-- Vingt-sept fiches -ebep existent, une par sequence : meme activite,
-- autrement. Elles sont derriere vingt-sept codes de cahier, et un eleve qui
-- en releve doit aujourd'hui SAVOIR qu'elles existent et aller les chercher.
-- Celui qui en a le plus besoin est celui qui y pense le moins.
--
-- Ce drapeau les lui sert sans qu'il ait rien a demander.
--
-- =====================================================================
-- CE QUE CETTE COLONNE NE CONTIENDRA JAMAIS, ET POURQUOI
-- =====================================================================
--
-- Elle ne dit PAS pourquoi. Pas de motif, pas de champ libre, pas de date de
-- notification, pas de mention d'un PAP, d'un PPRE, d'un trouble ni d'un
-- amenagement d'examen.
--
-- Ecrire << cet eleve a un PAP >> creerait un traitement de donnees de sante
-- au sens de l'article 9 du RGPD, dans un projet qui n'a ni base legale
-- explicite pour cela, ni analyse d'impact, ni duree de conservation definie
-- pour ce champ. Le motif est deja consigne la ou il est encadre : le dossier
-- de l'eleve et PRONOTE. Le site n'a pas a en tenir une seconde copie.
--
-- La regle generale dont ce cas est l'application : LE CLASSEUR ENREGISTRE CE
-- QUE L'ETABLISSEMENT FAIT, PAS CE QU'IL SAIT DE L'ELEVE.
--
-- Consequence pratique a ne pas contourner : si quelqu'un demande un jour
-- << on pourrait ajouter une petite note pour se souvenir >>, la reponse est
-- non. Cette note serait le motif, sous un autre nom.
--
-- =====================================================================
-- POURQUOI SUR appartenances, ET NON SUR profils
-- =====================================================================
--
-- Sur profils, le drapeau vaudrait pour tout le site et pour toutes les
-- annees, et n'importe quel professeur du reseau le lirait. Sur
-- appartenances, il vaut pour UN eleve dans UN groupe, donc pour une annee et
-- pour un professeur : c'est le perimetre de la decision reelle, et la
-- politique de securite en decoule sans rien inventer.
--
-- Contrepartie assumee : un eleve present dans deux groupes du meme
-- professeur demande deux fois le geste. C'est rare, et c'est le prix d'un
-- perimetre etroit.
--
-- A JOUER DANS L'EDITEUR SQL DE SUPABASE, projet bumyriwwysycbrngtzhk.
-- Ce fichier est INTEGRALEMENT ASCII.
-- =====================================================================

alter table appartenances
  add column if not exists version_adaptee boolean not null default false;

comment on column appartenances.version_adaptee is
  'Cet eleve recoit la version adaptee des fiches dans ce groupe. '
  'NE JAMAIS y adosser un motif, un PAP, un PPRE ni un trouble : '
  'le classeur enregistre ce que l etablissement FAIT, pas ce qu il SAIT. '
  'Voir db/16-version-adaptee.sql.';

-- Le professeur pose et retire le drapeau, dans SES groupes seulement.
-- La lecture ne change pas : l'eleve lit sa propre ligne, le professeur lit
-- celles de ses eleves (politique de db/01-schema.sql, inchangee).
drop policy if exists "appartenance: le prof regle la version adaptee" on appartenances;
create policy "appartenance: le prof regle la version adaptee" on appartenances
  for update
  using (exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()))
  with check (exists (select 1 from groupes g where g.id = groupe_id and g.prof_id = auth.uid()));

grant select, update on appartenances to service_role;

-- =====================================================================
-- VERIFICATION, a lancer juste apres
-- =====================================================================
-- 1. La colonne existe, elle est fausse partout :
--    select count(*) filter (where version_adaptee) as avec,
--           count(*) as total from appartenances;
--    doit donner 0 et l'effectif total.
--
-- 2. Le commentaire est bien pose, c'est lui qui portera la regle dans dix
--    mois quand ce fichier sera oublie :
--    select col_description('appartenances'::regclass, ordinal_position)
--      from information_schema.columns
--     where table_name = 'appartenances' and column_name = 'version_adaptee';
--
-- 3. Le test qui vaut : poser le drapeau sur un eleve depuis sa fiche, puis
--    ouvrir une sequence avec SON compte. L'onglet << Version adaptee >>
--    doit apparaitre, et lui seul doit le voir.
