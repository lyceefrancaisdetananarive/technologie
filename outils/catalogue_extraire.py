#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Amorce du catalogue : lit les pages existantes UNE FOIS et écrit catalogue.json.

Ce script ne sert qu'au démarrage, ou pour comparer ce que disent les pages avec
ce que dit le catalogue. Après l'amorce, catalogue.json est la source de
vérité : on l'édite à la main, et outils/generer.py en dérive tout le reste
(table de go.html, index de recherche, liste du classeur, page Cours, index de
niveau, espace enseignant).

Sans dépendance : Python 3 et sa bibliothèque standard. Lancer depuis la
racine du site :

    python3 outils/catalogue_extraire.py            # écrit catalogue.json (refuse s'il existe)
    python3 outils/catalogue_extraire.py --forcer   # le réécrit depuis les pages
    python3 outils/catalogue_extraire.py --comparer # ne touche à rien, signale
                                                    # les écarts pages / catalogue
"""
import glob
import html
import json
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RACINE)

NIVEAUX = {
    '5eme': {'libelle': '5e', 'long': 'Cinquième', 'ordre': 1},
    '4eme': {'libelle': '4e', 'long': 'Quatrième', 'ordre': 2},
    '3eme': {'libelle': '3e', 'long': 'Troisième', 'ordre': 3},
}

# Calendrier 2026-2027, cinq périodes (décision D2), séances garanties (D3).
PERIODES = [
    {'n': 1, 'debut': '2026-09-02', 'fin': '2026-10-17', 'seances_garanties': 6, 'libelle': '2 septembre au 17 octobre'},
    {'n': 2, 'debut': '2026-11-02', 'fin': '2026-12-19', 'seances_garanties': 7, 'libelle': '2 novembre au 19 décembre'},
    {'n': 3, 'debut': '2027-01-04', 'fin': '2027-02-13', 'seances_garanties': 6, 'libelle': '4 janvier au 13 février'},
    {'n': 4, 'debut': '2027-03-01', 'fin': '2027-04-10', 'seances_garanties': 4, 'libelle': '1er mars au 10 avril'},
    {'n': 5, 'debut': '2027-04-26', 'fin': '2027-07-03', 'seances_garanties': 9, 'libelle': '26 avril au 3 juillet'},
]

THEMES = {
    1: 'Les objets et les systèmes techniques, leurs usages et leurs interactions',
    2: 'Fonctionnement et comportement des objets et systèmes techniques',
    3: 'Conception et réalisation des objets et systèmes techniques',
}

# Progression de référence (05_PROGRESSION/PROGRESSION-5-PERIODES.md, révisée le
# 1er septembre 2026 pour la 3e). C'est elle qui fixe le nombre de séances de
# chaque séquence (décision D3 : dimensionnement sur le minimum garanti) et le
# thème du programme. Ce que la page dit d'elle-même est conservé à part
# (seances_page, theme_page) pour que le vérificateur signale les écarts.
REFERENCE = {
    '5eme': {1: (3, 1), 2: (3, 1), 3: (4, 1), 4: (3, 2), 5: (3, 2), 6: (3, 2), 7: (4, 3), 8: (3, 3), 9: (6, 3)},
    '4eme': {1: (3, 1), 2: (3, 2), 3: (4, 2), 4: (3, 3), 5: (3, 2), 6: (3, 2), 7: (4, 3), 8: (3, 2), 9: (6, 3)},
    '3eme': {1: (3, 1), 2: (3, 1), 3: (3, 1), 4: (4, 2), 5: (3, 2), 6: (3, 2), 7: (4, 0), 8: (4, 3), 9: (3, 3)},
}
# Thème 0 = transversal (méthodologie du brevet).

# Corrections apportées à l'amorce du 13 septembre 2026. Les cartes des index
# de niveau portaient des résumés restés d'avant l'interversion des séquences 8
# et 9 de 5e (décision D4) et d'avant le regroupement Arduino en 4e (D5).
CORRECTIONS_RESUME = {
    '5eme/p5/seq8': 'IA, objets connectés, indice de réparabilité.',
    '5eme/p5/seq9': 'Démarche de projet, prototype, FabLab, imprimante 3D, bilan de l\'année.',
    '4eme/p3/seq6': 'Arduino : faire clignoter une LED, lire un capteur, programmer le prototype de l\'équipe.',
}

# Titres dont la ponctuation était fautive dans le h1 de la fiche (deux-points
# attendu, minuscule après). La fiche sera alignée en phase 2 ; d'ici là,
# --comparer signale l'écart, ce qui est le comportement voulu.
CORRECTIONS_TITRE = {
    '3eme/p1/seq2': 'IA embarquée : études de cas',
    '3eme/p5/seq8': 'Projet Smart Object : de la conception au prototype',
    '5eme/p5/seq9': 'Projet de groupe : concevoir un objet technique',
}

# Les sept documents d'une séquence, dans l'ordre où l'élève les rencontre.
# « cours » est le nom d'usage de la fiche de structuration des connaissances ;
# le fichier garde son suffixe -structuration, seuls les libellés changent.
DOCUMENTS = [
    ('activite', 'activite', 'A', 'Activité'),
    ('cours', 'structuration', 'S', 'Cours'),
    ('quiz', 'quiz', 'Q', 'Quiz'),
    ('eval', 'eval', 'E', 'Évaluation'),
    ('revision', 'revision', 'R', 'Révision'),
    ('ebep', 'ebep', 'B', 'Version adaptée'),
    ('prof', 'prof', None, 'Fiche professeur'),
]


def lire(chemin):
    with open(chemin, encoding='utf-8') as f:
        return f.read()


def texte(fragment):
    """Un fragment HTML en texte brut, espaces normalisés."""
    t = re.sub(r'<[^>]+>', ' ', fragment)
    t = html.unescape(t)
    return re.sub(r'\s+', ' ', t).strip()


def h1(page):
    m = re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S)
    return texte(m.group(1)) if m else ''


def table_go():
    page = lire('go.html')
    return dict(re.findall(r'"([0-9][0-9A-Z]+)"\s*:\s*"([^"]+)"', page))


def code_de(fichier, go):
    for code, cible in go.items():
        if cible == fichier:
            return code
    return None


def extraire_sequence(niveau, dossier, cle, go):
    """Tout ce que la fiche d'activité sait dire d'elle-même."""
    fichier = f'{dossier}/{cle}-activite.html'
    page = lire(fichier)
    titre = h1(page)
    if re.match(r'Activit[ée]\s*:\s*S[ée]quence\s*\d+\s*$', titre):
        # Page dont le h1 est générique : le <title> porte le vrai intitulé.
        t = re.search(r'<title>(.*?)</title>', page, re.S)
        titre = texte(t.group(1)).split('|')[0].replace('Activité ·', '').strip() if t else titre
    m = re.match(r'S[ée]q(?:uence)?\.?\s*(\d+)\s*[:·]\s*(.*)', titre)
    numero = int(m.group(1)) if m else int(re.sub(r'\D', '', cle))
    titre = m.group(2).strip() if m else titre

    # Ce que la fiche affiche elle-même, dans son tableau Durée / Thème s'il
    # existe encore (la phase 2 l'a remplacé par les compétences ; les
    # valeurs viennent alors du catalogue et il n'y a rien à comparer).
    seances_page = None
    m = re.search(r'<strong>Durée</strong></td>\s*<td[^>]*>\s*(\d+)\s*séances', page)
    if m:
        seances_page = int(m.group(1))

    theme = None
    m = re.search(r'<strong>Thème</strong></td>\s*<td[^>]*>\s*Th[èe]me\s*(\d)', page)
    if m:
        theme = int(m.group(1))

    competences = [texte(c) for c in re.findall(
        r'class="competence-badge"[^>]*>(.*?)</span>', page, re.S)]

    activites = []
    for m in re.finditer(r'<h2[^>]*>(.*?)</h2>', page, re.S):
        t = texte(m.group(1))
        t = re.sub(r'^[^A-Za-zÀ-ÿ]+', '', t)          # pictogrammes en tête
        a = re.match(r'Activit[ée]\s*(\d+)\s*[:·]\s*(.*)', t)
        if a:
            titre_act = re.sub(r'\s*\(S\d+\)\s*$', '', a.group(2)).strip()
            activites.append({'n': int(a.group(1)), 'titre': titre_act})

    documents = {}
    for cle_doc, suffixe, _lettre, _libelle in DOCUMENTS:
        f = f'{dossier}/{cle}-{suffixe}.html'
        if os.path.exists(f):
            doc = {'fichier': f}
            code = code_de(f, go)
            if code:
                doc['code'] = code
            if cle_doc == 'prof':
                doc['reserve'] = True
            documents[cle_doc] = doc

    ref = REFERENCE.get(niveau, {}).get(numero)
    return {
        'n': numero,
        'periode': int(dossier.split('/p')[1]),
        'cle': cle,
        'dossier': dossier,
        'titre': titre,
        'theme': ref[1] if ref else theme,
        'seances': ref[0] if ref else seances_page,
        'theme_page': theme,
        'seances_page': seances_page,
        'competences': competences,
        'activites': activites,
        'documents': documents,
    }


def resumes_index(niveau, catalogue_existant=None):
    """Les résumés d'une ligne écrits sur les cartes de l'index de niveau,
    rattachés à la séquence par le lien de la carte (le numéro affiché sur la
    carte s'est déjà trompé).

    Une page qui porte déjà les marqueurs du générateur ne fait plus autorité :
    ses cartes viennent du catalogue. On reprend alors les résumés du catalogue
    existant, sinon une réextraction les effacerait (c'est arrivé le 13
    septembre 2026, entre la pose des marqueurs et l'amorce définitive)."""
    page = lire(f'{niveau}/index.html')
    resumes = {}
    if 'catalogue:debut cartes-p1' in page and catalogue_existant:
        for s in catalogue_existant['niveaux'].get(niveau, {}).get('sequences', []):
            if s.get('resume'):
                resumes[f"{s['dossier']}/{s['cle']}"] = s['resume']
        return resumes
    for carte in re.findall(r'<div class="seq-card"[^>]*>(.*?)</div>\s*</div>', page, re.S):
        lien = re.search(r'href="(p\d/seq\d+)-activite\.html"', carte)
        meta = re.search(r'class="seq-card-meta">(.*?)</p>', carte, re.S)
        if lien and meta:
            t = texte(meta.group(1))
            t = re.sub(r'^\d+\s*séances?(\s*·\s*|\s*$)', '', t)
            if t:
                resumes[f'{niveau}/{lien.group(1)}'] = t
    return resumes


def extraire_niveau(niveau, go, catalogue_existant=None):
    resumes = resumes_index(niveau, catalogue_existant)
    sequences = []
    for fichier in sorted(glob.glob(f'{niveau}/p*/seq*-activite.html')):
        dossier = os.path.dirname(fichier)
        cle = os.path.basename(fichier).replace('-activite.html', '')
        s = extraire_sequence(niveau, dossier, cle, go)
        s['resume'] = CORRECTIONS_RESUME.get(f'{dossier}/{cle}', resumes.get(f'{dossier}/{cle}', ''))
        s['titre'] = CORRECTIONS_TITRE.get(f'{dossier}/{cle}', s['titre'])
        sequences.append(s)
    sequences.sort(key=lambda s: (s['periode'], s['n']))

    diagnostiques = []
    for fichier in sorted(glob.glob(f'{niveau}/p*/diagnostique-eleve.html')):
        dossier = os.path.dirname(fichier)
        d = {'periode': int(dossier.split('/p')[1]),
             'titre': h1(lire(fichier)) or 'Évaluation diagnostique',
             'eleve': {'fichier': fichier}}
        code = code_de(fichier, go)
        if code:
            d['eleve']['code'] = code
        prof = f'{dossier}/diagnostique-prof.html'
        if os.path.exists(prof):
            d['prof'] = {'fichier': prof, 'reserve': True}
        diagnostiques.append(d)

    bilans = []
    for fichier in sorted(glob.glob(f'{niveau}/p*/revision-t*.html') + glob.glob(f'{niveau}/p*/eval-t*.html')):
        nom = os.path.basename(fichier)
        trimestre = int(re.search(r'-t(\d)', nom).group(1))
        genre = 'revision' if nom.startswith('revision') else 'eval'
        bilans.append({'trimestre': trimestre, 'type': genre, 'fichier': fichier,
                       'titre': h1(lire(fichier)) or nom})
    bilans.sort(key=lambda b: (b['trimestre'], b['type']))

    connus = set()
    for s in sequences:
        connus.update(d['fichier'] for d in s['documents'].values())
    for d in diagnostiques:
        connus.add(d['eleve']['fichier'])
        if 'prof' in d:
            connus.add(d['prof']['fichier'])
    connus.update(b['fichier'] for b in bilans)
    annexes = []
    for fichier in sorted(glob.glob(f'{niveau}/p*/*.html')):
        if fichier not in connus:
            annexes.append({'fichier': fichier, 'titre': h1(lire(fichier)) or os.path.basename(fichier),
                            'reserve': 'prof' in fichier or 'releve' in fichier or 'preparation' in fichier})

    return {
        'libelle': NIVEAUX[niveau]['libelle'],
        'long': NIVEAUX[niveau]['long'],
        'ordre': NIVEAUX[niveau]['ordre'],
        'index': f'{niveau}/index.html',
        'sequences': sequences,
        'diagnostiques': diagnostiques,
        'bilans': bilans,
        'annexes': annexes,
    }


def construire():
    go = table_go()
    existant = None
    if os.path.exists('catalogue.json'):
        with open('catalogue.json', encoding='utf-8') as f:
            existant = json.load(f)
    cat = {
        'version': 1,
        'annee': '2026-2027',
        'periodes': PERIODES,
        'themes': {str(k): v for k, v in THEMES.items()},
        'documents': [{'cle': c, 'suffixe': s, 'lettre': l, 'libelle': lib} for c, s, l, lib in DOCUMENTS],
        'niveaux': {n: extraire_niveau(n, go, existant) for n in NIVEAUX},
    }
    # Codes de go.html que le catalogue n'explique pas : à signaler, jamais à perdre.
    connus = set()
    for niv in cat['niveaux'].values():
        for s in niv['sequences']:
            connus.update(d.get('code') for d in s['documents'].values())
        for d in niv['diagnostiques']:
            connus.add(d['eleve'].get('code'))
    orphelins = {c: f for c, f in go.items() if c not in connus}
    cat['codes_orphelins'] = orphelins
    return cat


def comparer(cat):
    """Écarts entre le catalogue enregistré et ce que disent les pages aujourd'hui."""
    frais = construire()
    ecarts = 0
    for niveau, niv in frais['niveaux'].items():
        anciens = {s['cle'] + '@' + s['dossier']: s for s in cat['niveaux'][niveau]['sequences']}
        for s in niv['sequences']:
            k = s['cle'] + '@' + s['dossier']
            a = anciens.get(k)
            if not a:
                print(f'  + {niveau} {s["dossier"]}/{s["cle"]} : séquence sur disque absente du catalogue')
                ecarts += 1
                continue
            for champ in ('titre', 'seances_page', 'theme_page'):
                if s.get(champ) is None and champ != 'titre':
                    continue
                if a.get(champ) != s.get(champ):
                    print(f'  ~ {niveau} {s["cle"]} {champ} : catalogue « {a.get(champ)} », page « {s.get(champ)} »')
                    ecarts += 1
            if len(a.get('activites', [])) != len(s['activites']):
                print(f'  ~ {niveau} {s["cle"]} activités : catalogue {len(a.get("activites", []))}, page {len(s["activites"])}')
                ecarts += 1
    return ecarts


if __name__ == '__main__':
    if '--comparer' in sys.argv:
        with open('catalogue.json', encoding='utf-8') as f:
            cat = json.load(f)
        n = comparer(cat)
        print(f'{n} écart(s) entre les pages et le catalogue.')
        sys.exit(1 if n else 0)
    if os.path.exists('catalogue.json') and '--forcer' not in sys.argv:
        print('catalogue.json existe déjà : c\'est la source de vérité, éditez-le à la main.')
        print('Pour le réamorcer depuis les pages malgré tout : --forcer (les éditions manuelles seront perdues).')
        sys.exit(2)
    cat = construire()
    with open('catalogue.json', 'w', encoding='utf-8') as f:
        json.dump(cat, f, ensure_ascii=False, indent=1)
        f.write('\n')
    total = sum(len(n['sequences']) for n in cat['niveaux'].values())
    print(f'catalogue.json écrit : {total} séquences, {len(cat["codes_orphelins"])} code(s) orphelin(s).')
