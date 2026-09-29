import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { echelleX, hauteurPlanche, MISE_EN_PAGE, yDeVoie, ySousVoie } from '../src/plan/reperes.ts'
import { chargerSite, type Site } from '../src/plan/site.ts'

const site = ((): Site => {
  const resultat = chargerSite(
    readFileSync(new URL('../fixtures/site-exemple.json', import.meta.url), 'utf-8'),
  )
  if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
  return resultat.site
})()

describe('mise en page de la planche', () => {
  it('place le mètre 0 à la marge gauche et la fin du site au bord droit utile', () => {
    const x = echelleX(site)
    expect(x(0)).toBe(MISE_EN_PAGE.margeGauche)
    expect(x(site.longueurMetres)).toBe(MISE_EN_PAGE.margeGauche + MISE_EN_PAGE.largeurUtile)
    // Nord à gauche : un point plus au sud est plus à droite.
    expect(x(400)).toBeGreaterThan(x(100))
  })

  it('espace les bandes de voies d’un interligne constant, dans l’ordre des rangs', () => {
    const ordonnees = [...site.voies].sort((a, b) => a.rang - b.rang)
    for (let i = 1; i < ordonnees.length; i++) {
      expect(yDeVoie(ordonnees[i]) - yDeVoie(ordonnees[i - 1])).toBe(MISE_EN_PAGE.interligne)
    }
  })

  it('dessine les stockages entre deux bandes, jamais sur une voie', () => {
    for (const voie of site.voies) {
      expect(ySousVoie(voie)).toBeGreaterThan(yDeVoie(voie) + MISE_EN_PAGE.hauteurZone / 2)
      expect(ySousVoie(voie)).toBeLessThan(yDeVoie(voie) + MISE_EN_PAGE.interligne)
    }
  })

  it('réserve la place du cartouche sous la dernière voie', () => {
    const rangMax = Math.max(...site.voies.map((voie) => voie.rang))
    const basDesVoies = MISE_EN_PAGE.yPremiereVoie + rangMax * MISE_EN_PAGE.interligne
    expect(hauteurPlanche(site)).toBeGreaterThan(basDesVoies + MISE_EN_PAGE.hauteurCartouche)
  })
})
