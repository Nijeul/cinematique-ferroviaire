import { describe, expect, it } from 'vitest'
import {
  ecrireInstant,
  formaterDuree,
  formaterHoraire,
  formaterPlage,
  instantDepuisT0,
  lireInstant,
  minutesDepuisT0,
} from '../src/plan/temps.ts'

// Le vendredi 9 octobre 2026 à 22h30.
const T0 = '2026-10-09T22:30'

describe('instants saisis', () => {
  it('lit une date et une heure, avec ou sans secondes', () => {
    expect(lireInstant('2026-10-09T22:30')).not.toBeNull()
    expect(lireInstant('2026-10-09T22:30:00')).toBe(lireInstant('2026-10-09T22:30'))
    expect(ecrireInstant(lireInstant('2026-10-09T22:30:00')!)).toBe('2026-10-09T22:30')
  })

  it('refuse une saisie incomplète ou impossible', () => {
    expect(lireInstant('')).toBeNull()
    expect(lireInstant('2026-10-09')).toBeNull()
    expect(lireInstant('2026-02-31T10:00')).toBeNull()
    expect(lireInstant('2026-10-09T25:00')).toBeNull()
  })

  it('compte en minutes depuis T0, dans les deux sens', () => {
    expect(minutesDepuisT0(T0, '2026-10-10T01:30')).toBe(180)
    expect(minutesDepuisT0(T0, '2026-10-12T06:30')).toBe(3360)
    expect(minutesDepuisT0(T0, '2026-10-09T22:00')).toBe(-30)
    expect(minutesDepuisT0(T0, 'demain')).toBeNull()
    expect(instantDepuisT0(T0, 3360)).toBe('2026-10-12T06:30')
  })

  it('ignore le passage à l’heure d’hiver (nuit du 24 au 25 octobre 2026)', () => {
    expect(minutesDepuisT0('2026-10-24T22:00', '2026-10-25T06:00')).toBe(8 * 60)
  })
})

describe('affichage au format du métier', () => {
  it('écrit « Ve 22h30 » le soir', () => {
    expect(formaterHoraire(T0, 0)).toBe('Ve 22h30')
  })

  it('écrit « Ve/Sa 01h30 » la nuit, avant 6 h', () => {
    expect(formaterHoraire(T0, 180)).toBe('Ve/Sa 01h30')
    expect(formaterHoraire(T0, 90)).toBe('Ve/Sa 00h00')
    expect(formaterHoraire(T0, 449)).toBe('Ve/Sa 05h59')
    expect(formaterHoraire(T0, 450)).toBe('Sa 06h00')
  })

  it('suit les jours sur trois minuits, jusqu’au lundi matin', () => {
    expect(formaterHoraire(T0, 24 * 60)).toBe('Sa 22h30')
    expect(formaterHoraire(T0, 24 * 60 + 240)).toBe('Sa/Di 02h30')
    expect(formaterHoraire(T0, 2 * 24 * 60 + 180)).toBe('Di/Lu 01h30')
    expect(formaterHoraire(T0, 3360)).toBe('Lu 06h30')
  })

  it('passe du dimanche au lundi et du samedi au dimanche', () => {
    expect(formaterHoraire('2026-10-11T23:00', 120)).toBe('Di/Lu 01h00')
    expect(formaterHoraire('2026-10-10T23:00', 120)).toBe('Sa/Di 01h00')
  })

  it('écrit une plage « début → fin »', () => {
    expect(formaterPlage(T0, 0, 3360)).toBe('Ve 22h30 → Lu 06h30')
    expect(formaterPlage(T0, 0, 180)).toBe('Ve 22h30 → Ve/Sa 01h30')
  })

  it('écrit une durée lisible', () => {
    expect(formaterDuree(45)).toBe('45 min')
    expect(formaterDuree(180)).toBe('3 h')
    expect(formaterDuree(90)).toBe('1 h 30')
    expect(formaterDuree(3360)).toBe('56 h')
  })

  it('ne plante pas sur un T0 illisible', () => {
    expect(formaterHoraire('n’importe quoi', 10)).toBe('?')
  })
})
