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

**Le fond, c'est le plan du commanditaire.** Il importe son propre plan (image ou PDF, au
choix de la page) et trace les voies par-dessus, à la main, comme sur un calque. Le style
des voies (double filet, nom en gras) est celui de l'aperçu validé à l'étape 1 ; couleurs,
noms et épaisseurs se personnalisent voie par voie. Les engins, zones et appareils se
placeront de la même façon, au calque, aux étapes suivantes.

## Méthode

Une étape = une chose visible = **validation du commanditaire avant l'étape suivante**.
Jamais deux étapes d'avance. Chaque étape est une PR courte qui dit quoi regarder.

## Étapes

| # | Contenu | Validation attendue | État |
|---|---|---|---|
| 1 | Style de planche : aperçu SVG (voies en double filet, noms, zones, BS, stockages, cartouche) | « C'est le style de mes synoptiques » | **validé** |
| 2 | Fond de plan importé (image ou PDF, choix de la page) ; tracé des voies à la main au calque ; nom, couleur et épaisseur par voie ; enregistrer / ouvrir | le commanditaire trace les voies de son site sur son propre plan | **en cours** |
| 3 | Zones, appareils (BS), stockages et textes tracés au calque, style personnalisable | le plan de base d'une planche est complet | à faire |
| 4 | Bibliothèque d'engins à placer (locomotive, wagon, bourreuse, pelle RR, TTX, PEM LEM… liste à confirmer avec le commanditaire), couleurs et numéros | les engins se posent et se reconnaissent | à faire |
| 5 | Image par image : planches successives ◀ ▶ (fonctionnement exact à préciser avec le commanditaire) | on feuillette comme un PowerPoint | à faire |
| 6 | Horloge, encart phasage, légende | une planche se lit comme une planche actuelle | à faire |
| 7 | Exports PowerPoint et PDF des planches | un jeu de planches équivalent à l'actuel | à faire |

Les besoins au-delà (vidéo, orthophoto calée, import DXF, 3D en option) seront rediscutés une
fois l'étape 7 validée — pas avant.

## Synoptiques réels

Plus bloquant : le commanditaire importe directement ses propres plans (PDF ou images) dans
l'application. Un ou deux synoptiques PowerPoint réels déposés dans `sources/` resteront
utiles pour caler le style des étapes 3 à 6 (engins, légende, encart phasage).
