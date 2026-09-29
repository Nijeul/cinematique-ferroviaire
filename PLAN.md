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
noms et épaisseurs se personnalisent voie par voie. Zones, appareils, cadres et textes se
placent de la même façon, au calque ; les engins suivront.

## Méthode

Une étape = une chose visible = **validation du commanditaire avant l'étape suivante**.
Jamais deux étapes d'avance. Chaque étape est une PR courte qui dit quoi regarder.

## Étapes

| # | Contenu | Validation attendue | État |
|---|---|---|---|
| 1 | Style de planche : aperçu SVG (voies en double filet, noms, zones, BS, stockages, cartouche) | « C'est le style de mes synoptiques » | **validé** |
| 2 | Fond de plan importé (image ou PDF, choix de la page) ; tracé des voies à la main au calque ; nom, couleur et épaisseur par voie ; enregistrer / ouvrir | le commanditaire trace les voies de son site sur son propre plan | **validé** |
| 3 | Éléments du plan au calque : zones de travaux, appareils (BS et communications), cadres, textes, extrémités du plan (détail ci-dessous) | le plan de base d'une planche est complet | **validé** |
| 4 | Organisation : accueil et chantiers, plusieurs plans par chantier, synoptiques et images (détail ci-dessous) | on crée un synoptique à partir d'un plan et on feuillette ses images | **en cours** |
| 5 | Bibliothèque d'engins à placer (locomotive, wagon, bourreuse, pelle RR, TTX, PEM LEM… liste à confirmer avec le commanditaire), couleurs et numéros | les engins se posent et se reconnaissent | à faire |
| 6 | Contenu de chaque image : couleurs de zones qui changent d'une image à l'autre, engins déplacés, encart phasage, horloge, légende | une image se lit comme une planche actuelle | à faire |
| 7 | Exports PowerPoint et PDF des images d'un synoptique | un jeu de planches équivalent à l'actuel | à faire |

Les besoins au-delà (vidéo, orthophoto calée, import DXF, 3D en option) seront rediscutés une
fois l'étape 7 validée — pas avant.

### Étape 3 — éléments du plan au calque

Tout se dessine au calque sur le plan, se choisit, se déplace, se supprime (Suppr),
s'annule / se rétablit, s'enregistre et revient au rechargement, comme les voies.

- **Zones de travaux** (outil Zone, Z) : un clic sur une voie au début, un clic sur la même
  voie à la fin. La zone est rattachée à la voie (position le long du tracé) : si l'on
  déplace les points de la voie, la zone suit. Bande colorée qui épouse la voie, coudes
  compris ; nom au-dessus, ou au-dessous si le nom voisin le gênerait. Nom et couleur
  modifiables ; poignées aux deux bouts, glissables le long de la voie.
- **Appareil (BS)** (B) : premier clic à la pointe, sur la voie directe ; second clic côté
  talon, sur la voie déviée. Biais de voie, petit triangle plein à la pointe, nom en gras.
  Le panneau affiche « pointe côté … » et propose « Inverser le sens ».
- **Communication** (C) : un clic sur chaque voie ; crée deux BS talon contre talon, liés
  (« BS 1a » / « BS 1b »), chacun avec son nom et son sens. Supprimer l'un supprime les deux.
- **Extrémités du plan** : deux noms (« Nord » à gauche, « Sud » à droite par défaut,
  renommables en « Paris » / « Poitiers »…), affichés en haut du plan et utilisés pour le
  sens des appareils.
- **Cadres** (R) : rectangle tracé en glissant (stockage, base arrière, pont, zone
  d'étanchéité…) ; nom centré, couleur, pointillés ou trait plein, remplissage léger ou non ;
  poignées d'angle.
- **Textes libres** (X) : un clic sur le plan, puis la frappe ; taille, couleur, gras.
- **Calques** : Fond, Cadres, Voies, Zones, Appareils, Textes (dans cet ordre d'affichage),
  chacun visible / masqué et verrouillé. Supprimer une voie supprime ce qui est posé dessus,
  avec un message ; un seul Annuler rétablit tout.
- Les fichiers et sauvegardes de l'étape 2 s'ouvrent toujours.

### Étape 4 — organisation

- **Accueil** : la liste des chantiers gardés dans le navigateur (nom, nombre de plans et de
  synoptiques, date de modification). Nouveau chantier, ouvrir, renommer, supprimer (la
  confirmation dit ce qui sera perdu). « Exporter » crée un fichier avec tout le chantier,
  fonds compris ; « Importer un chantier » le relit ; « Importer un plan » accepte un fichier
  de plan des étapes 2 et 3, dans un chantier existant ou nouveau.
- **Chantier** : « Accueil › chantier ». Les plans (nouveau plan vierge, copie d'un plan pour
  une autre phase, ouvrir, renommer, supprimer, importer) et les synoptiques (nom, plan
  d'origine, début → fin, nombre d'images ; ouvrir, renommer, supprimer).
- **Plan** : l'éditeur des étapes 2 et 3, inchangé, et le bouton **« Nouveau synoptique… »** :
  nom, heure de début et de fin (date et heure), **cadrage** glissé sur le plan (« Tout le
  plan » par défaut). Le synoptique est une copie figée du plan, avec une première image qui
  couvre tout le synoptique.
- **Synoptique** : l'image courante, limitée au cadrage ; « Image n / N » et ses horaires
  (« Ve 22h30 → Ve/Sa 01h30 ») ; ◀ ▶, flèches du clavier et vignettes. « Nouvelle image »
  copie l'image courante juste après (elle commence à sa fin et dure autant, sans dépasser la
  fin du synoptique). Horaires de l'image, suppression (jamais la dernière), nom, horaires et
  cadrage du synoptique ; Annuler / Rétablir sur tout.
- Le contenu des images ne se modifie pas encore : c'est l'étape 6.
- Adresse par écran (le bouton Précédent et le rechargement de la page fonctionnent).
- Au premier lancement, la sauvegarde automatique des étapes 2 et 3 devient le
  « Chantier récupéré ».

Questions ouvertes (réponses attendues du commanditaire) :

- Deux images qui se chevauchent ou laissent un trou : simple avertissement pour l'instant.
  Faut-il l'interdire, ou est-ce parfois voulu ?
- Quand l'image courante va jusqu'à la fin du synoptique, la nouvelle image reprend ses
  horaires (à ajuster). Faut-il plutôt couper l'image courante en deux ?
- Changer l'heure de début du synoptique garde chaque image à son heure réelle (et refuse si
  une image se retrouverait avant le début). Faut-il plutôt décaler toutes les images avec ?
- Un cadrage qui coupe une voie cache son nom (écrit à son extrémité). Faut-il répéter le nom
  au bord du cadre ?

## Décisions du commanditaire

- Appareils de voie : **seulement le BS et la communication** pour l'instant, pas d'autres ADV.
- Longueur des zones : **tapée dans le nom** (« RVB 50 m ») ; pas de calage d'échelle pour
  l'instant.
- Sens d'un appareil : fixé par l'ordre des clics (pointe d'abord), repère triangle à la
  pointe, bouton « Inverser le sens ».
- **Plan et synoptiques sont indépendants après création** : un synoptique est une copie
  figée du plan.

## Synoptiques réels

Plus bloquant : le commanditaire importe directement ses propres plans (PDF ou images) dans
l'application. Un ou deux synoptiques PowerPoint réels déposés dans `sources/` resteront
utiles pour caler le style des étapes 5 et 6 (engins, légende, encart phasage).
