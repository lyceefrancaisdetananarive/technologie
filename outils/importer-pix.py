#!/usr/bin/env python3
"""
Importe les exports de Pix Orga dans la table `pix`.

    SUPABASE_URL="https://bumyriwwysycbrngtzhk.supabase.co" \
    SUPABASE_SERVICE_ROLE_KEY="$(security find-generic-password \
        -a technologie -s supabase-service-role -w)" \
    python3 outils/importer-pix.py <dossier-des-csv> [--ecrire] [--trancher]

Sans --ecrire, il ne fait que dire ce qu'il ferait. C'est le mode par defaut :
on regarde la liste des rapprochements douteux AVANT d'ecrire quoi que ce soit.

Avec --trancher, il DEMANDE, pour chacun des douteux, lequel des noms tapes
dans Pix est le bon, ou aucun. C'est le seul endroit ou cette question peut
etre posee : il faut avoir les noms de la campagne sous les yeux, et ils ne
sont que dans ces fichiers. L'ecran du professeur, lui, ne sait que confirmer
ou ecarter ce qui est deja en base. --trancher implique --ecrire.

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


# La classe s'ecrit en majuscules dans Pix Orga : « __5M1__ ». Le motif ne
# l'acceptait qu'en minuscules, et un export ainsi nomme etait ignore SANS UN
# MOT. Le programme annoncait « 0 participants releves » et continuait : tous
# les eleves partaient en « hors perimetre », ce qui a l'air d'un import qui a
# tourne. `match` restant ancre, les fichiers AppleDouble « ._resultats-… » du
# volume continuent d'etre ecartes, et il y en a un par export reel.
NOM_FICHIER = re.compile(r'resultats-(\d{4}-\d{4})__([0-9A-Za-z]+)__([a-z_]+)-(\d+)-')

# LA DATE DE CETTE LECTURE, ECRITE EXPLICITEMENT.
#
# `releve_le` a un defaut `now()` en base, mais un defaut ne sert qu'a
# l'INSERTION. L'import est un upsert : sur une ligne qui existe deja, une
# colonne absente du corps garde son ancienne valeur. Le 3 octobre 2026, un
# import complet a donc laisse les 182 lignes datees du 1er, et le classeur
# annoncait « releve du 1er octobre » alors qu'on venait de regarder.
#
# C'est exactement le defaut que l'affichage de cette date devait rendre
# visible. Il l'a rendu visible le jour meme.
RELEVE_LE = datetime.datetime.now(datetime.timezone.utc).isoformat()


def relever(dossier, ignores=None):
    """Rend { (classe, mots) : releve }, en gardant le dernier envoi.

    `ignores` recoit les fichiers que le motif a ecartes : un export dont le
    nom ne colle pas doit se VOIR, sans quoi un import peut sembler avoir
    tourne alors qu'il n'a rien lu.
    """
    pix = {}
    for f in sorted(os.listdir(dossier)):
        m = NOM_FICHIER.match(f)
        if not m:
            if ignores is not None and f.lower().endswith('.csv') and not f.startswith('._'):
                ignores.append(f)
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


def distance(x, y, plafond=1):
    """Distance de Levenshtein, abandonnee des qu'elle depasse le plafond.

    POURQUOI PAS UN RATIO. difflib donnait 0,857 aussi bien pour
    « ouedrogo » / « ouedraogo » (une lettre inseree, le meme nom) que pour
    « martin » / « martinez » (deux lettres, deux familles). Le ratio ne sait
    pas separer une faute de frappe d'un autre nom ; le nombre d'editions,
    si. Une faute de frappe, c'est UNE lettre.
    """
    if abs(len(x) - len(y)) > plafond:
        return plafond + 1
    precedente = list(range(len(y) + 1))
    for i, cx in enumerate(x, 1):
        courante = [i]
        for j, cy in enumerate(y, 1):
            courante.append(min(precedente[j] + 1, courante[j - 1] + 1,
                                precedente[j - 1] + (cx != cy)))
        if min(courante) > plafond:
            return plafond + 1
        precedente = courante
    return precedente[-1]


def voisin(x, y):
    """Deux ecritures du meme mot, a une faute de frappe pres."""
    return x != y and min(len(x), len(y)) >= 5 and distance(x, y) <= 1


def tronque_vers(mot_base, mot_pix):
    """Le mot tape dans Pix est un DEBUT du mot de la base.

    LA REGLE EST ASYMETRIQUE, ET C'EST TOUT L'INTERET. « Vali » pour
    « Valinkiry » : l'eleve a tape moins que son nom, cela arrive tous les
    jours. L'inverse n'arrive pas : personne n'ajoute des lettres a son propre
    nom. « Martin » dans la base contre « Martinez » dans Pix, ce ne sont donc
    pas deux ecritures d'un nom, ce sont deux familles. La version symetrique
    de cette regle rapprochait les deux.
    """
    return mot_base != mot_pix and mot_base.startswith(mot_pix) and len(mot_pix) >= 3


def qualite(base, pix):
    """(rang, raison). 4 = le nom exact, 3 = certain, 2 = tres probable,
    1 = douteux, 0 = non.
    """
    b, p = set(base), set(pix)
    # LES PARTICULES RECOLLEES. « da silva » dans la base, « dasilva » dans
    # Pix : un seul mot commun, alors que c'est le meme nom. On ajoute donc de
    # chaque cote les mots VOISINS recolles. Ils servent a reconnaitre, pas a
    # gonfler le decompte : un recollement ne vaut qu'un mot.
    bc = b | {base[i] + base[i + 1] for i in range(len(base) - 1)}
    pc = p | {pix[i] + pix[i + 1] for i in range(len(pix) - 1)}
    if not (bc & pc):
        return 0, 'aucun mot commun'
    # L'EGALITE EXACTE PRIME SUR L'INCLUSION. Deux soeurs, « RABEMANANJARA
    # Tiana » tape par l'une et « RABEMANANJARA Tiana Paul » par l'autre : pour
    # l'eleve dont le nom est exactement celui tape, sa propre ligne rendait 3
    # et celle de sa soeur aussi, par inclusion. Ex aequo, donc arbitrage, pour
    # un cas qui ne laisse pourtant aucun doute. Le rang 4 le tranche.
    if b == p:
        return 4, 'mots identiques'
    # L'INCLUSION NE VAUT QU'A PARTIR DE DEUX MOTS. Avec un seul, « Ariel
    # Lucas » (un prenom commun) battait « Ouedraogo Lucas », qui etait le
    # bon : un prenom partage n'est pas une identite.
    if p <= bc and len(p) >= 2:
        return 3, 'le nom tape dans Pix est contenu dans celui de la base'
    if b <= pc and len(b) >= 2:
        return 3, 'le nom de la base est contenu dans celui tape dans Pix'
    communs = b & p
    colles = len((bc & pc) - communs)
    tronque = any(tronque_vers(x, y) for x in b for y in p)
    # Une faute de frappe d'une lettre n'est pas un autre nom : « ouedrogo »
    # et « ouedraogo », « rajaona » et « rajaobna ». On compte ces mots-la
    # comme communs, sans quoi deux candidats restaient a egalite et le
    # professeur devait trancher une evidence.
    voisins = sum(1 for x in b for y in p if voisin(x, y))

    # DEUX NOMS DIFFERENTS NE DEVIENNENT PAS LE MEME PARCE QU'ILS PARTAGENT UN
    # PRENOM. Si chaque cote garde un mot qui lui est propre, qui n'est ni un
    # voisin orthographique ni un recollement, alors ce sont deux personnes :
    # MARTIN Lucas et MARTINEZ Lucas, RAKOTO Hery et RAKOTOARISOA Hery. Le
    # rang 1 renvoie au professeur au lieu d'ecrire.
    couvert_b = {x for x in b if x in pc or any(voisin(x, y) or tronque_vers(x, y) for y in p)}
    couvert_p = {y for y in p if y in bc or any(voisin(y, x) or tronque_vers(x, y) for x in b)}
    if (b - couvert_b) and (p - couvert_p):
        return 1, 'un mot propre a chacun : %s contre %s' % (
            '/'.join(sorted(b - couvert_b)), '/'.join(sorted(p - couvert_p)))

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
    trancher = '--trancher' in sys.argv
    # --trancher implique --ecrire : on ne pose pas quatre questions pour
    # ensuite ne rien enregistrer.
    ecrire = '--ecrire' in sys.argv or trancher
    fichier_classes = next((a.split('=', 1)[1] for a in sys.argv[1:]
                            if a.startswith('--classes=')), None)
    if not args:
        raise SystemExit(__doc__)
    dossier = args[0]

    ignores = []
    pix = relever(dossier, ignores)
    print('%d participants releves dans %s' % (len(pix), dossier))
    if ignores:
        print('%d fichier(s) CSV ignore(s), leur nom ne suit pas le motif attendu :'
              % len(ignores))
        for f in ignores[:8]:
            print('   %s' % f)
        print('   (attendu : resultats-AAAA-AAAA__CLASSE__type-123-...csv)')
    if not pix:
        raise SystemExit('Aucun participant lu : rien a faire. Verifiez le dossier '
                         'et le nom des fichiers avant de relancer.')

    # TOUS LES ELEVES, ACTIFS OU NON. Le filtre `actif=is.true` etait ici, et
    # c'etait l'angle mort : un eleve mis a la corbeille ne revendiquait plus
    # son propre releve, qui partait alors sur le compte d'un camarade. On lit
    # donc tout le monde, on ne REGARDE les revendications que la-dessus, et on
    # n'ECRIT que pour les actifs.
    tous = appel('GET', 'profils', urllib.parse.urlencode({
        'role': 'eq.eleve',
        'select': 'id,email,nom,prenom,actif,appartenances(groupes(code,niveau))'}))
    eleves = [e for e in tous if e.get('actif') is not False]
    print('%d eleves, dont %d a la corbeille (comptes dans les revendications, '
          'jamais dans les ecritures)' % (len(tous), len(tous) - len(eleves)))

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
    table_absente = False
    try:
        deja = {l['profil_id']: l['appariement']
                for l in appel('GET', 'pix', 'select=profil_id,appariement')}
    except urllib.error.HTTPError as err:
        if err.code != 404:
            raise
        print('table `pix` absente : jouer db/17-pix.sql avant d\'ecrire.')
        deja = {}
        table_absente = True

    # Le perimetre est celui des campagnes importees, pas celui de
    # l'etablissement. Un eleve dont la classe n'a pas ete relevee n'est pas
    # « sans Pix » : il est hors perimetre, et le dire evite de faire croire
    # a un trou dans les donnees.
    classes_relevees = {c for c, _ in pix}

    def cle_ligne(v):
        return (v['nom'] + ' ' + v['prenom']).strip() + '|' + v['classe']

    def contexte(e):
        """(identifiant, mots du nom, classe PRONOTE, niveaux du site)."""
        ident = (e.get('email') or '').split('@')[0]
        return (ident, mots(e.get('nom')) + mots(e.get('prenom')),
                classe_de.get(ident),
                {g['groupes']['niveau'] for g in (e.get('appartenances') or [])
                 if g.get('groupes')})

    def candidats(base, sa_classe, ses_niveaux, pour='attribution'):
        """Les lignes Pix que cet eleve peut revendiquer, les meilleures d'abord.

        LA CONTRAINTE QUI EVITE LES FAUX : un resultat de 5M1 ne peut
        appartenir qu'a un eleve de 5M1. Sans elle, « Rajaona Camille » de 5M1
        se collait sur camille.loray de 3M4. A defaut de classe, le NIVEAU
        ecarte deja l'essentiel des confusions de prenom.
        """
        # NI CLASSE NI NIVEAU : LES DEUX USAGES NE DEMANDENT PAS LA MEME CHOSE,
        # et les confondre rouvre le defaut que la passe 1 existe pour fermer.
        #
        #   ATTRIBUTION : on n'ECRIT rien. Un eleve nouvellement inscrit, pas
        #   encore rattache a un groupe, et un import sans --classes, etait
        #   confronte aux lignes de TOUTES les campagnes, de la 6e a la 3e, et
        #   recevait sans arbitrage le releve du premier homonyme venu.
        #
        #   REVENDICATION : il revendique PARTOUT, au contraire. C'est tout
        #   l'objet de la passe 1 : un eleve qu'on ne sait pas placer est
        #   justement celui dont la revendication protege un camarade au nom
        #   proche. Le lui retirer rendrait « sur » un rapprochement qui ne
        #   l'est pas. Une revendication de trop ne coute qu'un arbitrage ;
        #   une revendication manquante coute le releve d'un eleve sur le
        #   compte d'un autre.
        if not sa_classe and not ses_niveaux and pour == 'attribution':
            return []
        out = []
        for (classe, cle), v in pix.items():
            if sa_classe:
                if classe != sa_classe:
                    continue
            elif ses_niveaux and niveau_classe(classe) not in ses_niveaux:
                continue
            rang, raison = qualite(base, cle)
            if rang:
                out.append((rang, raison, v))
        out.sort(key=lambda x: -x[0])
        return out

    # ---------------------------------------------------------------- passe 1
    # QUI REVENDIQUE QUOI, SUR TOUT L'ETABLISSEMENT.
    #
    # Le garde-fou « une ligne Pix ne sert qu'un eleve » ne valait autrefois
    # que pour les eleves du lot courant. Trois portes le contournaient : un
    # eleve deja tranche par le professeur, un eleve absent du fichier de
    # classes, un compte a la corbeille. Dans les trois cas l'ayant droit
    # sortait de la boucle AVANT d'avoir revendique quoi que ce soit, et son
    # releve s'ecrivait en silence sur le compte d'un camarade au nom proche.
    # Cette passe-ci ne saute personne : elle ne decide rien, elle compte.
    revendiquee = {}
    for e in tous:
        ident, base, sa_classe, ses_niveaux = contexte(e)
        for rang, _, v in candidats(base, sa_classe, ses_niveaux, 'revendication'):
            if rang >= 2:
                revendiquee.setdefault(cle_ligne(v), set()).add(ident)

    # ---------------------------------------------------------------- passe 2
    surs, douteux, absents, intouches, hors, sans_classe = [], [], [], [], [], []
    for e in eleves:
        ident, base, sa_classe, ses_niveaux = contexte(e)
        if deja.get(e['id']) in ('confirme', 'refuse'):
            intouches.append(ident)
            continue
        if classe_de and (not sa_classe or sa_classe not in classes_relevees):
            hors.append(ident)
            continue

        if not sa_classe and not ses_niveaux:
            sans_classe.append(ident)
            continue
        cands = candidats(base, sa_classe, ses_niveaux)
        if not cands:
            absents.append(ident)
            continue

        def amoi(v):
            """Cette ligne n'est revendiquee par personne d'autre."""
            return revendiquee.get(cle_ligne(v), set()) <= {ident}

        tete = cands[0]
        exaequo = [c for c in cands if c[0] == tete[0]]
        # UN ELEVE PEUT AVOIR ENVOYE DEUX FOIS, SOUS DEUX ORTHOGRAPHES.
        # « MAHAZOASY Roxanne » et « MAHAZOASY ZOGG Roxanne » sont alors deux
        # lignes, et prendre la mieux classee perdait la plus recente. Si
        # PERSONNE d'autre ne les revendique, elles sont a lui : on garde la
        # plus recente, et nom_pix porte les deux ecritures, seule chose que
        # l'eleve puisse reconnaitre sur son classeur.
        siennes = [c for c in cands if c[0] >= 2 and amoi(c[2])]
        fusion = None
        if len(siennes) > 1:
            fusion = sorted(siennes, key=lambda c: (c[2]['envoi'] is not None,
                                                    c[2]['envoi'] or datetime.datetime.min))[-1]

        choix = fusion or tete
        v = choix[2]
        # nom_pix PORTE UNE SEULE ECRITURE, celle qui est retenue : c'est sur
        # (nom_pix, classe) que db/18 pose son index d'unicite, et y glisser
        # « (aussi : ...) » rendrait deux lignes differentes aux yeux de la
        # base alors qu'elles designent le meme participant.
        autres = sorted({(c[2]['nom'] + ' ' + c[2]['prenom']).strip() for c in siennes
                         if c is not choix}) if fusion else []
        ligne = {'profil_id': e['id'],
                 'nom_pix': (v['nom'] + ' ' + v['prenom']).strip(),
                 'nom_pix_aussi': ', '.join(autres) or None,
                 'classe': v['classe'], 'score': v['score'],
                 'certifiable': v['certifiable'],
                 'envoi': v['envoi'].isoformat() if v['envoi'] else None,
                 'parcours': v['parcours'], 'competences': v['competences'],
                 'appariement': 'automatique', 'releve_le': RELEVE_LE}

        autres_revendiquent = not amoi(v)
        raison = choix[1] + (' ; deux envois fusionnes' if fusion else '')
        if autres_revendiquent:
            raison += ' (revendique aussi par : %s)' % ', '.join(
                sorted(revendiquee[cle_ligne(v)] - {ident}))
        if choix[0] >= 2 and (fusion or len(exaequo) == 1) and not autres_revendiquent:
            surs.append((ident, ligne, raison))
        else:
            # On garde les candidats ENTIERS, et pas seulement leurs noms :
            # --trancher doit pouvoir ecrire celui que le professeur designe.
            douteux.append((ident, ligne, raison,
                            [(c[2]['nom'] + ' ' + c[2]['prenom']).strip() for c in exaequo[1:4]],
                            [c[2] for c in cands[:6]], e['id']))

    print('  surs      : %d' % len(surs))
    print('  a trancher: %d' % len(douteux))
    print('  sans Pix  : %d' % len(absents))
    print('  hors perim: %d (classe non relevee)' % len(hors))
    print('  intouches : %d (deja confirmes ou refuses par le professeur)' % len(intouches))
    if sans_classe:
        print('  sans classe NI groupe : %d, ecartes de l\'appariement' % len(sans_classe))
        for i in range(0, len(sans_classe), 4):
            print('    ' + '  '.join('%-26s' % a for a in sans_classe[i:i + 4]).rstrip())
        print('    Leur nom seul ne dit pas de quelle classe ils sont : les rapprocher')
        print('    reviendrait a leur donner le releve du premier homonyme venu.')
        print('    Rattachez-les a un groupe, ou ajoutez-les au fichier --classes.')

    # LES ABSENTS SONT UNE LISTE, PAS UN NOMBRE. « 16 sans Pix » ne permet
    # d'aller chercher personne ; seize identifiants, si. Ce sont des eleves
    # d'une classe relevee qui n'ont aucun resultat : soit ils n'ont jamais
    # envoye leur profil, soit le nom qu'ils ont tape est trop loin du leur.
    if absents:
        print('\nSANS AUCUN RESULTAT, dans une classe pourtant relevee (%d) :'
              % len(absents))
        for i in range(0, len(absents), 4):
            print('  ' + '  '.join('%-26s' % a for a in absents[i:i + 4]).rstrip())

    if douteux:
        print('\nA TRANCHER (rien n\'est ecrit pour ceux-la) :')
        for d in douteux:
            ident, ligne, raison, autres = d[0], d[1], d[2], d[3]
            print('  %-28s %-5s -> %-28s %s%s'
                  % (ident, ligne['classe'], ligne['nom_pix'], raison,
                     ('  | autres : ' + ', '.join(autres)) if autres else ''))

    if not ecrire:
        print('\nRien n\'a ete ecrit. Relancer avec --ecrire pour enregistrer les %d surs,'
              ' --trancher pour decider des %d douteux.' % (len(surs), len(douteux)))
        return

    # Mieux vaut le dire ici qu'au premier POST : sans la table, l'ecriture
    # part en trace d'exception apres avoir pose les questions d'arbitrage.
    if table_absente:
        raise SystemExit("La table `pix` n'existe pas : jouer db/17-pix.sql dans "
                         "l'editeur SQL de Supabase, puis relancer. Rien n'a ete ecrit.")

    # LES RELEVES DEJA DETENUS, pour que l'arbitrage ne redonne pas a un eleve
    # ce qu'un autre porte deja en base. Les lignes des eleves justement a
    # trancher sont exclues : sans quoi un eleve serait bloque par sa propre
    # ligne d'un import precedent.
    a_trancher = {d[5] for d in douteux}
    ident_de = {e['id']: (e.get('email') or '').split('@')[0] for e in tous}
    prises_base = {}
    if not table_absente:
        for l in appel('GET', 'pix', 'select=profil_id,nom_pix,classe'):
            if l['profil_id'] in a_trancher:
                continue
            nom = l['nom_pix'].split(' (aussi :')[0]
            prises_base[nom + '|' + l['classe']] = ident_de.get(l['profil_id'], '?')

    tranches = arbitrer(douteux, prises_base) if trancher else []

    # LES ARBITRAGES EN PREMIER. Ils viennent d'etre tapes un par un, a la
    # main ; les 182 lignes automatiques, elles, se recalculent en une
    # commande. Si quelque chose casse entre les deux, c'est le travail
    # irremplacable qui doit deja etre en base.
    if tranches:
        for i in range(0, len(tranches), 50):
            appel('POST', 'pix', '', tranches[i:i + 50])
        print('\n%d arbitrage(s) enregistre(s), que les imports suivants ne '
              'toucheront plus.' % len(tranches))

    # UNE LIGNE AUTOMATIQUE QUI N'EST PLUS SURE DOIT PARTIR. Un import
    # precedent a pu ecrire un rapprochement que celui-ci juge desormais
    # douteux, parce que les regles ont change ou qu'un autre eleve le
    # revendique. La laisser en base, c'est garder a l'ecran un score que
    # l'outil ne soutient plus. On ne retire QUE les lignes `automatique` :
    # un arbitrage humain n'est jamais efface.
    tranche_ids = {l['profil_id'] for l in tranches}
    aretirer = [d[5] for d in douteux if d[5] not in tranche_ids and deja.get(d[5]) == 'automatique']
    if aretirer:
        for i in range(0, len(aretirer), 50):
            appel('DELETE', 'pix', 'profil_id=in.(%s)&appariement=eq.automatique'
                  % ','.join(aretirer[i:i + 50]))
        print('%d ligne(s) devenue(s) douteuse(s) retiree(s) de la base.' % len(aretirer))

    for i in range(0, len(surs), 50):
        appel('POST', 'pix', '', [l for _, l, _ in surs[i:i + 50]])
    print('%d lignes ecrites.' % len(surs))


def arbitrer(douteux, prises_base=None):
    """Demande, pour chaque douteux, lequel des noms tapes dans Pix est le bon.

    POURQUOI AU TERMINAL ET NON DANS LE SITE. La question n'a de sens qu'avec
    les noms de la campagne sous les yeux, et ils ne sont que dans les CSV
    exportes. L'ecran du professeur sait confirmer ou ecarter une ligne deja en
    base ; il ne sait pas en inventer une, et c'est tant mieux.

    Ce qui est ecrit ici porte `confirme` ou `refuse` : un arbitrage humain,
    que plus aucun import ne remettra en cause.
    """
    if not douteux:
        return []
    if not sys.stdin.isatty():
        print('\n--trancher demande un terminal : rien de douteux n\'a ete decide.')
        return []

    print('\n--- ARBITRAGE ---')
    print('Pour chacun : le numero du bon nom, `0` si aucun ne convient,')
    print('`p` pour passer, `q` pour arreter la. Une reponse non comprise')
    print('est redemandee : rien ne se decide par une faute de frappe.\n')
    retenus = []
    # UNE LIGNE PIX NE S'ATTRIBUE PAS DEUX FOIS. Deux soeurs aux prenoms
    # proches arrivent avec la MEME liste de candidats, dans le MEME ordre :
    # repondre « 1 » deux fois de suite gravait le releve de l'une sur le
    # compte de l'autre, en `confirme`, c'est-a-dire pour toujours.
    prises = dict(prises_base or {})
    for d in douteux:
        ident, ligne, raison, _, cands, profil_id = d[0], d[1], d[2], d[3], d[4], d[5]
        if not cands:
            # Litige entre deux eleves : les candidats ne sont pas rejoues ici,
            # il faut reprendre le releve a la main dans Pix Orga.
            print('%s : %s. A regarder dans Pix Orga.' % (ident, raison))
            continue
        print('%s  (classe %s, %s)' % (ident, ligne['classe'], raison))
        for i, c in enumerate(cands, 1):
            cle = (c['nom'] + ' ' + c['prenom']).strip() + '|' + c['classe']
            print('   %d. %-32s %4s pix  envoi %s%s'
                  % (i, (c['nom'] + ' ' + c['prenom']).strip(),
                     c['score'] if c['score'] is not None else '?',
                     c['envoi'].strftime('%d/%m') if c['envoi'] else '?',
                     '   <-- DEJA ATTRIBUE a ' + prises[cle] if cle in prises else ''))
        # LA QUESTION SE REPOSE JUSQU'A UNE REPONSE COMPRISE.
        #
        # « 2. », « deux », un numero hors liste ou une frappe accidentelle sur
        # Entree faisaient passer l'eleve, et la question ne revenait jamais :
        # sur soixante questions tapees a la suite, une faute de frappe est
        # certaine, et le professeur croyait avoir repondu pour tout le monde.
        # Passer reste possible, mais il faut le DIRE : `p`.
        arret = sortie = None
        while True:
            try:
                rep = input('   > ').strip().lower()
            except (KeyboardInterrupt, EOFError):
                # Ce qui est deja decide est garde : on ne refait pas taper dix
                # reponses parce que la onzieme a ete interrompue.
                print('\n   interrompu. Les %d arbitrage(s) deja decides sont '
                      'conserves.' % len(retenus))
                arret = True
                break
            if rep == 'q':
                print('   arret de l\'arbitrage.')
                arret = True
                break
            if rep == 'p':
                print('   passe.')
                sortie = True
                break
            if rep == '0':
                # ECARTER, ce n'est pas NE RIEN FAIRE. Une ligne `refuse`
                # empeche l'import suivant de reproposer le meme faux
                # rapprochement.
                l = dict(ligne)
                l['appariement'] = 'refuse'
                l.setdefault('nom_pix_aussi', None)
                retenus.append(l)
                print('   ecarte : aucun de ces noms n\'est le sien.')
                sortie = True
                break
            if rep.isdigit() and 1 <= int(rep) <= len(cands):
                break
            print('   Reponse attendue : un numero de 1 a %d, `0` pour ecarter, '
                  '`p` pour passer, `q` pour arreter.' % len(cands))
        if arret:
            break
        if sortie:
            continue
        c = cands[int(rep) - 1]
        cle = (c['nom'] + ' ' + c['prenom']).strip() + '|' + c['classe']
        if cle in prises:
            print('   REFUSE : ce releve est deja attribue a %s. Un releve Pix '
                  'ne sert qu\'un eleve.' % prises[cle])
            continue
        prises[cle] = ident
        retenus.append({
            'profil_id': profil_id,
            'nom_pix': (c['nom'] + ' ' + c['prenom']).strip(),
            'nom_pix_aussi': None,
            'classe': c['classe'], 'score': c['score'], 'certifiable': c['certifiable'],
            'envoi': c['envoi'].isoformat() if c['envoi'] else None,
            'parcours': c['parcours'], 'competences': c['competences'],
            'appariement': 'confirme', 'releve_le': RELEVE_LE,
        })
        print('   confirme : %s' % (c['nom'] + ' ' + c['prenom']).strip())
    return retenus


if __name__ == '__main__':
    main()
