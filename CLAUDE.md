# CLAUDE.md

Application web de cinématiques 3D de chantiers ferroviaires. Elle remplace les synoptiques
PowerPoint que le commanditaire produit aujourd'hui à la main pour la maîtrise d'œuvre.

Lis `FORMAT.md` avant toute tâche : il définit le format de données, qui est le contrat
central du projet. `SPEC.md` donne l'architecture et le découpage en lots.

## Contexte

Le commanditaire est conducteur de travaux ferroviaire, pas développeur. Il connaît son métier
à fond et pas le code.

- Explique en français, sans jargon technique inutile.
- Décision à impact métier : pose la question, ne tranche pas seul.
- Décision purement technique : tranche, et signale-le en une ligne.
- Il ne lira pas le code. Il regardera l'application déployée. Ce qui n'est pas visible ou
  testé n'existe pas.

## Ce qu'on construit

Un **outil**, réutilisable pour n'importe quel chantier. Pas la cinématique d'un chantier
particulier.

`fixtures/ocp1-sud.cinef` est un chantier réel qui sert de **cas de test**. Il n'est pas le
livrable. `fixtures/chantier-test.cinef` est un second jeu de données, volontairement sans
rapport avec le premier : il existe pour que toute spécialisation du code au chantier de
Châtellerault casse immédiatement un test.

Aucun nom de zone, aucun identifiant d'appareil, aucun chemin d'orthophoto, aucune durée et
aucun PK d'un chantier réel ne doit apparaître ailleurs que dans les fichiers de `fixtures/`.
Si une valeur d'un jeu de données se retrouve dans `src/`, c'est un défaut à corriger.

## Règles non négociables

1. **`etatAt(projet, t)` est une fonction pure.** Elle renvoie l'état complet du chantier à
   l'instant `t` : état des six couches de chaque zone, avancement des fronts, position et mode
   de chaque engin, contenu de chaque stock, opérations actives. Elle ne dépend ni de React, ni
   de Three.js, ni de l'instant précédent. Tout le rendu en découle.
2. **Aucune animation manuelle.** Rien n'est keyframé. Un objet bouge parce qu'une opération le
   dit, jamais parce qu'une animation a été écrite pour lui.
3. **Aucun objet ferroviaire ne stocke de XYZ.** Position = `(voie, pk, offset)`. Les
   coordonnées sont calculées par `pose()`.
4. **Le temps est en minutes depuis T0.** Jamais en heures absolues : un OCP de 56 h franchit
   trois fois minuit. La conversion en `Ve/Sa 01h30` est faite à l'affichage uniquement.
5. **La liste des verbes d'opération et la table des six couches sont fermées.** Ajouter une
   valeur se fait dans `FORMAT.md` d'abord, en le signalant, jamais en douce dans le code.
6. **Instancing obligatoire** pour tout élément répété : traverses, attaches, ballast.
7. **Pas de backend.** Le projet est un fichier `.cinef` que l'utilisateur enregistre.

## Ce que tu ne peux pas voir

Tu travailles dans un environnement distant sans écran. Tu ne verras jamais la scène 3D.
Par conséquent :

- `domain/`, `geometry/` et `state/` doivent être testables sans navigateur. Écris les tests
  Vitest en même temps que le code, pas après.
- Les deux jeux de données de `fixtures/` sont tes cas de test de référence. Ils doivent
  toujours se charger et se résoudre sans erreur, tous les deux. Un test qui ne passe que sur
  l'un des deux signale une spécialisation du code à corriger.
- Pour tout ce qui est visuel, décris précisément dans la PR ce qui devrait apparaître à
  l'écran et comment le vérifier. Le commanditaire fera le contrôle visuel.
- En cas de doute sur un rendu, préfère un affichage simple et lisible à un effet que tu ne
  peux pas contrôler.

## Méthode

- Un lot à la fois, dans l'ordre de `SPEC.md`. Ne pas anticiper les lots suivants.
- Une branche et une PR par lot : `lot-04-etats-de-zone`.
- La PR doit dire, en français et en clair : ce qui a été fait, ce qui est visible à l'écran,
  comment le vérifier, et ce qui reste ouvert.
- `npm run build`, `npm run test` et `npm run lint` doivent passer avant d'ouvrir la PR.
- Commits en français.

## Structure

```
src/
  domain/     types et schémas Zod du format .cinef      (ni React ni Three)
  geometry/   courbes de voie, référencement PK, pose()  (ni React ni Three)
  state/      etatAt(t) — le moteur                      (ni React ni Three)
  render/     composants react-three-fiber
  editor/     édition du site et du phasage
  export/     vidéo, PDF, PPTX
  ui/         panneaux, curseur temporel, encart phasage
fixtures/     jeux de données, dont ocp1-sud.cinef
```

Les trois premiers dossiers contiennent toute la logique. Le reste n'est que de l'affichage.
Si une règle métier se retrouve dans `render/`, elle est au mauvais endroit.

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

- **Vite + GitHub Pages** : `base` doit valoir `/<nom-du-depot>/` dans `vite.config.ts`, sinon
  la page déployée est blanche et les assets renvoient 404.
- **WebCodecs** n'existe ni sur Safari ni sur Firefox. Détecter et prévenir clairement ;
  fallback WebM via MediaRecorder.
- **Traverses** : 200 m de voie à 0,60 m = 333 traverses par voie. `InstancedMesh` obligatoire
  dès le premier rendu de voie, pas en optimisation ultérieure.
- **Fronts de progression** : une opération linéaire n'applique pas son effet d'un coup. À `t`,
  la fraction écoulée de la zone est dans le nouvel état, le reste dans l'ancien, dans le sens
  indiqué. C'est le comportement attendu, pas un raffinement optionnel.
- **Opérations simultanées sur une même zone** : c'est autorisé et ça arrive dans le chantier
  réel. `etatAt` doit les composer, pas en choisir une.

## Ce qu'il ne faut pas faire

- Chercher le photoréalisme. L'objectif est la lisibilité du phasage. La couleur porte
  l'information, comme dans les synoptiques existants.
- Ajouter des fonctionnalités hors périmètre sans demander.
- Introduire une dépendance lourde sans la justifier.
- Laisser du code mort ou des composants « au cas où ».
