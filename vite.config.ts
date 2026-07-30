import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Déploiement sur Vercel : le site est servi à la racine du domaine,
// `base` doit donc valoir '/'. (Un retour à GitHub Pages exigerait
// base = '/cinematique-ferroviaire/', sinon page blanche — voir CLAUDE.md.)
export default defineConfig({
  base: '/',
  plugins: [react()],
})
