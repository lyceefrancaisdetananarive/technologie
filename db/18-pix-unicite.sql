-- =====================================================================
-- db/18-pix-unicite.sql - Un releve Pix ne sert qu'un eleve
-- Technologie, Lycee Francais de Tananarive. 1er octobre 2026.
--
-- A EXECUTER DANS L'EDITEUR SQL DE SUPABASE, une fois, apres db/17.
-- Integralement en ASCII, comme tous les scripts de ce dossier.
--
-- POURQUOI CETTE CONTRAINTE
--
-- Pix n'expose aucun identifiant : les exports ne portent que "Nom du
-- Participant" et "Prenom du Participant", verifie sur les 25 fichiers du
-- 1er octobre 2026. Le rapprochement est donc un pari, et le pire qu'il
-- puisse faire est d'afficher a un eleve les resultats d'un autre.
--
-- outils/importer-pix.py se garde de ce defaut, mais il s'en gardait DEJA, et
-- un audit a montre trois portes par lesquelles il passait quand meme : un
-- eleve deja tranche par le professeur, un eleve absent du fichier de
-- classes, un compte a la corbeille. Dans les trois cas l'ayant droit sortait
-- de la boucle avant d'avoir revendique son propre releve.
--
-- Un garde-fou qui vit dans le programme se contourne par une porte qu'on
-- n'avait pas vue. Celui-ci vit dans la base : il ne se contourne pas.
--
-- CE QUE LA CONTRAINTE REFUSE, ET CE QU'IL FAUT EN FAIRE
--
-- Deux eleves qui portent le meme (nom_pix, classe) : l'ecriture echoue avec
-- un code 23505 au lieu de reussir en silence. C'est le resultat voulu. Le
-- cas se regle a la main, dans Pix Orga, en regardant qui a reellement
-- participe.
--
-- LA COLONNE nom_pix_aussi
--
-- Un eleve peut avoir envoye deux fois sous deux ecritures : "MAHAZOASY
-- Roxanne" puis "MAHAZOASY ZOGG Roxanne". L'import garde le releve le plus
-- recent et doit pouvoir nommer les deux, sans quoi l'eleve ne reconnait pas
-- celle qui s'affiche. Mettre les deux dans nom_pix aurait brise l'unicite
-- ci-dessus : les ecritures secondaires vivent donc a part.
-- =====================================================================

alter table public.pix add column if not exists nom_pix_aussi text;

comment on column public.pix.nom_pix_aussi is
  'Les autres ecritures sous lesquelles le meme eleve a envoye, separees par des virgules. nom_pix reste l ecriture retenue.';

create unique index if not exists pix_releve_unique
  on public.pix (nom_pix, classe);
