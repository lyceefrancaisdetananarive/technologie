#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sauvegarde et purge des fichiers du classeur (fiche de traitement, sections 8
et 9 ; CNIL, « Sauvegarder et prévoir la continuité d'activité »).

    python3 outils/sauvegarde.py --exporter DOSSIER
        copie toutes les tables du classeur (JSON) et tous les objets du
        bucket « rendus » dans DOSSIER/AAAA-MM-JJ/, puis vérifie le décompte.

    python3 outils/sauvegarde.py --reparer-depots [--ecrire]
        rattache à leur ligne les fichiers déposés dont la confirmation n'est
        jamais arrivée : le travail est chez Supabase, et il n'apparaît ni sur
        le classeur de l'élève ni sur l'écran du professeur, qui le compte
        comme non rendu. Sans --ecrire, il ne fait que dire ce qu'il ferait.

    python3 outils/sauvegarde.py --purger-fichiers ADRESSES.txt
        supprime du bucket les fichiers des élèves dont l'adresse figure dans
        ADRESSES.txt (une par ligne). À lancer AVANT la suppression des
        comptes (db/10-purge-fin-de-cycle.sql), après un export.

    python3 outils/sauvegarde.py --restaurer DOSSIER [--ecrire]
        remonte une sauvegarde dans un projet Supabase VIDE : comptes Auth
        avec leurs uuid d'origine, puis les tables dans l'ordre des clés
        étrangères, puis les fichiers. Sans --ecrire, il dit ce qu'il ferait.

    python3 outils/sauvegarde.py --eleve ADRESSE DOSSIER
        rassemble tout ce que la base sait d'UN élève, en un document lisible
        par une famille, pour répondre à une demande d'accès (RGPD).

CE QUE CETTE SAUVEGARDE EST, ET CE QU'ELLE N'EST PAS

Elle lit par l'API : elle rend donc les DONNÉES, pas la base. Lui échappent le
schéma lui-même (tables, politiques RLS, fonctions, déclencheurs : ils se
rejouent avec db/01 à db/18), la configuration du projet, et surtout LES MOTS
DE PASSE, dont l'API d'administration ne sérialise jamais l'empreinte
(supabase/auth, internal/models/user.go : `json:"-"`). Une restauration
redonne donc à chacun un provisoire.

LA SAUVEGARDE PLEINEMENT FIDÈLE EST UN `pg_dump`, qui emporte le schéma auth
avec ses empreintes, les séquences, les politiques et les fonctions :

    pg_dump "$CHAINE_DE_CONNEXION" --no-owner --no-privileges -Fc -f base.dump

La chaîne se lit dans Supabase, Project Settings > Database. Ce script-ci
reste utile pour autre chose : il est lisible, il se cherche au grep, il
alimente la restitution d'un seul élève, et il fonctionne sans le mot de passe
de la base. Les deux se complètent ; aucun des deux ne remplace l'autre.

Les deux clés sont lues dans l'environnement, jamais dans un fichier :
    SUPABASE_URL=https://....supabase.co SUPABASE_SERVICE_ROLE_KEY=... python3 outils/sauvegarde.py --exporter /Volumes/CHIFFRE/sauvegardes

Le dossier de destination doit être un support chiffré de l'établissement :
il contient des données d'élèves mineurs. Sans dépendance : Python 3 et sa
bibliothèque standard. Ce script n'est pas déployé (outils/*.py est exclu).
"""
import base64
import datetime
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

# L'ORDRE COMPTE : c'est celui dans lequel les tables se réinsèrent sans
# violer une clé étrangère. Les parents d'abord, les enfants ensuite.
TABLES = ['profils', 'groupes', 'appartenances', 'plans', 'publications', 'avancement',
          'rendus', 'reponses', 'scores', 'exceptions', 'pix',
          'journal_repli', 'journal', 'tentatives']
BUCKET = 'rendus'


def tables_en_base():
    """Les tables que PostgREST expose, lues dans son propre schéma OpenAPI.

    POURQUOI ON NE SE FIE PAS A LA LISTE ECRITE PLUS HAUT. Elle a été écrite
    une fois, et deux migrations sont passées dessous sans que personne ne le
    voie : `publications` (db/14) et `pix` (db/17) n'y figuraient pas. Une
    sauvegarde incomplète ne se signale jamais toute seule : elle se découvre
    le jour où l'on restaure, c'est-à-dire le plus mauvais jour possible.
    """
    req = urllib.request.Request(env('SUPABASE_URL').rstrip('/') + '/rest/v1/')
    req.add_header('apikey', env('SUPABASE_SERVICE_ROLE_KEY'))
    req.add_header('Authorization', 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'))
    req.add_header('Accept', 'application/openapi+json')
    with urllib.request.urlopen(req, timeout=120) as r:
        schema = json.loads(r.read() or b'{}')
    return set(schema.get('definitions') or
               schema.get('components', {}).get('schemas', {}))


def controler_la_liste():
    """Refuse d'exporter si une table de la base échappe à la sauvegarde."""
    en_base = tables_en_base()
    oubliees = sorted(en_base - set(TABLES))
    fantomes = sorted(set(TABLES) - en_base)
    if fantomes:
        print('AVERTISSEMENT : %s dans la liste mais absente(s) de la base.'
              % ', '.join(fantomes))
    if oubliees:
        print('ARRET : %d table(s) existent en base et ne seraient PAS sauvegardées : %s'
              % (len(oubliees), ', '.join(oubliees)))
        print('Ajoutez-les à TABLES, au bon rang dans l\'ordre des clés étrangères,')
        print('puis relancez. Une sauvegarde incomplète vaut moins qu\'une absence')
        print('de sauvegarde : elle fait croire que les données sont à l\'abri.')
        sys.exit(3)
    print('%d table(s) en base, toutes dans la liste.' % len(en_base))


def lire_comptes():
    """Les comptes de Supabase Auth, page par page.

    SANS EUX, RIEN N'EST RESTAURABLE. public.profils.id référence
    auth.users(id) : si le projet est perdu et qu'on recrée les comptes, ils
    reçoivent de nouveaux uuid, et chaque ligne de rendus, reponses,
    appartenances, scores, avancement, exceptions et pix pointe vers un profil
    qui n'existe plus. La restauration échoue alors en bloc, sur la première
    clé étrangère.

    CE QUE CET EXPORT NE CONTIENT PAS : le mot de passe. L'API
    d'administration ne rend aucune empreinte, vérifié le 1er octobre 2026 sur
    les 561 comptes du projet. Une restauration redonne donc à chacun un mot
    de passe provisoire, par groupe, avec l'écran qui existe déjà. C'est une
    limite, elle est connue, et elle vaut mieux que de la découvrir après.
    """
    comptes, page = [], 1
    while True:
        req = urllib.request.Request(
            env('SUPABASE_URL').rstrip('/') + '/auth/v1/admin/users?page=%d&per_page=200' % page)
        req.add_header('apikey', env('SUPABASE_SERVICE_ROLE_KEY'))
        req.add_header('Authorization', 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'))
        with urllib.request.urlopen(req, timeout=120) as r:
            lot = (json.loads(r.read() or b'{}') or {}).get('users') or []
        comptes.extend(lot)
        if len(lot) < 200:
            return [{c: u.get(c) for c in
                     ('id', 'email', 'role', 'created_at', 'confirmed_at',
                      'email_confirmed_at', 'user_metadata', 'app_metadata')}
                    for u in comptes]
        page += 1


def env(nom):
    v = os.environ.get(nom, '').strip()
    if not v:
        print(f'variable {nom} absente : exportez-la dans la commande, ne l\'écrivez pas dans un fichier.')
        sys.exit(2)
    return v


def appel(methode, chemin, corps=None, brut=False):
    base, cle = env('SUPABASE_URL').rstrip('/'), env('SUPABASE_SERVICE_ROLE_KEY')
    req = urllib.request.Request(base + chemin, method=methode)
    req.add_header('apikey', cle)
    req.add_header('Authorization', 'Bearer ' + cle)
    data = None
    if corps is not None:
        req.add_header('Content-Type', 'application/json')
        data = json.dumps(corps).encode()
    with urllib.request.urlopen(req, data, timeout=120) as r:
        contenu = r.read()
        return contenu if brut else (json.loads(contenu) if contenu else None)


def lire_table(table):
    lignes, page, pas = [], 0, 1000
    while True:
        req = urllib.request.Request(env('SUPABASE_URL').rstrip('/') + f'/rest/v1/{table}?select=*')
        req.add_header('apikey', env('SUPABASE_SERVICE_ROLE_KEY'))
        req.add_header('Authorization', 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'))
        req.add_header('Range', f'{page * pas}-{(page + 1) * pas - 1}')
        with urllib.request.urlopen(req, timeout=120) as r:
            morceau = json.loads(r.read() or b'[]')
        lignes.extend(morceau)
        if len(morceau) < pas:
            return lignes
        page += 1


def lister_objets(prefixe=''):
    objets, decalage = [], 0
    while True:
        page = appel('POST', f'/storage/v1/object/list/{BUCKET}',
                     {'prefix': prefixe, 'limit': 1000, 'offset': decalage,
                      'sortBy': {'column': 'name', 'order': 'asc'}}) or []
        for o in page:
            if o.get('id') is None:          # un dossier : descendre dedans
                objets.extend(lister_objets((prefixe + '/' if prefixe else '') + o['name']))
            else:
                objets.append((prefixe + '/' if prefixe else '') + o['name'])
        if len(page) < 1000:
            return objets
        decalage += 1000


def exporter(dossier):
    controler_la_liste()
    cible = os.path.join(dossier, datetime.date.today().isoformat())
    os.makedirs(os.path.join(cible, 'fichiers'), exist_ok=True)

    comptes = lire_comptes()
    with open(os.path.join(cible, 'auth-comptes.json'), 'w', encoding='utf-8') as f:
        json.dump(comptes, f, ensure_ascii=False, indent=1)
    print('%-14s %6d comptes (sans mot de passe : l\'API n\'en rend aucun)'
          % ('auth', len(comptes)))

    total = 0
    for t in TABLES:
        lignes = lire_table(t)
        with open(os.path.join(cible, f'{t}.json'), 'w', encoding='utf-8') as f:
            json.dump(lignes, f, ensure_ascii=False, indent=1)
        print(f'{t:14s} {len(lignes):6d} lignes')
        total += len(lignes)
    objets = lister_objets()
    for chemin in objets:
        dest = os.path.join(cible, 'fichiers', chemin)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            f.write(appel('GET', f'/storage/v1/object/{BUCKET}/{urllib.parse.quote(chemin)}', brut=True))
    print(f'{len(objets)} fichiers copiés, {total} lignes de tables, dans {cible}')
    # Vérification : autant de fichiers copiés que listés, autant de rendus avec fichier que d'objets attendus.
    tous_rendus = lire_table('rendus')
    rendus = [r for r in tous_rendus if r.get('fichier')]
    manquants = [r['fichier'] for r in rendus if r['fichier'] not in objets]
    if manquants:
        print(f'ATTENTION : {len(manquants)} rendu(s) pointent vers un fichier absent du bucket : {manquants[:5]}')
    else:
        print('vérification : chaque dépôt a son fichier.')

    # LE CONTROLE INVERSE, qui manquait. Le dépôt se fait en deux temps :
    # une ligne, puis le téléversement, puis la confirmation. Si la liaison
    # tombe entre les deux derniers, l'objet reste dans le bucket sans qu'aucune
    # ligne ne pointe vers lui. Il échappe alors à l'écran du professeur, à la
    # purge de fin de cycle et à cette vérification-ci, qui ne regardait que
    # dans un sens. Un travail d'élève mineur qui ne peut plus être ni vu ni
    # supprimé reste un travail d'élève mineur.
    attendus = {r['fichier'] for r in rendus}
    orphelins = sorted(o for o in objets if o not in attendus)
    if orphelins:
        print('ATTENTION : %d fichier(s) du bucket ne correspondent à aucun dépôt. '
              'Ils sont copiés, et listés dans ORPHELINS.txt.' % len(orphelins))
        with open(os.path.join(cible, 'ORPHELINS.txt'), 'w', encoding='utf-8') as f:
            f.write('Fichiers présents dans le bucket et rattachés à aucune ligne de rendus.\n'
                    'Cause la plus probable : une liaison coupée entre le téléversement et\n'
                    'la confirmation du dépôt. Ils n\'apparaissent sur aucun écran.\n\n')
            f.write('\n'.join(orphelins) + '\n')
    else:
        print('vérification : aucun fichier orphelin dans le bucket.')

    with open(os.path.join(cible, 'SAUVEGARDE.txt'), 'w', encoding='utf-8') as f:
        f.write(f'Sauvegarde du {datetime.datetime.now().isoformat(timespec="minutes")}\n'
                f'{len(comptes)} comptes Auth, {total} lignes de tables, {len(objets)} fichiers.\n'
                f'{len(manquants)} dépôt(s) sans fichier, {len(orphelins)} fichier(s) sans dépôt.\n'
                '\n'
                'CE QUE CETTE SAUVEGARDE NE CONTIENT PAS, et qu\'il faudra refaire à la main :\n'
                '  - les mots de passe. L\'API d\'administration de Supabase n\'en rend aucune\n'
                '    empreinte. Après restauration, chaque élève reçoit un mot de passe\n'
                '    provisoire, par groupe, depuis enseignant/classeur.html.\n'
                '  - le schéma lui-même : tables, politiques RLS, fonctions, déclencheurs.\n'
                '    Il se rejoue avec db/01 à db/18, dans l\'ordre.\n'
                '  - la configuration : bucket et ses limites, gabarits de courriel,\n'
                '    adresses de redirection, variables d\'environnement de Vercel.\n'
                '\n'
                'Contient des données d\'élèves mineurs : support chiffré, accès restreint,\n'
                'purge avec le compte.\n')


def reparer_depots(ecrire_vraiment):
    """Rend aux élèves les dépôts que la confirmation n'a jamais atteints.

    LE DEFAUT. Déposer se fait en trois temps : api/classeur/preparer-depot.js
    crée la ligne avec `fichier` à null, le navigateur téléverse chez Supabase,
    puis confirmer-depot.js renseigne la colonne. Si la liaison tombe entre les
    deux derniers, le travail de l'élève EST chez Supabase et n'apparaît nulle
    part : ni sur son classeur, ni sur l'écran du professeur, qui le compte
    comme non rendu.

    LA REPARATION EST SURE, et c'est ce qui la rend possible. Le chemin de
    l'objet est `profil_id/rendu_id.ext`, formé côté serveur : le nom du
    fichier EST l'identifiant de la ligne. Un objet et une ligne ne sont donc
    rapprochés que s'ils portent le même identifiant ET le même élève. Aucun
    rapprochement approximatif, aucune date à interpréter.

    Six cas constatés le 1er octobre 2026, dont cinq réparables : cinq
    diagnostiques de 5e rendus les 21, 23 et 29 septembre, comptés absents.
    """
    objets = lister_objets()
    rendus = {str(r['id']): r for r in lire_table('rendus')}
    profils = {p['id']: (p.get('email') or '').split('@')[0] for p in lire_table('profils')}
    attendus = {r['fichier'] for r in rendus.values() if r.get('fichier')}

    reparables, sans_ligne, etranges = [], [], []
    for o in objets:
        if o in attendus:
            continue
        morceaux = o.split('/')
        if len(morceaux) != 2:
            etranges.append(o)
            continue
        pid, nom = morceaux
        rid = nom.rsplit('.', 1)[0]
        r = rendus.get(rid)
        if not r:
            sans_ligne.append((o, pid))
        elif r.get('fichier'):
            etranges.append(o)              # la ligne pointe ailleurs : on ne touche pas
        elif r.get('profil_id') != pid:
            etranges.append(o)              # chemin et ligne en désaccord : on ne touche pas
        else:
            reparables.append((o, r))

    print('%d objet(s) dans le bucket, %d rattaché(s) à un dépôt.'
          % (len(objets), len(attendus)))
    print('  réparables       : %d (une ligne les attend, du même élève)' % len(reparables))
    print('  sans aucune ligne: %d (la ligne a été supprimée, le fichier non)' % len(sans_ligne))
    print('  à regarder       : %d' % len(etranges))

    if reparables:
        print('\nA REPARER :')
        for o, r in reparables:
            print('  %-28s %-26s déposé le %s'
                  % (profils.get(r['profil_id'], '?'), str(r.get('sequence'))[:26],
                     str(r.get('depose_le'))[:16]))
    if sans_ligne:
        print('\nSANS LIGNE, à trancher à la main (ni réparés ni supprimés ici) :')
        for o, pid in sans_ligne:
            print('  %-28s %s' % (profils.get(pid, '?'), o))
        print('  Soit le dépôt a été supprimé et le fichier est resté : il faut')
        print('  alors l\'effacer. Soit il est encore attendu : il faut recréer la')
        print('  ligne. Les deux se décident en regardant le fichier.')

    if not ecrire_vraiment:
        print('\nRien n\'a été modifié. Relancer avec --ecrire pour rattacher les %d dépôt(s).'
              % len(reparables))
        return
    for o, r in reparables:
        appel('PATCH', '/rest/v1/rendus?id=eq.%s' % r['id'], {'fichier': o})
    print('\n%d dépôt(s) rendus visibles à leur élève et à son professeur.' % len(reparables))


SEQUENCES = ['tentatives', 'journal_repli', 'journal']   # bigserial : setval après coup


def colonnes_en_base(table):
    """Les colonnes que PostgREST déclare pour une table."""
    req = urllib.request.Request(env('SUPABASE_URL').rstrip('/') + '/rest/v1/')
    req.add_header('apikey', env('SUPABASE_SERVICE_ROLE_KEY'))
    req.add_header('Authorization', 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'))
    req.add_header('Accept', 'application/openapi+json')
    with urllib.request.urlopen(req, timeout=120) as r:
        schema = json.loads(r.read() or b'{}')
    defs = schema.get('definitions') or schema.get('components', {}).get('schemas', {})
    return set((defs.get(table) or {}).get('properties') or {})


def restaurer(dossier, ecrire_vraiment):
    """Remonte une sauvegarde dans un projet Supabase VIDE.

    L'ORDRE EST LE SUJET. Quatre temps, et pas d'autre :
      1. rejouer db/01 à db/18 dans l'éditeur SQL. Ce script ne le fait pas :
         il n'a pas de connexion SQL, et un schéma se relit avant de se poser.
      2. recréer les comptes Auth EN IMPOSANT leur uuid d'origine. C'est le
         verrou : public.profils.id référence auth.users(id), et le chemin du
         bucket est <uuid de l'élève>/<uuid du dépôt>. Un uuid neuf casse à la
         fois les clés étrangères et les chemins des fichiers.
      3. insérer profils, puis groupes, puis les douze autres tables.
      4. remettre les trois séquences bigserial à leur place, sinon la
         première écriture suivante répond 23505.

    CE QU'ELLE NE REND PAS. Les mots de passe : l'API d'administration ne
    sérialise jamais l'empreinte (internal/models/user.go, `json:"-"`). Chaque
    élève repart donc d'un provisoire, par groupe, avec l'écran qui existe.
    Les dates de création des comptes Auth non plus. Pour une restauration
    vraiment fidèle, il faut un `pg_dump` : voir l'en-tête de ce fichier.
    """
    if not os.path.isdir(dossier):
        print('dossier introuvable : %s' % dossier)
        sys.exit(2)
    fichier_comptes = os.path.join(dossier, 'auth-comptes.json')
    if not os.path.exists(fichier_comptes):
        print('ARRET : %s est absent. Cette sauvegarde est antérieure à l\'export des'
              % fichier_comptes)
        print('comptes Auth, et elle n\'est donc PAS restaurable : sans les uuid d\'origine,')
        print('la première insertion dans profils échoue et les treize autres tables tombent.')
        sys.exit(3)
    comptes = json.load(open(fichier_comptes, encoding='utf-8'))

    # ON NE RESTAURE QUE DANS LE VIDE. Réinjecter par-dessus une base vivante
    # échouerait de toute façon (groupes.code est unique), mais à moitié : des
    # comptes seraient créés, des lignes insérées, et l'état final ne serait ni
    # l'ancien ni le nouveau. On refuse avant d'avoir rien touché.
    deja = lire_table('profils')
    if deja:
        print('ARRET : ce projet contient déjà %d profil(s).' % len(deja))
        print('Une restauration ne se fait que dans un projet VIDE : à moitié posée,')
        print('elle laisse un état qui n\'est ni l\'ancien ni le nouveau. Videz le projet,')
        print('ou restaurez ailleurs.')
        sys.exit(3)

    print('%d compte(s) Auth à recréer.' % len(comptes))
    plan = []
    for t in TABLES:
        chemin = os.path.join(dossier, t + '.json')
        if not os.path.exists(chemin):
            print('  %-14s ABSENT de la sauvegarde' % t)
            continue
        lignes = json.load(open(chemin, encoding='utf-8'))
        attendues = colonnes_en_base(t)
        exportees = set().union(*[set(l) for l in lignes]) if lignes else set()
        neuves = sorted(attendues - exportees)
        print('  %-14s %6d ligne(s)%s' % (t, len(lignes),
              ('  (colonne(s) apparue(s) depuis : %s, la valeur par défaut s\'appliquera)'
               % ', '.join(neuves)) if neuves and lignes else ''))
        plan.append((t, lignes))

    objets = []
    racine = os.path.join(dossier, 'fichiers')
    for dos, _, noms in os.walk(racine):
        for n in noms:
            objets.append(os.path.relpath(os.path.join(dos, n), racine))
    print('  %-14s %6d fichier(s) du bucket' % ('fichiers', len(objets)))

    if not ecrire_vraiment:
        print('\nRien n\'a été écrit. Avant de relancer avec --ecrire :')
        print('  1. rejouer db/01 à db/18 dans l\'éditeur SQL de Supabase, dans l\'ordre ;')
        print('  2. vérifier avec db/02-verification.sql ;')
        print('  3. puis seulement : --restaurer %s --ecrire' % dossier)
        print('\nAprès la restauration, chaque élève devra recevoir un mot de passe')
        print('provisoire par groupe : aucune empreinte n\'est sauvegardable.')
        return

    # ---- 1. les comptes, avec leur uuid d'origine -------------------------
    poses, rates = 0, []
    for c in comptes:
        corps = {'id': c['id'], 'email': c['email'],
                 'email_confirm': bool(c.get('email_confirmed_at')),
                 'user_metadata': c.get('user_metadata') or {},
                 'app_metadata': c.get('app_metadata') or {},
                 # UN MOT DE PASSE EXPLICITE, MEME INUTILISABLE. Sans lui,
                 # GoTrue en fabrique un au hasard et ne le rend pas : le
                 # compte existe, personne ne peut s'en servir, et rien ne le
                 # signale. On en pose donc un que personne ne connaît, et le
                 # professeur redonne un provisoire par groupe.
                 'password': base64.urlsafe_b64encode(os.urandom(33)).decode()}
        try:
            appel('POST', '/auth/v1/admin/users', corps)
            poses += 1
        except urllib.error.HTTPError as e:
            # Un uuid déjà pris rend 500, pas 409 : GoTrue n'a pas d'erreur
            # typée pour la collision de clé primaire. Relancer deux fois ce
            # script ne reprend donc pas proprement, il accumule des échecs.
            rates.append((c['email'], e.code))
    print('comptes recréés : %d, en échec : %d' % (poses, len(rates)))
    for adresse, code in rates[:10]:
        print('   %s -> HTTP %d' % (adresse, code))
    if rates:
        print('ARRET : des comptes manquent, les clés étrangères échoueraient.')
        sys.exit(4)

    # ---- 2. les tables, dans l'ordre des clés étrangères ------------------
    for t, lignes in plan:
        for i in range(0, len(lignes), 200):
            appel('POST', '/rest/v1/' + t, lignes[i:i + 200])
        print('%-14s %6d ligne(s) réinsérée(s)' % (t, len(lignes)))

    # ---- 3. les fichiers --------------------------------------------------
    for rel in objets:
        with open(os.path.join(racine, rel), 'rb') as f:
            contenu = f.read()
        req = urllib.request.Request(
            env('SUPABASE_URL').rstrip('/') + '/storage/v1/object/%s/%s'
            % (BUCKET, urllib.parse.quote(rel)), data=contenu, method='POST')
        req.add_header('apikey', env('SUPABASE_SERVICE_ROLE_KEY'))
        req.add_header('Authorization', 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'))
        req.add_header('Content-Type', 'application/octet-stream')
        try:
            urllib.request.urlopen(req, timeout=120)
        except urllib.error.HTTPError as e:
            print('fichier refusé : %s (HTTP %d)' % (rel, e.code))
    print('%d fichier(s) remis dans le bucket.' % len(objets))

    print('\nIL RESTE TROIS GESTES, qu\'aucun script ne peut faire :')
    print('  - remettre les séquences %s à leur plus grand identifiant'
          % ', '.join(SEQUENCES))
    print('    (select setval(pg_get_serial_sequence(\'public.X\', \'id\'),')
    print('     coalesce(max(id), 1)) from public.X ; pour chacune) ;')
    print('  - redonner un mot de passe provisoire par groupe, depuis')
    print('    enseignant/classeur.html ;')
    print('  - reposer la configuration hors base : relais SMTP, adresses de')
    print('    redirection d\'Auth, gabarits de courriel, variables Vercel.')


# CE QUI SE RESTITUE A UNE FAMILLE, ET CE QUI NE S'Y RESTITUE PAS.
#
# A gauche la table, au milieu la colonne qui porte le lien avec l'élève, à
# droite les colonnes ECARTEES. Elles le sont pour une seule raison : elles
# désignent quelqu'un d'autre. `par`, `prof_id`, `acteur`, `retire_par`
# nomment un professeur ; les restituer ferait d'une demande d'accès un moyen
# de savoir qui a fait quoi dans l'établissement. Le geste se restitue daté,
# jamais attribué.
RESTITUTION = [
    ('profils',       'id',        ()),
    ('appartenances', 'profil_id', ()),
    ('rendus',        'profil_id', ()),
    ('reponses',      'profil_id', ()),
    ('exceptions',    'profil_id', ('par',)),
    ('scores',        'profil_id', ()),
    ('pix',           'profil_id', ()),
    ('tentatives',    'profil_id', ()),
    ('journal_repli', 'eleve_id',  ('prof_id',)),
    ('journal',       'cible',     ('acteur',)),
]

# Les colonnes de texte libre. Un élève y écrit ce qu'il veut, un professeur
# aussi : le prénom d'un binôme, une appréciation qui cite un camarade. On ne
# censure pas, on SIGNALE, et un humain relit avant de remettre.
TEXTE_LIBRE = {'rendus': ('commentaire', 'binome', 'appreciation'),
               'reponses': ('texte', 'correction')}


def restituer_eleve(adresse, dossier):
    """Rassemble tout ce que la base sait d'UN élève (RGPD, droit d'accès).

    La page donnees-personnelles.html promet aux familles de pouvoir consulter
    les données de leur enfant, avec une réponse dans le mois. Jusqu'ici le
    seul moyen d'y répondre était d'exporter les 561 comptes sur un disque,
    puis de filtrer dix fichiers à la main : chaque demande fabriquait une
    copie complète des données de tous les élèves, c'est-à-dire exactement le
    risque que le chiffrement et la purge cherchent à contenir.

    Trois choix, et leurs raisons :
      - l'extraction part de l'UUID, obtenu une fois par l'adresse. Jamais du
        nom : deux élèves peuvent le partager.
      - un compte à la corbeille est accepté. La demande arrive souvent APRES
        le départ, et un filtre sur `actif` raterait précisément ces cas.
      - la sortie est un document lisible, pas un JSON. Une famille ne lit pas
        un JSON. Le JSON l'accompagne en annexe.
    """
    profils = [p for p in lire_table('profils')
               if (p.get('email') or '').lower() == adresse.strip().lower()]
    if not profils:
        print('aucun compte pour cette adresse.')
        sys.exit(2)
    if len(profils) > 1:
        print('ATTENTION : %d comptes portent cette adresse.' % len(profils))
    moi = profils[0]
    uuid_eleve = moi['id']

    cible = os.path.join(dossier, 'restitution-%s-%s'
                         % (adresse.split('@')[0], datetime.date.today().isoformat()))
    os.makedirs(os.path.join(cible, 'documents-deposes'), exist_ok=True)

    groupes = {g['id']: g for g in lire_table('groupes')}
    recolte, signales = {}, []
    for table, colonne, ecartees in RESTITUTION:
        lignes = [l for l in lire_table(table) if l.get(colonne) == uuid_eleve]
        propres = []
        for l in lignes:
            l = {k: v for k, v in l.items() if k not in ecartees}
            for c in TEXTE_LIBRE.get(table, ()):
                if (l.get(c) or '').strip():
                    signales.append((table, c, (l.get(c) or '')[:60]))
            propres.append(l)
        recolte[table] = propres
        print('%-14s %4d ligne(s)%s' % (table, len(propres),
              '  (sans %s)' % ', '.join(ecartees) if ecartees else ''))

    objets = [o for o in lister_objets(uuid_eleve)]
    for chemin in objets:
        dest = os.path.join(cible, 'documents-deposes', os.path.basename(chemin))
        with open(dest, 'wb') as f:
            f.write(appel('GET', '/storage/v1/object/%s/%s'
                          % (BUCKET, urllib.parse.quote(chemin)), brut=True))
    print('%-14s %4d fichier(s) déposé(s)' % ('bucket', len(objets)))

    with open(os.path.join(cible, 'donnees.json'), 'w', encoding='utf-8') as f:
        json.dump(recolte, f, ensure_ascii=False, indent=1)
    ecrire_restitution(os.path.join(cible, 'restitution.html'), moi, recolte,
                       groupes, objets)

    print('\nDossier : %s' % cible)
    if signales:
        print('\n%d texte(s) libre(s) À RELIRE avant remise : ils peuvent nommer'
              ' un tiers.' % len(signales))
        for t, c, extrait in signales[:8]:
            print('   %s.%s : %s…' % (t, c, extrait.replace('\n', ' ')))
    print('\nSupport chiffré. Ce dossier ne contient que cet élève, et aucune')
    print('mention du professeur qui a posé tel geste : un droit d\'accès n\'est')
    print('pas un droit de savoir qui a fait quoi dans l\'établissement.')


MOIS = ('janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
        'août', 'septembre', 'octobre', 'novembre', 'décembre')

# LES CODES INTERNES N'ONT PAS A SORTIR. « compte.cree », « a_reprendre »,
# « tres_bonne » sont des valeurs de colonne ; une famille lit du français.
MOTS = {
    'compte.cree': 'Compte créé', 'compte.rattache': 'Compte rattaché',
    'compte.reactive': 'Compte réactivé', 'compte.retire': 'Retiré d\'un groupe',
    'compte.desactive': 'Compte mis à la corbeille', 'compte.restaure': 'Compte restauré',
    'compte.promu': 'Compte promu', 'compte.modifie': 'Nom corrigé',
    'compte.supprime': 'Compte supprimé', 'mdp.change': 'Mot de passe changé',
    'mdp.reinitialise': 'Mot de passe réinitialisé', 'liste.importee': 'Importé depuis une liste',
    'depot.supprime': 'Dépôt supprimé', 'fichier.consulte': 'Document consulté',
    'mot.efface': 'Mot effacé', 'reponse.supprimee': 'Réponse supprimée',
    'pix.confirme': 'Rapprochement Pix confirmé', 'pix.refuse': 'Rapprochement Pix écarté',
    'absent': 'absent', 'a_reprendre': 'à reprendre', 'rattrape': 'rattrapé',
    'insuffisante': 'maîtrise insuffisante', 'fragile': 'maîtrise fragile',
    'satisfaisante': 'maîtrise satisfaisante', 'tres_bonne': 'très bonne maîtrise',
    'connexion': 'connexion', 'ressaisie': 'ressaisie du mot de passe', 'lien': 'lien reçu par courriel',
    'en_cours': 'en cours', 'terminee': 'terminée',
}


def pluriel(n, singulier, pluriel_=None):
    return '%d %s' % (n, singulier if n < 2 else (pluriel_ or singulier + 's'))


def titres_du_catalogue():
    """{code de séquence: titre lisible}, lu dans catalogue.json s'il est là.

    « 5eme/p1/diagnostique » ne veut rien dire pour une famille. Le catalogue
    du site porte déjà le titre de chaque séquence : autant s'en servir, et se
    rabattre sur le code quand il manque plutôt que de refuser de produire.
    """
    for chemin in ('catalogue.json', os.path.join(os.path.dirname(__file__), '..', 'catalogue.json')):
        try:
            with open(chemin, encoding='utf-8') as f:
                cat = json.load(f)
            # Le code d'une séquence est `dossier/cle` : le catalogue ne porte
            # pas d'identifiant tout fait.
            return {'%s/%s' % (s['dossier'], s['cle']): s.get('titre', s['cle'])
                    for n in (cat.get('niveaux') or {}).values()
                    for s in (n.get('sequences') or [])}
        except (OSError, ValueError, KeyError, TypeError):
            continue
    return {}


def ecrire_restitution(chemin, moi, recolte, groupes, objets):
    """Le document que la famille lit. Du HTML : il s'imprime et s'ouvre partout.

    IL EST ECRIT POUR ETRE LU, ce qui exclut trois choses que la base contient
    telles quelles : les booléens bruts (« Certifiable : False »), les
    horodatages ISO (« 2026-09-02T08:00:00Z ») et les codes de séquence
    (« 5eme/p1/diagnostique »). Les trois se traduisent ici.

    Les intitulés ne présument pas non plus du genre de l'élève : « Les
    travaux déposés », et non « les travaux qu'il a déposés ».
    """
    titres = titres_du_catalogue()

    def e(x):
        return (str('' if x is None else x).replace('&', '&amp;')
                .replace('<', '&lt;').replace('>', '&gt;'))

    def lisible(v, cle=''):
        if v is None or v == '':
            return ''
        if isinstance(v, bool):
            return 'oui' if v else 'non'
        t = str(v)
        # un horodatage, avec ou sans heure
        if len(t) >= 10 and t[4] == '-' and t[7] == '-' and t[:4].isdigit():
            try:
                a, m, j = int(t[:4]), int(t[5:7]), int(t[8:10])
                jour = '%d%s %s %d' % (j, 'er' if j == 1 else '', MOIS[m - 1], a)
                return jour + (' à %sh%s' % (t[11:13], t[14:16]) if len(t) >= 16 and t[10] in 'T ' else '')
            except (ValueError, IndexError):
                return t
        if cle in ('sequence', 'quiz', 'page'):
            return titres.get(t, t)
        return MOTS.get(t, t)

    def section(titre, lignes, colonnes, vide):
        if not lignes:
            return '<h2>%s</h2><p class="vide">%s</p>' % (e(titre), e(vide))
        tete = ''.join('<th>%s</th>' % e(c[1]) for c in colonnes)
        corps = ''.join('<tr>%s</tr>' % ''.join(
            '<td>%s</td>' % e(lisible(c[2](l) if len(c) > 2 else l.get(c[0]), c[0]))
            for c in colonnes) for l in lignes)
        return ('<h2>%s</h2><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>'
                % (e(titre), tete, corps))

    nom_groupe = lambda l: (groupes.get(l.get('groupe_id')) or {}).get('libelle', '')
    parts = [section(
        'Le compte', recolte['profils'],
        [('prenom', 'Prénom'), ('nom', 'Nom'), ('email', 'Adresse'),
         ('cree_le', 'Compte créé le'), ('derniere_connexion', 'Dernière connexion'),
         ('actif', 'Compte actif')], '')]
    parts.append(section('Les groupes', recolte['appartenances'],
        [('groupe_id', 'Groupe', nom_groupe),
         ('version_adaptee', 'Version adaptée des fiches')],
        'Aucun groupe.'))
    parts.append(section('Les travaux déposés', recolte['rendus'],
        [('depose_le', 'Déposé le'), ('sequence', 'Séquence'), ('document', 'Document'),
         ('groupe_id', 'Groupe', nom_groupe), ('commentaire', 'Son mot au professeur'),
         ('appreciation', 'Appréciation'), ('maitrise', 'Maîtrise'),
         ('corrige_le', 'Corrigé le')],
        'Aucun travail déposé.'))
    parts.append(section('Ce qui a été écrit dans les fiches', recolte['reponses'],
        [('page', 'Fiche'), ('question', 'Champ'), ('intitule', 'Intitulé'),
         ('texte', 'Sa réponse'), ('correction', 'Correction du professeur'),
         ('redige_le', 'Écrit le')],
        'Aucune réponse écrite dans une fiche.'))
    parts.append(section('Les résultats aux quiz', recolte['scores'],
        [('quiz', 'Quiz'), ('meilleur', 'Meilleur score'), ('total', 'Sur'),
         ('meilleur_le', 'Obtenu le')], 'Aucun quiz passé.'))
    parts.append(section('Le relevé Pix', recolte['pix'],
        [('nom_pix', 'Nom saisi dans Pix'), ('classe', 'Campagne'), ('score', 'Pix'),
         ('certifiable', 'Certifiable'), ('envoi', 'Profil envoyé le')],
        'Aucun relevé Pix.'))
    parts.append(section('Les absences et les séances à reprendre', recolte['exceptions'],
        [('le', 'Date'), ('sequence', 'Séquence'), ('seance', 'Séance'), ('etat', 'État')],
        'Aucune.'))
    parts.append(section('Les incidents signalés en classe', recolte['journal_repli'],
        [('quand', 'Date'), ('motif', 'Motif'), ('vu_par_eleve', 'Vu par l\'élève')],
        'Aucun.'))
    parts.append(section('Les connexions enregistrées', recolte['tentatives'],
        [('quand', 'Date'), ('origine', 'Origine')], 'Aucune.'))
    parts.append(section('Les opérations enregistrées sur le compte', recolte['journal'],
        [('quand', 'Date'), ('action', 'Opération'), ('detail', 'Détail')],
        'Aucun.'))

    docs = ('<h2>Les documents déposés</h2><p>%s, dans le dossier '
            '« documents-deposes » à côté de ce document.</p>'
            % pluriel(len(objets), 'fichier')) if objets \
        else '<h2>Les documents déposés</h2><p class="vide">Aucun.</p>'

    html = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Données personnelles</title>
<style>
/* UN DOCUMENT, PAS UNE APPLICATION. Il se lit chez la famille, dans un
   navigateur dont on ne sait rien, et il s'imprime. Sans fond explicite, le
   texte foncé s'affichait sur le fond sombre du navigateur : illisible.
   color-scheme: light le dit aussi aux formulaires et aux barres. */
:root { color-scheme: light; }
body { font: 16px/1.55 "Nunito Sans", system-ui, sans-serif; color: #1F2A37;
  background: #FFFFFF;
  max-width: 60rem; margin: 2rem auto; padding: 0 1.5rem; }
h1 { font-size: 1.6rem; } h2 { font-size: 1.1rem; margin-top: 2rem;
  border-bottom: 2px solid #E3E8EE; padding-bottom: .3rem; }
table { border-collapse: collapse; width: 100%%; font-size: .9rem; }
th, td { border: 1px solid #E3E8EE; padding: .35rem .5rem; text-align: left;
  vertical-align: top; }
th { background: #F3F5F7; font-weight: 700; }
td { overflow-wrap: anywhere; }
.vide { color: #5F6B7A; font-style: italic; }
.chapeau { background: #F3F5F7; padding: .8rem 1rem; border-radius: 10px; }
@media print { body { margin: 0; } h2 { page-break-after: avoid; } }
</style></head><body>
<h1>Données personnelles de %s %s</h1>
<p class="chapeau">Document établi le %s par le professeur de Technologie du Lycée
Français de Tananarive, en réponse à une demande d'accès. Il rassemble tout ce
que le classeur en ligne conserve sur cet élève.<br><br>
Les gestes sont datés mais non attribués&nbsp;: savoir qui, dans l'établissement,
a posé telle opération ne relève pas du droit d'accès de l'élève. Les travaux déposés
sont joints dans le dossier voisin.</p>
%s
<h2>Ce que vous pouvez demander</h2>
<p>Vous pouvez demander la correction de ce qui serait inexact, ou la
suppression de ces données, auprès du professeur de Technologie de
l'établissement. Les travaux déposés sont effacés à la fin du cycle, en même
temps que le compte.</p>
</body></html>""" % (e(moi.get('prenom')), e(moi.get('nom')),
                     datetime.date.today().strftime('%d/%m/%Y'),
                     ''.join(parts) + docs)
    with open(chemin, 'w', encoding='utf-8') as f:
        f.write(html)


def purger_fichiers(fichier_adresses):
    with open(fichier_adresses, encoding='utf-8') as f:
        adresses = {l.strip().lower() for l in f if l.strip() and '@' in l}
    if not adresses:
        print('aucune adresse dans le fichier.')
        return
    profils = [p for p in lire_table('profils') if p['email'].lower() in adresses]
    print(f'{len(profils)} compte(s) trouvé(s) pour {len(adresses)} adresse(s).')
    objets = lister_objets()
    a_supprimer = [o for o in objets if any(o.startswith(p['id'] + '/') for p in profils)]
    print(f'{len(a_supprimer)} fichier(s) à supprimer.')
    if a_supprimer and input('Confirmer la suppression (oui/non) ? ').strip().lower() == 'oui':
        appel('DELETE', f'/storage/v1/object/{BUCKET}', {'prefixes': a_supprimer})
        print('supprimés. Supprimez maintenant les comptes dans Supabase Auth (db/10-purge-fin-de-cycle.sql).')
    else:
        print('rien supprimé.')


if __name__ == '__main__':
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == '--exporter':
        exporter(args[1])
    elif len(args) == 2 and args[0] == '--purger-fichiers':
        purger_fichiers(args[1])
    elif args and args[0] == '--reparer-depots':
        reparer_depots('--ecrire' in args)
    elif len(args) >= 2 and args[0] == '--restaurer':
        restaurer(args[1], '--ecrire' in sys.argv)
    elif len(args) == 3 and args[0] == '--eleve':
        restituer_eleve(args[1], args[2])
    else:
        print(__doc__)
        sys.exit(1)
