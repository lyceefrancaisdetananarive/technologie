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
import sys, pathlib

RACINE = pathlib.Path(__file__).resolve().parent.parent

# Les paires qui doivent etre rigoureusement identiques, octet pour octet.
IDENTIQUES = [
    ("api/_lib/etats-fiche.js", "js/etats-fiche.js"),
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
    if souci:
        print("\n%d anomalie(s). Recopier l'exemplaire de reference sur l'autre." % souci)
    return 1 if souci else 0

if __name__ == "__main__":
    sys.exit(main())
