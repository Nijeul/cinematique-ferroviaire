# Phasage de référence

Séquence complète d'un OCP de renouvellement voie-ballast avec remplacement d'appareils de
voie, sur 56 heures de vendredi soir à lundi matin. Elle sert de **jeu de test** au moteur :
c'est un enchaînement réel, avec ses chevauchements, ses reprises et ses aléas, pas une
séquence idéalisée.

Aucune donnée permettant d'identifier un chantier, un client ou une opération réelle ne figure
dans ce document.

---

## Anonymisation

Ce phasage est dérivé d'un chantier réel dont les éléments identifiants ont été retirés :

| Retiré | Remplacé par |
|---|---|
| Nom du chantier, du client, de la ligne | — |
| Signataires, indices, dates | — |
| Points kilométriques réels | PK fictifs, à définir dans le fichier `.cinef` |
| Désignations d'appareils du site | BS A, BS B, BS C, BS D |
| Villes en tête et queue de ligne | Nord, Sud |
| Nom de la base arrière | Base arrière Sud |
| Orthophoto du site | — |

Ce qui reste — méthode, enchaînement, rendements implicites, moyens engagés — relève de la
technique courante du renouvellement de voie.

---

## Repères

- **T0 = vendredi 22h30**, prise d'interception. Tous les instants sont en minutes depuis T0.
- **Restitution à T0 + 3360 min** (lundi 06h30), soit 56 heures.
- Moyens : 4 pelles rail-route numérotées **3, 4, 5, 6** · trains de travaux **TTX 2** (déblais),
  **TTX 3** (sous-couche ballast), **TTX 4** (évacuation) · un portique **PEM LEM**.
- Appareils : **BS A** et **BS C** talon sur VC, **BS B** et **BS D** pointe sur voie tiroir.
- Zones : RVB 50 m et RR 14 m sur VC · RVB 15 m, 27 m, 41 m, 54 m, 55 m, 63 m sur V1.

---

## Séquence

| N° | Début | Fin | Opération | Moyens |
|---|---|---|---|---|
| 1 | 120 | 150 | Enraillement de 4 pelles RR sur la base arrière · sécurisation du pont par plaque de protection | 3,4,5,6 |
| 2 | 150 | 210 | Dépose rails et traverses RVB 50 m VC — rails aux extrémités, traverses stockées entre VC et V1 | 3,4 |
| 3 | 150 | 210 | Dépose RVB 15 m V1 — traverses stockées entre VS et clôture | 5,6 |
| 4 | 210 | 240 | Suite dépose rails et traverses RVB 50 m + RR 14 m VC | 3,4 |
| 5 | 210 | 240 | Dépose RVB 27 m | 5,6 |
| 6 | 210 | 270 | Dépose BS A | 3,4 |
| 7 | 225 | 285 | Acheminement des panneaux du BS A en base arrière | 5,6 |
| 8 | 240 | 300 | Dépose RVB 55 m — vieilles TBA stockées entre V1 et VC pour chargement TTX | 3 |
| 9 | 240 | 270 | Arrivée du TTX 2 sur V2 depuis la base arrière Sud | TTX 2 |
| 10 | 270 | 330 | Déballastage RVB 50 m — reprise par la 2ᵉ pelle dès la dépose du RVB 55 m terminée | 4 |
| 11 | 270 | 330 | Dépose BS D et acheminement des panneaux en base arrière | 5,6 |
| 12 | 330 | 420 | Dépose du BS B et acheminement des panneaux en base arrière | 3,4 |
| 13 | 330 | 420 | Déballastage RVB 55 m, ballast chargé dans le TTX 2 | 5,6 |
| 14 | 420 | 480 | Dépose RVB 63 m V1 — traverses stockées entre VS et clôture | 3,4 |
| 15 | 420 | 480 | Déballastage BS A | 5,6 |
| 16 | 480 | 540 | Dépose BS C et acheminement des panneaux en base arrière | 3,4 |
| 17 | 480 | 540 | Déballastage BS B | 5,6 |
| 18 | 540 | 810 | Acheminement de 2 pelles RR vers la zone Nord pour évacuer des panneaux | 5,6 |
| 19 | 540 | 810 | Déballastage des zones RVB 63 m, BS C, BS D, RVB 15 m | 3,4 |
| 20 | 750 | 810 | Évacuation du TTX 2 en direction du Sud | TTX 2 |
| 21 | 810 | 840 | Évacuation du TTX 2 par V2 vers la base arrière Sud | TTX 2 |
| 22 | 810 | 870 | Arrivée du TTX 3 depuis la base arrière Sud sur V2 | TTX 3 |
| 23 | 840 | 990 | Déchargement de sous-couche ballast | 3 |
| 24 | 840 | 990 | Lissage de la sous-couche par pelle enraillée sur voie tiroir, puis compactage | 4 |
| 25 | 870 | 1050 | Suite déchargement de sous-couche ballast | 3 |
| 26 | 870 | 1050 | Suite lissage de la sous-couche puis compactage | 4 |
| 27 | 900 | 1170 | Acheminement des traverses neuves des zones de stockage aux zones de pose | 5,6 |
| 28 | 990 | 1170 | Mise en place des traverses neuves sur RVB 15 m en talon du BS D | 5,6 |
| 29 | 990 | 1050 | Mise en attente du TTX 3 au Sud | TTX 3 |
| 30 | 990 | 1170 | Suite lissage de la sous-couche puis compactage | 4 |
| 31 | 990 | 1170 | Acheminement des traverses des zones de stockage aux zones de pose | 5 |
| 32 | 1050 | 1170 | Mise en place des traverses neuves sur RVB 15 m en talon du BS D | 6 |
| 33 | 1110 | 1170 | Acheminement du BS C — passage mode route puis dépose du panneau sur la voie | 4,5 |
| 34 | 1170 | 1260 | Acheminement du BS C — passage mode rail à route, panneau posé sur la voie | 4,5 |
| 35 | 1260 | 1380 | Pose du BS C en 3 parties à la pelle sur pneu | 4,5 |
| 36 | 1320 | 1500 | Acheminement du BS D, méthode identique au BS C | 4,5 |
| 37 | 1500 | 1620 | Pose BS D + RVB 15 m, panneau talon direct du BS D | 3,6 |
| 38 | 1320 | 1500 | Pose RVB 27 m entre BS C et BS D | 3,6 |
| 39 | 1500 | 1620 | Pose RVB 63 m en talon du BS C | 3,6 |
| 40 | 1590 | 1680 | Pose du chemin de roule sur la zone du BS B | 4 |
| 41 | 1620 | 1710 | Acheminement du BS B au PEM LEM des VS vers la V1 en passant par le BS C | PEM LEM |
| 42 | 1710 | 1800 | Sortie des LEM et dépose du chemin de roule | 3,4 |
| 43 | 1710 | 1980 | Pose du BS B avec les PEM | PEM LEM, 4,5 |
| 44 | 1710 | 1980 | Lissage de la sous-couche et compactage sur V2, voie du TTX | 3 |
| 45 | 1980 | 2130 | Suite pose BS B | 3,4 |
| 46 | 1980 | 2130 | Pose RVB 54 m en talon du BS B | 5,6 |
| 47 | 2070 | 2250 | Calage des rampes et reprise des gauches sur toute la zone | 3,4 |
| 48 | — | — | *Non renseignée dans le document source* | — |
| 49 | 2130 | 2250 | Pose RVB 50 m + RR 14 m sur VC — optionnel selon avancement | 5,6 |
| 50 | 2250 | 2340 | Acheminement du TTX 4 depuis la base arrière Sud | TTX 4 |
| 51 | 2340 | 2610 | Chargement des vieilles traverses TBA | 3,4,5,6 |

---

## Ce que cette séquence met à l'épreuve

Chaque point ci-dessous est une difficulté réelle du moteur, pas une curiosité :

- **Opérations simultanées sur la même zone** (10 et 13, 27 et 31) — le moteur doit composer,
  pas choisir.
- **Reprise en cours de tâche** (10 : une seconde pelle rejoint le déballastage en cours) — le
  front de progression change de vitesse.
- **Bascule de mode rail ↔ route** (33 à 36) — un engin qui quitte la voie, roule, puis
  s'enraille ailleurs.
- **Appareil déposé en trois panneaux** acheminés séparément (6 et 7, 11, 12, 16).
- **Deux zones ciblées par une même opération** (4 : RVB 50 m et RR 14 m).
- **Trois trains de travaux successifs** avec arrivée, mise en attente, évacuation, et des
  stocks qui se remplissent et se vident.
- **Flux croisés de matériaux** : vieilles traverses vers deux stockages différents selon la
  zone, traverses neuves du stockage vers la pose, ballast vers le TTX, sous-couche depuis le TTX.
- **Une opération optionnelle** (49) — le format doit pouvoir la porter sans la traiter à part.
- **Un trou de numérotation** (48) — le fichier réel en aura toujours ; ça ne doit rien casser.

---

## Ce qui manque et qu'il faut inventer

La géométrie n'est pas dans ce document. Pour construire le fichier `.cinef`, il faut définir
un tracé plausible : deux voies principales, une voie de circulation, deux voies tiroir, quatre
appareils, et des PK cohérents avec les longueurs de zones ci-dessus. Ces valeurs sont
fictives et n'ont pas à correspondre à quoi que ce soit.
