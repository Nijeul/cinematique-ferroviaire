import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` doit valoir /<nom-du-depot>/ pour GitHub Pages, sinon la page
// déployée est blanche (assets en 404). Voir CLAUDE.md, « Pièges connus ».
export default defineConfig({
  base: '/cinematique-ferroviaire/',
  plugins: [react()],
})
