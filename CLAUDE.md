# CLAUDE.md

Application web qui remplace les synoptiques PowerPoint de phasage que le commanditaire
produit à la main pour la maîtrise d'œuvre. **Version 2 : rendu 2D, image par image, dans le
style des planches existantes.** `PLAN.md` est la feuille de route ; `FORMAT.md` décrit le
format de données de la version 1 — il servira de base quand le besoin d'un format complet
reviendra, mais il n'est plus contractuel tant que les étapes du plan ne l'exigent pas.

## Contexte

Le commanditaire est conducteur de travaux ferroviaire, pas développeur. Il connaît son métier
à fond et pas le code.

- Explique en français, sans jargon technique inutile.
- Décision à impact métier : pose la question, ne tranche pas seul.
- Décision purement technique : tranche, et signale-le en une ligne.
- Il ne lira pas le code. Il regardera l'application déployée. Ce qui n'est pas visible ou
  testé n'existe pas.

## Méthode — non négociable depuis l'échec de la V1

- **Une étape du `PLAN.md` à la fois.** Jamais deux étapes d'avance, même si c'est demandé
  vite : chaque étape attend la validation visuelle du commanditaire.
- Une PR courte par étape, en français : ce qui a été fait, ce qui est visible, comment le
  vérifier, ce qui reste ouvert.
- `npm run build`, `npm run test` et `npm run lint` passent avant d'ouvrir la PR — vérifier
  sur le **code de sortie**, pas en lisant la fin des logs.
- Commits en français.
- La V1 (3D) vit dans l'historique Git. Ne pas la restaurer sans demande explicite.

## Règles de fond

1. **La logique est pure et testée sans navigateur.** Ce qui s'affiche sur une planche se
   calcule dans des fonctions sans React ni DOM ; les tests Vitest s'écrivent avec le code.
2. **Le temps est en minutes depuis T0** (un OCP franchit plusieurs minuits). Conversion en
   `Ve/Sa 01h30` à l'affichage uniquement.
3. **La couleur porte l'information**, comme dans les synoptiques. Lisibilité avant tout ;
   jamais de recherche d'effet.
4. **Mémoire en ligne dans Supabase** (décision du commanditaire, étape 9), avec une copie
   locale de secours (IndexedDB) et l'export `.chantier.json` toujours disponible ; aucun
   serveur à nous ; RLS partout (seuls les membres de l'équipe lisent et écrivent) ; jamais
   de clé secrète côté navigateur (seules l'adresse du projet et la clé publique
   `sb_publishable_…` vont dans les variables `VITE_…`). Le schéma vit dans
   `supabase/migrations/`, identique à ce qui est appliqué au projet.
5. **Aucune valeur d'un chantier réel hors de `fixtures/`** (les données y sont anonymisées).
6. Pas de dépendance lourde sans justification, pas de code mort, pas de fonctionnalité hors
   plan sans demander.

## Ce que tu ne peux pas voir

Environnement distant sans écran : la planche ne sera jamais visible ici. Donc : logique
testée, rendu SVG simple, et description précise dans la PR de ce qui doit apparaître.
Le commanditaire fait le contrôle visuel — c'est le cœur de la méthode.

## Structure

```
src/
  plan/       modèle du plan (sans aucun engin), du chantier et du synoptique, lecture des
              fichiers (plan, chantier — version 5) et migrations (engins retirés des plans
              enregistrés avant la correction de l'étape 5 ; chantiers et synoptiques des
              étapes 4 à 7 complétés), temps (minutes depuis T0 → « Ve/Sa 01h30 »), adresses
              des écrans, vue et cadrage, géométrie du tracé et le long des voies (dont le
              tracé parallèle, trace.ts), zones / appareils / cadres / textes, échelle,
              catalogue d'engins (liste par défaut dans catalogue.ts), engins et rames à
              l'échelle posés dans les images d'un synoptique, avec leur description pour la
              légende (engins.ts, synoptique.ts), états de la voie d'un chantier (liste par
              défaut et texture ballast dans etatsVoie.ts), état et avancement partiel de
              chaque zone dans une image (etatsZones.ts), types de flèches d'un chantier (liste
              par défaut) et flèches des images : pointes, double trait, contrainte Maj,
              sélection (fleches.ts), légende de chaque image construite d'après ce qu'elle
              montre (legende.ts), mise en page d'une image en planche : bandeau de titre,
              créneau horaire, encart PHASAGE et ses étapes, cadre LÉGENDE en colonnes
              (planche.ts), cartouche de la page de garde (cartouche.ts), exports : choix
              des images, planche ajustée dans la page, zones de texte PowerPoint à leur
              place, page de garde, nom du fichier (export.ts), mémoire en ligne : fonds
              extraits du chantier et réinjectés, empreinte, fichiers inutiles (fondsEnLigne.ts),
              décisions de synchronisation (à envoyer, à récupérer, conflit, reprise d'un
              navigateur), textes et erreurs en français (synchro.ts), détection sous le
              pointeur, annuler (ni React ni DOM, testé)
  enligne/    accès à Supabase, seul endroit qui le connaît : interface DepotEnLigne
              (depot.ts), variables et refus d'une clé secrète (configuration.ts, testé),
              comptes, tables et stockage « fonds » (supabase.ts, chargé à la demande)
  export/     écriture des fichiers exportés, sans navigateur (testée sous Node) :
              PowerPoint avec pptxgenjs (ecrirePptx.ts), PDF avec jsPDF (ecrirePdf.ts) ;
              chargés à la demande, au premier export
  ui/         écrans React (accueil, chantier avec ses états de la voie, ses types de flèches
              (TypesFleches) et son catalogue, assistant « Nouveau plan », plan, synoptique),
              calage de l'échelle (plan et synoptique), dessin SVG du plan, des engins, des
              zones selon leur état (DessinEtats), des flèches (DessinFleches) et de la
              planche entière avec sa légende (Planche), panneau Calques du plan, édition de
              l'image courante d'un synoptique (useEditeurImage, ImageDeTravail,
              PanneauEngins, PanneauFleches, PanneauImage : zone choisie, créneau, phasage,
              légende), fenêtres « Exporter… » et cartouche (FenetreExport), rendu d'une
              planche en image pour les exports, avec le même dessin que l'écran
              (rendrePlanche), export image après image (exporter), connexion, nouveau mot de
              passe et compte non membre (EcranConnexion), page Équipe (EcranEquipe), mémoire
              des chantiers en ligne ou dans ce navigateur (memoire.ts), enregistrement et
              conflits du chantier ouvert (useChantier), et accès au navigateur (IndexedDB :
              copie de secours des chantiers et fiches de synchronisation, pdf.js,
              téléchargement)
fixtures/     jeux de données d'exemple, anonymisés (dont un plan des étapes 2-3 et un
              chantier avec plans à l'échelle sans engins, un synoptique dont les images
              portent des engins et une rame à des positions différentes, un synoptique de
              4 images qui raconte les états d'une zone avec bandeau, créneaux et phasage, et
              un synoptique de 2 images avec des flèches de chaque type, des engins numérotés
              avec description, une rame « TTX 1 » et un cartouche aux valeurs fictives)
sources/      synoptiques réels fournis par le commanditaire (facultatif, jamais versionnés :
              données réelles ; il importe ses propres plans dans l'application)
supabase/     migrations SQL du projet Supabase (tables membres et chantiers, règles
              d'accès, refus d'inscription non invitée, stockage privé « fonds »)
```

## Vocabulaire métier

À respecter tel quel dans le code et dans l'interface. Ne jamais traduire ni paraphraser.

| Terme | Sens |
|---|---|
| OCP | opération coup de poing, l'intervention elle-même |
| PK | point kilométrique |
| V1 / V2 / VC | voies principales et voie de circulation ; V tiroir = voie de service |
| BS | branchement simple, un type d'appareil de voie |
| ADV | appareil de voie |
| RVB | renouvellement voie-ballast |
| RR | renouvellement rail |
| TTX | train de travaux |
| pelle RR | pelle rail-route, circule sur route et sur rail |
| PEM LEM | portique de manutention |
| TBA | traverse bi-bloc armée |
| BDML | bourrage-dressage-nivellement-relevage mécanisé |
| base arrière | zone logistique hors emprise |
| déballastage | excavation du ballast existant |
| sous-couche | couche de fondation posée avant le ballast neuf |
| calage de rampe | réglage du profil de raccordement |
| enraillement | mise sur rail d'un engin rail-route |
| interception | mise à disposition de la voie pour travaux |
| restitution | remise de la voie à l'exploitation |

## Pièges connus

- **`base` dans `vite.config.ts`** : le site est déployé sur Vercel, qui sert à la racine :
  `base` doit valoir `/`. Une mauvaise valeur rend la page déployée blanche.
- **Nord à gauche, Sud à droite** sur toutes les planches : ce sont les repères du
  commanditaire, ne jamais les inverser.
- **tsconfig.node.json** couvre `tests/` : tout module importé par un test doit compiler avec
  ses `lib`/`types` (DOM et vite/client y sont déjà).
- **Variables Vercel** : `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` sont lues au
  **build** (Production, Preview et Development). Les changer n'a d'effet qu'au déploiement
  suivant ; absentes, le site repasse en « dans ce navigateur seulement ». Localement :
  `.env.local` (jamais versionné, modèle dans `.env.example`).
- **Projet Supabase gratuit** : mis en pause après 7 jours sans activité (le site affiche
  alors la marche à suivre : « Restore project » dans le tableau de bord), et pas de
  sauvegarde automatique. Le service d'e-mails intégré n'écrit qu'aux membres de
  l'organisation Supabase tant qu'aucun SMTP n'est réglé.
- **Erreurs d'Auth** : une inscription refusée par la base (adresse non invitée) arrive en
  erreur 500 « Database error saving new user », rangée par la bibliothèque dans
  `AuthRetryableFetchError` : seul le statut 0 veut dire « pas de réseau ».
