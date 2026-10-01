#!/usr/bin/env python3
"""
Pose le parcours activite par activite sur une fiche d'activite.

CE QU'IL FAIT, ET RIEN D'AUTRE :
  1. un attribut id="activite-N" sur la carte de chaque activite ;
  2. une balise <script> vers js/fiche-parcours.js, apres js/reponse.js.

CE QU'IL NE FAIT JAMAIS : ajouter, retirer ou deplacer un element de <main>.
js/reponse.js recalcule les cles des champs a chaque ouverture, a partir du
SEUL ordre des elements, et des milliers de reponses d'eleves y sont
accrochees. Un attribut ne change pas cet ordre ; une balise <script> posee
hors de <main> non plus.

LA PREUVE EST DANS L'OUTIL. Avant d'ecrire, il compte les sept categories que
le scanner de reponse.js regarde (tableaux, paragraphes, zones de reponse,
cadres pointilles, cadres a tirets, lignes pointillees, suites de trois
points) ; apres ecriture il les recompte. Au moindre ecart, il restaure le
fichier et s'arrete.

Usage : poser-parcours.py <fiche.html> [<fiche.html> ...]
        poser-parcours.py --essai <fiche.html>   (n'ecrit rien, dit ce qu'il ferait)
"""
import re, sys

TITRE = re.compile(
    r'<h2[^>]*>(?:<span class="ico">[^<]*</span>\s*)?((?:Activité|Étape|Exercice)\s+\d+)')

# Les sept categories lues par detecter(), dans js/reponse.js.
CATEGORIES = [
    ('tableaux',            r'<table'),
    ('paragraphes',         r'<p[ >]'),
    ('zones de reponse',    r'zone-reponse'),
    ('cadres ebep-fill',    r'ebep-fill'),
    ('cadres a tirets',     r'<div[^>]*style="[^"]*dashed'),
    ('lignes pointillees',  r'<(?:span|p)[^>]*style="[^"]*dotted'),
    ('suites de 3 points',  r'[.…_]{3}'),
]


def empreinte(t):
    return {nom: len(re.findall(motif, t)) for nom, motif in CATEGORIES}


def transformer(t):
    """Rend le texte transforme et le nombre d'activites, ou leve une erreur."""
    titres = list(TITRE.finditer(t))
    if len(titres) < 2:
        raise ValueError('moins de deux activites reperables')
    if 'fiche-parcours.js' in t:
        raise ValueError('parcours deja pose')

    # Chaque activite doit vivre dans sa propre carte : sinon masquer une
    # activite masquerait sa voisine.
    cartes = []
    for m in titres:
        ouverts = [x.start() for x in re.finditer(r'<div[^>]*class="[^"]*content-card', t[:m.start()])]
        if not ouverts:
            raise ValueError('une activite hors de toute carte')
        cartes.append(ouverts[-1])
    if len(set(cartes)) != len(cartes):
        raise ValueError('deux activites partagent une carte')

    # On ecrit de la fin vers le debut : les index precedents restent valides.
    for rang, debut in reversed(list(enumerate(cartes, 1))):
        fin = t.index('>', debut)
        balise = t[debut:fin + 1]
        if ' id=' in balise:
            raise ValueError('la carte de l\'activite %d porte deja un id' % rang)
        t = t[:debut] + balise.replace('<div ', '<div id="activite-%d" ' % rang, 1) + t[fin + 1:]

    # Le script se charge APRES reponse.js, qui a besoin de l'ordre intact.
    ancre = re.search(r'(\s*)<script src="(\.\./\.\./js/)reponse\.js"></script>', t)
    if not ancre:
        raise ValueError('js/reponse.js introuvable dans la page')
    pose = ('%s<!-- APRES reponse.js, toujours : il calcule ses cles sur l\'ordre\n'
            '%s     des elements, et ce script n\'ajoute rien dans <main>. -->'
            '%s<script src="%sfiche-parcours.js"></script>'
            % (ancre.group(1), ancre.group(1).strip('\n') + '    ',
               ancre.group(1), ancre.group(2)))
    t = t[:ancre.end()] + pose + t[ancre.end():]
    return t, len(titres)


def traiter(chemin, essai=False):
    avant = open(chemin, encoding='utf-8').read()
    try:
        apres, n = transformer(avant)
    except ValueError as e:
        print('  %-36s ignoree : %s' % (chemin[:36], e))
        return False

    a, b = empreinte(avant), empreinte(apres)
    ecarts = {k: (a[k], b[k]) for k in a if a[k] != b[k]}
    if ecarts:
        print('  %-36s REFUS : la structure scannee a bouge : %s' % (chemin[:36], ecarts))
        return False
    if essai:
        print('  %-36s %d activites (essai, rien ecrit)' % (chemin[:36], n))
        return True
    open(chemin, 'w', encoding='utf-8').write(apres)
    print('  %-36s %d activites' % (chemin[:36], n))
    return True


if __name__ == '__main__':
    args = sys.argv[1:]
    essai = '--essai' in args
    fiches = [a for a in args if a != '--essai']
    if not fiches:
        raise SystemExit(__doc__)
    faits = sum(traiter(f, essai) for f in fiches)
    print('\n%d fiche(s) sur %d.' % (faits, len(fiches)))
