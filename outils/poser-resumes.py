#!/usr/bin/env python3
"""
Pose le resume court en tete de chaque document d'une fiche d'activite.

LA SEULE CHOSE QUI COMPTE ICI : ne pas decaler les cles de champ. js/reponse.js
les recalcule a chaque ouverture, a partir du seul ordre des elements de
<main>, et des milliers de reponses d'eleves y sont accrochees. Le resume est
donc pose dans un <div>, qui n'entre dans aucun des quatre selecteurs du
scanner, et son texte est verifie : jamais trois points de suite, jamais trois
traits bas, jamais le caractere de points de suspension.

Usage : poser-resumes.py <fiche.html> <resumes.json>
  resumes.json : { "doc1": "texte avec <strong> autorise", ... }
"""
import json, re, sys

INTERDIT = re.compile(r'[.…_]{3}|…|—|–')

def poser(fiche, resumes):
    t = open(fiche, encoding='utf-8').read()
    poses = []
    for cle, texte in resumes.items():
        mauvais = INTERDIT.search(texte)
        if mauvais:
            raise SystemExit('REFUS : %s contient %r, qui serait pris pour un trou '
                             'a remplir ou qui est un tiret long.' % (cle, mauvais.group(0)))
        if re.search(r'<(?!/?strong\b)[a-zA-Z]', texte):
            raise SystemExit('REFUS : %s contient une balise autre que <strong>.' % cle)
        m = re.search(r'(<div id="%s" class="info-box[^"]*">\s*\n\s*<div class="info-box-title">.*?</div>\n)' % cle, t, re.S)
        if not m:
            raise SystemExit('REFUS : encadre %s introuvable, ou deja muni d\'un resume.' % cle)
        if '"doc-resume"' in t[m.end():m.end()+200]:
            print('  %s : resume deja pose, ignore' % cle); continue
        indent = re.match(r'\s*', m.group(1).split('\n')[1]).group(0)
        bloc = '%s<div class="doc-resume">%s</div>\n' % (indent, texte)
        t = t[:m.end()] + bloc + t[m.end():]
        poses.append(cle)
    open(fiche, 'w', encoding='utf-8').write(t)
    return poses

if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    r = json.load(open(sys.argv[2], encoding='utf-8'))
    faits = poser(sys.argv[1], r)
    print('%d resume(s) pose(s) : %s' % (len(faits), ', '.join(faits)))
