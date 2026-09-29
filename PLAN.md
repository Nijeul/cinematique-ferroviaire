# Plan d'action — version 2, en 2D

## Constat de la version 1

La première version (3D) n'a pas convaincu : rendu illisible et outil trop compliqué. Deux
causes de méthode, à ne pas reproduire : les synoptiques réels n'ont jamais été fournis
(dossier `sources/` resté vide), et quinze lots ont été livrés d'un coup sans contrôle visuel
du commanditaire. L'ancien code reste dans l'historique Git ; il n'est plus la référence.

## Direction retenue

**Du 2D, image par image, comme une présentation PowerPoint.** Une « planche » = le site vu à
plat, dans le style des synoptiques existants ; on passe d'une planche à la suivante et les
états changent. Simple d'abord ; toute complexité devra se justifier par un besoin exprimé.

## Méthode

Une étape = une chose visible = **validation du commanditaire avant l'étape suivante**.
Jamais deux étapes d'avance. Chaque étape est une PR courte qui dit quoi regarder.

## Étapes

| # | Contenu | Validation attendue | État |
|---|---|---|---|
| 1 | Fond de plan 2D statique : voies en bandes, zones nommées, appareils, stockages, pont, Nord/Sud | « Ça ressemble au plan de mes synoptiques » | en cours |
| 2 | Image par image : planches ◀ ▶, zones qui changent de couleur selon un phasage simple | on feuillette comme un PowerPoint | à faire |
| 3 | États complets des zones, légende, encart phasage, horloge | une planche se lit comme une planche actuelle | à faire |
| 4 | Engins en pastilles numérotées, positionnés par les opérations | les pelles sont au bon endroit à chaque planche | à faire |
| 5 | Flux de matériaux (flèches) et stocks | on voit où vont les traverses et le ballast | à faire |
| 6 | Saisie du phasage dans un tableau simple | le commanditaire modifie une opération seul | à faire |
| 7 | Exports PowerPoint et PDF des planches | un jeu de planches équivalent à l'actuel | à faire |

Les besoins au-delà (vidéo, orthophoto, import DXF, 3D en option) seront rediscutés une fois
l'étape 7 validée — pas avant.

## Toujours en attente du commanditaire

Un ou deux **synoptiques PowerPoint réels** (anonymisés au besoin) déposés dans `sources/`.
L'étape 1 est construite sans modèle : elle devra être corrigée dès que les vraies planches
seront disponibles.
