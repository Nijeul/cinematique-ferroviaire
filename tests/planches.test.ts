import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chargerProjet } from '../src/domain/chargement.ts'
import { instantsDesPlanches } from '../src/export/planches.ts'
import type { Projet } from '../src/domain/projet.ts'

const chargerFixture = (nom: string): Projet => {
  const resultat = chargerProjet(
    readFileSync(new URL(`../fixtures/${nom}`, import.meta.url), 'utf-8'),
  )
  if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
  return resultat.projet
}

describe.each(['ocp1-sud.cinef', 'chantier-test.cinef'])('instantsDesPlanches %s', (nom) => {
  const projet = chargerFixture(nom)

  it('découpe par créneau du début à la fin', () => {
    const instants = instantsDesPlanches(projet, 'creneau')
    expect(instants[0]).toBe(0)
    expect(instants[instants.length - 1]).toBeLessThanOrEqual(projet.temps.dureeMinutes)
    expect(instants[1] - instants[0]).toBe(projet.temps.pasCreneau)
  })

  it('découpe par changement d’opération, bornes uniques et ordonnées', () => {
    const instants = instantsDesPlanches(projet, 'operations')
    expect(new Set(instants).size).toBe(instants.length)
    const ordonnes = [...instants].sort((a, b) => a - b)
    expect(instants).toEqual(ordonnes)
    for (const op of projet.operations) {
      expect(instants).toContain(op.tDebut)
      expect(instants).toContain(op.tFin)
    }
  })
})
