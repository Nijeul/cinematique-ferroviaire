# Démarrage — Claude Code sur le web

Marche à suivre et prompts prêts à coller. Ce fichier est pour vous, pas pour Claude Code.

---

## 1. Créer le dépôt

Sur GitHub, créez un dépôt **privé** nommé `cinematique-ferroviaire`. Cochez « Add a README ».

Déposez-y ces fichiers à la racine, par glisser-déposer dans l'interface GitHub
(bouton *Add file* → *Upload files*) :

```
CLAUDE.md
SPEC.md
FORMAT.md
DEMARRAGE.md
```

Le dossier `sources/` compte autant que les autres fichiers. Claude Code sait ouvrir un PPTX et
un XLSX ; en les mettant dans le dépôt, il travaille sur vos documents réels au lieu de
travailler sur ma description de vos documents.

Puis allez sur **claude.ai/code**, connectez votre compte GitHub, et sélectionnez le dépôt.

---

## 2. Comment ça se passe

Vous décrivez une tâche, Claude travaille dans un environnement distant, et il ouvre une
**pull request** quand il a fini. Vous pouvez fermer la page entre-temps.

Une pull request est une proposition de modification. Vous la lisez, et si elle vous convient
vous cliquez *Merge* : les modifications entrent dans le projet. Vous n'avez pas à comprendre
le code — lisez la description que Claude écrit en tête de PR, et regardez le résultat déployé.

**Un lot = une session = une PR.** Ne lancez pas le lot suivant avant d'avoir fusionné le
précédent, sinon les deux sessions travaillent sur des bases différentes et se marchent dessus.

---

## 3. Prompt du lot 0 — à coller en premier

> Lis `CLAUDE.md`, `SPEC.md` et `FORMAT.md` à la racine du dépôt avant de commencer.
>
> Réalise le **lot 0** décrit dans SPEC.md §5, et rien de plus.
>
> Mets en place le socle du projet : Vite, React, TypeScript, react-three-fiber, Zustand, Zod,
> Vitest, ESLint. Une scène 3D vide avec un sol, une grille et des contrôles de caméra à la
> souris. Configure le déploiement automatique sur GitHub Pages via GitHub Actions, déclenché à
> chaque fusion sur la branche principale.
>
> Attention : `base` dans `vite.config.ts` doit valoir `/cinematique-ferroviaire/`, sinon la
> page déployée sera blanche.
>
> Dans la description de la PR, indique en français : l'adresse à laquelle le site sera
> déployé, et ce que je dois faire dans les réglages GitHub pour activer Pages si c'est
> nécessaire.

Après avoir fusionné cette PR, ouvrez l'adresse indiquée. Vous devez voir une grille en 3D que
vous pouvez faire tourner à la souris. **Ne passez pas à la suite tant que ce n'est pas le
cas** — c'est votre seul moyen de voir le projet avancer.

---

## 4. Prompt du lot 1

> Lis `CLAUDE.md`, `SPEC.md` et `FORMAT.md`. Réalise le **lot 1** de SPEC.md §5, et rien de plus.
>
> Écris les types TypeScript et les schémas Zod du format `.cinef` décrit dans FORMAT.md, puis
> le chargement et la validation d'un fichier.
>
> Crée ensuite le jeu de données `fixtures/ocp1-sud.cinef` en encodant le phasage réel du
> chantier. Les onze premières opérations sont déjà écrites dans FORMAT.md §6 : reprends-les
> telles quelles. Pour les suivantes, ouvre
> `sources/RAVI_CHATELLERAULT_SYNOPTIQUE_OCP_1_SUD.pptx` et encode les opérations 12 à 51 en
> suivant le même format, en te servant des libellés et des horaires de chaque planche.
>
> Les géométries de voies et les PK dans FORMAT.md sont des valeurs plausibles que j'ai
> inventées, pas des relevés. Garde-les pour l'instant, mais signale-le clairement dans la PR.
>
> Si une opération du synoptique n'entre pas dans les verbes disponibles, ne force pas et
> n'invente pas de verbe : liste-la dans la description de la PR, je trancherai.

Cette dernière consigne est la plus importante du lot. C'est le vrai test du format : s'il faut
inventer trois verbes pour encoder vos 51 opérations, mieux vaut le savoir maintenant.

---

## 5. Prompt du lot 2

> Lis `CLAUDE.md`, `SPEC.md` et `FORMAT.md`. Réalise le **lot 2** de SPEC.md §5, et rien de plus.
>
> Écris le moteur `etatAt(projet, t)` conformément à SPEC.md §2 : application des effets,
> composition de plusieurs opérations sur une même zone, fronts de progression pour les
> opérations linéaires, suivi des flux et du contenu des stocks.
>
> Couvre-le de tests Vitest sur `fixtures/ocp1-sud.cinef`. Au minimum : le fichier se résout à
> tout instant sans erreur ; l'état final de chaque zone correspond à une voie neuve posée et
> réglée ; aucune zone ne repasse en arrière ; un stock ne devient jamais négatif.
>
> Il n'y a rien à afficher dans ce lot. Ne touche pas au rendu.

C'est le lot le plus important et le seul qui ne produira rien de visible. Ne l'escamotez pas :
tout le reste en dépend.

---

## 6. Lots suivants

Le modèle est stable, adaptez le numéro et la ligne du tableau :

> Lis `CLAUDE.md`, `SPEC.md` et `FORMAT.md`. Réalise le **lot N** de SPEC.md §5, et rien de plus.
> Dans la description de la PR, dis-moi en français ce qui est visible à l'écran et comment le
> vérifier.

Ajoutez au besoin une phrase de contexte propre au lot. Deux exemples :

- **Lot 4** : « Suis exactement le tableau de rendu de SPEC.md §4. Si une valeur d'état ne te
  paraît pas représentable de façon lisible, dis-le plutôt que d'improviser. »
- **Lot 6** : « Utilise des volumes simples et reconnaissables, pas des modèles détaillés, avec
  la pastille numérotée au-dessus de chaque engin comme sur mes synoptiques. »

---

## 7. Conseils de conduite

**Fusionnez souvent, en petits morceaux.** Une PR de lot est déjà grosse. Si Claude vous
propose d'en faire plus, refusez.

**Quand quelque chose ne va pas visuellement, décrivez ce que vous voyez**, pas ce qu'il faut
corriger dans le code. « Les traverses déposées se superposent aux rails » suffit ; Claude
trouvera où. C'est vous l'œil du projet, il ne voit rien.

**Le vocabulaire prime sur le code.** Si l'interface affiche un terme qui n'est pas celui du
métier, faites-le corriger tout de suite. Ces choses-là se figent vite et vous vivrez avec.

**Tenez `FORMAT.md` à jour.** C'est le contrat. Un verbe ou un état ajouté dans le code sans
passer par ce fichier finira par créer une incohérence. Si Claude propose un ajout, faites-le
inscrire dans `FORMAT.md` dans la même PR.

**Quand le doute s'installe, revenez au fichier d'exemple.** `fixtures/ocp1-sud.cinef` décrit
un chantier que vous connaissez par cœur. Si la cinématique ne raconte pas ce que vous savez
s'être passé, c'est là qu'il faut chercher.
