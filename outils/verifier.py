#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vérificateur : à lancer avant chaque déploiement.

    python3 outils/verifier.py

Échoue (code de sortie 1) sur ce qui casserait le site pour un élève :
  · un lien interne vers un fichier absent, dans n'importe quelle page ;
  · un des 165 codes de cahier (go.html) qui ne mène plus à un fichier, ou
    dont la table ne correspond plus au catalogue ;
  · un document du catalogue absent du disque, ou une page de séquence sur le
    disque que le catalogue ignore ;
  · un bloc généré qui n'est plus à jour (lancer outils/generer.py) ;
  · une faute de saisie dans catalogue.json (numéro, période, dossier, code
    en double, champ vide) ;
  · une entrée de recherche vers un fichier absent, ou vers un corrigé.

Signale sans échouer (avertissements) ce qui se corrige en phase 2 :
  · une page dont le nombre de séances affiché diffère du catalogue ;
  · une police chargée depuis un serveur tiers ;
  · le nombre de pages qui portent encore leur propre bloc <style>.

Sans dépendance : Python 3 et sa bibliothèque standard.
"""
import glob
import json
import os
import re
import sys
from urllib.parse import unquote

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RACINE)
sys.path.insert(0, os.path.join(RACINE, 'outils'))

EXCLUS = ('_a_fusionner/', '/t1/', '/t2/', '/t3/', 'node_modules/', '.git/', '.vercel/', 'db/')
ERREURS = []
AVERTS = []


def erreur(m):
    ERREURS.append(m)


def avert(m):
    AVERTS.append(m)


def pages_deployees():
    for p in sorted(glob.glob('**/*.html', recursive=True)):
        q = '/' + p
        if any(x in q for x in EXCLUS) or os.path.basename(p).startswith('._'):
            continue
        yield p


def lire(p):
    with open(p, encoding='utf-8', errors='replace') as f:
        return f.read()


def cible_existe(page, ref):
    ref = ref.split('#', 1)[0].split('?', 1)[0]
    ref = unquote(ref)
    if not ref:
        return True
    if ref.startswith('/'):
        chemin = ref.lstrip('/')
    else:
        chemin = os.path.normpath(os.path.join(os.path.dirname(page), ref))
    if chemin in ('', '.'):
        return True
    if os.path.isdir(chemin):
        return os.path.exists(os.path.join(chemin, 'index.html'))
    return os.path.exists(chemin)


def verifier_liens():
    motif = re.compile(r'(?:href|src)\s*=\s*["\']([^"\']+)["\']', re.I)
    ignores = ('http://', 'https://', 'mailto:', 'tel:', '#', 'data:', 'javascript:', '//', '${')
    n = 0
    for page in pages_deployees():
        contenu = lire(page)
        for ref in motif.findall(contenu):
            if ref.startswith(ignores):
                continue
            n += 1
            if not cible_existe(page, ref):
                erreur(f'lien mort : {page} → {ref}')
    return n


def verifier_go(cat):
    page = lire('go.html')
    table = re.findall(r'"([0-9][0-9A-Z]+)"\s*:\s*"([^"]+)"', page)
    codes_go = dict(table)
    if len(table) != len(codes_go):
        erreur('go.html : un code apparaît deux fois')
    if len(codes_go) != 165:
        erreur(f'go.html : {len(codes_go)} codes au lieu de 165 (les cahiers en portent 165)')
    for c, f in codes_go.items():
        if not os.path.exists(f):
            erreur(f'go.html : le code {c} mène à {f}, qui n\'existe pas')
    attendus = {}
    for niv in cat['niveaux'].values():
        for d in niv['diagnostiques']:
            if 'code' in d['eleve']:
                attendus[d['eleve']['code']] = d['eleve']['fichier']
        for s in niv['sequences']:
            for doc in s['documents'].values():
                if 'code' in doc:
                    attendus[doc['code']] = doc['fichier']
    if attendus != codes_go:
        manque = set(attendus) - set(codes_go)
        trop = set(codes_go) - set(attendus)
        diff = {c for c in attendus if c in codes_go and attendus[c] != codes_go[c]}
        erreur(f'go.html et catalogue divergent : absents de go {sorted(manque)}, absents du catalogue {sorted(trop)}, cibles différentes {sorted(diff)}')
    return len(codes_go)


def verifier_catalogue(cat):
    """Le catalogue est édité à la main : on attrape ici les fautes de saisie les
    plus probables avant qu'elles ne partent dans neuf fichiers générés."""
    connus = set()
    codes_vus = {}
    periodes = {p['n']: p for p in cat['periodes']}
    for niveau, niv in cat['niveaux'].items():
        numeros = [s.get('n') for s in niv['sequences']]
        if sorted(numeros) != list(range(1, len(numeros) + 1)):
            erreur(f'{niveau} : les numéros de séquence ne forment pas la suite 1..{len(numeros)} : {numeros}')
        for s in niv['sequences']:
            ou = f'{niveau} séquence {s.get("n")}'
            for champ in ('n', 'periode', 'cle', 'dossier', 'titre', 'seances', 'documents'):
                if champ not in s or s[champ] in (None, ''):
                    erreur(f'{ou} : champ « {champ} » manquant ou vide dans catalogue.json')
            if any(c not in s for c in ('n', 'periode', 'cle', 'dossier', 'documents')):
                continue
            if s['periode'] not in periodes:
                erreur(f'{ou} : période {s["periode"]} inconnue (1 à {len(periodes)})')
            if str(s['n']) != re.sub(r'\D', '', s['cle']):
                erreur(f'{ou} : la clé « {s["cle"]} » ne porte pas le numéro {s["n"]}')
            if s['dossier'] != f'{niveau}/p{s["periode"]}':
                erreur(f'{ou} : dossier « {s["dossier"]} » incohérent avec {niveau}/p{s["periode"]}')
            if not isinstance(s.get('seances'), int) or not 1 <= s['seances'] <= 9:
                erreur(f'{ou} : « seances » doit être un entier entre 1 et 9 (valeur : {s.get("seances")!r})')
            for cle, doc in s['documents'].items():
                if 'fichier' not in doc:
                    erreur(f'{ou} {cle} : document sans « fichier »')
                    continue
                connus.add(doc['fichier'])
                if not doc['fichier'].startswith(s['dossier'] + '/'):
                    erreur(f'{ou} {cle} : {doc["fichier"]} n\'est pas dans {s["dossier"]}/')
                if not os.path.exists(doc['fichier']):
                    erreur(f'{ou} {cle} → {doc["fichier"]} absent')
                code = doc.get('code')
                if code is not None:
                    if not re.fullmatch(r'[0-9][0-9A-Z]+', code):
                        erreur(f'{ou} {cle} : code « {code} » mal formé')
                    if code in codes_vus:
                        erreur(f'code {code} attribué deux fois : {codes_vus[code]} et {doc["fichier"]}')
                    codes_vus[code] = doc['fichier']
                if cle == 'prof' and not doc.get('reserve'):
                    erreur(f'{ou} : la fiche professeur doit porter reserve: true')
            # Après la phase 2, la fiche ne dit plus elle-même son nombre de
            # séances ni son thème : ils viennent du catalogue. On ne compare
            # qu'avec ce qu'une fiche affiche ENCORE (tableau Durée / Thème).
            for cle_doc in ('activite', 'prof'):
                doc = s['documents'].get(cle_doc)
                if not doc or not os.path.exists(doc['fichier']):
                    continue
                t = lire(doc['fichier'])
                md = re.search(r'<strong>Durée</strong></td>\s*<td[^>]*>\s*(\d+)\s*séances', t)
                if md and int(md.group(1)) != s['seances']:
                    avert(f'{ou} ({cle_doc}) : la fiche affiche {md.group(1)} séances, le catalogue en prévoit {s["seances"]}')
                mt = re.search(r'<strong>Thème</strong></td>\s*<td[^>]*>\s*Th[èe]me\s*(\d)', t)
                if mt and int(mt.group(1)) != s.get('theme'):
                    avert(f'{ou} ({cle_doc}) : la fiche affiche le thème {mt.group(1)}, le catalogue dit {s.get("theme")}')
            if not s.get('activites'):
                avert(f'{ou} : aucune activité repérée dans la fiche (titres « Activité N » absents), à saisir dans le catalogue avant la phase 3')
        for d in niv['diagnostiques']:
            for role in ('eleve', 'prof'):
                if role in d:
                    connus.add(d[role]['fichier'])
                    if not os.path.exists(d[role]['fichier']):
                        erreur(f'{niveau} diagnostique p{d["periode"]} {role} → {d[role]["fichier"]} absent')
            code = d['eleve'].get('code')
            if code:
                if code in codes_vus:
                    erreur(f'code {code} attribué deux fois')
                codes_vus[code] = d['eleve']['fichier']
        for b in niv['bilans'] + niv['annexes']:
            connus.add(b['fichier'])
            if not os.path.exists(b['fichier']):
                erreur(f'{niveau} : {b["fichier"]} (bilan ou annexe) absent')
    for p in glob.glob('[345]eme/p*/*.html'):
        if os.path.basename(p).startswith('._'):
            continue
        if p not in connus:
            erreur(f'page hors catalogue : {p} (relancer outils/catalogue_extraire.py --comparer)')
    return len(connus)


def verifier_recherche():
    contenu = lire('js/components.js')
    a = contenu.find('const SITE_DATA = [')
    b = contenu.find('];', a)
    urls = re.findall(r'url: `\$\{ROOT\}/([^`]+)`', contenu[a:b])
    for u in urls:
        if not os.path.exists(u.split('?')[0].split('#')[0]):
            erreur(f'recherche : {u} n\'existe pas')
        if u.endswith('-prof.html'):
            erreur(f'recherche : {u} est un corrigé, il ne doit pas figurer dans l\'index public')
    return len(urls)


def verifier_generes():
    import generer
    with open('catalogue.json', encoding='utf-8') as f:
        cat = json.load(f)
    perimes = []
    for g in generer.GENERATEURS:
        for chemin, contenu in g(cat).items():
            actuel = generer.lire(chemin) if os.path.exists(chemin) else ''
            sans = lambda t: re.sub(r'// Généré le \d{4}-\d{2}-\d{2}\.', '', t)
            if sans(actuel) != sans(contenu):
                perimes.append(chemin)
    if perimes:
        erreur('blocs générés périmés : ' + ', '.join(perimes) + ' (lancer outils/generer.py)')


def verifier_parasites():
    # os.walk et non glob : glob ignore les noms qui commencent par un point,
    # c'est-à-dire précisément ceux que l'on cherche.
    n = 0
    for dossier, sous, fichiers in os.walk('.'):
        sous[:] = [d for d in sous if d not in ('.git', 'node_modules', '_a_fusionner', '.vercel')]
        for nom in fichiers:
            if nom.startswith('._') or nom == '.DS_Store':
                n += 1
    if n:
        avert(f'{n} fichier(s) parasite(s) macOS (._* ou .DS_Store) dans la source : exclus du déploiement, à nettoyer avec `find . -name "._*" -delete`')


def verifier_hygiene(cat):
    if not os.path.exists('.vercelignore') or '.env' not in lire('.vercelignore'):
        erreur('.vercelignore absent ou n\'exclut pas .env* : le jeton local serait publié')
    # Depuis la phase 2, les polices sont servies par le site : un appel vers
    # Google transmettrait l'adresse IP de chaque élève et bloquerait le rendu.
    for p in list(pages_deployees()) + ['css/style.css', 'css/connecte.css']:
        t = lire(p)
        if 'fonts.googleapis' in t or 'fonts.gstatic' in t:
            erreur(f'{p} charge une police depuis Google')
    for f in ('fonts/faces.css', 'fonts/bricolage-grotesque-normal-latin.woff2', 'fonts/nunito-sans-normal-latin.woff2', 'fonts/jetbrains-mono-normal-latin.woff2'):
        if not os.path.exists(f):
            erreur(f'police manquante : {f}')
    # Aucun script ni feuille ni police chargés depuis un autre serveur. Les
    # iframes de vidéo (PodEduc, apps.education.fr) sont le seul contenu externe.
    tiers = re.compile(r'<(?:script|link)[^>]+(?:src|href)="https?://|@import\s+url\(["\']?https?://', re.I)
    for p in pages_deployees():
        if tiers.search(lire(p)):
            erreur(f'{p} charge un script, une feuille ou une police depuis un serveur tiers')
    for p in ('css/style.css', 'css/connecte.css', 'fonts/faces.css'):
        if re.search(r'@import\s+url\(["\']?https?://|url\(["\']?https?://', lire(p)):
            erreur(f'{p} charge une ressource depuis un serveur tiers')
    # Chaque page de séquence porte l'enveloppe commune
    for p in glob.glob('[345]eme/p*/seq*-*.html'):
        t = lire(p)
        if 'css/style.css' not in t or 'js/components.js' not in t:
            erreur(f'{p} ne charge pas css/style.css ou js/components.js')
    # L'adresse du site est techlft.egd.mg (décision D15) ; go.html et la
    # planche des codes gardent la cible imprimée dans les cahiers.
    for p in pages_deployees():
        if p in ('go.html',):
            continue
        if 'technologie-lft.vercel.app' in lire(p):
            erreur(f'{p} affiche encore technologie-lft.vercel.app')
    lic = lire('fonts/LICENCES.txt') if os.path.exists('fonts/LICENCES.txt') else ''
    if 'SIL OPEN FONT LICENSE Version 1.1' not in lic:
        erreur('fonts/LICENCES.txt ne contient pas le texte de la licence OFL')
    avec_style = [p for p in pages_deployees() if '<style' in lire(p)]
    if len(avec_style) > 30:
        avert(f'{len(avec_style)} pages portent leur propre bloc <style> (attendu : une trentaine, pages d\'impression et outils) : {avec_style}')
    # Une sonde de test est un point d'entrée sans session, avec une clé en
    # clair dans un dépôt public : elle ne doit jamais partir en production.
    sondes = [f for f in glob.glob('api/**/sonde*.js', recursive=True)]
    if sondes:
        erreur(f'sonde de test présente dans api/ : {sondes} (à supprimer avant tout déploiement)')
    # Les libellés visibles n'emploient pas le tiret cadratin (règle d'écriture
    # du projet) ; les pages écrites avant la phase 2 sont reprises au fil de l'eau.
    for p in ('enseignant/plan.html', 'enseignant/index.html', 'enseignant/classeur.html',
              'enseignant/comptes.html', 'classeur/index.html', 'index.html'):
        if os.path.exists(p) and '\u2014' in lire(p):
            erreur(f'{p} contient un tiret cadratin')
    # Chaque séquence du catalogue porte au moins une compétence : la
    # correction par compétence (décision D15, question 4) en dépend.
    for niv, n in cat['niveaux'].items():
        for s in n['sequences']:
            if not s.get('competences'):
                avert(f'{s["dossier"]}/{s["cle"]} sans compétence au catalogue : le positionnement sera muet pour cette séquence')
    # Chaque page de séquence charge le catalogue pour son en-tête
    sans = [p for p in glob.glob('[345]eme/p*/seq*-*.html') if 'js/catalogue.js' not in lire(p)]
    if sans:
        avert(f'{len(sans)} page(s) de séquence sans js/catalogue.js (lancer outils/migrer.py) : {sans[:3]}')


def main():
    with open('catalogue.json', encoding='utf-8') as f:
        cat = json.load(f)
    nl = verifier_liens()
    nc = verifier_go(cat)
    nd = verifier_catalogue(cat)
    nr = verifier_recherche()
    verifier_generes()
    verifier_parasites()
    verifier_hygiene(cat)
    print(f'{nl} liens internes, {nc} codes de cahier, {nd} documents au catalogue, {nr} entrées de recherche.')
    for a in AVERTS:
        print('  avertissement :', a)
    for e in ERREURS:
        print('  ERREUR :', e)
    if ERREURS:
        print(f'{len(ERREURS)} erreur(s). Ne pas déployer.')
        sys.exit(1)
    print(f'aucune erreur, {len(AVERTS)} avertissement(s). Déploiement possible.')


if __name__ == '__main__':
    main()
