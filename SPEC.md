# Spécification technique

Voir `FORMAT.md` pour le format de données, qui est le contrat central du projet.

---

## 1. Objectif

Remplacer les synoptiques PowerPoint de phasage par une cinématique 3D générée automatiquement
à partir d'une description du chantier. L'utilisateur décrit le phasage une fois ; l'outil
produit la vidéo et les planches, toujours cohérentes entre elles.

Le rendu n'a pas à être photoréaliste. Il doit être **lisible** : la couleur porte
l'information, comme dans les synoptiques actuels.

---

## 2. Le moteur

Toute l'application repose sur une seule fonction :

```ts
etatAt(projet: Projet, t: number): EtatScene
```

Pure, déterministe, sans dépendance au rendu. Elle renvoie :

```ts
EtatScene {
  zones:      Record<ZoneId, { couches: EtatZone, front?: { sens, fraction } }>
  appareils:  Record<AdvId,  { pose: boolean, panneaux: Record<string, LieuRef> }>
  ressources: Record<ResId,  { position: PositionVoie | PositionLibre, mode, charge? }>
  stocks:     Record<LieuId, { contenus: { quoi, quantite }[] }>
  operations: OperationId[]        // actives à l'instant t
}
```

Trois propriétés à préserver absolument :

- **Pureté.** `etatAt(p, 300)` donne le même résultat qu'on y arrive en lisant la cinématique
  ou en sautant directement au curseur. C'est ce qui rend l'export vidéo image par image
  possible, et ce qui rend le moteur testable sans navigateur.
- **Composition.** Plusieurs opérations peuvent toucher la même zone au même instant. Elles se
  composent couche par couche.
- **Progression.** Une opération linéaire produit un front, pas un basculement instantané.

C'est le seul module dont la justesse ne peut pas être vérifiée à l'œil. Il doit être couvert
par des tests.

---

## 3. Stack

| Besoin | Choix |
|---|---|
| Build | Vite + TypeScript |
| UI | React |
| 3D | Three.js via react-three-fiber + drei |
| État applicatif | Zustand |
| Validation | Zod, sur le schéma du format `.cinef` |
| Tests | Vitest |
| Orthophoto depuis PDF | pdf.js (rendu d'une page en image) |
| Export vidéo | WebCodecs + mp4-muxer, fallback MediaRecorder |
| Export PDF | jsPDF |
| Export PPTX | pptxgenjs |
| Stockage | fichier `.cinef` local, autosave IndexedDB |
| Déploiement | GitHub Pages via GitHub Actions |

Pas de backend. Le projet est un fichier que l'utilisateur enregistre et transmet.

L'export PPTX est là pour rester dans la chaîne documentaire existante : les planches générées
doivent pouvoir être reprises et annotées comme les synoptiques actuels.

---

## 4. Rendu des états

Chaque couche du modèle a une représentation visuelle. Le tableau ci-dessous est le cahier des
charges du rendu ; il suit exactement la table du `FORMAT.md`.

| Couche | Valeur | Rendu |
|---|---|---|
| `rails` | `poses` | deux profils continus, gris acier |
| | `tronconnes` | idem, avec marques de coupe |
| | `deposes_en_extremite` | profils déplacés en bordure de zone |
| | `absents` | rien |
| | `neufs_poses` | profils clairs, teinte plus vive |
| `traverses` | `anciennes` | traverses régulières, teinte usée |
| | `deposees` | traverses désordonnées à côté de la voie |
| | `absentes` | rien |
| | `neuves_reparties` | traverses espacées, non alignées |
| | `neuves_posees` | traverses alignées, teinte claire |
| `ballast` | `ancien` | ruban gris moyen |
| | `deballaste` | creux, teinte terre |
| | `neuf_repandu` | ruban clair irrégulier |
| | `regale` | ruban clair au profil net |
| `sousCouche` | `deversee` / `lissee` / `compactee` | ruban ocre, de plus en plus régulier |
| `plateforme` | `decaissee` / `ecretee` | niveau du terrain abaissé |
| `geometrie` | `bourree` / `reglee` / `soudee` | pastille d'état, pas de géométrie propre |

Une zone affiche en permanence son nom et sa longueur, comme sur les synoptiques.

---

## 5. Découpage en lots

Un lot = une branche = une PR. Chaque lot doit produire quelque chose de visible ou de testé.

| Lot | Contenu | Critère de fin |
|---|---|---|
| 0 | Socle Vite + React + r3f, scène vide, **déploiement GitHub Pages automatique** | une adresse web affiche une scène 3D vide |
| 1 | Types et schéma Zod du format, chargement et validation de `ocp1-sud.cinef` | le fichier réel se charge, les erreurs sont explicites |
| 2 | `etatAt(t)` : opérations, effets, composition, fronts, stocks | tests verts sur les 51 opérations de l'OCP 1 Sud |
| 3 | Géométrie de voie, `pose()`, rendu voie instancié | 600 m de voies affichés à 60 fps |
| 4 | Rendu des six couches d'état selon le tableau §4 | déplacer le curseur change l'aspect des zones |
| 5 | Orthophoto au sol, import d'une page PDF, ancrage deux points | le site réel apparaît sous les voies |
| 6 | Engins : modèles proxy, pastilles numérotées, position déduite des opérations | les pelles 3 à 6 se placent seules |
| 7 | Flux et stocks : piles qui grandissent, TTX qui se remplit | les traverses déposées apparaissent au stockage |
| 8 | Appareils de voie : dépose et pose par panneaux, acheminement | le BS 14a part en base arrière en trois panneaux |
| 9 | Lecture : curseur, vitesses, horloge `Ve/Sa 01h30`, encart phasage | la cinématique se joue de bout en bout |
| 10 | Caméras et vues, dont vue générale reprenant le cadrage des synoptiques | on change de vue en lecture |
| 11 | Éditeur de site : tracé des voies, pose des zones et des appareils | un nouveau chantier se saisit sans écrire de JSON |
| 12 | Éditeur d'opérations : saisie du phasage, table des verbes | le phasage se modifie dans l'interface |
| 13 | Export vidéo MP4 | un MP4 propre, frame-accurate |
| 14 | Export planches PDF et PPTX avec cartouche et encart phasage | un jeu de planches équivalent au synoptique actuel |
| 15 | Bibliothèque de modes opératoires réutilisables, finitions | — |

**Chemin critique : 0 → 1 → 2 → 3 → 4 → 9.** À la fin du lot 9, la cinématique est jouable et
l'outil a démontré sa valeur. Les lots 11 et 12 le rendent utilisable sans écrire de JSON à la
main ; jusque-là, le fichier `.cinef` se modifie dans un éditeur de texte.

Les lots 5 à 8 sont indépendants les uns des autres et peuvent être réordonnés selon ce qui
manque le plus à la démonstration.

---

## 6. Performance

- Instancing pour les traverses dès le lot 3. 600 m de voies représentent plus de 3 000
  traverses ; une par mesh fait tomber l'application.
- Rails extrudés le long de la courbe, profil simplifié. Pas de profil Vignole détaillé.
- Ballast et sous-couche en rubans texturés, jamais en particules.
- Cible : 60 fps sur un portable bureautique à GPU intégré, site de 600 m et 10 engins.

---

## 7. Hors périmètre

- Calcul automatique des durées à partir des rendements. Le planning minuté existe déjà sous
  Excel et sait le faire. Le rapprochement des deux est un sujet à part, à reprendre plus tard.
- Détection de conflits de ressources et chemin critique. Utile, mais ce n'est pas l'objet de
  cet outil.
- Travail collaboratif, backend, comptes utilisateurs.
- Conformité réglementaire. L'outil illustre un phasage, il ne valide rien. Les documents de
  sécurité restent produits par les procédures en vigueur.
