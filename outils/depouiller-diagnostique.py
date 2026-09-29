#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dépouille les évaluations diagnostiques de rentrée déposées dans le classeur.

    python3 outils/depouiller-diagnostique.py DOSSIER [--niveau 3eme]

DOSSIER est celui produit par `outils/a-corriger.py --extraire ... --fichiers` :
il contient `a-corriger.json` et les PDF déposés. Le script écrit à côté un
fichier `Depouillement-<groupe>-<date>.md`.

CE QUE CE SCRIPT FAIT, ET CE QU'IL NE FAIT PAS. Il applique la grille de
dépouillement du diagnostic, celle de `04_DIAGNOSTIQUE/diagnostiques.json`,
et rien d'autre. Donc :

  - il code chaque item d'une lettre, R, P, N ou V, jamais d'un point ;
  - le score d'un axe est le nombre d'items codés R dans cet axe ;
  - IL NE CALCULE AUCUN TOTAL GÉNÉRAL, et ne classe pas les élèves.

Ces trois règles ne sont pas des choix d'écriture, elles sont dans la grille.
Un total général transformerait un positionnement en note, et le diagnostic
porte en toutes lettres « ce travail n'est pas noté ».

CE QUI EST AUTOMATISABLE, ET CE QUI NE L'EST PAS. Sur les seize items, neuf
ont une réponse fermée : ils se codent sans jugement, en comparant au corrigé
officiel de `api/_lib/diagnostiques-corriges.js`. Trois autres, les items 13
à 15 de l'axe D, ont un critère que la grille rend explicitement mécanique :
la réponse est-elle juste, et un chiffre du Document 1 figure-t-il dedans.
Les quatre derniers, 3, 7, 10 et 16, demandent de lire une phrase rédigée :
le script les laisse à coder et recopie la réponse de l'élève sous les yeux
du professeur. Il ne devine pas, et il le dit.

RÈGLE DU VIDE, reprise de la grille : plus de quatre cases codées V interdit
tout positionnement. Le script le signale et refuse de conclure pour cet
élève.

LES NOMS. Le fichier produit porte les noms des élèves, parce qu'il sert à
préparer des groupes de besoin : sans nom il est inutilisable. Il ne doit
donc JAMAIS entrer dans le dépôt. Il s'écrit à côté des PDF extraits, sur le
support de travail, et s'efface avec eux une fois les groupes constitués.

Sans dépendance hors pypdf.
"""
import datetime
import io
import json
import os
import re
import sys

from pypdf import PdfReader

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJET = os.path.dirname(RACINE)

# Intitulés tels que le générateur de PDF les écrit, donc identiques d'une
# copie à l'autre. Ils servent à découper la copie : se fier au seul numéro
# en tête de ligne ne suffit pas, les énumérations internes des items 2, 5,
# 8 et 11 repartent elles aussi à 1.
INTITULES = {
    1: 'Le besoin auquel répond le cadenas',
    2: 'Fonction, contrainte, critère, niveau',
    3: 'À quoi sert un cahier des charges',
    4: 'Vrai ou faux sur le cahier des charges',
    5: 'Chaîne d’énergie et chaîne d’information du lampadaire',
    6: 'Nature du moteur du portail motorisé',
    7: 'Un capteur et l’information qu’il capte',
    8: 'Chaîne d’information de la citerne',
    9: 'Le programme du lampadaire : que fait la lampe ?',
    10: 'Corriger la ligne du programme',
    11: 'Les formes de l’organigramme',
    12: 'Vrai ou faux sur boucle, condition et variable',
    13: 'Nombre de lampes du kit solaire et ligne du document',
    14: 'Le kit convient-il pour 4 heures par soir ?',
    15: 'Batterie et saison des pluies',
    16: 'À quoi sert un planning',
}

AXES = [
    ('A', 'Analyse fonctionnelle et cahier des charges', [1, 2, 3, 4]),
    ('B', 'Chaîne d’énergie, chaîne d’information et constituants', [5, 6, 7, 8]),
    ('C', 'Lecture et modification d’un programme', [9, 10, 11, 12]),
    ('D', 'Méthode d’examen : extraire une information et justifier', [13, 14, 15]),
    ('E', 'Organisation du travail de projet', [16]),
]

# Les quatre items rédigés que le script ne code pas : il recopie la réponse.
A_LIRE = (3, 7, 10, 16)
VIDE = ('(sans réponse)', '(sans reponse)')


def corriges(niveau):
    p = os.path.join(RACINE, 'api', '_lib', 'diagnostiques-corriges.js')
    s = io.open(p, encoding='utf-8').read()
    i = s.index('export const CORRIGES =') + len('export const CORRIGES =')
    j = s.index('\n};', i) + 2
    return json.loads(s[i:j])[niveau]['items']


def texte_du_pdf(chemin):
    r = PdfReader(chemin)
    return '\n'.join((p.extract_text() or '') for p in r.pages)


def decouper(txt):
    """Renvoie {num: bloc de texte de l'item}. Le découpage se fait sur les
    intitulés exacts, jamais sur le seul numéro."""
    positions = []
    for n, titre in INTITULES.items():
        cible = '%d. %s' % (n, titre)
        i = txt.find(cible)
        if i >= 0:
            positions.append((i, n, len(cible)))
    positions.sort()
    blocs = {}
    for k, (i, n, taille) in enumerate(positions):
        fin = positions[k + 1][0] if k + 1 < len(positions) else len(txt)
        blocs[n] = txt[i + taille:fin].strip()
    return blocs


def nom_et_classe(txt):
    m = re.search(r'^(.+?) · classe (\S+) · rempli en ligne le (\S+)', txt,
                  re.M)
    return (m.group(1).strip(), m.group(2), m.group(3)) if m else ('?', '?', '?')


def lire_qcm(bloc):
    m = re.search(r'^([A-E])\)', bloc.strip())
    return m.group(1) if m else None


def lire_appariement(bloc):
    """« 1. « phrase » : A. libellé » ou « 1. le losange : B. libellé »."""
    d = {}
    for m in re.finditer(r'^(\d)\..*?:\s*([A-E])\.', bloc, re.M):
        d[m.group(1)] = m.group(2)
    return d or None


def lire_vrai_faux(bloc):
    d = {}
    for m in re.finditer(r'^([a-c])\).*?:\s*(Vrai|Faux)\s*$', bloc, re.M | re.S):
        d[m.group(1)] = 'V' if m.group(2) == 'Vrai' else 'F'
    if len(d) < 3:  # une phrase repliée sur deux lignes casse l'ancrage de fin
        d = {}
        for m in re.finditer(r'^([a-c])\)(.*?)(?=^[a-c]\)|\Z)', bloc,
                             re.M | re.S):
            corps = m.group(2)
            if re.search(r':\s*Vrai', corps):
                d[m.group(1)] = 'V'
            elif re.search(r':\s*Faux', corps):
                d[m.group(1)] = 'F'
    return d or None


def lire_classement(bloc):
    """« 1. le panneau solaire : CHAÎNE D’ÉNERGIE (…) » : 0 énergie, 1 info."""
    d = {}
    for m in re.finditer(r'^(\d)\..*?:\s*CHAÎNE D’(ÉNERGIE|INFORMATION)', bloc,
                         re.M | re.S):
        d[m.group(1)] = 0 if m.group(2) == 'ÉNERGIE' else 1
    return d or None


def lire_cadres(bloc):
    """« Case 1 : 2. la carte électronique programmée »."""
    d = {}
    for m in re.finditer(r'^Case (\d)\s*:\s*(\d)\.', bloc, re.M):
        d[m.group(1)] = m.group(2)
    return d or None


def lire_texte(bloc):
    """Les lignes « Étiquette : valeur », valeur vide comprise."""
    d = {}
    for m in re.finditer(r'^([^:\n]{2,60}?)\s*:\s*(.*?)\s*(?=^[^:\n]{2,60}\s*:|\Z)',
                         bloc, re.M | re.S):
        cle, val = m.group(1).strip(), ' '.join(m.group(2).split())
        d[cle] = '' if val in VIDE else val
    return d


LECTEURS = {
    'qcm': lire_qcm, 'appariement': lire_appariement,
    'lignes_choix': lire_vrai_faux, 'classement': lire_classement,
    'cadres': lire_cadres,
}


def coder(num, type_, attendu, bloc):
    """Renvoie (code, detail). Code R, P, N ou V."""
    if type_ == 'texte':
        return None, lire_texte(bloc)
    lecteur = LECTEURS.get(type_)
    if lecteur is None:
        return 'V', 'type %s non lu' % type_
    donne = lecteur(bloc)
    if donne is None:
        return 'V', 'aucune réponse lisible'
    if not isinstance(attendu, dict):
        return ('R' if donne == attendu else 'N'), 'répondu %s' % donne
    justes = sum(1 for k, v in attendu.items() if donne.get(k) == v)
    total = len(attendu)
    if justes == total:
        return 'R', '%d sur %d' % (justes, total)
    if justes == 0:
        return 'N', '0 sur %d' % total
    return 'P', '%d sur %d' % (justes, total)


def coder_axe_d(num, champs):
    """Critère rendu mécanique par la grille : la réponse est-elle juste, et
    un chiffre du Document 1 figure-t-il dedans. Les deux, ou ce n'est pas R."""
    tout = ' '.join(v for v in champs.values() if v).lower()
    if not tout.strip():
        return 'V', 'sans réponse'
    if num == 13:
        juste = re.search(r'\b3\b|trois', tout) is not None
        chiffre = 'sortie' in tout or '3 prise' in tout or 'disponible' in tout
    elif num == 14:
        juste = re.search(r'\boui\b', tout) is not None
        chiffre = re.search(r'\b8\b|huit', tout) is not None
    else:
        juste = re.search(r'ne se charge|pas entièrement|incomplèt|pas le temps|'
                          r'pas assez|insuffis|manque', tout) is not None
        chiffre = re.search(r'\b7\b|sept', tout) is not None
    if juste and chiffre:
        return 'R', 'réponse juste et chiffre du document'
    if juste or chiffre:
        return 'P', ('réponse juste, chiffre absent' if juste
                     else 'chiffre présent, conclusion absente')
    return 'N', 'ni la réponse ni le chiffre'


def depouiller(dossier, niveau):
    data = json.load(io.open(os.path.join(dossier, 'a-corriger.json'),
                             encoding='utf-8'))['travaux']
    evals = [t for t in data if t['document'] == 'eval' and t.get('fichier_local')]
    if not evals:
        print('Aucune évaluation diagnostique dans ce dossier.')
        return 1
    cor = corriges(niveau)
    eleves = []
    for t in evals:
        txt = texte_du_pdf(os.path.join(dossier, t['fichier_local']))
        nom, classe, date = nom_et_classe(txt)
        blocs = decouper(txt)
        manquants = [n for n in INTITULES if n not in blocs]
        codes, details, redige = {}, {}, {}
        for n in sorted(INTITULES):
            it = cor.get(str(n))
            if it is None or n not in blocs:
                codes[n] = 'V'
                details[n] = 'item absent de la copie'
                continue
            code, detail = coder(n, it['type'], it['attendu'], blocs[n])
            if code is None:                      # item rédigé
                champs = detail
                vide = not any(v for v in champs.values())
                if n in (13, 14, 15):
                    code, detail = coder_axe_d(n, champs)
                else:
                    code = 'V' if vide else None  # à coder à la main
                    detail = ' / '.join('%s : %s' % (k, v)
                                        for k, v in champs.items() if v)
                redige[n] = champs
            codes[n] = code
            details[n] = detail
        eleves.append(dict(nom=nom, classe=classe, date=date, codes=codes,
                           details=details, redige=redige,
                           manquants=manquants, rendu=t['id']))
    eleves.sort(key=lambda e: e['nom'])
    return eleves


def ecrire(eleves, dossier, groupe):
    aujourdhui = datetime.date.today().isoformat()
    chemin = os.path.join(dossier, 'Depouillement-%s-%s.md'
                          % (groupe.replace(' ', ''), aujourdhui))
    o = []
    a = o.append
    a('# Dépouillement du diagnostique de rentrée')
    a('## %s, %d copies, %s\n' % (groupe, len(eleves), aujourdhui))
    a('*Grille du diagnostique : un code par item, R réussi, P partiel, '
      'N non réussi, V vide. Le score d’un axe est le nombre de R. '
      '**Aucun total général, aucun classement** : c’est la règle de la '
      'grille, et le diagnostique porte « ce travail n’est pas noté ».*\n')
    a('**Ce document porte des noms d’élèves : il ne va pas dans le dépôt.** '
      'Il s’efface avec les copies extraites une fois les groupes de besoin '
      'constitués.\n')
    a('---\n')

    a('## Où en est la classe, axe par axe\n')
    a('| Axe | Items | Réussi | Partiel | Non réussi | Vide | À coder |')
    a('|---|---|---|---|---|---|---|')
    for lettre, nom, items in AXES:
        c = {k: 0 for k in 'RPNV'}
        amain = 0
        for e in eleves:
            for n in items:
                v = e['codes'].get(n)
                if v in c:
                    c[v] += 1
                elif v is None:
                    amain += 1
        # Le pourcentage se calcule sur les cases CODÉES, jamais sur toutes :
        # les items rédigés ne sont pas des échecs, ils ne sont pas encore
        # lus. Les compter au dénominateur ferait passer un axe entièrement
        # rédigé pour un axe entièrement raté, ce qui est exactement le
        # contresens que la grille interdit.
        codees = c['R'] + c['P'] + c['N'] + c['V']
        part = '(%d %% des cases codées)' % round(100.0 * c['R'] / codees) \
            if codees else '(rien de codable ici)'
        a('| %s | %s | %d %s | %d | %d | %d | %s |'
          % (lettre, ', '.join(str(i) for i in items), c['R'], part,
             c['P'], c['N'], c['V'], amain or ''))
    a('')
    a('*Les colonnes « à coder » sont les items rédigés, 3, 7, 10 et 16 : le '
      'script ne les juge pas, il recopie la réponse plus bas. Ils sont hors '
      'du pourcentage, sans quoi un axe non encore lu passerait pour un axe '
      'raté.*\n')

    a('## Item par item\n')
    a('| Item | Ce qu’il vérifie | R | P | N | V | À coder à la main |')
    a('|---|---|---|---|---|---|---|')
    for n in sorted(INTITULES):
        c = {k: 0 for k in 'RPNV'}
        amain = 0
        for e in eleves:
            v = e['codes'].get(n)
            if v in c:
                c[v] += 1
            elif v is None:
                amain += 1
        a('| %d | %s | %d | %d | %d | %d | %s |'
          % (n, INTITULES[n], c['R'], c['P'], c['N'], c['V'],
             str(amain) if amain else ''))
    a('')

    a('## Les trois surlignages de la grille\n')
    def faibles(items, seuil):
        out = []
        for e in eleves:
            r = sum(1 for n in items if e['codes'].get(n) == 'R')
            if r <= seuil:
                out.append('%s (%d R sur %d)' % (e['nom'], r, len(items)))
        return out
    c_items = [9, 10, 11, 12]
    d_items = [13, 14, 15]
    a('**Maîtrise insuffisante sur l’axe C, lecture de programme.** %s\n'
      % (', '.join(faibles(c_items, 1)) or 'personne.'))
    a('**Maîtrise insuffisante sur l’axe D, méthode d’examen.** %s\n'
      % (', '.join(faibles(d_items, 0)) or 'personne.'))
    a('*Le troisième surlignage, les élèves n’ayant jamais présenté de travail '
      'à l’oral, se lit dans la Feuille B et non ici.*\n')

    trop_vides = [e for e in eleves
                  if sum(1 for v in e['codes'].values() if v == 'V') > 4]
    a('## Règle du vide\n')
    if trop_vides:
        a('Plus de quatre cases vides interdit tout positionnement. **Faire '
          'repasser les items non traités** avant de conclure quoi que ce '
          'soit pour : %s.\n'
          % ', '.join('%s (%d vides)'
                      % (e['nom'], sum(1 for v in e['codes'].values() if v == 'V'))
                      for e in trop_vides))
    else:
        a('Aucune copie ne dépasse quatre cases vides : toutes se positionnent.\n')

    a('---\n')
    a('## Élève par élève\n')
    a('*Les items 3, 7, 10 et 16 demandent de lire une phrase : le script ne '
      'les code pas, il recopie la réponse. Les cases marquées « à coder » '
      'sont les seules qui te restent.*\n')
    for e in eleves:
        a('### %s\n' % e['nom'])
        ligne = []
        for lettre, nom, items in AXES:
            r = sum(1 for n in items if e['codes'].get(n) == 'R')
            ligne.append('%s %d/%d' % (lettre, r, len(items)))
        a('`%s`  ·  rempli le %s\n' % ('   '.join(ligne), e['date']))
        a('| Item | Code | Détail |')
        a('|---|---|---|')
        for n in sorted(INTITULES):
            code = e['codes'].get(n)
            a('| %d | %s | %s |' % (n, code if code else '**à coder**',
                                    (e['details'].get(n) or '')[:160]))
        a('')
    io.open(chemin, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
    return chemin


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    dossier = args[0]
    niveau = args[args.index('--niveau') + 1] if '--niveau' in args else '3eme'
    eleves = depouiller(dossier, niveau)
    if isinstance(eleves, int):
        return eleves
    data = json.load(io.open(os.path.join(dossier, 'a-corriger.json'),
                             encoding='utf-8'))['travaux']
    groupe = data[0]['groupe'] if data else 'groupe'
    chemin = ecrire(eleves, dossier, groupe)
    print('%d copies dépouillées.' % len(eleves))
    a_main = sum(1 for e in eleves for v in e['codes'].values() if v is None)
    print('%d cases restent à coder à la main (items rédigés 3, 7, 10 et 16).'
          % a_main)
    print('Dépouillement : %s' % chemin)
    return 0


if __name__ == '__main__':
    sys.exit(main())
