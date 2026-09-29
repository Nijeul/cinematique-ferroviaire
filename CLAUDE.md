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
4. **Pas de backend.** Le projet reste un fichier que l'utilisateur enregistre et transmet.
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
  plan/       modèle du plan, du chantier et du synoptique, lecture des fichiers (plan,
              chantier) et migrations, temps (minutes depuis T0 → « Ve/Sa 01h30 »),
              adresses des écrans, vue et cadrage, géométrie du tracé et le long des
              voies, zones / appareils / cadres / textes, échelle du plan, catalogue
              d'engins (liste par défaut dans catalogue.ts), engins et rames à l'échelle,
              détection sous le pointeur, annuler (ni React ni DOM, testé)
  ui/         écrans React (accueil, chantier et son catalogue, assistant « Nouveau plan »,
              plan, synoptique), calage de l'échelle, dessin SVG du plan et des engins,
              panneau Calques, et accès au navigateur (IndexedDB pour les chantiers,
              pdf.js, téléchargement)
fixtures/     jeux de données d'exemple, anonymisés (dont un plan des étapes 2-3 et un
              chantier avec échelle, engins et rame)
sources/      synoptiques réels fournis par le commanditaire (facultatif : il importe
              ses propres plans dans l'application)
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
