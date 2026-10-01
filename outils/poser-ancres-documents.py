#!/usr/bin/env python3
"""
Pose les ancres des documents ressources d'une fiche, et transforme en liens
les citations « document N » des consignes.

Un clic sur « document 3 » dans une consigne ouvre alors le document A COTE de
la question, dans le volet de js/fiche-parcours.js, au lieu de faire defiler la
page jusqu'en haut.

CE QU'IL FAIT, ET RIEN D'AUTRE :
  1. un attribut id="docN" sur l'encadre de chaque document numerote ;
  2. les citations « document N » du texte deviennent <a href="#docN">.

Un attribut ne change pas l'ordre des elements. Un <a> pose A L'INTERIEUR d'un
paragraphe existant n'en cree pas un nouveau. Ce sont les deux seules formes
d'ecriture autorisees ici, parce que js/reponse.js recalcule les cles des
champs a partir du seul ordre des elements de <main>, et que des reponses
d'eleves y sont accrochees.

JAMAIS DANS UN TITRE D'ENCADRE : le titre « Document 3 · ... » est le nom du
document, pas un renvoi vers lui.

LA PREUVE EST DANS L'OUTIL. Les sept categories lues par le scanner de
reponse.js sont comptees avant et apres. Au moindre ecart, rien n'est ecrit.

Usage : poser-ancres-documents.py <fiche.html> [...]
        poser-ancres-documents.py --essai <fiche.html>
"""
import re, sys

# « Document 3 », « Document 1A », suivi d'un separateur de titre.
TITRE_DOC = re.compile(
    r'<div class="info-box-title">\s*(?:<span class="ico">[^<]*</span>\s*)?'
    r'Document\s+(\d+[A-Z]?)\s*[·:]')

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


def poser_ancres(t):
    """Ajoute id="docN" sur l'encadre de chaque document. Rend (texte, n)."""
    n = 0
    # De la fin vers le debut : les index precedents restent valides.
    for m in reversed(list(TITRE_DOC.finditer(t))):
        cle = m.group(1)
        ouverts = [x for x in re.finditer(r'<div[^>]*class="[^"]*info-box[^"]*"[^>]*>', t[:m.start()])]
        if not ouverts:
            raise ValueError('document %s hors de tout encadre' % cle)
        o = ouverts[-1]
        if ' id=' in o.group(0):
            continue                      # deja pose
        neuf = o.group(0).replace('<div ', '<div id="doc%s" ' % cle, 1)
        t = t[:o.start()] + neuf + t[o.end():]
        n += 1
    return t, n


def lier_citations(t, ancres):
    """« document 3 » devient un lien, jamais dans un titre d'encadre."""
    liens = [0]

    def un(m):
        cle = m.group('n')
        if cle not in ancres:
            return m.group(0)             # pas d'ancre : on ne ment pas
        liens[0] += 1
        return '<a class="va-au-doc" href="#doc%s">document %s</a>' % (cle, cle)

    def plusieurs(m):
        nums = re.findall(r'\d+[A-Z]?', m.group(0))
        if not all(x in ancres for x in nums):
            return m.group(0)
        liens[0] += len(nums)
        p = ['<a class="va-au-doc" href="#doc%s">%s</a>' % (x, x) for x in nums]
        return 'documents ' + ', '.join(p[:-1]) + ' et ' + p[-1]

    def hors_balises(x):
        """Substitue dans le CONTENU seulement.

        Sans cela, « document 2 » ecrit dans un alt= ou un title= recevait un
        <a href="#doc2"> au milieu d'une valeur d'attribut : la valeur se
        refermait sur le premier guillemet du lien, la balise se fermait sur
        le premier chevron, et la page se cassait sans que le controle
        d'empreinte y voie quoi que ce soit, aucun des sept motifs n'etant
        present dans le fragment insere.
        """
        morceaux = re.split(r'(<[^>]*>)', x)
        for j in range(0, len(morceaux), 2):      # les indices pairs sont du contenu
            s = morceaux[j]
            s = re.sub(r'documents (\d+[A-Z]?)(?:, (\d+[A-Z]?))* et (\d+[A-Z]?)', plusieurs, s)
            s = re.sub(r'(?<![>\w])document (?P<n>\d+[A-Z]?)(?![\d\w])', un, s)
            morceaux[j] = s
        return ''.join(morceaux)

    lignes = t.split('\n')
    dans_commentaire = False
    for i, x in enumerate(lignes):
        # Un commentaire HTML n'est pas du contenu : on n'y touche pas.
        if dans_commentaire:
            if '-->' in x:
                dans_commentaire = False
            continue
        if '<!--' in x and '-->' not in x:
            dans_commentaire = True
            continue
        if 'info-box-title' in x or 'va-au-doc' in x or '<!--' in x:
            continue
        x = hors_balises(x)
        # <strong>document 3</strong> : le lien va a l'interieur du gras.
        x = re.sub(r'<strong>document (?P<n>\d+[A-Z]?)</strong>',
                   lambda m: '<strong>%s</strong>' % un(m), x)
        lignes[i] = x
    return '\n'.join(lignes), liens[0]


def traiter(chemin, essai=False):
    avant = open(chemin, encoding='utf-8').read()
    try:
        t, nb_ancres = poser_ancres(avant)
    except ValueError as e:
        print('  %-36s ignoree : %s' % (chemin[:36], e))
        return False
    ancres = set(re.findall(r'id="doc(\d+[A-Z]?)"', t))
    if not ancres:
        print('  %-36s ignoree : aucun document numerote' % chemin[:36])
        return False
    t, nb_liens = lier_citations(t, ancres)

    a, b = empreinte(avant), empreinte(t)
    ecarts = {k: (a[k], b[k]) for k in a if a[k] != b[k]}
    if ecarts:
        print('  %-36s REFUS : la structure scannee a bouge : %s' % (chemin[:36], ecarts))
        return False
    if essai:
        print('  %-36s %d ancres, %d liens (essai)' % (chemin[:36], nb_ancres, nb_liens))
        return True
    open(chemin, 'w', encoding='utf-8').write(t)
    print('  %-36s %d ancres, %d liens' % (chemin[:36], nb_ancres, nb_liens))
    return True


if __name__ == '__main__':
    args = sys.argv[1:]
    essai = '--essai' in args
    fiches = [a for a in args if a != '--essai']
    if not fiches:
        raise SystemExit(__doc__)
    faits = sum(traiter(f, essai) for f in fiches)
    print('\n%d fiche(s) sur %d.' % (faits, len(fiches)))
