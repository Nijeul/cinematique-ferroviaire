import { describe, expect, it } from 'vitest'
import { segmentsDeCouche } from '../src/state/segments.ts'
import type { EtatZoneScene } from '../src/state/etatScene.ts'
import { ETAT_INITIAL_DEFAUT } from '../src/domain/etats.ts'

const zoneSansFront: EtatZoneScene = { couches: { ...ETAT_INITIAL_DEFAUT }, fronts: [] }

describe('segmentsDeCouche', () => {
  it('rend un segment unique sans front', () => {
    expect(segmentsDeCouche(zoneSansFront, 'rails')).toEqual([
      { de: 0, a: 1, valeur: 'poses' },
    ])
  })

  it('coupe la zone à la fraction du front, dans le sens des PK croissants', () => {
    const zone: EtatZoneScene = {
      couches: { ...ETAT_INITIAL_DEFAUT },
      fronts: [
        { couche: 'ballast', de: 'ancien', vers: 'deballaste', sens: 'pk_croissant', fraction: 0.3, operation: 'op' },
      ],
    }
    expect(segmentsDeCouche(zone, 'ballast')).toEqual([
      { de: 0, a: 0.3, valeur: 'deballaste' },
      { de: 0.3, a: 1, valeur: 'ancien' },
    ])
  })

  it('coupe depuis l’autre extrémité dans le sens des PK décroissants', () => {
    const zone: EtatZoneScene = {
      couches: { ...ETAT_INITIAL_DEFAUT },
      fronts: [
        { couche: 'ballast', de: 'ancien', vers: 'deballaste', sens: 'pk_decroissant', fraction: 0.3, operation: 'op' },
      ],
    }
    expect(segmentsDeCouche(zone, 'ballast')).toEqual([
      { de: 0, a: 0.7, valeur: 'ancien' },
      { de: 0.7, a: 1, valeur: 'deballaste' },
    ])
  })

  it('compose deux opérations simultanées dans l’ordre du phasage', () => {
    // Répartition (avancée à 0,6) rattrapée par la pose (avancée à 0,4).
    const zone: EtatZoneScene = {
      couches: { ...ETAT_INITIAL_DEFAUT, traverses: 'absentes' },
      fronts: [
        { couche: 'traverses', de: 'absentes', vers: 'neuves_reparties', sens: 'pk_croissant', fraction: 0.6, operation: 'op-a' },
        { couche: 'traverses', de: 'absentes', vers: 'neuves_posees', sens: 'pk_croissant', fraction: 0.4, operation: 'op-b' },
      ],
    }
    expect(segmentsDeCouche(zone, 'traverses')).toEqual([
      { de: 0, a: 0.4, valeur: 'neuves_posees' },
      { de: 0.4, a: 0.6, valeur: 'neuves_reparties' },
      { de: 0.6, a: 1, valeur: 'absentes' },
    ])
  })

  it('ignore les fronts des autres couches', () => {
    const zone: EtatZoneScene = {
      couches: { ...ETAT_INITIAL_DEFAUT },
      fronts: [
        { couche: 'ballast', de: 'ancien', vers: 'deballaste', sens: 'pk_croissant', fraction: 0.5, operation: 'op' },
      ],
    }
    expect(segmentsDeCouche(zone, 'rails')).toEqual([{ de: 0, a: 1, valeur: 'poses' }])
  })
})
