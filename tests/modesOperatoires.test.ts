import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chargerProjet } from '../src/domain/chargement.ts'
import { MODES_OPERATOIRES, operationsDuMode } from '../src/editor/modesOperatoires.ts'
import { VERBES } from '../src/domain/etats.ts'
import type { Projet } from '../src/domain/projet.ts'

const projet = ((): Projet => {
  const resultat = chargerProjet(
    readFileSync(new URL('../fixtures/chantier-test.cinef', import.meta.url), 'utf-8'),
  )
  if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
  return resultat.projet
})()

describe('modes opératoires', () => {
  it('n’utilisent que des verbes de la liste fermée', () => {
    for (const mode of MODES_OPERATOIRES) {
      for (const etape of mode.etapes) {
        for (const effet of etape.effets) {
          expect(Object.keys(VERBES), `${mode.id} / ${etape.libelle}`).toContain(effet.verbe)
        }
      }
    }
  })

  it('produisent des opérations enchaînées, numérotées à la suite', () => {
    const mode = MODES_OPERATOIRES.find((m) => m.id === 'rvb-complet')!
    const operations = operationsDuMode(projet, mode, {
      cible: 'z-test-a',
      tDebut: 100,
      ressources: ['pt1'],
      nomCible: 'RVB 80 m',
    })
    expect(operations).toHaveLength(mode.etapes.length)
    expect(operations[0].tDebut).toBe(100)
    for (let i = 1; i < operations.length; i++) {
      expect(operations[i].tDebut).toBeGreaterThanOrEqual(operations[i - 1].tFin)
    }
    const numeroMax = Math.max(...projet.operations.map((op) => op.numero))
    expect(operations[0].numero).toBe(numeroMax + 1)
    // Aucun identifiant en collision avec l'existant.
    const ids = new Set(projet.operations.map((op) => op.id))
    for (const operation of operations) {
      expect(ids.has(operation.id)).toBe(false)
      ids.add(operation.id)
    }
  })
})
