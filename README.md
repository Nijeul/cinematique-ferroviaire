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

## Développement

```
npm install     # installer les dépendances
npm run dev     # serveur de développement
npm run build   # construire le site
npm run test    # lancer les tests
npm run lint    # vérifier le code
```
