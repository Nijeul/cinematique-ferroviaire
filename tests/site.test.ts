import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chargerSite } from '../src/plan/site.ts'

const contenuExemple = readFileSync(
  new URL('../fixtures/site-exemple.json', import.meta.url),
  'utf-8',
)

describe('chargerSite', () => {
  it('charge le site d’exemple sans erreur', () => {
    const resultat = chargerSite(contenuExemple)
    if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
    expect(resultat.site.voies.length).toBeGreaterThanOrEqual(2)
    expect(resultat.site.zones.length).toBeGreaterThan(0)
  })

  it('garde chaque zone dans l’emprise de sa voie', () => {
    const resultat = chargerSite(contenuExemple)
    if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
    const voies = new Map(resultat.site.voies.map((voie) => [voie.id, voie]))
    for (const zone of resultat.site.zones) {
      const voie = voies.get(zone.voie)!
      expect(zone.de, zone.id).toBeGreaterThanOrEqual(voie.de)
      expect(zone.a, zone.id).toBeLessThanOrEqual(voie.a)
    }
  })

  it('signale un JSON invalide sans lever d’exception', () => {
    const resultat = chargerSite('{ pas du json')
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreurs[0]).toContain('JSON')
  })

  it('signale une zone sur une voie inconnue, en français', () => {
    const resultat = chargerSite(
      JSON.stringify({
        nom: 'Essai',
        longueurMetres: 100,
        voies: [{ id: 'va', nom: 'Voie A', de: 0, a: 100, rang: 0 }],
        zones: [{ id: 'z1', nom: 'Zone 1', voie: 'vb', de: 0, a: 10 }],
      }),
    )
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreurs.join('\n')).toContain('vb')
  })

  it('signale une zone qui déborde de sa voie', () => {
    const resultat = chargerSite(
      JSON.stringify({
        nom: 'Essai',
        longueurMetres: 100,
        voies: [{ id: 'va', nom: 'Voie A', de: 0, a: 50, rang: 0 }],
        zones: [{ id: 'z1', nom: 'Zone 1', voie: 'va', de: 40, a: 80 }],
      }),
    )
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreurs.join('\n')).toContain('déborde')
  })

  it('refuse deux voies au même rang', () => {
    const resultat = chargerSite(
      JSON.stringify({
        nom: 'Essai',
        longueurMetres: 100,
        voies: [
          { id: 'va', nom: 'Voie A', de: 0, a: 100, rang: 0 },
          { id: 'vb', nom: 'Voie B', de: 0, a: 100, rang: 0 },
        ],
      }),
    )
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreurs.join('\n')).toContain('rang')
  })
})
