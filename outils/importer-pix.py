#!/usr/bin/env python3
"""
Importe les exports de Pix Orga dans la table `pix`.

    SUPABASE_URL="https://bumyriwwysycbrngtzhk.supabase.co" \
    SUPABASE_SERVICE_ROLE_KEY="$(security find-generic-password \
        -a technologie -s supabase-service-role -w)" \
    python3 outils/importer-pix.py <dossier-des-csv> [--ecrire]

Sans --ecrire, il ne fait que dire ce qu'il ferait. C'est le mode par defaut :
on regarde la liste des rapprochements douteux AVANT d'ecrire quoi que ce soit.

POURQUOI CE PROGRAMME EXISTE, ET CE QU'IL NE PEUT PAS FAIRE

Pix n'expose aucun identifiant stable. Le participant tape lui-meme son nom
dans Pix, et il le tape mal : « NkomNkom Emmanuel » pour NKOM Emmanuel,
« LADHA Hilal » pour DARMSY Hilal. Sur une classe relevee le 1er octobre 2026,
6 noms sur 23 correspondaient exactement a ceux de la base.

Le rapprochement est donc fait ici, et il peut se tromper. Trois regles le
tiennent :

  1. MEME CLASSE, TOUJOURS. Un resultat de 5M1 ne peut appartenir qu'a un
     eleve de 5M1. Sans cette contrainte, « Rajaona Camille » de 5M1 se
     collait sur camille.loray de 3M4, qui partage son prenom.

  2. L'INCLUSION PLUTOT QUE L'EGALITE. L'eleve tape une forme courte de son
     nom : « Ranivo Mae » pour RANIVO Mae Lucie. L'ensemble des mots de Pix
     est donc INCLUS dans celui de la base, rarement egal. C'est cette regle
     qui fait passer le taux de 64 a 93 pour cent.

  3. LE DOUTE NE S'ECRIT PAS TOUT SEUL. Des que deux candidats se valent, ou
     qu'un seul mot est commun, la ligne part dans la liste a trancher et
     n'est PAS ecrite. Le professeur decide, et sa decision se grave dans la
     colonne `appariement`.

CE QUE L'IMPORT NE TOUCHE JAMAIS

Une ligne dont l'appariement vaut `confirme` ou `refuse` a ete tranchee par un
humain. L'import la laisse telle quelle, meme si son calcul dit autre chose.
Sans cette regle, chaque reimport effacerait les arbitrages, et le meme travail
serait a refaire indefiniment.

LE PIEGE DE L'ENVOI MULTIPLE

Les campagnes de collecte acceptent plusieurs envois : 87 des 203 participants
releves l'avaient fait. Le CSV porte alors plusieurs lignes par eleve. On garde
la PLUS RECENTE, par la date d'envoi, jamais la derniere lue dans le fichier.
Lire dans l'ordre du fichier donnait une mediane de 81 pix au lieu de 92.
"""
import csv
import datetime
import difflib
import io
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request

# ---------------------------------------------------------------- base


def env(nom):
    v = os.environ.get(nom)
    if not v:
        raise SystemExit('variable %s absente : voir l\'en-tete de ce fichier' % nom)
    return v


def appel(methode, table, requete='', corps=None):
    base, cle = env('SUPABASE_URL').rstrip('/'), env('SUPABASE_SERVICE_ROLE_KEY')
    url = '%s/rest/v1/%s%s' % (base, table, ('?' + requete) if requete else '')
    entetes = {'apikey': cle, 'Authorization': 'Bearer ' + cle,
               'Content-Type': 'application/json',
               'Prefer': 'return=representation,resolution=merge-duplicates'}
    donnees = json.dumps(corps).encode() if corps is not None else None
    r = urllib.request.Request(url, data=donnees, headers=entetes)
    r.get_method = lambda: methode
    with urllib.request.urlopen(r) as rep:
        texte = rep.read().decode()
    return json.loads(texte) if texte.strip() else []


# ------------------------------------------------------------- lecture


def mots(s):
    """Les mots d'un nom, sans accent ni casse. Les initiales sautent."""
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
    return [m for m in re.sub(r'[^a-z]+', ' ', s).split() if len(m) > 1]


def date(s):
    for f in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y'):
        try:
            return datetime.datetime.strptime((s or '').strip(), f)
        except ValueError:
            pass
    return None


def lire_csv(chemin):
    brut = open(chemin, 'rb').read()
    for enc in ('utf-8-sig', 'utf-16', 'latin-1'):
        try:
            return list(csv.DictReader(io.StringIO(brut.decode(enc)), delimiter=';'))
        except (UnicodeDecodeError, UnicodeError):
            continue
    return []


NOM_FICHIER = re.compile(r'resultats-(\d{4}-\d{4})__([0-9a-z]+)__([a-z_]+)-(\d+)-')


def relever(dossier):
    """Rend { (classe, mots) : releve }, en gardant le dernier envoi."""
    pix = {}
    for f in sorted(os.listdir(dossier)):
        m = NOM_FICHIER.match(f)
        if not m:
            continue
        classe, typ = m.group(2).upper(), m.group(3)
        for r in lire_csv(os.path.join(dossier, f)):
            nom = (r.get('Nom du Participant') or '').strip()
            pre = (r.get('Prénom du Participant') or '').strip()
            if not (nom or pre):
                continue
            cle = (classe, tuple(sorted(mots(nom) + mots(pre))))
            e = pix.setdefault(cle, {'nom': nom, 'prenom': pre, 'classe': classe,
                                     'score': None, 'certifiable': None, 'envoi': None,
                                     'parcours': {}, 'competences': {}})
            if 'Nombre de pix total' in r:
                d = date(r.get("Date et heure de l'envoi (Europe/Paris)"))
                # Le plus RECENT, jamais le dernier lu : voir l'en-tete.
                if e['envoi'] is None or (d and d > e['envoi']):
                    v = (r.get('Nombre de pix total') or '').strip()
                    e['score'] = int(v) if v.isdigit() else None
                    e['certifiable'] = (r.get('Certifiable (O/N)') or '').strip() in ('Oui', 'O')
                    e['envoi'] = d
                    e['competences'] = {
                        k.replace('Niveau pour la compétence ', '').strip(): r[k]
                        for k in r if k and k.startswith('Niveau pour la compétence') and r[k]
                    }
            else:
                col = [k for k in r if k and 'maitrise' in k.lower()]
                if col:
                    e['parcours'][typ] = (r[col[0]] or '').strip()
    return pix


# --------------------------------------------------------- appariement


def qualite(base, pix):
    """(rang, raison). 3 = certain, 2 = tres probable, 1 = douteux, 0 = non."""
    b, p = set(base), set(pix)
    # LES PARTICULES RECOLLEES. « da silva » dans la base, « dasilva » dans
    # Pix : un seul mot commun, alors que c'est le meme nom. On ajoute donc de
    # chaque cote les mots VOISINS recolles. Ils servent a reconnaitre, pas a
    # gonfler le decompte : un recollement ne vaut qu'un mot.
    bc = b | {base[i] + base[i + 1] for i in range(len(base) - 1)}
    pc = p | {pix[i] + pix[i + 1] for i in range(len(pix) - 1)}
    if not (bc & pc):
        return 0, 'aucun mot commun'
    if b == p:
        return 3, 'mots identiques'
    # L'INCLUSION NE VAUT QU'A PARTIR DE DEUX MOTS. Avec un seul, « Ariel
    # Lucas » (un prenom commun) battait « Ouedraogo Lucas », qui etait le
    # bon : un prenom partage n'est pas une identite.
    if p <= bc and len(p) >= 2:
        return 3, 'le nom tape dans Pix est contenu dans celui de la base'
    if b <= pc and len(b) >= 2:
        return 3, 'le nom de la base est contenu dans celui tape dans Pix'
    communs = b & p
    colles = len((bc & pc) - communs)
    tronque = any(x != y and (x.startswith(y) or y.startswith(x)) and min(len(x), len(y)) >= 3
                  for x in b for y in p)
    # Une faute de frappe d'une lettre n'est pas un autre nom : « ouedrogo »
    # et « ouedraogo », « rajaona » et « rajaobna ». On compte ces mots-la
    # comme communs, sans quoi deux candidats restaient a egalite et le
    # professeur devait trancher une evidence.
    voisins = sum(1 for x in b for y in p
                  if x != y and min(len(x), len(y)) >= 5
                  and difflib.SequenceMatcher(None, x, y).ratio() >= 0.85)
    if len(communs) + voisins + colles >= 2:
        return 2, '%d mots communs%s%s' % (
            len(communs),
            ', une faute de frappe pres' if voisins else '',
            ', une particule recollee' if colles else '')
    if tronque:
        return 2, 'un mot commun et une forme tronquee'
    return 1, 'un seul mot commun'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ecrire = '--ecrire' in sys.argv
    fichier_classes = next((a.split('=', 1)[1] for a in sys.argv[1:]
                            if a.startswith('--classes=')), None)
    if not args:
        raise SystemExit(__doc__)
    dossier = args[0]

    pix = relever(dossier)
    print('%d participants releves dans %s' % (len(pix), dossier))

    eleves = appel('GET', 'profils', urllib.parse.urlencode({
        'role': 'eq.eleve', 'actif': 'is.true',
        'select': 'id,email,nom,prenom,appartenances(groupes(code,niveau))'}))

    # LA CLASSE DE L'ELEVE. Elle n'est pas dans la base : un groupe comme
    # 3SVT2 melange deux classes. On l'accepte donc d'un fichier
    # { "identifiant": "3M4", ... }, celui qu'on tire de PRONOTE. A defaut,
    # on retombe sur le NIVEAU, qui est dans la base et qui ecarte deja
    # l'essentiel des confusions de prenom entre une 3e et une 5e.
    classe_de = {}
    if fichier_classes:
        classe_de = json.load(open(fichier_classes, encoding='utf-8'))
        print('classes lues dans %s : %d eleves' % (fichier_classes, len(classe_de)))
    else:
        print('AUCUN fichier de classes : repli sur le niveau, moins sur.')

    def niveau_classe(c):
        return {'3': '3eme', '4': '4eme', '5': '5eme', '6': '6eme'}.get((c or '')[:1])

    # La table peut ne pas exister encore (db/17-pix.sql pas joue) : on tourne
    # alors a blanc, ce qui est precisement l'usage de ce mode.
    try:
        deja = {l['profil_id']: l['appariement']
                for l in appel('GET', 'pix', 'select=profil_id,appariement')}
    except urllib.error.HTTPError as err:
        if err.code != 404:
            raise
        print('table `pix` absente : jouer db/17-pix.sql avant d\'ecrire.')
        deja = {}

    # Le perimetre est celui des campagnes importees, pas celui de
    # l'etablissement. Un eleve dont la classe n'a pas ete relevee n'est pas
    # « sans Pix » : il est hors perimetre, et le dire evite de faire croire
    # a un trou dans les donnees.
    classes_relevees = {c for c, _ in pix}
    surs, douteux, absents, intouches, hors = [], [], [], [], []
    for e in eleves:
        identifiant = (e.get('email') or '').split('@')[0]
        if deja.get(e['id']) in ('confirme', 'refuse'):
            intouches.append(identifiant)
            continue
        base = mots(e.get('nom')) + mots(e.get('prenom'))
        sa_classe = classe_de.get(identifiant)
        if classe_de and (not sa_classe or sa_classe not in classes_relevees):
            hors.append(identifiant)
            continue
        ses_niveaux = {g['groupes']['niveau'] for g in (e.get('appartenances') or [])
                       if g.get('groupes')}
        cands = []
        for (classe, cle), v in pix.items():
            # LA CONTRAINTE QUI EVITE LES FAUX : un resultat de 5M1 ne peut
            # appartenir qu'a un eleve de 5M1. Sans elle, « Rajaona Camille »
            # de 5M1 se collait sur camille.loray de 3M4.
            if sa_classe:
                if classe != sa_classe:
                    continue
            elif ses_niveaux and niveau_classe(classe) not in ses_niveaux:
                continue
            rang, raison = qualite(base, cle)
            if rang:
                cands.append((rang, raison, v))
        cands.sort(key=lambda x: -x[0])
        if not cands:
            absents.append(identifiant)
            continue
        tete = cands[0]
        exaequo = [c for c in cands if c[0] == tete[0]]
        ligne = {'profil_id': e['id'], 'nom_pix': (tete[2]['nom'] + ' ' + tete[2]['prenom']).strip(),
                 'classe': tete[2]['classe'], 'score': tete[2]['score'],
                 'certifiable': tete[2]['certifiable'],
                 'envoi': tete[2]['envoi'].isoformat() if tete[2]['envoi'] else None,
                 'parcours': tete[2]['parcours'], 'competences': tete[2]['competences'],
                 'appariement': 'automatique'}
        if tete[0] >= 2 and len(exaequo) == 1:
            surs.append((identifiant, ligne, tete[1]))
        else:
            douteux.append((identifiant, ligne, tete[1],
                            [(c[2]['nom'] + ' ' + c[2]['prenom']).strip() for c in exaequo[1:4]]))

    # UNE LIGNE PIX NE SERT QU'UN ELEVE. Deux freres, deux homonymes, et le
    # meme releve se collait sur les deux. Si deux eleves revendiquent la
    # meme ligne, aucun des deux ne passe : le professeur tranche.
    revendiquee = {}
    for ident, ligne, raison in surs:
        revendiquee.setdefault(ligne['nom_pix'] + '|' + ligne['classe'], []).append(ident)
    litiges = {k for k, v in revendiquee.items() if len(v) > 1}
    if litiges:
        garde = []
        for ident, ligne, raison in surs:
            if ligne['nom_pix'] + '|' + ligne['classe'] in litiges:
                douteux.append((ident, ligne, raison + ' (revendique par plusieurs eleves)', []))
            else:
                garde.append((ident, ligne, raison))
        surs = garde

    print('  surs      : %d' % len(surs))
    print('  a trancher: %d' % len(douteux))
    print('  sans Pix  : %d' % len(absents))
    print('  hors perim: %d (classe non relevee)' % len(hors))
    print('  intouches : %d (deja confirmes ou refuses par le professeur)' % len(intouches))

    if douteux:
        print('\nA TRANCHER (rien n\'est ecrit pour ceux-la) :')
        for ident, ligne, raison, autres in douteux:
            print('  %-28s %-5s -> %-28s %s%s'
                  % (ident, ligne['classe'], ligne['nom_pix'], raison,
                     ('  | autres : ' + ', '.join(autres)) if autres else ''))

    if not ecrire:
        print('\nRien n\'a ete ecrit. Relancer avec --ecrire pour enregistrer les %d surs.'
              % len(surs))
        return

    for i in range(0, len(surs), 50):
        appel('POST', 'pix', '', [l for _, l, _ in surs[i:i + 50]])
    print('\n%d lignes ecrites.' % len(surs))


if __name__ == '__main__':
    main()
