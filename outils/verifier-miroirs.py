#!/usr/bin/env python3
"""
Controle que les fichiers tenus en double exemplaire ne divergent pas.

Le site suit une convention : une regle partagee entre les fonctions serveur
et les pages est ecrite deux fois, une fois sous api/_lib/ et une fois sous
js/. C'est le prix a payer pour que les fonctions Vercel n'aient a remonter
dans aucun dossier voisin. Le risque est que les deux copies divergent en
silence, ce qui est exactement le defaut corrige le 30 septembre 2026.

Usage : python3 outils/verifier-miroirs.py
Sortie : 0 si tout concorde, 1 sinon.
"""
import re, sys, pathlib

RACINE = pathlib.Path(__file__).resolve().parent.parent

# Les paires qui doivent etre rigoureusement identiques, octet pour octet.
IDENTIQUES = [
    ("api/_lib/etats-fiche.js", "js/etats-fiche.js"),
    ("api/_lib/cles-champs.js", "js/cles-champs.js"),
]

# ---------------------------------------------------------------------
# LES VALEURS RECOPIEES, QU'AUCUN FICHIER NE PEUT PARTAGER.
#
# Une paire de fichiers se compare octet pour octet ; une VALEUR recopiee a
# l'interieur de fichiers differents, non. Ce sont pourtant les memes degats :
# deux exemplaires d'une meme regle qui divergent en silence. On les compare
# donc une a une, sur le modele du controle de --bord-composant qui existe
# deja dans outils/verifier.py.
#
# Chaque entree : (nom lisible, [(fichier, motif a capturer), ...]).
# Le motif doit porter UN groupe, qui est la valeur a confronter.
# ---------------------------------------------------------------------
VALEURS = [
    ("la grammaire des cles de champ", [
        ("api/_lib/cles-champs.js", r"CLE_CHAMP = (/\^.*\$/)"),
        # js/reponse.js est un script classique : il ne peut pas importer le
        # module, il garde son litteral. A defaut d'etre partage, il est
        # surveille.
        ("js/reponse.js", r"CLE_CHAMP = (/\^.*\$/)"),
    ]),
    ("la largeur des pages d'application", [
        ("css/style.css", r"--mesure-app:\s*([0-9.]+rem)"),
        ("css/connecte.css", r"--mesure-app:\s*([0-9.]+rem)"),
    ]),
    ("les couleurs de la charte Pix", [
        # Relevees sur orga.pix.fr, et recopiees faute de feuille commune aux
        # quatre pages qui affichent un score. Si elles divergent, un eleve voit
        # deux Pix differents selon l'ecran.
        ("css/style.css", r"--pix-score-fond:\s*(#[0-9A-Fa-f]{6})"),
        ("css/connecte.css", r"--pix-score-fond:\s*(#[0-9A-Fa-f]{6})"),
    ]),
    ("la couleur du « certifiable » de Pix", [
        ("css/style.css", r"--pix-oui-fond:\s*(#[0-9A-Fa-f]{6})"),
        ("css/connecte.css", r"--pix-oui-fond:\s*(#[0-9A-Fa-f]{6})"),
    ]),
    ("l'ombre de base", [
        ("css/style.css", r"--ombre:\s*([^;]+);"),
        ("css/connecte.css", r"--ombre:\s*([^;]+);"),
    ]),
]

def main():
    souci = 0
    for a, b in IDENTIQUES:
        fa, fb = RACINE / a, RACINE / b
        for f in (fa, fb):
            if not f.exists():
                print("MANQUANT : %s" % f.relative_to(RACINE)); souci += 1
        if fa.exists() and fb.exists():
            if fa.read_bytes() != fb.read_bytes():
                print("DIVERGENT : %s et %s" % (a, b)); souci += 1
            else:
                print("identiques : %s et %s" % (a, b))
    for nom, sources in VALEURS:
        vues = {}
        for fichier, motif in sources:
            f = RACINE / fichier
            if not f.exists():
                print("MANQUANT : %s" % fichier); souci += 1; continue
            m = re.search(motif, f.read_text(encoding="utf-8"))
            if not m:
                print("INTROUVABLE : %s dans %s (le motif de controle est perime)"
                      % (nom, fichier)); souci += 1; continue
            vues[fichier] = m.group(1).strip()
        if len(set(vues.values())) > 1:
            print("DIVERGENT : %s" % nom); souci += 1
            for fichier, valeur in vues.items():
                print("   %-28s %s" % (fichier, valeur[:70]))
        elif vues:
            print("identique  : %s (%d exemplaire(s))" % (nom, len(vues)))

    if souci:
        print("\n%d anomalie(s). Recopier l'exemplaire de reference sur l'autre." % souci)
    return 1 if souci else 0

if __name__ == "__main__":
    sys.exit(main())
