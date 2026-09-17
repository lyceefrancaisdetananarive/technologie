-- =====================================================================
-- PURGE DE FIN DE CYCLE (fiche de traitement, section 8)
--
-- A executer par l'administrateur, chaque ete avant le 31 aout, APRES la
-- copie du bucket "rendus" (outils/sauvegarde.py) et l'export de la base.
-- Procedure en trois temps ; rien n'est automatique.
--
--   1. Les eleves sortants : liste fournie par le secretariat (adresses),
--      ou tous les eleves des groupes de 3e de l'annee ecoulee. Coller les
--      adresses dans la liste ci-dessous.
--   2. Les fichiers : la suppression d'un compte emporte les lignes rendus
--      en cascade, PAS les objets du stockage. Lancer d'abord
--      "python3 outils/sauvegarde.py --purger-fichiers <fichier d'adresses>"
--      qui supprime les objets du bucket de ces eleves (avec la cle de
--      service lue dans l'environnement, jamais ecrite sur disque).
--   3. Les comptes : supprimer les utilisateurs Auth de ces adresses dans le
--      tableau de bord Supabase (Authentication > Users) ou par l'API
--      d'administration ; profils, appartenances, rendus, reponses (les
--      reponses redigees, db/12), exceptions, scores et journal_repli
--      (eleve_id) suivent en cascade.
--
-- Les requetes ci-dessous preparent et verifient ; elles ne suppriment que
-- les tables de service. Fichier integralement ASCII.
-- =====================================================================

-- A. Qui part ? (adresses a coller entre les parentheses)
-- select p.id, p.email from profils p where p.email in ('...@eleve.egd.mg');

-- B. Ce que chacun laisse (a exporter avant si la direction le demande)
-- select p.email, count(r.id) as depots
--   from profils p left join rendus r on r.profil_id = p.id
--  where p.email in ('...') group by p.email;

-- C. Apres suppression des comptes : verifier qu'il ne reste rien
-- select count(*) from profils where email in ('...');

-- D. Tables de service : au plus un an d'echecs, journal des reinitialisations
--    et journal des gestes de l'annee ecoulee (a lancer chaque ete)
delete from tentatives where quand < now() - interval '1 year';
delete from journal_repli where quand < now() - interval '1 year';
delete from journal where quand < now() - interval '1 year';

-- E. Groupes vides de l'annee ecoulee (les groupes portent l'annee).
--    Un groupe emporte en cascade ses rendus ET ses reponses redigees :
--    on ne supprime que ceux qui n'en portent aucun.
-- delete from groupes g where g.annee < '2026-2027'
--   and not exists (select 1 from appartenances a where a.groupe_id = g.id)
--   and not exists (select 1 from rendus r where r.groupe_id = g.id)
--   and not exists (select 1 from reponses q where q.groupe_id = g.id);
