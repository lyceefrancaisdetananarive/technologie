#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migration des pages de séquence vers le gabarit commun (phase 2, décision D15).

    python3 outils/migrer.py            # transforme les pages, en place
    python3 outils/migrer.py --simuler  # dit ce qui changerait, n'écrit rien

REJOUABLE : chaque transformation reconnaît son propre résultat et ne
s'applique pas deux fois. Relancer le script sur un site déjà migré ne change
rien. Une page éditée à la main après migration n'est pas abîmée : les blocs
sont reconnus par leur forme, jamais par leur position en ligne.

Ce que le script fait à chaque page de séquence ([345]eme/p*/seq*-*.html) :

  1. retire le bloc <style> propre à la page quand il ne fait que répéter ce
     que css/style.css fournit désormais (encart de lien direct, EBEP) ;
  2. charge js/catalogue.js avant components.js, pour l'en-tête de séquence ;
  3. déplace en pied de fiche l'encart « Lien direct » et le mode d'emploi du
     dépôt, qui passaient avant le premier mot du cours ;
  4. replie les notes de travail du professeur sur la vidéo (« VÉRIFIÉ LE »,
     « À VISIONNER AVANT LA SÉANCE ») dans un bloc « Notes pour le
     professeur », que l'élève ne lit plus par défaut ;
  5. remplace le tableau Niveau / Durée / Thème / Compétences de la fiche
     d'activité par la seule liste des compétences : niveau, période, séances
     et thème viennent maintenant du catalogue, un seul endroit à corriger ;
  6. retire des actions de page les boutons vers les documents frères, que
     les onglets de séquence remplacent ;
  7. donne à la problématique son bloc propre, lisible en premier ;
  8. sur la version adaptée, retire l'étiquette qui nommait les troubles des
     élèves (décision D15, question 9) ;
  9. écrit techlft.egd.mg à la place de technologie-lft.vercel.app dans les
     textes visibles (les QR codes imprimés, eux, ne changent pas : go.html
     répond aux deux adresses).

Sans dépendance : Python 3 et sa bibliothèque standard.
"""
import glob
import hashlib
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RACINE)

SIMULER = '--simuler' in sys.argv
JOURNAL = {}


def note(page, quoi):
    JOURNAL.setdefault(page, []).append(quoi)


def lire(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def ecrire(p, s):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)


# ---------------------------------------------------------------- 1. styles
def normaliser(css):
    return re.sub(r'\s+', ' ', css).strip()


STYLES_COMMUNS = set()
for bloc in [
    ".lien-encart { display: grid; grid-template-columns: 104px 1fr; gap: 14px; align-items: center; } .lien-encart img { width: 104px; height: auto; border: 1px solid var(--gray-300); border-radius: 6px; background: #fff; } .lien-code { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 700; font-size: 1.5rem; letter-spacing: .06em; } .lien-url { font-size: .88rem; word-break: break-all; color: var(--gray-600); } @media (max-width: 520px) { .lien-encart { grid-template-columns: 1fr; justify-items: start; } }",
]:
    STYLES_COMMUNS.add(hashlib.md5(normaliser(bloc).encode()).hexdigest())


def retirer_styles(page, s):
    def rempl(m):
        corps = normaliser(re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S))
        h = hashlib.md5(corps.encode()).hexdigest()
        # Les variantes EBEP ne définissent que .ebep-content / .ebep-hint / .ebep-fill,
        # toutes trois reprises dans la feuille commune.
        seul_ebep = corps and all(sel.strip().startswith('.ebep-') for sel in re.findall(r'([^{}]+)\{', corps))
        if h in STYLES_COMMUNS or seul_ebep:
            note(page, 'style propre retiré')
            return ''
        return m.group(0)
    return re.sub(r'\s*<style[^>]*>(.*?)</style>', rempl, s, flags=re.S)


# ---------------------------------------------------------------- 2. catalogue.js
def ajouter_catalogue(page, s):
    if 'js/catalogue.js' in s:
        return s
    m = re.search(r'(\s*)<script src="((?:\.\./)+)js/components\.js"></script>', s)
    if not m:
        return s
    note(page, 'catalogue.js chargé')
    return s.replace(m.group(0), f'{m.group(1)}<script src="{m.group(2)}js/catalogue.js"></script>{m.group(0)}', 1)


# ---------------------------------------------------------------- utilitaires HTML
def bloc_div(s, debut):
    """Renvoie (a, b) : les bornes du <div …> qui commence à `debut`, accolades
    équilibrées. `debut` doit pointer sur '<div'."""
    prof, i = 0, debut
    motif = re.compile(r'<div\b|</div>')
    while True:
        m = motif.search(s, i)
        if not m:
            return None
        prof += 1 if m.group(0) == '<div' else -1
        i = m.end()
        if prof == 0:
            return debut, i


def trouver_div(s, marqueur, depuis=0):
    """Le <div …> le plus proche qui contient `marqueur`, en remontant."""
    k = s.find(marqueur, depuis)
    if k < 0:
        return None
    # remonter au <div qui contient k et dont la fermeture est après k
    for m in reversed(list(re.finditer(r'<div\b', s[:k]))):
        bornes = bloc_div(s, m.start())
        if bornes and bornes[1] > k:
            return bornes
    return None


# ---------------------------------------------------------------- 3. pied de fiche
def deplacer_pied(page, s):
    if 'class="pied-fiche"' in s:
        return s
    if 'Lien direct vers cette page' not in s:
        return s
    bornes = trouver_div(s, 'Lien direct vers cette page')
    if not bornes:
        return s
    a, b = bornes
    carte = s[a:b]
    # La carte doit être celle qui porte l'encart : un content-card
    if 'lien-encart' not in carte or 'content-card' not in carte[:200]:
        return s
    s = s[:a] + s[b:]
    # dépôt : le mode d'emploi devient un dépliant, plus un bouton clair
    rendre = ''
    m = re.search(r'<div class="info-box info-box-green"[^>]*>\s*<div class="info-box-title">(?:<span class="ico">&#x1F4E4;</span>\s*)?Rendre mon travail</div>', carte, re.S)
    if m:
        bornes_boite = bloc_div(carte, m.start())
        if not bornes_boite:
            return s   # forme inattendue : on ne touche pas à la page
        fin_boite = bornes_boite[1]
        mode_emploi = carte[m.end():fin_boite - len('</div>')].replace('technologie-lft.vercel.app', 'techlft.egd.mg').strip()
        carte = carte[:m.start()] + carte[fin_boite:]
        rel = re.search(r'src="((?:\.\./)+)img/qr/', carte)
        racine = rel.group(1) if rel else '../../'
        rendre = f'''
      <div class="rendre no-print">
        <div><b>Rendre mon travail</b><span>Une photo nette de ta feuille, ou un PDF, dans le classeur numérique.</span></div>
        <a class="btn" href="{racine}classeur/index.html"><span class="ico">&#x1F4E4;</span> Déposer</a>
      </div>
      <details class="depliant no-print"><summary>Comment déposer mon travail ?</summary>{mode_emploi}</details>'''
    carte = carte.replace('technologie-lft.vercel.app', 'techlft.egd.mg')
    carte = re.sub(r'<p style="margin:\.2rem 0 \.4rem">Scanne le QR code, ou saisis ce code sur la page\s*d\'accès direct du site\.</p>',
                   '<p>Scanne le QR code, ou tape ce code sur la page d\'accès du site.</p>', carte)
    pied = f'''
      <div class="pied-fiche">{rendre}
{carte}
      </div>
'''
    k = s.rfind('</main>')
    if k < 0:
        return s
    s = s[:k] + pied + '    ' + s[k:]
    note(page, 'lien direct et dépôt en pied de fiche')
    return s


# ---------------------------------------------------------------- 4. notes vidéo
def replier_notes_video(page, s):
    if 'Notes pour le professeur' in s:
        return s
    m0 = re.search(r'<div class="info-box info-box-green">\s*<div class="info-box-title">(?:<span class="ico">&#x1F3AC;</span>|&#x1F3AC;)?\s*Vidéo académique retenue</div>', s)
    if not m0:
        return s
    bornes = bloc_div(s, m0.start())
    if not bornes:
        return s
    a, b = bornes
    boite = s[a:b]
    # L'attribution (auteur, licence, lien vers l'original) est une obligation
    # des licences Creative Commons : elle reste sous la vidéo. Seules les
    # réserves de travail du professeur (« VÉRIFIÉ LE », « À VISIONNER ») se
    # replient.
    notes = [n for n in re.findall(r'<p class="vid-licence">.*?</p>', boite, re.S)
             if re.search(r'Réserve\s*:|VÉRIFIÉ|À VISIONNER|REQUALIFICATION', n)]
    if not notes:
        return s
    for n in notes:
        boite = boite.replace(n, '', 1)
    # le paragraphe « Prompt de génération » qui suit la boîte, s'il existe
    apres = s[b:]
    m = re.match(r'\s*<p class="no-print"[^>]*>\s*Prompt de génération.*?</p>', apres, re.S)
    prompt = ''
    if m:
        prompt = m.group(0).strip()
        apres = apres[m.end():]
    details = ('\n        <details class="note-prof no-print"><summary>Notes pour le professeur : réserves sur cette vidéo</summary>'
               + ''.join(notes) + prompt + '</details>')
    s = s[:a] + boite + details + apres
    note(page, 'notes vidéo repliées')
    return s


# ---------------------------------------------------------------- 5. tableau de métadonnées
def remplacer_meta(page, s):
    if 'class="content-card competences"' in s:
        return s
    m = re.search(r'<div class="content-card">\s*<table>\s*(?:<tbody>\s*)?<tr>\s*<td[^>]*><strong>Niveau</strong></td>.*?</table>\s*</div>', s, re.S)
    if not m:
        return s
    badges = re.findall(r'<span class="competence-badge">.*?</span>', m.group(0), re.S)
    if not badges:
        return s
    nouveau = ('<div class="content-card competences">\n        <h2>Compétences travaillées</h2>\n        '
               + '\n        '.join(badges) + '\n      </div>')
    s = s[:m.start()] + s[m.end():]
    # en pied de fiche, avant le lien direct, pour que le premier écran soit le contenu
    k = s.find('<div class="pied-fiche">')
    if k < 0:
        k = s.rfind('</main>')
        nouveau = '\n      ' + nouveau + '\n    '
    s = s[:k] + nouveau + '\n      ' + s[k:]
    note(page, 'métadonnées remplacées par les compétences, en pied de fiche')
    return s


# ---------------------------------------------------------------- 6. actions de page
DOCS_FRERES = re.compile(r'\s*<a href="seq\d+-(?:activite|structuration|quiz|eval|revision|ebep)\.html" class="btn btn-outline">.*?</a>', re.S)


def epurer_actions(page, s):
    m = re.search(r'<div class="page-actions no-print">(.*?)</div>', s, re.S)
    if not m:
        return s
    corps, n = DOCS_FRERES.subn('', m.group(1))
    if n == 0:
        return s
    if not corps.strip():
        s = s[:m.start()] + s[m.end():]
    else:
        s = s[:m.start()] + '<div class="page-actions no-print">' + corps + '</div>' + s[m.end():]
    note(page, f'{n} bouton(s) vers les documents frères retiré(s)')
    return s


# ---------------------------------------------------------------- 7. problématique
def bloc_probleme(page, s):
    m2 = re.search(r'<p>\s*<strong>Problématique\s*:?\s*</strong>\s*:?\s*(.*?)</p>', s, re.S)
    if m2 and 'class="probleme"' not in s:
        s = s[:m2.start()] + f'<div class="probleme"><div class="lab">Problématique</div><p>{m2.group(1).strip()}</p></div>' + s[m2.end():]
        note(page, 'problématique mise en avant')
    m = re.search(r'<div class="info-box info-box-blue"[^>]*>\s*<div class="info-box-title">Problématique</div>(.*?)</div>', s, re.S)
    if not m:
        return s
    texte = m.group(1).strip()
    texte = re.sub(r'^<strong>(.*)</strong>$', r'\1', texte, flags=re.S).strip()
    if not texte or '<div' in texte:
        return s
    s = s[:m.start()] + f'<div class="probleme"><div class="lab">Problématique</div><p>{texte}</p></div>' + s[m.end():]
    note(page, 'problématique mise en avant')
    return s


# ---------------------------------------------------------------- 8. étiquette EBEP
def etiquette_ebep(page, s):
    if '-ebep.html' not in page:
        return s
    avant = s
    niv = page.split('/')[0]
    picto = {'5eme': '&#x1F535;', '4eme': '&#x1F7E2;', '3eme': '&#x1F7E0;'}[niv]
    # le badge rouge au fauteuil roulant devient le badge de niveau ordinaire
    s = re.sub(r'<span class="page-level-badge" style="[^"]*"><span class="ico">&#x267F;</span>\s*',
               f'<span class="page-level-badge level-{niv}"><span class="ico">{picto}</span> ', s)
    s = re.sub(r'<span class="page-level-badge level-(\deme)">(?:&#x1F7E[02];|&#x1F535;)\s*', lambda m: f'<span class="page-level-badge level-{m.group(1)}"><span class="ico">{picto}</span> ', s)
    s = s.replace(' · ADAPTATION EBEP</span>', ' · Version adaptée</span>')
    s = re.sub(r' · ACTIVITÉ ADAPTÉE \(EBEP\)</span>', ' · Version adaptée</span>', s)
    s = re.sub(r'<p class="page-description">\s*Version adaptée pour les Élèves à Besoins Éducatifs Particuliers[^<]*</p>',
               '<p class="page-description">Même activité, présentée autrement : consignes plus courtes, plus d\'espace pour écrire, une seule chose à la fois.</p>', s)
    s = re.sub(r'ACTIVITÉ ADAPTÉE \(EBEP\) · ', 'Version adaptée · ', s)
    # l'encadré des adaptations s'adresse au professeur
    m8 = re.search(r'<div class="info-box info-box-orange"[^>]*>\s*<div class="info-box-title">Adaptations de cette fiche</div>', s)
    if m8 and 'Notes pour le professeur : adaptations' not in s:
        b8 = bloc_div(s, m8.start())
        if b8:
            s = s[:b8[0]] + '<details class="note-prof no-print"><summary>Notes pour le professeur : adaptations de cette version</summary>' + s[b8[0]:b8[1]] + '</details>' + s[b8[1]:]
    s = re.sub(r'( · Période \d) · (?:Version EBEP|EBEP)</span>', r'\1 · Version adaptée</span>', s)
    s = s.replace('Version EBEP', 'Version adaptée').replace('"label":"Fiche EBEP"', '"label":"Version adaptée"')
    s = re.sub(r'Version adaptée pour les Élèves à Besoins Éducatifs Particuliers \(DYS, TDAH, allophones, PAP/PPS\)\.',
               'Même activité, présentée autrement : consignes plus courtes, plus d\'espace pour écrire, une seule chose à la fois.', s)
    s = s.replace('data-print-title="5ème · Séquence', 'data-print-title="5ème · Séquence')
    s = re.sub(r'(data-print-title="[^"]*?) : ADAPTATION EBEP"', r'\1 : version adaptée"', s)
    if s != avant:
        note(page, 'étiquette EBEP retirée')
    return s


# ---------------------------------------------------------------- 9. adresse
def adresse(page, s):
    n = s.count('technologie-lft.vercel.app')
    if not n:
        return s
    s = s.replace('https://technologie-lft.vercel.app/go.html', 'https://techlft.egd.mg/go.html')
    s = s.replace('technologie-lft.vercel.app/classeur', 'techlft.egd.mg/classeur')
    s = s.replace('technologie-lft.vercel.app', 'techlft.egd.mg')
    note(page, f'{n} adresse(s) vercel.app → techlft.egd.mg')
    return s


# ---------------------------------------------------------------- 5 ter. fiche professeur
def epurer_meta_prof(page, s):
    """La fiche professeur garde son tableau d'objectifs (compétences, objectifs
    de séquence, prérequis…), mais ses lignes Niveau / Thème / Durée répétaient
    des valeurs que l'en-tête de séquence donne désormais depuis le catalogue,
    parfois autrement. On retire ces trois lignes, rien d'autre."""
    if not page.endswith('-prof.html'):
        return s
    motif = re.compile(r'\s*<tr>\s*<td[^>]*><strong>(?:Niveau|Thème|Durée)</strong></td>\s*<td[^>]*>.*?</td>\s*</tr>', re.S)
    s2, n = motif.subn('', s)
    if n:
        note(page, f'{n} ligne(s) Niveau / Thème / Durée retirée(s) du tableau professeur')
    return s2


# ---------------------------------------------------------------- 10. emojis nus dans les badges
def pictos_badges(page, s):
    """Les pages les plus récentes écrivent l'emoji du badge à nu : components.js
    ne peut alors pas le remplacer par un tracé. On l'enveloppe."""
    n = 0
    def rempl(m):
        nonlocal n; n += 1
        return f'{m.group(1)}<span class="ico">{m.group(2)}</span> '
    s = re.sub(r'(<span class="page-level-badge[^>]*>)(&#x1F7E[02];|&#x1F535;)\s*', rempl, s)
    if n:
        note(page, f'{n} emoji de badge enveloppé(s)')
    return s


ETAPES = [retirer_styles, ajouter_catalogue, deplacer_pied, replier_notes_video, remplacer_meta, epurer_meta_prof,
          epurer_actions, bloc_probleme, etiquette_ebep, pictos_badges, adresse]


def pages_de_sequence():
    return sorted(glob.glob('[345]eme/p*/seq*-*.html'))


def main():
    modifiees = 0
    for page in pages_de_sequence():
        if os.path.basename(page).startswith('._'):
            continue
        avant = lire(page)
        s = avant
        for etape in ETAPES:
            s = etape(page, s)
        if s != avant:
            modifiees += 1
            if not SIMULER:
                ecrire(page, s)
    for page, quoi in JOURNAL.items():
        print(f'{page} : {", ".join(quoi)}')
    print(f'{modifiees} page(s) {"à modifier" if SIMULER else "modifiée(s)"} sur {len(pages_de_sequence())}.')


if __name__ == '__main__':
    main()
