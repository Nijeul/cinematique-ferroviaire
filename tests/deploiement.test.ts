import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Garde-fou de la page blanche : le site est déployé sur Vercel, à la racine
// du domaine. Si `base` prend une autre valeur (par exemple celle qui convient
// à GitHub Pages), les assets renvoient 404 et la page déployée est blanche.
describe('configuration du déploiement', () => {
  it("vite.config.ts déclare base = '/' (Vercel sert le site à la racine)", () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf-8')
    expect(config).toContain("base: '/'")
  })
})
