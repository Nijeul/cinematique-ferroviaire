import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Déploiement sur Vercel : le site est servi à la racine du domaine,
// `base` doit donc valoir '/'. (Un retour à GitHub Pages exigerait
// base = '/cinematique-ferroviaire/', sinon page blanche — voir CLAUDE.md.)
export default defineConfig({
  base: '/',
  plugins: [react()],
  // L'application tient en un fichier d'environ 500 ko (150 ko compressé) ;
  // les outils lourds (PowerPoint, PDF, pdf.js, Supabase) sont chargés à la
  // demande. Pas d'avertissement en dessous de 600 ko.
  build: { chunkSizeWarningLimit: 600 },
})
