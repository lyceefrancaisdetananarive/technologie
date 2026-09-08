-- =====================================================================
-- Vérification du schéma · Classeur de Technologie · LFT
--
-- À EXÉCUTER APRÈS 01-schema.sql, ET DE NOUVEAU APRÈS CHAQUE MODIFICATION
-- de la base, y compris celles faites à la main dans le tableau de bord.
--
-- Ce fichier ne modifie RIEN. Il lève une exception au premier problème et
-- ne dit rien quand tout va bien, sauf un récapitulatif final.
--
-- Il existe parce que la confidentialité de ce système repose entièrement
-- sur le Row Level Security : la clé anon est publique, le dépôt GitHub
-- l'est aussi, et une seule table ajoutée plus tard sans RLS exposerait tout
-- son contenu au monde. Cet oubli-là ne se voit pas : rien ne casse, rien
-- ne s'affiche, les données sortent en silence.
-- =====================================================================

do $$
declare
  t record;
  n int;
  compte_tables int := 0;
  compte_politiques int := 0;
begin

  -- 1. ------------------------------------------------------------------
  -- TOUTE table du schéma public a le Row Level Security activé.
  -- C'est le contrôle le plus important du fichier.
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception
      'RLS DÉSACTIVÉ sur la table public.% — son contenu est lisible par '
      'quiconque possède la clé anon, qui est publique. Corriger avec : '
      'alter table % enable row level security;', t.relname, t.relname;
  end loop;

  select count(*) into compte_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  -- 2. ------------------------------------------------------------------
  -- Les tables que le navigateur doit pouvoir lire ont bien des politiques.
  -- Une table avec RLS et SANS politique est fermée : c'est sûr, mais si
  -- c'est involontaire l'application affiche des listes vides sans erreur,
  -- ce qui est très difficile à diagnostiquer en séance.
  for t in
    select unnest(array['profils','groupes','appartenances','rendus',
                        'journal_repli']) as nom
  loop
    select count(*) into n from pg_policies
     where schemaname = 'public' and tablename = t.nom;
    if n = 0 then
      raise exception
        'La table public.% n''a AUCUNE politique : le classeur affichera des '
        'listes vides, sans message d''erreur, car le RLS ne refuse pas, il '
        'renvoie zéro ligne.', t.nom;
    end if;
    compte_politiques := compte_politiques + n;
  end loop;

  -- 3. ------------------------------------------------------------------
  -- `tentatives` ne doit avoir AUCUNE politique : table de service, lue et
  -- écrite uniquement par /api/ avec la clé de service. Une politique de
  -- lecture y révélerait qui essaie de se connecter, et à quelle heure.
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'tentatives';
  if n > 0 then
    raise exception
      'La table tentatives porte % politique(s). Elle ne doit en avoir '
      'aucune : le navigateur n''a rien à y voir.', n;
  end if;

  -- 4. ------------------------------------------------------------------
  -- Le bucket des copies d'élèves est PRIVÉ. Public, il rendrait chaque
  -- travail déposé lisible par n'importe qui connaissant son adresse, et
  -- les adresses sont devinables.
  select count(*) into n from storage.buckets
   where id = 'rendus' and buckets.public is false;
  if n <> 1 then
    raise exception
      'Le bucket « rendus » est PUBLIC, ou absent. Les copies des élèves '
      'seraient lisibles sans authentification.';
  end if;

  select count(*) into n from storage.buckets
   where id = 'rendus'
     and file_size_limit = 5242880
     and allowed_mime_types @> array['image/jpeg','image/png','image/webp',
                                     'application/pdf'];
  if n <> 1 then
    raise warning
      'Le bucket « rendus » n''a pas la limite de taille ou la liste de '
      'formats attendues. Ce filet protège si le code client est trafiqué.';
  end if;

  -- 5. ------------------------------------------------------------------
  -- CONTRAT mdp_pose_le : ni valeur par défaut, ni contrainte NOT NULL.
  -- Avec « not null default now() », l'horloge de péremption partait de la
  -- création de la ligne, et un import de comptes préparé l'avant-veille
  -- était refusé en bloc à la rentrée. Voir la note dans 01-schema.sql.
  select count(*) into n
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profils'
    and column_name = 'mdp_pose_le'
    and (column_default is not null or is_nullable = 'NO');
  if n > 0 then
    raise exception
      'profils.mdp_pose_le porte une valeur par défaut ou une contrainte '
      'NOT NULL. Tout compte créé en bloc serait refusé 24 h plus tard, '
      'quel que soit son mot de passe. Corriger avec : alter table profils '
      'alter column mdp_pose_le drop default, alter column mdp_pose_le '
      'drop not null;';
  end if;

  -- 6. ------------------------------------------------------------------
  -- La contrainte de domaine accepte les DEUX domaines de l'établissement.
  -- Piège rencontré : « %@egd.mg » n'attrape pas « x@eleve.egd.mg », le
  -- caractère qui précède « egd.mg » y étant un point et non une arobase.
  -- Une rédaction naïve rejette donc TOUS les élèves.
  begin
    select count(*) into n from pg_constraint
     where conname = 'profils_domaine_coherent';
    if n <> 1 then
      raise exception 'La contrainte profils_domaine_coherent est absente.';
    end if;
    if pg_get_constraintdef(
         (select oid from pg_constraint where conname = 'profils_domaine_coherent')
       ) not like '%@eleve.egd.mg%' then
      raise exception
        'profils_domaine_coherent ne mentionne pas @eleve.egd.mg : elle '
        'rejette probablement toutes les adresses d''élèves.';
    end if;
  end;

  -- 7. ------------------------------------------------------------------
  -- Les fonctions d'autorisation sont en SECURITY DEFINER avec un
  -- search_path fixé. Sans search_path, un utilisateur pourrait créer un
  -- schéma qui masque les tables et détourner la fonction.
  for t in
    select p.proname
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname in ('est_prof','enseigne_a','membre_de')
      and (not p.prosecdef
           or coalesce(array_to_string(p.proconfig, ','), '')
              not like '%search_path%')
  loop
    raise exception
      'La fonction %() n''est pas SECURITY DEFINER avec un search_path '
      'fixé. Les politiques qui s''appuient dessus ne sont pas fiables.',
      t.proname;
  end loop;

  -- ---------------------------------------------------------------------
  raise notice 'Vérification passée : % table(s), % politique(s), bucket privé.',
    compte_tables, compte_politiques;
end $$;
