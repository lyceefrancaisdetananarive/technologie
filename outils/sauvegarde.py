#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sauvegarde et purge des fichiers du classeur (fiche de traitement, sections 8
et 9 ; CNIL, « Sauvegarder et prévoir la continuité d'activité »).

    python3 outils/sauvegarde.py --exporter DOSSIER
        copie toutes les tables du classeur (JSON) et tous les objets du
        bucket « rendus » dans DOSSIER/AAAA-MM-JJ/, puis vérifie le décompte.

    python3 outils/sauvegarde.py --purger-fichiers ADRESSES.txt
        supprime du bucket les fichiers des élèves dont l'adresse figure dans
        ADRESSES.txt (une par ligne). À lancer AVANT la suppression des
        comptes (db/10-purge-fin-de-cycle.sql), après un export.

Les deux clés sont lues dans l'environnement, jamais dans un fichier :
    SUPABASE_URL=https://....supabase.co SUPABASE_SERVICE_ROLE_KEY=... python3 outils/sauvegarde.py --exporter /Volumes/CHIFFRE/sauvegardes

Le dossier de destination doit être un support chiffré de l'établissement :
il contient des données d'élèves mineurs. Sans dépendance : Python 3 et sa
bibliothèque standard. Ce script n'est pas déployé (outils/*.py est exclu).
"""
import datetime
import json
import os
import sys
import urllib.parse
import urllib.request

TABLES = ['profils', 'groupes', 'appartenances', 'rendus', 'reponses', 'plans', 'avancement',
          'exceptions', 'scores', 'journal_repli', 'journal', 'tentatives']
BUCKET = 'rendus'


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
    cible = os.path.join(dossier, datetime.date.today().isoformat())
    os.makedirs(os.path.join(cible, 'fichiers'), exist_ok=True)
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
    rendus = [r for r in lire_table('rendus') if r.get('fichier')]
    manquants = [r['fichier'] for r in rendus if r['fichier'] not in objets]
    if manquants:
        print(f'ATTENTION : {len(manquants)} rendu(s) pointent vers un fichier absent du bucket : {manquants[:5]}')
    else:
        print('vérification : chaque dépôt a son fichier.')
    with open(os.path.join(cible, 'SAUVEGARDE.txt'), 'w', encoding='utf-8') as f:
        f.write(f'Sauvegarde du {datetime.datetime.now().isoformat(timespec="minutes")}\n'
                f'{total} lignes, {len(objets)} fichiers, {len(manquants)} manquants.\n'
                'Contient des données d\'élèves mineurs : support chiffré, accès restreint, purge avec le compte.\n')


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
    else:
        print(__doc__)
        sys.exit(1)
