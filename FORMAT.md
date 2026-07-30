# Format de cinématique de travaux ferroviaires

Format de fichier décrivant un phasage de chantier de façon à ce qu'une scène 3D puisse en
être **déduite automatiquement** à n'importe quel instant, sans animation manuelle.

Extension proposée : `.cinef` (JSON).

---

## Principe

Trois idées, et tout le reste en découle.

**1. Une zone de voie est un empilement de couches, chacune dans un état.**

Ce n'est pas un objet 3D qu'on anime. C'est une donnée. Le rendu 3D est une fonction de cette
donnée. Modifier le phasage change les états ; l'image suit.

**2. Une opération est un changement d'état, pas une animation.**

`Dépose RVB 50 m VC` ne veut pas dire « faire disparaître des rails à l'écran ». Ça veut dire :
`rails: posés → déposés_en_extrémité` et `traverses: anciennes → déposées`, sur la zone
`z-rvb-50-vc`, entre t=120 et t=210, dans le sens PK croissant, avec les pelles 3 et 4.

**3. La position des engins est déduite, pas saisie.**

Un engin est là où se trouve la zone sur laquelle il travaille. Les déplacements entre deux
chantiers sont des opérations `circuler` explicites, avec leur durée. Aucun keyframe.

---

## Structure du fichier

```
Projet {
  meta          en-tête du document (chantier, indice, émetteur, dates)
  temps         T0, durée, découpage des créneaux
  site          orthophoto, voies, appareils, zones, lieux
  ressources    engins, trains de travaux, équipes
  stocks        contenu initial des lieux de stockage
  operations    le phasage — le cœur du fichier
  vues          caméras
  affichage     palette d'états, légende
}
```

---

## 1. `meta` et `temps`

```json
{
  "meta": {
    "chantier": "RAVI Châtellerault 2025",
    "document": "Synoptique OCP 1 Sud",
    "emetteur": "ETF",
    "indice": "B",
    "date": "2025-08-25",
    "etabliPar": "F.MANESSE",
    "validePar": "N.VRIGNEAU",
    "approuvePar": "L.GUYADER"
  },
  "temps": {
    "t0": "2025-09-12T22:30:00",
    "libelleT0": "Prise d'interception",
    "dureeMinutes": 3360,
    "libelleFin": "Restitution",
    "pasCreneau": 30
  }
}
```

Tous les instants du fichier sont en **minutes depuis T0**. Jamais en heures absolues : un OCP
de 56 h franchit trois fois minuit. L'affichage reconvertit en `Ve/Sa 00h30` pour l'utilisateur.

---

## 2. `site`

### Orthophoto

```json
"orthophoto": {
  "image": "assets/chatellerault_ortho.jpg",
  "ancrages": [
    { "pixel": [412, 880],  "monde": [0, 0] },
    { "pixel": [3120, 905], "monde": [640, 0] }
  ]
}
```

Deux points d'ancrage suffisent à caler l'image au sol : échelle, rotation et origine s'en
déduisent. L'image devient la texture du plan de sol de la scène 3D.

### Voies

```json
"voies": [
  { "id": "v1", "nom": "V1", "polyligne": [[0,4.5],[210,4.5],[640,4.5]], "pkOrigine": 303.400 },
  { "id": "v2", "nom": "V2", "polyligne": [[0,0],[640,0]],               "pkOrigine": 303.400 },
  { "id": "vc", "nom": "VC", "polyligne": [[0,9],[640,9]],               "pkOrigine": 303.400 },
  { "id": "vt-n", "nom": "V tiroir Nord", "polyligne": [[0,13.5],[180,13.5]] }
]
```

La polyligne est tracée à la souris sur l'orthophoto. Coordonnées en mètres, système local.
`pkOrigine` permet d'afficher des PK réels sur les cotations.

### Appareils de voie

```json
"appareils": [
  {
    "id": "bs14a", "nom": "BS 14 a", "type": "branchement_simple", "tangente": 0.085,
    "voieDirecte": "vc", "voiedeviee": "v1", "pkPointe": 303.520, "orientation": "talon",
    "panneaux": ["pointe", "intermediaire", "talon"]
  },
  { "id": "bs15",  "nom": "BS 15",   "type": "branchement_simple", "tangente": 0.0654, "voieDirecte": "v1", "voiedeviee": "vt-n", "pkPointe": 303.610, "orientation": "pointe", "panneaux": ["complet"] },
  { "id": "bs16b", "nom": "BS 16 b", "type": "branchement_simple", "tangente": 0.085,  "voieDirecte": "v1", "voiedeviee": "vc",   "pkPointe": 303.735, "orientation": "talon",  "panneaux": ["pointe","intermediaire","talon"] },
  { "id": "bs17a", "nom": "BS 17 a", "type": "branchement_simple", "tangente": 0.085,  "voieDirecte": "v1", "voiedeviee": "vt-s", "pkPointe": 303.860, "orientation": "pointe", "panneaux": ["pointe","intermediaire","talon"] }
]
```

`panneaux` est ce qui permet de montrer un ADV déposé **en morceaux** et acheminé en plusieurs
voyages, comme dans votre phasage. Chaque panneau est un objet transportable indépendant.

### Zones

L'unité de travail. Une zone porte l'état de la voie.

```json
"zones": [
  { "id": "z-rvb50-vc", "nom": "RVB 50 m",  "voie": "vc", "pkDebut": 303.470, "pkFin": 303.520, "longueur": 50 },
  { "id": "z-rr14-vc",  "nom": "RR 14 m",   "voie": "vc", "pkDebut": 303.456, "pkFin": 303.470, "longueur": 14 },
  { "id": "z-rvb55-v1", "nom": "RVB 55 m",  "voie": "v1", "pkDebut": 303.555, "pkFin": 303.610, "longueur": 55 },
  { "id": "z-rvb63-v1", "nom": "RVB 63 m",  "voie": "v1", "pkDebut": 303.672, "pkFin": 303.735, "longueur": 63 },
  { "id": "z-rvb27",    "nom": "RVB 27 m",  "voie": "v1", "pkDebut": 303.760, "pkFin": 303.787, "longueur": 27 },
  { "id": "z-rvb15",    "nom": "RVB 15 m",  "voie": "v1", "pkDebut": 303.875, "pkFin": 303.890, "longueur": 15 }
]
```

### Lieux

Tout ce qui n'est pas sur voie.

```json
"lieux": [
  { "id": "ba-gp",       "nom": "Base arrière Grand Pont", "type": "base_arriere",  "contour": [[-80,-20],[-80,30],[20,30],[20,-20]] },
  { "id": "st-tba-n",    "nom": "Stockage anciennes TBA",  "type": "stockage",      "contour": [[180,6],[260,6],[260,8],[180,8]] },
  { "id": "st-tba-s",    "nom": "Stockage anciennes TBA",  "type": "stockage",      "contour": [[400,15],[480,15],[480,17],[400,17]] },
  { "id": "st-tvn",      "nom": "Stockage traverses neuves","type": "stockage",     "contour": [[500,15],[580,15],[580,17],[500,17]] },
  { "id": "st-adv",      "nom": "Stockage BS 16b et 17a",  "type": "stockage",      "contour": [[-60,10],[-10,10],[-10,25],[-60,25]] },
  { "id": "acces-pelle", "nom": "Accès pelle RR",          "type": "acces",         "contour": [[300,-25],[320,-25],[320,0],[300,0]] },
  { "id": "z-etanch",    "nom": "Zone étanchéité",         "type": "zone_speciale", "contour": [[240,2],[300,2],[300,11],[240,11]] },
  { "id": "pont",        "nom": "Pont — plaque de protection", "type": "ouvrage",   "contour": [[228,-2],[248,-2],[248,16],[228,16]] }
]
```

---

## 3. État d'une zone

Six couches, chacune avec une liste fermée de valeurs. C'est le vocabulaire complet du format.

| Couche | Valeurs possibles |
|---|---|
| `plateforme` | `existante` · `decaissee` · `ecretee` |
| `sousCouche` | `absente` · `deversee` · `lissee` · `compactee` |
| `ballast` | `ancien` · `deballaste` · `neuf_repandu` · `regale` |
| `traverses` | `anciennes` · `deposees` · `absentes` · `neuves_reparties` · `neuves_posees` |
| `rails` | `poses` · `tronconnes` · `desclisses` · `deposes_en_extremite` · `absents` · `neufs_poses` |
| `geometrie` | `nc` · `calee` · `bourree` · `reglee` · `soudee` |

Chaque zone déclare son état initial ; le reste est calculé par les opérations.

```json
"etatInitial": {
  "plateforme": "existante", "sousCouche": "absente", "ballast": "ancien",
  "traverses": "anciennes", "rails": "poses", "geometrie": "reglee"
}
```

Le moteur de rendu dessine chaque couche selon sa valeur. Ajouter un état visuel = ajouter une
valeur à cette table et son rendu. Rien d'autre à toucher.

---

## 4. `ressources`

```json
"ressources": [
  { "id": "p3", "numero": 3, "nom": "Pelle RR 3", "type": "pelle_rr", "modeInitial": "route", "lieuInitial": "ba-gp", "longueur": 9,  "couleur": "E8A33D" },
  { "id": "p4", "numero": 4, "nom": "Pelle RR 4", "type": "pelle_rr", "modeInitial": "route", "lieuInitial": "ba-gp", "longueur": 9,  "couleur": "E8A33D" },
  { "id": "p5", "numero": 5, "nom": "Pelle RR 5", "type": "pelle_rr", "modeInitial": "route", "lieuInitial": "ba-gp", "longueur": 9,  "couleur": "E8A33D" },
  { "id": "p6", "numero": 6, "nom": "Pelle RR 6", "type": "pelle_rr", "modeInitial": "route", "lieuInitial": "ba-gp", "longueur": 9,  "couleur": "E8A33D" },
  { "id": "ttx2", "nom": "TTX 2 — déblais", "type": "train_travaux", "lieuInitial": "ba-gp", "longueur": 180, "capacite": { "quoi": "ballast", "valeur": 12, "unite": "wagon" }, "couleur": "3E6FB0" },
  { "id": "ttx3", "nom": "TTX 3 — sous-couche ballast", "type": "train_travaux", "lieuInitial": "ba-gp", "longueur": 180, "capacite": { "quoi": "sous_couche", "valeur": 12, "unite": "wagon" }, "couleur": "C9A227" },
  { "id": "pemlem", "nom": "PEM LEM", "type": "portique", "lieuInitial": "ba-gp", "longueur": 30, "couleur": "7B4FA8" }
]
```

Les pelles rail-route portent un `mode` (`route` / `rail`) qui change par les opérations
`enrailler` et `derailler`. Votre phasage s'appuie beaucoup dessus : c'est un état de première
classe, pas un détail de rendu.

---

## 5. `operations` — le cœur du format

```json
{
  "id": "op-04",
  "numero": 4,
  "libelle": "Suite dépose des rails et traverses RVB 50 m + RR 14 m VC",
  "tDebut": 180,
  "tFin": 210,
  "ressources": ["p3", "p4"],
  "cibles": ["z-rvb50-vc", "z-rr14-vc"],
  "effets": [
    { "verbe": "deposer_rails",     "vers": "deposes_en_extremite" },
    { "verbe": "deposer_traverses", "vers": "deposees" }
  ],
  "sens": "pk_croissant",
  "flux": [
    { "quoi": "traverses_anciennes", "de": "z-rvb50-vc", "vers": "st-tba-n", "quantite": 83 }
  ],
  "commentaire": "Les rails seront positionnés aux extrémités des traverses. Les traverses seront stockées entre VC et V1."
}
```

### Verbes disponibles

Liste fermée. Chaque verbe sait quelle couche il modifie.

| Verbe | Couche touchée |
|---|---|
| `tronconner`, `desclisser` | `rails` |
| `deposer_rails`, `poser_rails` | `rails` |
| `deposer_traverses`, `repartir_traverses`, `poser_traverses` | `traverses` |
| `deballaster`, `ballaster`, `ecreter` | `ballast`, `plateforme` |
| `decharger_sous_couche`, `lisser`, `compacter` | `sousCouche` |
| `caler`, `bourrer`, `regler`, `souder` | `geometrie` |
| `deposer_adv`, `poser_adv` | l'appareil et ses panneaux |
| `enrailler`, `derailler` | mode d'un engin |
| `circuler`, `acheminer` | position d'un engin, et sa charge |
| `attendre`, `installer` | rien — mise en attente, plaque de protection, chemin de roule |

### Opération optionnelle

`"optionnelle": true` marque une opération conditionnelle (« selon avancement »). Le moteur la
traite comme les autres ; l'affichage pourra la distinguer. Champ ajouté pour porter
l'opération 49 du phasage de référence sans la traiter à part.

### `sens` et progression

Une opération linéaire (`deballaster`, `poser_traverses`, `bourrer`…) affiche un **front qui
progresse**. À `t`, la fraction `(t - tDebut) / (tFin - tDebut)` de la zone est dans le nouvel
état, le reste dans l'ancien, dans la direction donnée par `sens`. C'est ce qui rend le « sens
de déballastage » de vos synoptiques lisible sans flèche à dessiner.

### `flux`

Ce qui donne sa lisibilité à la cinématique : les matériaux vont quelque part.

```json
{ "quoi": "panneau_adv", "ref": "bs14a.pointe", "de": "bs14a", "vers": "ba-gp", "porteur": "p5" }
```

`quoi` ∈ `traverses_anciennes` · `traverses_neuves` · `rails` · `ballast` · `sous_couche` ·
`panneau_adv`. Un stockage affiche une pile qui grandit ou diminue. Un TTX se remplit et se
vide. C'est automatique dès que les flux sont renseignés.

---

## 6. Exemple réel — OCP 1 Sud, opérations 1 à 11

Encodage direct de vos planches, T0 = vendredi 22h30.

```json
"operations": [
  {
    "id": "op-01a", "numero": 1, "libelle": "Enraillement de 4 pelles RR sur la base arrière",
    "tDebut": 120, "tFin": 150, "ressources": ["p3","p4","p5","p6"], "cibles": ["ba-gp"],
    "effets": [{ "verbe": "enrailler", "vers": "rail" }]
  },
  {
    "id": "op-01b", "numero": 1, "libelle": "Sécurisation du pont — plaque de protection",
    "tDebut": 120, "tFin": 150, "cibles": ["pont"],
    "effets": [{ "verbe": "installer", "objet": "plaque_protection" }],
    "commentaire": "Prévient toute chute d'objet sur la chaussée située dessous."
  },
  {
    "id": "op-02", "numero": 2, "libelle": "Dépose rails et traverses RVB 50 m VC",
    "tDebut": 150, "tFin": 210, "ressources": ["p3","p4"], "cibles": ["z-rvb50-vc"],
    "effets": [
      { "verbe": "deposer_rails", "vers": "deposes_en_extremite" },
      { "verbe": "deposer_traverses", "vers": "deposees" }
    ],
    "sens": "pk_croissant",
    "flux": [{ "quoi": "traverses_anciennes", "de": "z-rvb50-vc", "vers": "st-tba-n" }],
    "commentaire": "Traverses stockées entre VC et V1 pour rechargement en fin d'OCP."
  },
  {
    "id": "op-03", "numero": 3, "libelle": "Dépose RVB 15 m V1",
    "tDebut": 150, "tFin": 210, "ressources": ["p5","p6"], "cibles": ["z-rvb15"],
    "effets": [
      { "verbe": "deposer_rails", "vers": "deposes_en_extremite" },
      { "verbe": "deposer_traverses", "vers": "deposees" }
    ],
    "sens": "pk_croissant",
    "flux": [{ "quoi": "traverses_anciennes", "de": "z-rvb15", "vers": "st-tba-s" }],
    "commentaire": "Traverses stockées entre la VS et la clôture."
  },
  {
    "id": "op-04", "numero": 4, "libelle": "Suite dépose RVB 50 m + RR 14 m VC",
    "tDebut": 210, "tFin": 240, "ressources": ["p3","p4"],
    "cibles": ["z-rvb50-vc","z-rr14-vc"],
    "effets": [
      { "verbe": "deposer_rails", "vers": "deposes_en_extremite" },
      { "verbe": "deposer_traverses", "vers": "deposees" }
    ],
    "sens": "pk_croissant"
  },
  {
    "id": "op-05", "numero": 5, "libelle": "Dépose RVB 27 m",
    "tDebut": 210, "tFin": 240, "ressources": ["p5","p6"], "cibles": ["z-rvb27"],
    "effets": [
      { "verbe": "deposer_rails", "vers": "deposes_en_extremite" },
      { "verbe": "deposer_traverses", "vers": "deposees" }
    ],
    "sens": "pk_croissant",
    "flux": [{ "quoi": "traverses_anciennes", "de": "z-rvb27", "vers": "st-tba-s" }]
  },
  {
    "id": "op-06", "numero": 6, "libelle": "Dépose BS 14a",
    "tDebut": 210, "tFin": 270, "ressources": ["p3","p4"], "cibles": ["bs14a"],
    "effets": [{ "verbe": "deposer_adv", "decoupage": ["pointe","intermediaire","talon"] }]
  },
  {
    "id": "op-07", "numero": 7, "libelle": "Acheminement des panneaux du BS 14a en base arrière",
    "tDebut": 225, "tFin": 285, "ressources": ["p5","p6"],
    "effets": [{ "verbe": "acheminer" }],
    "flux": [
      { "quoi": "panneau_adv", "ref": "bs14a.pointe",        "de": "bs14a", "vers": "ba-gp", "porteur": "p5" },
      { "quoi": "panneau_adv", "ref": "bs14a.intermediaire", "de": "bs14a", "vers": "ba-gp", "porteur": "p6" },
      { "quoi": "panneau_adv", "ref": "bs14a.talon",         "de": "bs14a", "vers": "ba-gp", "porteur": "p5" }
    ]
  },
  {
    "id": "op-08", "numero": 8, "libelle": "Dépose RVB 55 m",
    "tDebut": 240, "tFin": 300, "ressources": ["p3"], "cibles": ["z-rvb55-v1"],
    "effets": [
      { "verbe": "deposer_rails", "vers": "deposes_en_extremite" },
      { "verbe": "deposer_traverses", "vers": "deposees" }
    ],
    "sens": "pk_croissant",
    "flux": [{ "quoi": "traverses_anciennes", "de": "z-rvb55-v1", "vers": "st-tba-n" }],
    "commentaire": "Vieilles TBA/TB stockées entre V1 et VC pour chargement TTX."
  },
  {
    "id": "op-09", "numero": 9, "libelle": "Arrivée du TTX 2 sur V2 depuis la base arrière de Grand Pont",
    "tDebut": 240, "tFin": 270, "ressources": ["ttx2"],
    "effets": [{ "verbe": "circuler", "voie": "v2", "pkArrivee": 303.700, "sens": "pk_croissant" }]
  },
  {
    "id": "op-10", "numero": 10, "libelle": "Déballastage RVB 50 m",
    "tDebut": 270, "tFin": 330, "ressources": ["p4"], "cibles": ["z-rvb50-vc"],
    "effets": [{ "verbe": "deballaster", "vers": "deballaste" }],
    "sens": "pk_croissant",
    "flux": [{ "quoi": "ballast", "de": "z-rvb50-vc", "vers": "ttx2" }],
    "commentaire": "Puis dès la dépose du RVB 55 ml terminée, la 1ère pelle RR rejoint le déballastage."
  },
  {
    "id": "op-11", "numero": 11, "libelle": "Dépose BS 17a et acheminement des panneaux en base arrière",
    "tDebut": 270, "tFin": 330, "ressources": ["p5","p6"], "cibles": ["bs17a"],
    "effets": [{ "verbe": "deposer_adv", "decoupage": ["pointe","intermediaire","talon"] }],
    "flux": [
      { "quoi": "panneau_adv", "ref": "bs17a.pointe",        "de": "bs17a", "vers": "st-adv", "porteur": "p5" },
      { "quoi": "panneau_adv", "ref": "bs17a.intermediaire", "de": "bs17a", "vers": "st-adv", "porteur": "p6" },
      { "quoi": "panneau_adv", "ref": "bs17a.talon",         "de": "bs17a", "vers": "st-adv", "porteur": "p5" }
    ]
  }
]
```

Le format encaisse les 11 opérations sans champ ad hoc ni exception. Les 40 suivantes utilisent
les mêmes verbes, y compris les séquences les plus particulières de votre phasage :
l'acheminement du BS 16b en trois parties avec passage mode rail ↔ mode route (`derailler`,
`acheminer`, `enrailler`), la pose du chemin de roule (`installer`), et l'acheminement du BS 15
au PEM LEM en long (`acheminer` avec porteur `pemlem`).

---

## 7. `vues` et sortie

```json
"vues": [
  { "id": "generale", "type": "orthographique_inclinee", "cible": "site", "angle": 35 },
  { "id": "sud",      "type": "cadree", "zone": [280, -30, 640, 40], "angle": 40 },
  { "id": "suivi-p4", "type": "suivi", "ressource": "p4", "recul": 45 }
]
```

La vue par défaut reprend le cadrage de vos synoptiques : vue inclinée du dessus, site entier,
Paris à gauche et Poitiers à droite. On garde vos repères.

L'encart « PHASAGE » de vos planches est régénéré automatiquement : à l'instant `t`, l'outil
affiche les opérations actives avec leur numéro et leur libellé, exactement comme aujourd'hui.

Deux sorties depuis le même fichier :

- **vidéo** — lecture continue, avec horloge `Ve/Sa 01h30` et encart phasage incrusté ;
- **planches** — une image par créneau de 30 min (ou par changement d'opération), avec
  cartouche et encart, exportables en PDF ou en PPTX pour rester dans votre chaîne documentaire.

---

## 8. Ce que ce format ne fait pas

- Il ne calcule pas les durées. Elles sont saisies. Votre planning minuté sait déjà le faire
  avec ses rendements ; brancher les deux est un sujet distinct, à traiter plus tard.
- Il ne vérifie pas la faisabilité. Il n'empêche pas d'affecter la pelle 4 à deux opérations
  simultanées — il peut le signaler, pas l'interdire.
- Il ne remplace aucun document de sécurité. Il illustre un phasage.

---

## 9. Points à trancher

1. **Découpage des ADV.** J'ai supposé pointe / intermédiaire / talon. Est-ce toujours en trois
   panneaux, ou variable selon l'appareil et le moyen de levage ?
2. **Vocabulaire des états.** La table des six couches est à valider. Il manque peut-être des
   états intermédiaires que vous montrez et que je n'ai pas vus dans l'OCP 1 Sud.
3. **Traverses déposées.** Vous les stockez tantôt entre VC et V1, tantôt entre VS et clôture.
   Faut-il représenter ces piles à leur emplacement exact, ou une pile symbolique près de la zone
   suffit-elle ?
4. **Niveau de détail des engins.** Silhouette reconnaissable avec pastille numérotée, ou modèle
   3D fidèle par type de matériel ?
