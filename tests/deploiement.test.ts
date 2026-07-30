import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Garde-fou du piège connu Vite + GitHub Pages : si `base` ne vaut pas
// /cinematique-ferroviaire/, la page déployée est blanche et les assets
// renvoient 404.
describe('configuration du déploiement', () => {
  it('vite.config.ts déclare base = /cinematique-ferroviaire/', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf-8')
    expect(config).toContain("base: '/cinematique-ferroviaire/'")
  })
})
