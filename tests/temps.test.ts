import { describe, expect, it } from 'vitest'
import { formaterInstant } from '../src/ui/temps.ts'

// T0 du jeu de référence : un vendredi 22h30.
const T0 = '2026-01-09T22:30:00'

describe('formaterInstant', () => {
  it('affiche le jour et l’heure en journée', () => {
    expect(formaterInstant(T0, 0)).toBe('Ve 22h30')
    expect(formaterInstant(T0, 720)).toBe('Sa 10h30')
  })

  it('affiche la nuit à cheval sur deux jours, comme les synoptiques', () => {
    expect(formaterInstant(T0, 180)).toBe('Ve/Sa 01h30')
    expect(formaterInstant(T0, 1620)).toBe('Sa/Di 01h30')
  })

  it('franchit trois minuits sur un OCP de 56 h sans changer de repère', () => {
    expect(formaterInstant(T0, 3360)).toBe('Lu 06h30')
  })
})
