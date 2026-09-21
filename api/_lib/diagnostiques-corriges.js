// FICHIER GÉNÉRÉ par scratchpad/gen-corriges.py (D20, 21 septembre 2026). Ne pas
// éditer ici : corriger la table du script ou diagnostiques.json, puis régénérer.
// Généré le 2026-09-21.
//
// Le corrigé des trois évaluations diagnostiques en ligne, pour
// api/classeur/corrige-diagnostique.js. Il ne sort du serveur que pour un
// élève connecté qui a déposé son évaluation : il n’est jamais dans la page,
// qui reste publique.
//
// Par niveau, par item (clé = num de la page en ligne) : type (celui de la
// page), attendu au format exact des champs de la page (ce que lignesItem lit
// dans champs, js/diagnostique.js) et explication pour l’élève.
//   qcm           'B'                   le val de l’option juste
//   cases         ['A', 'C']            les val à cocher, ordre indifférent
//   lignes_choix  { a:'U', b:'P' }      par val de phrase, le val du choix
//   appariement   { '1':'D', '2':'A' }  par val de gauche, le val de droite
//   ordre         { a:3, b:1 }          par val d’étape, le numéro attendu
//   classement    { '1':0, '2':1 }      par val d’élément, l’index de la colonne
//   trous         { a:'3', b:'2' }      par val de phrase, l’index dans liste (chaîne)
//   cadres        { '1':'pile' }        par val de cadre, le val attendu dans liste
//   texte         { reponse:'…' }       par clé de champ, une phrase : jamais
//                                       évalué automatiquement, seulement affiché
// Ni total ni classement : seulement l’attendu et un mot pour l’élève.
export const CORRIGES = {
 "5eme": {
  "items": {
   "1": {
    "type": "classement",
    "attendu": {
     "1": 0,
     "2": 1,
     "3": 0,
     "4": 1,
     "5": 0,
     "6": 1
    },
    "explication": "Le taxi-be, la lampe à pétrole et le téléphone mobile sont fabriqués par l’homme pour rendre un service : ce sont des objets techniques. Le galet, la fleur sauvage et le nuage existent dans la nature sans que personne les ait fabriqués."
   },
   "2": {
    "type": "appariement",
    "attendu": {
     "1": "C",
     "2": "A",
     "3": "E",
     "4": "B",
     "5": "D"
    },
    "explication": "Chaque objet répond à un besoin précis : la moustiquaire empêche les moustiques de piquer, le panneau solaire produit de l’électricité, le foyer amélioré cuit en dépensant moins de charbon, le pousse-pousse transporte une personne et le parapluie protège de la pluie. Le besoin F (conserver au froid) ne servait pas."
   },
   "3": {
    "type": "qcm",
    "attendu": "c",
    "explication": "Dire à quoi sert un objet, c’est dire le service qu’il rend : le vélo sert à se déplacer plus vite qu’à pied. Les autres phrases parlent de son état, de sa matière ou de son propriétaire, pas de son usage."
   },
   "4": {
    "type": "texte",
    "attendu": {
     "objet": "Un objet fabriqué par l’homme, par exemple le téléphone mobile, la marmite ou le balai.",
     "usage": "Une phrase qui dit le service rendu, par exemple « Il sert à appeler ma famille » ou « Elle sert à faire cuire le riz »."
    },
    "explication": "Un objet technique est fabriqué par l’homme, et son usage, c’est le service qu’il rend (« il sert à… »), pas sa couleur ni sa taille. Ton professeur lira ta réponse."
   },
   "5": {
    "type": "appariement",
    "attendu": {
     "1": "B",
     "2": "D",
     "3": "E",
     "4": "A",
     "5": "C"
    },
    "explication": "La marmite est en métal, le seau en plastique, le manche de l’angady en bois, la vitre en verre et le panier en fibre végétale. Le caoutchouc (F) ne servait pas."
   },
   "6": {
    "type": "qcm",
    "attendu": "b",
    "explication": "Le métal résiste à la chaleur du feu, alors que le plastique fondrait. On choisit un matériau pour une de ses propriétés : ici, la résistance à la chaleur."
   },
   "7": {
    "type": "classement",
    "attendu": {
     "1": 0,
     "2": 1,
     "3": 0,
     "4": 1,
     "5": 0,
     "6": 0
    },
    "explication": "Le soleil, le charbon de bois, le pétrole et le vent fournissent de l’énergie : ce sont des sources d’énergie. Un tournevis et une roue sont des objets ou des pièces, ils n’en fournissent pas."
   },
   "8": {
    "type": "lignes_choix",
    "attendu": {
     "a": "V",
     "b": "F",
     "c": "V",
     "d": "F",
     "e": "V"
    },
    "explication": "Aucun objet ne fonctionne « tout seul » : la lampe à pétrole consomme du pétrole, la charrette utilise l’énergie du zébu, et le feu s’éteint quand il n’y a plus de charbon."
   },
   "9": {
    "type": "cadres",
    "attendu": {
     "1": "pile",
     "2": "interrupteur",
     "3": "ampoule"
    },
    "explication": "La pile fournit l’énergie électrique, l’interrupteur ouvre ou ferme le passage du courant et l’ampoule produit la lumière. Le fil électrique ne servait pas : il est déjà dessiné sur le trait de retour."
   },
   "10": {
    "type": "texte",
    "attendu": {
     "reponse": "Le courant électrique passe de la pile jusqu’à l’ampoule (le circuit est fermé), et l’ampoule s’allume."
    },
    "explication": "Quand on allume l’interrupteur, le circuit est fermé : le courant venant de la pile peut passer jusqu’à l’ampoule, qui éclaire. Une bonne réponse relie au moins deux de ces idées : le courant passe, il vient de la pile, l’ampoule s’allume."
   },
   "11": {
    "type": "qcm",
    "attendu": "b",
    "explication": "Le texte le dit : la bougie filtrante « retient les saletés et une partie des microbes ». Le mot « bougie » ne veut pas dire qu’elle éclaire : il faut lire le texte."
   },
   "12": {
    "type": "ordre",
    "attendu": {
     "a": 2,
     "b": 4,
     "c": 1,
     "d": 3
    },
    "explication": "L’eau suit ce trajet : on la verse dans le réservoir du haut, elle traverse la bougie filtrante, elle tombe propre dans le réservoir du bas, puis on ouvre le robinet pour la prendre."
   },
   "13": {
    "type": "trous",
    "attendu": {
     "a": "3",
     "b": "2",
     "c": "4",
     "d": "0",
     "e": "5"
    },
    "explication": "Celui qui se sert d’un objet est son utilisateur ; le marteau et le tournevis sont des outils ; la roue et le guidon sont des pièces du vélo ; une lampe qui ne s’allume plus est en panne ; le mécanicien va réparer le vélo cassé. Le mot « le moteur » ne servait pas."
   }
  }
 },
 "4eme": {
  "items": {
   "1": {
    "type": "qcm",
    "attendu": "B",
    "explication": "Le filtre enlève les saletés et les microbes : c’est le besoin « boire une eau propre ». Chauffer, transporter ou mesurer l’eau, ce n’est pas ce pour quoi on pose un filtre."
   },
   "2": {
    "type": "lignes_choix",
    "attendu": {
     "a": "U",
     "b": "P",
     "c": "U",
     "d": "P"
    },
    "explication": "Porter dix kilos et garder sa forme, c’est ce que le panier FAIT (U). Des motifs réguliers et un joli aspect, c’est ce qui PLAÎT et donne envie de l’acheter (P)."
   },
   "3": {
    "type": "appariement",
    "attendu": {
     "1": "D",
     "2": "A",
     "3": "B",
     "4": "C"
    },
    "explication": "La lampe à pétrole éclaire une pièce le soir, la charrette transporte de lourdes charges, le pilon et le mortier séparent le grain de riz de son enveloppe, et le téléphone mobile permet d’échanger des informations à distance. La fonction E (conserver l’eau) ne servait pas."
   },
   "4": {
    "type": "appariement",
    "attendu": {
     "1": "B",
     "2": "A",
     "3": "D",
     "4": "C"
    },
    "explication": "Le repère 1 est le pédalier : il reçoit l’effort du pied et le transforme en rotation. Le repère 2 est la chaîne, qui transmet ce mouvement à la roue arrière (repère 3), laquelle fait avancer le vélo ; le repère 4 est le frein, qui ralentit ou arrête la roue."
   },
   "5": {
    "type": "qcm",
    "attendu": "B",
    "explication": "La courroie avance de la même longueur sur les deux poulies. Comme le tour de la grande poulie est plus long, elle fait moins de tours que la petite pendant le même temps."
   },
   "6": {
    "type": "qcm",
    "attendu": "B",
    "explication": "La porte glisse en ligne droite : c’est une translation. La roue tourne autour de son axe : c’est une rotation."
   },
   "7": {
    "type": "ordre",
    "attendu": {
     "a": 4,
     "b": 5,
     "c": 1,
     "d": 2,
     "e": 3
    },
    "explication": "La vie d’un objet commence par les matières premières (1), puis la fabrication à l’atelier (2), le transport et la vente (3), l’utilisation par la famille (4) et enfin la fin de vie : jeté, réparé ou recyclé (5)."
   },
   "8": {
    "type": "texte",
    "attendu": {
     "a": "5 heures (ligne « 6 heures » du tableau).",
     "b": "Poser la lampe au soleil pendant 8 heures, pour charger complètement la batterie."
    },
    "explication": "Le tableau donne 5 heures d’éclairage pour 6 heures au soleil, et la notice demande, avant la première utilisation, de poser la lampe 8 heures au soleil. On cherche l’information dans le document, sans le recopier en entier."
   },
   "9": {
    "type": "lignes_choix",
    "attendu": {
     "a": "E",
     "b": "I",
     "c": "E",
     "d": "I"
    },
    "explication": "Le panneau solaire et la batterie font FONCTIONNER la lampe (E), alors que le bouton commande la lampe et que le voyant prévient la personne (I). Cette question anticipe sur ce que tu apprendras cette année."
   },
   "10": {
    "type": "qcm",
    "attendu": "C",
    "explication": "Le compteur part de 2 et la boucle ajoute 1 quatre fois : le programme affiche 3, 4, 5 puis 6. Le dernier nombre affiché est 6."
   },
   "11a": {
    "type": "qcm",
    "attendu": "b",
    "explication": "Quand le badge n’est pas reconnu, on suit la sortie NON du losange : la machine affiche « Accès refusé » et la barrière reste fermée."
   },
   "11b": {
    "type": "texte",
    "attendu": {
     "reponse": "Elle lit le badge (l’étape « Lire le badge », juste avant la question « Le badge est reconnu ? »)."
    },
    "explication": "Juste avant de décider, la machine lit le badge : c’est le rectangle « Lire le badge », placé avant le losange de la question."
   },
   "12": {
    "type": "qcm",
    "attendu": "A",
    "explication": "Sur le chemin OUI, on lit « Ouvrir la barrière », puis « Attendre 5 secondes », puis « Fermer la barrière » : la barrière reste ouverte 5 secondes."
   }
  }
 },
 "3eme": {
  "items": {
   "1": {
    "type": "qcm",
    "attendu": "B",
    "explication": "Le besoin, c’est ce pour quoi on installe le cadenas : empêcher une personne non autorisée d’ouvrir la porte. La matière, le prix et la forme décrivent l’objet, pas le besoin."
   },
   "2": {
    "type": "appariement",
    "attendu": {
     "1": "A",
     "2": "B",
     "3": "C",
     "4": "D"
    },
    "explication": "« Le cadenas doit empêcher l’ouverture » dit ce que l’objet doit faire : c’est la fonction de service, et « coûter moins de 30 000 ariary » est une limite à respecter : une contrainte. « Nombre de chiffres du code » est ce que l’on mesure : le critère ; « au moins 4 chiffres » est la valeur attendue : le niveau."
   },
   "3": {
    "type": "texte",
    "attendu": {
     "reponse": "Le cahier des charges est écrit avant la conception : il dit ce que l’objet devra faire (ses fonctions) et ce qu’il devra respecter (ses contraintes), pour vérifier à la fin que l’objet convient."
    },
    "explication": "On attendait l’idée d’un document écrit à l’avance, qui liste ce que l’objet doit faire et ce qu’il doit respecter. Ce n’est ni une notice, ni un mode d’emploi."
   },
   "4": {
    "type": "lignes_choix",
    "attendu": {
     "a": "V",
     "b": "V",
     "c": "F"
    },
    "explication": "Le cahier des charges est écrit avant la fabrication et il dit ce que l’objet doit faire. Il n’impose ni la matière ni la forme : le concepteur les choisit ensuite, en respectant les contraintes."
   },
   "5": {
    "type": "classement",
    "attendu": {
     "1": 0,
     "2": 1,
     "3": 0,
     "4": 1,
     "5": 0,
     "6": 1
    },
    "explication": "Le panneau solaire, la batterie et la lampe LED font circuler l’électricité : chaîne d’énergie. Le capteur de luminosité, la carte programmée et le petit écran font circuler une information : chaîne d’information."
   },
   "6": {
    "type": "qcm",
    "attendu": "B",
    "explication": "Le moteur agit : il fait coulisser le portail. Un élément qui agit sur l’objet est un actionneur, alors qu’un capteur détecte."
   },
   "7": {
    "type": "texte",
    "attendu": {
     "objet": "Un seul des trois objets : le téléphone mobile, la porte automatique ou la balance électronique.",
     "capteur": "Un vrai capteur de cet objet : le capteur de présence de la porte, le capteur de poids de la balance, le microphone ou l’écran tactile du téléphone.",
     "information": "Ce que ce capteur mesure : la présence d’une personne, la masse posée, le son ou la voix, l’endroit touché par le doigt."
    },
    "explication": "Un capteur mesure quelque chose et le transforme en information : la porte détecte la présence d’une personne, la balance mesure une masse, le microphone capte le son. Un haut-parleur, une batterie ou un moteur ne sont pas des capteurs."
   },
   "8": {
    "type": "cadres",
    "attendu": {
     "1": "3",
     "2": "2",
     "3": "1"
    },
    "explication": "Dans une chaîne d’information, on acquiert d’abord l’information (le capteur de niveau d’eau), on la traite (la carte électronique programmée), puis on la communique (la sonnerie qui prévient le gardien)."
   },
   "9": {
    "type": "qcm",
    "attendu": "B",
    "explication": "Le capteur donne 80, et 80 n’est pas inférieur à 30 : la condition est fausse, on passe dans le SINON et la lampe reste éteinte."
   },
   "10": {
    "type": "texte",
    "attendu": {
     "modifier": "SI luminosité < 30 ALORS",
     "corrigee": "SI luminosité ≤ 30 ALORS (ou « inférieure ou égale à 30 », ou « < 31 » puisque le capteur donne un nombre entier)."
    },
    "explication": "La ligne qui décide est la condition « SI luminosité < 30 ALORS ». Pour que 30 allume aussi la lampe, la condition doit inclure la valeur 30 : « ≤ 30 », ou « < 31 » puisque le capteur donne un nombre entier."
   },
   "11": {
    "type": "appariement",
    "attendu": {
     "1": "A",
     "2": "B",
     "3": "C",
     "4": "D"
    },
    "explication": "Dans un organigramme, le losange pose une question (oui ou non), le rectangle est une action, l’ovale marque le début ou la fin, et la flèche indique l’ordre de lecture."
   },
   "12": {
    "type": "lignes_choix",
    "attendu": {
     "a": "F",
     "b": "V",
     "c": "V"
    },
    "explication": "« Répéter indéfiniment » recommence sans fin, pas une seule fois. Dans un SI … ALORS … SINON, une seule des deux parties s’exécute à chaque passage, et une variable est bien une case mémoire dont la valeur peut changer."
   },
   "13": {
    "type": "texte",
    "attendu": {
     "reponse": "3 lampes.",
     "ligne": "« Sorties disponibles : 3 prises pour lampes de 3 W + 1 prise USB 5 V » (une recopie partielle suffit)."
    },
    "explication": "La ligne « Sorties disponibles » du document indique 3 prises pour lampes : on peut donc brancher 3 lampes. La prise USB n’est pas une prise pour lampe."
   },
   "14": {
    "type": "texte",
    "attendu": {
     "reponse": "OUI : le document annonce 8 heures d’autonomie avec les 3 lampes allumées, et la famille n’a besoin que de 4 heures par soir ; 8 h est supérieur à 4 h, donc le kit convient."
    },
    "explication": "Une bonne réponse répond OUI, puis compare la donnée du document (8 heures d’autonomie) au besoin (4 heures par soir) et conclut. Le chiffre seul, sans conclusion, ne suffit pas."
   },
   "15": {
    "type": "texte",
    "attendu": {
     "reponse": "La charge complète demande 7 heures de soleil ; avec seulement 4 heures de bon soleil par jour, la batterie n’a pas le temps de se charger entièrement (4 h < 7 h)."
    },
    "explication": "Le document indique 7 heures de soleil pour une charge complète : avec 4 heures de bon soleil par jour, il en manque, et la batterie ne se remplit pas entièrement. La donnée chiffrée (7 heures) doit apparaître dans ta réponse."
   },
   "16": {
    "type": "texte",
    "attendu": {
     "reponse": "Le planning répartit le travail dans le temps : il dit qui fait quoi et pour quelle date, afin que le projet soit terminé à temps."
    },
    "explication": "On attendait l’idée d’organiser les tâches dans le temps ou de respecter les délais : qui fait quoi, et quand. Ce n’est pas l’emploi du temps de la classe."
   }
  }
 }
};

/** Le corrigé d’un niveau ('5eme', '4eme', '3eme') : { items }, ou null. */
export function corrigeDe(niveau) {
  const n = String(niveau ?? '');
  return Object.prototype.hasOwnProperty.call(CORRIGES, n) ? CORRIGES[n] : null;
}
