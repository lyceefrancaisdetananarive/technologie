#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dérive du catalogue tout ce qui, jusqu'ici, était recopié à la main.

    python3 outils/generer.py            # réécrit les blocs générés
    python3 outils/generer.py --verifier # ne réécrit rien, échoue si un bloc
                                         # n'est pas à jour (pour le vérificateur)

Un seul fichier source, catalogue.json, et dix cibles :

  js/catalogue.js            le catalogue pour le navigateur (recherche, classeur,
                             carte de l'année)
  api/_lib/catalogue.js      la même chose en module ES pour les fonctions /api/
                             (plan, avancement, essai, correction) : à redéployer
                             après toute régénération
  go.html                    la table des 165 codes imprimés dans les cahiers
  js/components.js           l'index de recherche du bandeau
  js/sequences.js            ce que le classeur accepte en dépôt
  structuration/index.html   la page « Cours », par niveau et par période
  5eme|4eme|3eme/index.html  les cartes de séquence de chaque période
  enseignant/index.html      les tables de fiches professeur
  outils/index.html          les listes de quiz et de cours
  outils/qrcodes.html        la planche imprimable des 165 codes (titres seulement,
                             les codes et les images ne changent jamais, D9)

Chaque cible porte des marqueurs :
  HTML :  <!-- catalogue:debut NOM --> … <!-- catalogue:fin NOM -->
  JS   :  // catalogue:debut NOM … // catalogue:fin NOM
Seul l'intérieur des marqueurs est réécrit. Tout le reste de la page reste à la
main. Un marqueur absent arrête le script : mieux vaut ne rien écrire que
d'écrire au mauvais endroit.

Sans dépendance : Python 3 et sa bibliothèque standard.
"""
import datetime
import html
import json
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RACINE)

ORDRE_NIVEAUX = ['5eme', '4eme', '3eme']
COULEUR = {'5eme': 'var(--color-5eme)', '4eme': 'var(--color-4eme)', '3eme': 'var(--color-3eme)'}
PICTO_NIVEAU = {'5eme': '&#x1F535;', '4eme': '&#x1F7E2;', '3eme': '&#x1F7E0;'}
PICTO_DOC = {'activite': '&#x1F4DD;', 'cours': '&#x1F4D8;', 'eval': '&#x1F4CA;', 'quiz': '&#x2753;',
             'revision': '&#x1F4D6;', 'ebep': '&#x267F;', 'prof': '&#x1F4D7;'}
CLASSE_DOC = {'activite': 'activite', 'cours': 'structuration', 'eval': 'eval', 'quiz': 'quiz',
              'revision': 'revision', 'ebep': 'ebep', 'prof': 'prof'}
LIBELLE_COURT = {'activite': 'Activité', 'cours': 'Cours', 'eval': 'Éval', 'quiz': 'Quiz',
                 'revision': 'Révision', 'ebep': 'EBEP', 'prof': 'Prof'}


def lire(chemin):
    with open(chemin, encoding='utf-8') as f:
        return f.read()


def ecrire(chemin, contenu):
    with open(chemin, 'w', encoding='utf-8') as f:
        f.write(contenu)


def e(t):
    """Échappement HTML, apostrophes comprises, comme le reste du site."""
    return html.escape(str(t), quote=True).replace("'", '&#x27;')


def js(t):
    return str(t).replace('\\', '\\\\').replace("'", "\\'")


def remplacer_bloc(contenu, nom, nouveau, commentaire, chemin='?'):
    """Remplace ce qui se trouve entre les marqueurs `nom`. Lève si absents,
    doublés ou mal ordonnés : une page éditée à la main peut avoir perdu ou
    dupliqué un marqueur, et écrire au mauvais endroit serait pire que ne rien
    écrire."""
    if commentaire == 'html':
        debut, fin = f'<!-- catalogue:debut {nom} -->', f'<!-- catalogue:fin {nom} -->'
    else:
        debut, fin = f'// catalogue:debut {nom}', f'// catalogue:fin {nom}'
    if contenu.count(debut) != 1 or contenu.count(fin) != 1:
        raise SystemExit(f'{chemin} : le marqueur « {nom} » doit apparaître exactement une fois '
                         f'(début {contenu.count(debut)}, fin {contenu.count(fin)})')
    a = contenu.index(debut) + len(debut)
    b = contenu.index(fin)
    if b < a:
        raise SystemExit(f'{chemin} : le marqueur de fin « {nom} » précède celui de début')
    return contenu[:a] + '\n' + nouveau.rstrip('\n') + '\n' + contenu[b:]


# ---------------------------------------------------------------------------
# Les six générateurs. Chacun renvoie {chemin: contenu_complet}.
# ---------------------------------------------------------------------------

def gen_catalogue_js(cat):
    """Version allégée pour le navigateur : pas de champs de diagnostic."""
    leger = {
        'annee': cat['annee'],
        'periodes': cat['periodes'],
        'themes': cat['themes'],
        'documents': cat['documents'],
        'niveaux': {},
    }
    for niv in ORDRE_NIVEAUX:
        n = cat['niveaux'][niv]
        leger['niveaux'][niv] = {
            'libelle': n['libelle'], 'long': n['long'], 'index': n['index'],
            'sequences': [{
                'n': s['n'], 'periode': s['periode'], 'cle': s['cle'], 'dossier': s['dossier'],
                'id': f"{s['dossier']}/{s['cle']}",
                'titre': s['titre'], 'resume': s.get('resume', ''),
                'theme': s['theme'], 'seances': s['seances'],
                'activites': s['activites'],
                'competences': s.get('competences', []),
                'documents': {k: {kk: vv for kk, vv in d.items() if kk in ('fichier', 'code', 'reserve')}
                              for k, d in s['documents'].items()},
            } for s in n['sequences']],
            'diagnostiques': n['diagnostiques'],
            'bilans': n['bilans'],
        }
    corps = json.dumps(leger, ensure_ascii=False, indent=1)
    entete = (
        '// FICHIER GÉNÉRÉ par outils/generer.py depuis catalogue.json. Ne pas éditer ici.\n'
        f'// Généré le {datetime.date.today().isoformat()}.\n'
        '//\n')
    return {
        'js/catalogue.js': (
            entete
            + '// Le plan de l\'année, tel que le navigateur en a besoin : recherche du\n'
            '// bandeau, liste du classeur, carte de l\'année. Se charge en <script>\n'
            '// classique (window.CATALOGUE) ou en CommonJS (require) pour les outils.\n'
            f'const CATALOGUE = {corps};\n'
            'if (typeof window !== "undefined") window.CATALOGUE = CATALOGUE;\n'
            'if (typeof module !== "undefined") module.exports = CATALOGUE;\n'),
        # La même chose en module ES pour les fonctions /api/ : Vercel ne suit
        # que les imports statiques quand il empaquette une fonction, un
        # require() calculé vers js/catalogue.js n'embarquerait pas le fichier.
        'api/_lib/catalogue.js': (
            entete
            + '// Copie du plan de l\'année pour les fonctions /api/ (plan par groupe,\n'
            '// avancement) : mêmes données que js/catalogue.js, en module ES.\n'
            f'const CATALOGUE = {corps};\n'
            'export default CATALOGUE;\n'),
    }


def codes(cat):
    """Tous les codes de cahier, dans un ordre stable."""
    table = []
    for niv in ORDRE_NIVEAUX:
        n = cat['niveaux'][niv]
        for d in n['diagnostiques']:
            if 'code' in d['eleve']:
                table.append((d['eleve']['code'], d['eleve']['fichier']))
        for s in n['sequences']:
            for cle_doc in ('activite', 'cours', 'eval', 'quiz', 'ebep', 'revision'):
                doc = s['documents'].get(cle_doc)
                if doc and 'code' in doc:
                    table.append((doc['code'], doc['fichier']))
    return table


def gen_go(cat):
    page = lire('go.html')
    lignes = ''.join(f'"{c}": "{f}",\n' for c, f in codes(cat))
    a = page.index('const TABLE = {') + len('const TABLE = {')
    b = page.index('};', a)
    page = page[:a] + '\n' + lignes + page[b:]
    return {'go.html': page}


def gen_recherche(cat):
    contenu = lire('js/components.js')
    lignes = []
    lignes.append("    { title: 'Cours, fiches de structuration', url: `${ROOT}/structuration/index.html`, level: '', tags: 'cours structuration résumé connaissances' },")
    for niv in ORDRE_NIVEAUX:
        n = cat['niveaux'][niv]
        lib = n['libelle']
        for d in n['diagnostiques']:
            lignes.append(f"    {{ title: 'Évaluation diagnostique · {js(d['titre'])} ({lib})', url: `${{ROOT}}/{d['eleve']['fichier']}`, level: '{niv}', tags: 'diagnostique rentrée évaluation' }},")
        for s in n['sequences']:
            base = f"S{s['n']}, {s['titre']} ({lib})"
            mots = f"séquence {s['n']} période {s['periode']} {s.get('resume', '')} {' '.join(a['titre'] for a in s['activites'])}".lower()
            mots = re.sub(r'[^\w\s:/-]', ' ', mots)
            mots = re.sub(r'\s+', ' ', mots).strip()
            for cle_doc, doc in s['documents'].items():
                if doc.get('reserve'):
                    # La recherche du bandeau est publique : les corrigés ne s'y
                    # affichent pas, même s'ils sont derrière le portier. Le
                    # professeur les trouve dans son espace.
                    continue
                lib_doc = {'activite': 'Activité', 'cours': 'Cours', 'quiz': 'Quiz', 'eval': 'Évaluation',
                           'revision': 'Révision', 'ebep': 'Version adaptée', 'prof': 'Fiche professeur'}[cle_doc]
                tags = f"{cle_doc} {lib_doc.lower()} {mots}"
                if cle_doc == 'cours':
                    tags = 'structuration ' + tags
                lignes.append(f"    {{ title: '{js(lib_doc)} {js(base)}', url: `${{ROOT}}/{doc['fichier']}`, level: '{niv}', tags: '{js(tags)}' }},")
        for b in n['bilans']:
            lignes.append(f"    {{ title: '{js(b['titre'])} ({lib})', url: `${{ROOT}}/{b['fichier']}`, level: '{niv}', tags: 'trimestre bilan {b['type']} révision' }},")
    return {'js/components.js': remplacer_bloc(contenu, 'recherche', '\n'.join(lignes), 'js', 'js/components.js')}


def gen_sequences_js(cat):
    contenu = lire('js/sequences.js')
    lignes = ['export const SEQUENCES = {']
    for niv in ORDRE_NIVEAUX:
        n = cat['niveaux'][niv]
        lignes.append(f"  '{niv}': [")
        for d in n['diagnostiques']:
            lignes.append(f"    {{ id: '{niv}/p{d['periode']}/diagnostique', titre: 'Évaluation diagnostique · {js(d['titre'])}' }},")
        for s in n['sequences']:
            lignes.append(f"    {{ id: '{s['dossier']}/{s['cle']}', titre: 'Séquence {s['n']} · {js(s['titre'])}' }},")
        lignes.append('  ],')
    lignes.append('};')
    return {'js/sequences.js': remplacer_bloc(contenu, 'sequences', '\n'.join(lignes), 'js', 'js/sequences.js')}


def gen_cours(cat):
    contenu = lire('structuration/index.html')
    parts = []
    for niv in ORDRE_NIVEAUX:
        n = cat['niveaux'][niv]
        parts.append(f'''      <div class="content-card" style="border-left:5px solid {COULEUR[niv]};">
        <h2 style="display:flex;align-items:center;gap:var(--space-sm);">
          <span class="page-level-badge level-{niv}"><span class="ico">{PICTO_NIVEAU[niv]}</span> {n['libelle']}</span>
          {e(n['long'])}
        </h2>''')
        for p in cat['periodes']:
            seqs = [s for s in n['sequences'] if s['periode'] == p['n'] and 'cours' in s['documents']]
            if not seqs:
                continue
            parts.append(f'        <h3 style="margin-top:var(--space-md);">Période {p["n"]} · {e(p["libelle"])}</h3>')
            parts.append('        <div class="seq-card-links">')
            for s in seqs:
                parts.append(f'          <a href="../{s["documents"]["cours"]["fichier"]}" class="seq-link seq-link-structuration"><span class="ico">{PICTO_DOC["cours"]}</span> S{s["n"]} · {e(s["titre"])}</a>')
            parts.append('        </div>')
        parts.append('      </div>')
    return {'structuration/index.html': remplacer_bloc(contenu, 'cours', '\n'.join(parts), 'html', 'structuration/index.html')}


def carte_sequence(niv, s):
    liens = []
    for cle_doc in ('activite', 'cours', 'eval', 'quiz', 'revision'):
        doc = s['documents'].get(cle_doc)
        if doc:
            liens.append(f'                <a href="{doc["fichier"].split("/", 1)[1]}" class="seq-link seq-link-{CLASSE_DOC[cle_doc]}"><span class="ico">{PICTO_DOC[cle_doc]}</span> {LIBELLE_COURT[cle_doc]}</a>')
    resume = f' · {e(s["resume"])}' if s.get('resume') else ''
    return f'''            <!-- Séquence {s['n']} -->
            <div class="seq-card" data-seq="{s['n']}" data-id="{s['dossier']}/{s['cle']}">
              <div class="seq-card-number" style="background: {COULEUR[niv]};">{s['n']}</div>
              <h3>{e(s['titre'])}</h3>
              <p class="seq-card-meta">{s['seances']} séances{resume}</p>
              <div class="seq-card-links">
{chr(10).join(liens)}
              </div>
            </div>'''


def gen_index_niveaux(cat):
    sorties = {}
    for niv in ORDRE_NIVEAUX:
        n = cat['niveaux'][niv]
        contenu = lire(n['index'])
        for p in cat['periodes']:
            seqs = [s for s in n['sequences'] if s['periode'] == p['n']]
            bloc = '\n\n'.join(carte_sequence(niv, s) for s in seqs)
            contenu = remplacer_bloc(contenu, f'cartes-p{p["n"]}', bloc, 'html', n['index'])
        sorties[n['index']] = contenu
    return sorties


def gen_enseignant(cat):
    contenu = lire('enseignant/index.html')
    for niv in ORDRE_NIVEAUX:
        n = cat['niveaux'][niv]
        lignes = []
        for s in n['sequences']:
            prof = s['documents'].get('prof')
            ebep = s['documents'].get('ebep')
            liens = []
            if prof:
                liens.append(f'<a href="../{prof["fichier"]}" class="seq-link seq-link-prof" style="font-size:0.8rem;"><span class="ico">{PICTO_DOC["prof"]}</span> Prof</a>')
            if ebep:
                liens.append(f'<a href="../{ebep["fichier"]}" class="seq-link seq-link-ebep" style="font-size:0.8rem;margin-left:.3rem;"><span class="ico">{PICTO_DOC["ebep"]}</span> EBEP</a>')
            periode = f'P{s["periode"]}' + (' · transversal' if s['theme'] == 0 else '')
            lignes.append(f'            <tr><td><strong>Séq. {s["n"]}</strong> : {e(s["titre"])}</td><td>{periode}</td><td>{" ".join(liens)}</td></tr>')
        contenu = remplacer_bloc(contenu, f'prof-{niv}', '\n'.join(lignes), 'html', 'enseignant/index.html')
    return {'enseignant/index.html': contenu}


def gen_outils(cat):
    contenu = lire('outils/index.html')
    for niv in ORDRE_NIVEAUX:
        n = cat['niveaux'][niv]
        quiz, cours = [], []
        for s in n['sequences']:
            if 'quiz' in s['documents']:
                quiz.append(f'          <a href="../{s["documents"]["quiz"]["fichier"]}" class="seq-link seq-link-quiz" style="font-size:0.8rem;">S{s["n"]} · {e(s["titre"])}</a>')
            if 'cours' in s['documents']:
                cours.append(f'          <a href="../{s["documents"]["cours"]["fichier"]}" class="seq-link" style="font-size:0.8rem;">S{s["n"]} · {e(s["titre"])}</a>')
        contenu = remplacer_bloc(contenu, f'outils-quiz-{niv}', '\n'.join(quiz), 'html', 'outils/index.html')
        contenu = remplacer_bloc(contenu, f'outils-cours-{niv}', '\n'.join(cours), 'html', 'outils/index.html')
    return {'outils/index.html': contenu}


def gen_qrcodes(cat):
    """La planche imprimable : mêmes 165 codes, mêmes images, titres du catalogue."""
    contenu = lire('outils/qrcodes.html')
    libelles = {'activite': 'Activité', 'cours': 'Cours', 'eval': 'Évaluation', 'quiz': 'Quiz',
                'ebep': 'Version adaptée', 'revision': 'Révision'}
    def case(code, lib):
        return (f'<div class="qr-case"><img src="../img/qr/{code}.svg" alt="QR {code}">'
                f'<div class="qr-code">{code}</div><div class="qr-lib">{e(lib)}</div></div>')
    blocs = []
    for niv in ORDRE_NIVEAUX:
        n = cat['niveaux'][niv]
        b = [f'<div class="qr-niveau"><div class="content-card"><h2>{e(n["long"])}</h2>']
        for d in n['diagnostiques']:
            if 'code' in d['eleve']:
                b.append(f'<div class="qr-seq"><h3>Évaluation diagnostique de rentrée</h3><p class="qr-sous">Première séance de l\'année, non notée.</p>'
                         f'<div class="qr-grille">{case(d["eleve"]["code"], "Évaluation diagnostique")}</div></div>')
        for s in n['sequences']:
            cases = ''.join(case(s['documents'][k]['code'], libelles[k])
                            for k in ('activite', 'cours', 'eval', 'quiz', 'ebep', 'revision')
                            if k in s['documents'] and 'code' in s['documents'][k])
            b.append(f'<div class="qr-seq"><h3>Séquence {s["n"]} : {e(s["titre"])}</h3><p class="qr-sous">Période {s["periode"]}</p><div class="qr-grille">{cases}</div></div>')
        b.append('</div></div>')
        blocs.append(''.join(b))
    return {'outils/qrcodes.html': remplacer_bloc(contenu, 'qr', '\n'.join(blocs), 'html', 'outils/qrcodes.html')}


GENERATEURS = [gen_catalogue_js, gen_go, gen_recherche, gen_sequences_js, gen_cours, gen_index_niveaux,
               gen_enseignant, gen_outils, gen_qrcodes]


def main():
    verifier = '--verifier' in sys.argv
    with open('catalogue.json', encoding='utf-8') as f:
        cat = json.load(f)
    # Tout est calculé avant la première écriture : si un marqueur manque dans
    # la sixième cible, les cinq premières ne sont pas laissées à moitié faites.
    sorties = {}
    for g in GENERATEURS:
        sorties.update(g(cat))
    perimes = []
    ecrits = []
    def sans_date(t):
        # La date de génération de catalogue.js change chaque jour : on l'ignore.
        return re.sub(r'// Généré le \d{4}-\d{2}-\d{2}\.', '', t or '')
    for chemin, contenu in sorties.items():
        actuel = lire(chemin) if os.path.exists(chemin) else None
        if sans_date(actuel) == sans_date(contenu):
            continue
        if verifier:
            perimes.append(chemin)
        else:
            ecrire(chemin, contenu)
            ecrits.append(chemin)
    if verifier:
        if perimes:
            print('blocs générés périmés :', ', '.join(perimes))
            print('lancer : python3 outils/generer.py')
            sys.exit(1)
        print('blocs générés à jour.')
        return
    if ecrits:
        print('réécrit :', ', '.join(ecrits))
    else:
        print('rien à réécrire, tout était à jour.')


if __name__ == '__main__':
    main()
