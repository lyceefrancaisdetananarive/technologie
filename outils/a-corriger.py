#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Relève ce qui attend une correction, pour préparer les appréciations hors ligne.

    python3 outils/a-corriger.py --compter
        n'écrit rien, ne télécharge rien : affiche le décompte par groupe.
        À lancer en premier, pour vérifier qu'il coïncide avec le tableau de
        bord de l'espace enseignant.

    python3 outils/a-corriger.py --accuser [--groupe CODE] [--ecrire]
        pose l'accusé de réception sur les dépôts du diagnostique en attente.
        Sans --ecrire, rien n'est envoyé : la commande affiche ce qu'elle
        ferait. Les identifiants écrits sont journalisés dans un fichier, ce
        qui rend l'opération annulable.

    python3 outils/a-corriger.py --extraire DOSSIER [--groupe CODE]
        écrit DOSSIER/a-corriger.json : un objet par travail en attente,
        dépôts et fiches confondus, avec de quoi rédiger l'appréciation.

    python3 outils/a-corriger.py --extraire DOSSIER --fichiers
        télécharge en plus les fichiers déposés dans DOSSIER/fichiers/.
        Ce sont des photos de copies : le dossier doit être un support
        chiffré de l'établissement.

Les deux clés sont lues dans l'environnement, jamais dans un fichier.

Le plus sûr sur macOS est de ranger la clé une fois dans le trousseau, puis
de l'en tirer à chaque lancement : elle ne passe alors ni par un fichier, ni
par la ligne de commande, ni par l'historique du terminal.

    # une fois, la saisie est muette et demandée deux fois
    security add-generic-password -U -a technologie -s supabase-service-role -w

    # à chaque lancement
    SUPABASE_URL="https://bumyriwwysycbrngtzhk.supabase.co" \
    SUPABASE_SERVICE_ROLE_KEY="$(security find-generic-password \
      -a technologie -s supabase-service-role -w)" \
      python3 outils/a-corriger.py --compter

Ne pas employer « read -s » dans une invite qui n'est pas un vrai terminal :
la commande attend une frappe qui n'arrive jamais et reste suspendue.

AUCUN NOM D'ÉLÈVE N'EST LU NI ÉCRIT. La clé de correction est l'identifiant
de la ligne, qui suffit à écrire l'appréciation au bon endroit : le nom
n'apparaît que dans le classeur du professeur, au moment de la relecture.
Les identifiants de compte (profil_id) ne servent qu'à regrouper les
réponses d'une même fiche et sont remplacés par un rang local, « eleve-01 »,
qui ne vaut que dans le fichier produit et ne se recoupe avec rien.

Deux formes de travail à corriger, qui ne se corrigent pas au même endroit :

  DÉPÔT   une photo de copie ou un PDF déposé dans le classeur. Une
          appréciation, écrite dans rendus.appreciation.

  FICHE   les réponses saisies dans la fiche d'activité elle-même, champ par
          champ. Le professeur pose UNE correction globale, sur la ligne
          d'état « fiche ». Une fiche n'est à corriger que si l'élève a
          cliqué « J'ai terminé » : une fiche encore en cours n'attend rien.

Sans dépendance : Python 3 et sa bibliothèque standard. Ce script n'est pas
déployé (outils/*.py est exclu par .vercelignore).
"""
import datetime
import io
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BUCKET = 'rendus'

# ---------------------------------------------------------------------------
# ACCUSÉS DE RÉCEPTION DES DIAGNOSTIQUES
#
# Le diagnostique de rentrée ne se corrige pas : il se dépouille, et il ne se
# rend JAMAIS avec une note. Les trois règles de l'espace enseignant sont
# formelles, et la feuille B « ne se rend jamais » du tout. Ce que l'élève
# doit voir dans son classeur n'est donc pas une appréciation, c'est un
# accusé : son travail est arrivé, il est complet, il n'a rien à refaire.
#
# Deux textes, un par pièce, parce qu'un élève peut n'avoir déposé que l'une
# des deux : annoncer la feuille B à qui ne l'a pas rendue serait faux, et
# c'est justement le genre de faux qui fait perdre confiance dans l'outil.
#
# Aucun résultat, aucun chiffre, aucun jugement : c'est ce qui rend ce texte
# publiable dans 33 classeurs sans le relire un par un.
ACCUSES = {
    'eval': (
        "Bien reçu : ton évaluation diagnostique de rentrée est "
        "enregistrée et prise en compte dans ton parcours. Ce travail "
        "n’est pas noté : il me sert à voir ce que tu maîtrises déjà "
        "et à organiser ton accompagnement cette année. Tu n’as rien "
        "à refaire."),
    'autre': (
        "Bien reçu : ta feuille B est enregistrée et prise en compte dans "
        "ton parcours. Ce travail n’est pas noté : il me sert à former "
        "les binômes et à organiser le travail sur les postes. Tu n’as "
        "rien à refaire."),
}
FICHE = 'fiche'          # la ligne d'état d'une fiche d'activité
LIBRE = 'reponse'        # le bloc libre « Ma réponse » au pied de la fiche
TERMINEE = 'terminee'    # valeur de texte de la ligne d'état après « J'ai terminé »


def env(nom):
    v = os.environ.get(nom, '').strip()
    if not v:
        print("variable %s absente : exportez-la dans la commande, "
              "ne l'écrivez pas dans un fichier." % nom)
        sys.exit(2)
    return v


def lire(chemin):
    """GET paginé sur PostgREST. Le Range évite de manquer les lignes au-delà
    du plafond par défaut, qui est de mille."""
    lignes, page, pas = [], 0, 1000
    base, cle = env('SUPABASE_URL').rstrip('/'), env('SUPABASE_SERVICE_ROLE_KEY')
    while True:
        req = urllib.request.Request(base + '/rest/v1/' + chemin)
        req.add_header('apikey', cle)
        req.add_header('Authorization', 'Bearer ' + cle)
        req.add_header('Range', '%d-%d' % (page * pas, (page + 1) * pas - 1))
        with urllib.request.urlopen(req, timeout=120) as r:
            morceau = json.loads(r.read() or b'[]')
        lignes.extend(morceau)
        if len(morceau) < pas:
            return lignes
        page += 1


def telecharger(chemin_objet, destination):
    base, cle = env('SUPABASE_URL').rstrip('/'), env('SUPABASE_SERVICE_ROLE_KEY')
    url = base + '/storage/v1/object/' + BUCKET + '/' + urllib.parse.quote(chemin_objet)
    req = urllib.request.Request(url)
    req.add_header('apikey', cle)
    req.add_header('Authorization', 'Bearer ' + cle)
    with urllib.request.urlopen(req, timeout=300) as r:
        contenu = r.read()
    with open(destination, 'wb') as f:
        f.write(contenu)
    return len(contenu)


def relever():
    """Renvoie (groupes_par_id, dépôts en attente, fiches en attente)."""
    groupes = {g['id']: g for g in lire('groupes?select=id,code,libelle,niveau')}

    depots = lire('rendus?corrige_le=is.null'
                  '&select=id,profil_id,groupe_id,sequence,document,fichier,'
                  'commentaire,binome,depose_le&order=depose_le.asc')

    # Toutes les lignes non corrigées, y compris l'état de la fiche. Le tri
    # par page puis par question rend le fichier produit lisible dans l'ordre
    # où la fiche pose ses questions.
    brutes = lire('reponses?corrige_le=is.null'
                  '&select=id,profil_id,groupe_id,page,question,texte,intitule,'
                  'redige_le,modifie_le&order=page.asc,question.asc')

    par_fiche = {}
    for l in brutes:
        par_fiche.setdefault((l['profil_id'], l['page']), []).append(l)

    # Une fiche n'attend une correction que si l'élève l'a déclarée terminée.
    # Sans ce filtre on corrigerait des brouillons, et le décompte ne
    # coïnciderait pas avec celui de l'espace enseignant.
    fiches = []
    for (profil, page), lignes in par_fiche.items():
        etat = next((l for l in lignes if l['question'] == FICHE), None)
        if not etat or (etat.get('texte') or '').strip() != TERMINEE:
            continue
        fiches.append({'profil_id': profil, 'page': page, 'etat': etat,
                       'lignes': [l for l in lignes if l['question'] != FICHE]})
    return groupes, depots, fiches


def nom_groupe(groupes, gid):
    g = groupes.get(gid)
    return g['code'] if g else '(groupe inconnu : %s)' % gid


def compter(groupes, depots, fiches):
    tableau = {}
    for d in depots:
        tableau.setdefault(d['groupe_id'], [0, 0])[0] += 1
    for f in fiches:
        tableau.setdefault(f['etat']['groupe_id'], [0, 0])[1] += 1
    lignes = sorted(tableau.items(), key=lambda kv: nom_groupe(groupes, kv[0]))
    print('\nCe qui attend une correction, groupe par groupe :\n')
    print('  %-22s %8s %8s' % ('GROUPE', 'DÉPÔTS', 'FICHES'))
    for gid, (nd, nf) in lignes:
        print('  %-22s %8d %8d' % (nom_groupe(groupes, gid), nd, nf))
    print('  %-22s %8d %8d' % ('TOTAL', len(depots), len(fiches)))
    print('\nComparez avec l\'espace enseignant : si un nombre diffère, ne pas '
          'corriger avant d\'avoir compris pourquoi.\n')


def filtrer(groupes, depots, fiches, code):
    """Ne garde qu'un groupe. Corriger une classe ne doit ni lire ni
    télécharger le travail des autres : c'est la moindre des choses avec des
    copies d'élèves, et cela évite de rapatrier des dizaines de photos pour
    rien."""
    vises = [g for g in groupes.values()
             if g['code'].strip().lower() == code.strip().lower()]
    if not vises:
        connus = ', '.join(sorted(g['code'] for g in groupes.values()))
        print('Groupe %r inconnu. Groupes existants : %s' % (code, connus))
        return None, None
    gid = vises[0]['id']
    return ([d for d in depots if d['groupe_id'] == gid],
            [f for f in fiches if f['etat']['groupe_id'] == gid])


def extraire(groupes, depots, fiches, dossier, avec_fichiers):
    os.makedirs(dossier, exist_ok=True)

    # Un rang local par compte, pour regrouper sans jamais nommer personne.
    rangs, travaux = {}, []

    def rang(profil_id):
        if profil_id not in rangs:
            rangs[profil_id] = 'eleve-%02d' % (len(rangs) + 1)
        return rangs[profil_id]

    dossier_fichiers = os.path.join(dossier, 'fichiers')
    if avec_fichiers:
        os.makedirs(dossier_fichiers, exist_ok=True)

    for d in depots:
        local = None
        if avec_fichiers and d.get('fichier'):
            # Le nom local reprend l'identifiant du dépôt : il est unique, il
            # ne dit rien de personne, et il ramène au bon enregistrement.
            ext = os.path.splitext(d['fichier'])[1][:8] or '.bin'
            local = os.path.join('fichiers', d['id'] + ext)
            try:
                telecharger(d['fichier'], os.path.join(dossier, local))
            except urllib.error.HTTPError as e:
                print('  fichier illisible (%s) pour le dépôt %s' % (e.code, d['id']))
                local = None
        travaux.append({
            'forme': 'depot',
            'id': d['id'],                       # rendus.id : la clé d'écriture
            'eleve': rang(d['profil_id']),
            'groupe': nom_groupe(groupes, d['groupe_id']),
            'sequence': d['sequence'],
            'document': d['document'],
            'commentaire_eleve': d.get('commentaire'),
            'binome': d.get('binome'),
            'depose_le': d.get('depose_le'),
            'fichier_distant': d.get('fichier'),
            'fichier_local': local,
            'appreciation': '',                  # à rédiger
        })

    for f in fiches:
        etat = f['etat']
        travaux.append({
            'forme': 'fiche',
            'id': etat['id'],                    # la ligne d'état : la clé d'écriture
            'eleve': rang(f['profil_id']),
            'groupe': nom_groupe(groupes, etat['groupe_id']),
            'page': f['page'],
            'terminee_le': etat.get('modifie_le') or etat.get('redige_le'),
            'reponses': [
                {'champ': l['question'],
                 'intitule': l.get('intitule'),
                 'texte': l.get('texte'),
                 'libre': l['question'] == LIBRE}
                for l in sorted(f['lignes'], key=lambda l: l['question'])
            ],
            'correction': '',                    # à rédiger
        })

    chemin = os.path.join(dossier, 'a-corriger.json')
    with open(chemin, 'w', encoding='utf-8') as fp:
        json.dump({'travaux': travaux}, fp, ensure_ascii=False, indent=2)
    print('\n%d travaux écrits dans %s' % (len(travaux), chemin))
    if avec_fichiers:
        n = len([t for t in travaux if t.get('fichier_local')])
        print('%d fichiers téléchargés dans %s' % (n, dossier_fichiers))
    print('Aucun nom d\'élève dans ce fichier. Il contient en revanche des '
          'copies d\'élèves mineurs : support chiffré, et effacement une fois '
          'les corrections saisies.\n')


def ecrire_ligne(table, cible, corps):
    base, cle = env('SUPABASE_URL').rstrip('/'), env('SUPABASE_SERVICE_ROLE_KEY')
    req = urllib.request.Request(base + '/rest/v1/%s?%s' % (table, cible),
                                 method='PATCH')
    req.add_header('apikey', cle)
    req.add_header('Authorization', 'Bearer ' + cle)
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=minimal')
    urllib.request.urlopen(req, json.dumps(corps).encode(), timeout=60).read()


def accuser(groupes, depots, ecrire_vraiment):
    """Pose l'accusé sur les dépôts du diagnostique restés sans correction."""
    vises = [d for d in depots
             if d['sequence'].endswith('/diagnostique')
             and d['document'] in ACCUSES]
    autres = [d for d in depots if d not in vises]
    if autres:
        print('%d dépôt(s) NON concerné(s), laissés intacts : ce ne sont pas '
              'des diagnostiques.' % len(autres))
    par_doc = {}
    for d in vises:
        par_doc[d['document']] = par_doc.get(d['document'], 0) + 1
    print('\nAccusés à poser :')
    for doc, n in sorted(par_doc.items()):
        print('  %-6s %3d' % (doc, n))
        print('    « %s »' % ACCUSES[doc])
    if not ecrire_vraiment:
        print('\nEssai à blanc : RIEN n\u2019a été écrit. Ajouter --ecrire pour '
              'envoyer.')
        return 0
    horodatage = datetime.datetime.now(datetime.timezone.utc).isoformat()
    # Le journal porte 166 identifiants de dépôts d'élèves : il n'a rien à
    # faire dans un dépôt public. Il s'écrit hors du site, dans 00_AUDIT.
    dossier_journal = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.abspath(__file__)))), '00_AUDIT', 'journaux')
    os.makedirs(dossier_journal, exist_ok=True)
    journal = os.path.join(dossier_journal, 'accuses-%s.txt'
                           % datetime.date.today().isoformat())
    ecrits = 0
    with open(journal, 'a', encoding='utf-8') as f:
        for d in vises:
            ecrire_ligne('rendus', 'id=eq.%s' % d['id'],
                         {'appreciation': ACCUSES[d['document']],
                          'corrige_le': horodatage})
            f.write('%s\t%s\t%s\t%s\n'
                    % (horodatage, d['id'], nom_groupe(groupes, d['groupe_id']),
                       d['document']))
            ecrits += 1
            if ecrits % 25 == 0:
                print('  %d écrits...' % ecrits)
    print('\n%d accusés écrits. Journal : %s' % (ecrits, journal))
    print('Pour annuler : remettre appreciation et corrige_le à null sur ces '
          'identifiants.')
    return 0


def recrire(journal):
    """Repose le texte d'accusé sur des lignes DÉJÀ corrigées, en relisant
    le journal. Sert quand le libellé change après coup : sans cela il
    faudrait décorriger 166 lignes pour les recorriger.

    Le corrigé_le n'est PAS touché : la date de correction reste celle du
    geste initial, ce qui est la vérité."""
    lignes = [l.rstrip('\n').split('\t')
              for l in io.open(journal, encoding='utf-8') if l.strip()]
    n = 0
    for _date, rendu, _groupe, document in lignes:
        if document not in ACCUSES:
            continue
        ecrire_ligne('rendus', 'id=eq.%s' % rendu,
                     {'appreciation': ACCUSES[document]})
        n += 1
        if n % 25 == 0:
            print('  %d r\u00e9\u00e9crits...' % n)
    print('%d accus\u00e9s r\u00e9\u00e9crits depuis %s' % (n, journal))
    return 0


def main():
    args = sys.argv[1:]
    if '--recrire' in args:
        k = args.index('--recrire')
        if k + 1 >= len(args):
            print('--recrire attend le chemin du journal.')
            return 2
        return recrire(args[k + 1])
    if '--accuser' in args:
        groupes, depots, fiches = relever()
        if '--groupe' in args:
            j = args.index('--groupe')
            depots, _ = filtrer(groupes, depots, fiches, args[j + 1])
            if depots is None:
                return 2
            print('Filtre : groupe %s seulement.' % args[j + 1])
        return accuser(groupes, depots, '--ecrire' in args)
    if '--compter' in args:
        compter(*relever())
        return 0
    if '--extraire' in args:
        i = args.index('--extraire')
        if i + 1 >= len(args):
            print('--extraire attend un dossier de destination.')
            return 2
        groupes, depots, fiches = relever()
        if '--groupe' in args:
            j = args.index('--groupe')
            if j + 1 >= len(args):
                print('--groupe attend un code, par exemple "3M3 SVT".')
                return 2
            depots, fiches = filtrer(groupes, depots, fiches, args[j + 1])
            if depots is None:
                return 2
            print('\nFiltre : groupe %s seulement.' % args[j + 1])
        compter(groupes, depots, fiches)
        extraire(groupes, depots, fiches, args[i + 1], '--fichiers' in args)
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
