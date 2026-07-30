# Cinématique ferroviaire

Application web de cinématiques 3D de chantiers ferroviaires. Elle remplace les synoptiques
PowerPoint produits à la main pour la maîtrise d'œuvre.

- `FORMAT.md` — le format de données `.cinef`, contrat central du projet
- `SPEC.md` — architecture et découpage en lots
- `CLAUDE.md` — règles de développement

## Site déployé

https://cinematique-six.vercel.app

Le déploiement est automatique à chaque fusion sur `main` (Vercel). Chaque pull request
dispose en plus d'une adresse de prévisualisation, indiquée par Vercel en commentaire de la PR.

## Ce que fait l'application

- charge et valide un fichier `.cinef` (erreurs explicites en français) ;
- calcule l'état complet du chantier à tout instant via `etatAt(projet, t)`, moteur pur et testé ;
- affiche voies, zones (six couches d'état avec fronts de progression), appareils par panneaux,
  engins à pastille, stocks et flux, orthophoto calée ;
- lecture avec vitesses, horloge `Ve/Sa 01h30` et encart PHASAGE ; vues déclarées dans le fichier ;
- éditeurs du site (tracé à la souris) et du phasage (verbes fermés, modes opératoires) ;
- exports : vidéo MP4 (WebCodecs, repli WebM), planches PDF et PPTX avec cartouche.

## Développement

```
npm install     # installer les dépendances
npm run dev     # serveur de développement
npm run build   # construire le site
npm run test    # lancer les tests
npm run lint    # vérifier le code
```
