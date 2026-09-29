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
placent de la même façon, au calque. Chaque plan a une échelle, calée à sa création ; le
plan reste « juste un plan », sans aucun engin. Les engins et les trains se posent dans les
images des synoptiques, à leur vraie longueur, et avancent d'une image à l'autre.

## Méthode

Une étape = une chose visible = **validation du commanditaire avant l'étape suivante**.
Jamais deux étapes d'avance. Chaque étape est une PR courte qui dit quoi regarder.

## Étapes

| # | Contenu | Validation attendue | État |
|---|---|---|---|
| 1 | Style de planche : aperçu SVG (voies en double filet, noms, zones, BS, stockages, cartouche) | « C'est le style de mes synoptiques » | **validé** |
| 2 | Fond de plan importé (image ou PDF, choix de la page) ; tracé des voies à la main au calque ; nom, couleur et épaisseur par voie ; enregistrer / ouvrir | le commanditaire trace les voies de son site sur son propre plan | **validé** |
| 3 | Éléments du plan au calque : zones de travaux, appareils (BS et communications), cadres, textes, extrémités du plan (détail ci-dessous) | le plan de base d'une planche est complet | **validé** |
| 4 | Organisation : accueil et chantiers, plusieurs plans par chantier, synoptiques et images (détail ci-dessous) | on crée un synoptique à partir d'un plan et on feuillette ses images | **validé** |
| 5 | Échelle du plan, obligatoire à la création ; catalogue d'engins par chantier ; engins et rames posés à l'échelle **dans les images des synoptiques** (pas sur le plan), couleurs et numéros ; « Nouvelle image » emporte les engins (détail ci-dessous) | les engins se posent à la bonne taille dans une image, se reconnaissent et avancent d'une image à l'autre | **validé** |
| 6 | États de la voie par chantier ; état et avancement partiel de chaque zone dans chaque image ; encart PHASAGE ; créneau horaire et bandeau de titre (détail ci-dessous) | une image se lit comme une planche actuelle (hors flèches et légende) | **en cours** |
| 7 | Flèches (sens de travail, sens d'avancement TTX, cheminement, chemin de roule) et **légende** propre à chaque image : numéros d'engins (« 1 = pelle RR 1 »), états présents, trains, flèches | la planche s'explique d'elle-même, sans les carrés noirs numérotés | à faire |
| 8 | Exports PowerPoint et PDF des images d'un synoptique | un jeu de planches équivalent à l'actuel | à faire |

Les besoins au-delà (vidéo, orthophoto calée, import DXF, 3D en option) seront rediscutés une
fois l'étape 8 validée — pas avant.

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
- Le contenu des images ne se modifie pas encore à cette étape (engins : étape 5 ; couleurs
  de zones : étape 6).
- Adresse par écran (le bouton Précédent et le rechargement de la page fonctionnent).
- Au premier lancement, la sauvegarde automatique des étapes 2 et 3 devient le
  « Chantier récupéré ».

Questions ouvertes de l'étape 4 (réponses attendues du commanditaire) :

- ~~Deux images qui se chevauchent ou laissent un trou : faut-il l'interdire ?~~ **Tranché** :
  « Les horaires sont indicatifs. » Chevauchements et trous sont permis, sans avertissement
  (étape 6) ; seul « la fin après le début » est contrôlé.
- Quand l'image courante va jusqu'à la fin du synoptique, la nouvelle image reprend ses
  horaires (à ajuster). Faut-il plutôt couper l'image courante en deux ?
- Changer l'heure de début du synoptique garde chaque image à son heure réelle (et refuse si
  une image se retrouverait avant le début). Faut-il plutôt décaler toutes les images avec ?
- Un cadrage qui coupe une voie cache son nom (écrit à son extrémité). Faut-il répéter le nom
  au bord du cadre ? (Les repères « ◀ Nord » / « Sud ▶ », eux, restent toujours dans le cadre.)
- Heures de nuit (avant 6 h) écrites « Ve/Sa 01h30 », y compris en fin de plage
  (« Ve 22h30 → Ve/Sa 01h30 ») : ce format convient-il ?

### Étape 5 — échelle du plan et engins à l'échelle dans les synoptiques

Demande du commanditaire : « Je veux que les engins et autres soient à l'échelle. […] dans la
création de plan on doive mettre l'échelle. Comme ça quand on ajoute un engin, il est à la
bonne taille. Notamment pour les trains. »

Correction du commanditaire après la première version (engins posés sur le plan) : « J'ai
mal expliqué. Sur le plan je ne veux pas d'engin, c'est vraiment juste un plan. C'est sur le
synoptique qu'on ajoute les engins. »

- **Échelle obligatoire à la création d'un plan** : « Nouveau plan » ouvre un assistant en
  trois étapes (nom, fond, échelle) ; le plan n'est créé qu'une fois l'échelle calée. Calage en
  deux clics sur deux repères dont on connaît l'écart réel (deux poteaux, deux PK), puis la
  distance en mètres ; sans fond, la longueur réelle représentée par la largeur de la toile
  (400 m par défaut). La copie d'un plan garde son échelle.
- **Outil « Échelle… »** (L) dans l'éditeur du plan, pour recaler ; Annuler rétablit
  l'ancienne échelle. Les synoptiques déjà créés gardent la leur (copies figées).
- **Échelle graphique** « 0 — 50 m » (longueur ronde adaptée au zoom) en bas à droite du plan,
  et dans chaque image d'un synoptique.
- **Le plan ne contient aucun engin** : ni outil Engin ou Rame, ni calque « Engins ». Un plan
  enregistré avec des engins (première version de cette étape) s'ouvre toujours : ses engins
  en sont retirés, avec un message une seule fois (« Les engins ne se posent plus sur le plan
  mais dans les synoptiques : 3 engins et 1 rame retirés du plan « … » »).
- **Plans sans échelle** (Chantier récupéré, plans importés des étapes 2 et 3, plans de
  l'étape 4) : bandeau « Échelle non définie : calez-la pour que les engins des synoptiques
  issus de ce plan soient à la bonne taille », avec « Caler l'échelle… ».
- **Catalogue d'engins par chantier**, dans la page du chantier : catégorie, modèle, longueur,
  largeur, couleur ; modifier, ajouter, supprimer. Initialisé avec la liste du commanditaire
  (Pelle RR comprise) ; il voyage dans l'export du chantier. Modifier un type vaut pour les
  prochains engins posés : ceux déjà posés dans les synoptiques gardent leurs valeurs (copie
  figée, comme le reste du synoptique).
- **Synoptique** : créé depuis un plan, il en copie le contenu **et l'échelle**, sans engin.
  L'écran du synoptique permet de modifier l'**image courante** avec les outils Sélection,
  Main, **Engin (E)** et **Rame (W)** :
  - Engin : on choisit le type dans le panneau. Clic près d'une voie : l'engin se pose le long
    de la voie, suit les courbes et glisse le long d'elle. Clic loin des voies : engin libre
    (pelle RR sur route, en base arrière), tourné avec sa poignée ronde ou le champ « Angle » ;
  - Rame : composition dans le panneau (« BB 61000 + 10 × R39 » : ajout, retrait, ordre,
    nombre), puis clic sur une voie. Véhicules bout à bout, chacun à sa place le long de la
    voie ; longueur totale affichée (« Rame 1 — 213,5 m »), sens réglable (« Inverser le
    sens »), glisse d'un bloc. Une rame qui dépasse le bout de la voie est signalée, jamais
    tronquée ;
  - numéro (« 3 », « P4 ») dans une pastille ronde au-dessus de l'engin ou de la tête de la
    rame ; couleur modifiable par engin, celle de la catégorie par défaut ;
  - panneau « Engins de l'image n » : visible / verrouillé, liste des engins et des rames de
    l'image avec leurs propriétés, sélection, Suppr, Annuler / Rétablir ; molette pour zoomer.
- **Chaque image a ses propres engins** : poser, déplacer ou retirer un engin ne change que
  l'image courante. **« Nouvelle image » duplique l'image courante, engins compris** : il ne
  reste qu'à déplacer ce qui bouge. Les vignettes et ◀ ▶ montrent les engins de chaque image.
- **Synoptique sans échelle** (étape 4, ou plan sans échelle) : bandeau clair, outils Engin
  et Rame grisés avec une infobulle qui explique ; l'échelle se cale **dans le synoptique**
  (même outil, deux repères et leur distance), le plan d'origine ne change pas.
- Les synoptiques créés pendant la première version de cette étape gardent dans leurs images
  les engins copiés depuis le plan.

Questions ouvertes de l'étape 5 (choix provisoires en place) :

- **Largeur des engins ferroviaires** : non fournie, 3,0 m pour tous par défaut (modifiable
  type par type dans le catalogue). Faut-il d'autres largeurs ?
- **Pelle RR = Caterpillar 323** : 9,5 m × 3,2 m vue de dessus, en transport (flèche
  repliée), à confirmer. Les fiches techniques consultées donnent environ 9,5 m × 3,2 m avec
  patins de 790 mm, et près de 3,0 m de large avec patins de 600 mm. S'agit-il bien de la 323
  sur chenilles, ou d'une version rail-route sur pneus (CAT M323F), plus étroite ?
- Ballastière et Wagon ont la même couleur orange dans le tableau : les garder identiques ?
- Dans une rame, chaque véhicule garde la couleur de sa catégorie (loco verte, wagons
  orange) ; la couleur réglable de la rame est celle de sa pastille. Est-ce ce qu'il faut ?
- Une rame se pose centrée sur le point cliqué, la tête côté gauche (Nord) ; « Inverser le
  sens » la retourne sur place. Préférez-vous cliquer l'emplacement de la tête ?
- Vu de loin, à l'échelle réelle, un wagon fait quelques pixels : le modèle n'est écrit dans
  le rectangle que s'il tient. Faut-il une étiquette à côté quand il ne tient pas ?
- **Propagation aux images suivantes** : poser ou déplacer un engin ne change que l'image
  courante. Faut-il pouvoir propager un ajout ou un déplacement aux images suivantes ?

### Étape 6 — états des zones, encart PHASAGE, créneau et bandeau de titre

Le commanditaire a fourni un synoptique PowerPoint réel (19 planches). Il a été analysé pour
cette étape mais **n'est pas versionné** : ce sont des données réelles. On y voit, sur chaque
planche (un créneau horaire) : le bandeau de titre en haut sur fond bleu clair, le créneau en
haut à droite (fond gris clair, bord rouge), l'encart PHASAGE en bas à gauche (bandeau gris
foncé, étapes numérotées de façon continue sur tout le document), et des zones de travaux
dont l'aspect change avec l'état de la voie, parfois sur une partie seulement.

- **États de la voie, par chantier** (comme le catalogue d'engins), dans la page du chantier :
  nom, rendu (couleur propre de la zone — réservé au premier état —, aplat de couleur, ou
  texture ballast avec ou sans voile de couleur semi-transparent), couleur, aperçu ; modifier,
  ajouter, réordonner, supprimer. Liste par défaut, dans l'ordre : **Avant travaux** (couleur
  propre de la zone), **Déposée** (texture gris ballast), **Déballastée** (aplat saumon),
  **Sous-couche ballast** (aplat brun clair, à confirmer), **Voie neuve posée** (texture et
  voile jaune : jaune tacheté). Changer la couleur d'un état change toutes les images qui
  l'utilisent. Supprimer un état utilisé demande une confirmation qui dit combien d'images
  sont concernées ; leurs zones reviennent à l'état précédent de la liste. Le premier état ne
  se supprime pas et reste en tête. La liste voyage avec l'export du chantier ; les
  chantiers existants reçoivent la liste par défaut.
- **État de chaque zone, dans chaque image** (Avant travaux par défaut). Mode Sélection :
  cliquer une zone la choisit (elle ne se déplace pas) ; le panneau montre son nom, la
  palette des états (touches 1 à 9) et la case « En partie » : pourcentage fait, côté de
  départ (« ◀ Nord » ou « Sud ▶ », avec les noms d'extrémités du plan), état du reste. La
  bande est coupée à la bonne distance le long de la voie, courbes comprises, et un trait
  marque le front. Annuler / Rétablir ; les vignettes montrent les états ; « Nouvelle image »
  recopie les états.
- **Encart PHASAGE, propre à chaque image** : étapes numérotées (« 3 – Dépose des rails… »),
  libellés sur une ou plusieurs lignes, qui vont à la ligne ; ajouter (numéro proposé : le plus
  grand déjà donné jusqu'à cette image, plus 1), modifier, réordonner, supprimer. Un encart
  vide ne s'affiche pas. « Nouvelle image » ne recopie pas les étapes (à confirmer).
- **Créneau horaire** en haut à droite : les heures de l'image (« Ve/Sa » puis
  « 00h30 – 03h30 »), ou le début seul (« Sa 20h00 »), et un titre facultatif au-dessus
  (« Phase avant travaux »), qui peut aussi remplacer les heures.
- **Bandeau de titre** du synoptique, sur une ou plusieurs lignes, en haut de chaque image ;
  vide par défaut, et alors absent.
- Le bandeau et le créneau sont posés dans une bande au-dessus du plan, l'encart PHASAGE
  dans une bande au-dessous, comme sur ses planches : ils ne masquent jamais les voies. Ces
  bandes ont la même hauteur sur toutes les images d'un synoptique (le plan ne saute pas
  quand on feuillette).
- Hors étape 6 : flèches et légende (étape 7), exports (étape 8), découpage du site en bandes
  (pas demandé).

Questions ouvertes de l'étape 6 (choix provisoires en place) :

- **Couleur de la sous-couche ballast** : brun clair (#a07c52), choisi pour se distinguer du
  saumon (déballastée) et du jaune (voie neuve). Modifiable dans la page du chantier.
  Convient-elle ?
- **« Nouvelle image » ne recopie pas les étapes du PHASAGE** (ni le titre du créneau) : sur
  vos planches, chaque créneau a ses propres étapes. L'encart de la nouvelle image est vide
  et « + Étape » propose le numéro suivant. Est-ce bien ce qu'il faut ?
- Bandeau, créneau et encart sont placés **autour** du plan (au-dessus et au-dessous), comme
  sur vos planches, plutôt que par-dessus. Cela vous convient-il ?

## Décisions du commanditaire

- Appareils de voie : **seulement le BS et la communication** pour l'instant, pas d'autres ADV.
- Longueur des zones : **tapée dans le nom** (« RVB 50 m »). Maintenant que le plan a une
  échelle, un calcul automatique pourrait être proposé plus tard, s'il est demandé.
- **Échelle obligatoire à la création d'un plan** ; les engins sont **à l'échelle**, trains
  compris (on voit les longueurs des wagons et des locomotives).
- **Le plan ne contient aucun engin** : « c'est vraiment juste un plan ». Les engins et les
  rames se posent dans les images des synoptiques.
- Liste des engins : Loco (BB 61000 14,5 m, V211 12,3 m), Ballastière (D12 14 m, Ex 100
  15,64 m, C12 9,64 m), Bigrue (Type DGS82BG 32,6 m, Socofer 19,9 m), BML (Type 08-32U 31 m,
  Type 08 GV 31,5 m, Type 108-32 U 32,8 m), Stabilisateur (Type DGS82 32,8 m), Wagon (R39
  19,9 m), avec la couleur de chaque catégorie de son tableau.
- **Pelle RR = Caterpillar 323** (dimensions retenues à confirmer, voir l'étape 5).
- Sens d'un appareil : fixé par l'ordre des clics (pointe d'abord), repère triangle à la
  pointe, bouton « Inverser le sens ».
- **Plan et synoptiques sont indépendants après création** : un synoptique est une copie
  figée du plan.
- **États des zones** : « Il faut une étape pour la sous-couche ballast. » États par défaut,
  dans l'ordre : Avant travaux, Déposée, Déballastée, Sous-couche ballast, Voie neuve posée.
- **Avancement partiel d'une zone** (déballastée sur 40 % depuis un côté) : « C'est bien de
  pouvoir le faire. »
- **Horaires indicatifs** : deux images peuvent se chevaucher ou laisser un trou.
- **Pas de découpage du site en deux bandes** : « Pas besoin. »
- **Numéros des pelles** (carrés noirs numérotés de ses planches) : « Il faut faire mieux, par
  exemple une légende. » → légende de l'étape 7.

## Synoptiques réels

Le commanditaire importe directement ses propres plans (PDF ou images) dans l'application. Il
a aussi fourni un synoptique PowerPoint réel, analysé pour caler le style de l'étape 6 (encart
PHASAGE, créneau, bandeau, états des zones) et qui servira aux étapes 7 et 8. **Il n'est pas
versionné** (données réelles) : `sources/` reste vide dans le dépôt, et les fixtures restent
fictives.
