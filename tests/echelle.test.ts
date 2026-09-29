import { describe, expect, it } from 'vitest'
import {
  descriptionEchelle,
  echelleParDeuxPoints,
  echelleParLargeur,
  formaterMetres,
  formaterNombre,
  LARGEUR_TOILE_PAR_DEFAUT_M,
  lireNombre,
  longueurGraduee,
  metresVersPlan,
  planVersMetres,
} from '../src/plan/echelle.ts'
import { TOILE_PAR_DEFAUT } from '../src/plan/projet.ts'

const valeur = <T>(r: { ok: true; valeur: T } | { ok: false; erreur: string }): T => {
  if (!r.ok) throw new Error(r.erreur)
  return r.valeur
}

describe('calage de l’échelle', () => {
  it('par deux points et leur distance réelle', () => {
    // Deux repères à 400 px l'un de l'autre, 100 m sur le terrain : 4 px par mètre.
    expect(valeur(echelleParDeuxPoints({ x: 100, y: 200 }, { x: 500, y: 200 }, 100))).toEqual({ pixelsParMetre: 4 })
    // En biais : c'est la distance entre les points qui compte (3-4-5).
    expect(valeur(echelleParDeuxPoints({ x: 0, y: 0 }, { x: 300, y: 400 }, 250)).pixelsParMetre).toBeCloseTo(2)
  })

  it('refuse des points confondus, avec un message clair', () => {
    const r = echelleParDeuxPoints({ x: 100, y: 100 }, { x: 100.4, y: 100 }, 50)
    expect(r.ok).toBe(false)
    expect(r.ok || r.erreur).toContain('confondus')
  })

  it('refuse une distance nulle, négative ou absente', () => {
    for (const metres of [0, -10, NaN, Infinity]) {
      const r = echelleParDeuxPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, metres)
      expect(r.ok || r.erreur).toContain('plus grand que zéro')
    }
  })

  it('sans fond : la longueur réelle de la largeur de la toile (400 m par défaut)', () => {
    expect(LARGEUR_TOILE_PAR_DEFAUT_M).toBe(400)
    expect(valeur(echelleParLargeur(TOILE_PAR_DEFAUT.largeur, LARGEUR_TOILE_PAR_DEFAUT_M))).toEqual({ pixelsParMetre: 4 })
    expect(echelleParLargeur(1600, 0).ok).toBe(false)
  })

  it('décrit l’échelle en une ligne', () => {
    expect(descriptionEchelle({ pixelsParMetre: 4 }, 1600)).toBe('1 m = 4 px du plan · la largeur du plan fait 400 m')
    expect(descriptionEchelle({ pixelsParMetre: 2.5 }, 1200)).toBe('1 m = 2,5 px du plan · la largeur du plan fait 480 m')
  })
})

describe('conversions mètres ↔ unités du plan', () => {
  it('dans les deux sens', () => {
    const e = { pixelsParMetre: 4 }
    expect(metresVersPlan(e, 19.9)).toBeCloseTo(79.6)
    expect(planVersMetres(e, 79.6)).toBeCloseTo(19.9)
    expect(planVersMetres(e, metresVersPlan(e, 32.8))).toBeCloseTo(32.8)
  })
})

describe('saisie et affichage des longueurs', () => {
  it('lit un nombre tapé à la française ou à l’anglaise', () => {
    expect(lireNombre('14,5')).toBe(14.5)
    expect(lireNombre(' 100 ')).toBe(100)
    expect(lireNombre('15.64')).toBe(15.64)
    expect(lireNombre('')).toBeNull()
    expect(lireNombre('abc')).toBeNull()
    expect(lireNombre('1,5,3')).toBeNull()
  })

  it('écrit « 213,5 m », « 15,64 m », « 14 m », « 1 250 m »', () => {
    expect(formaterMetres(14.5 + 10 * 19.9)).toBe('213,5 m')
    expect(formaterMetres(15.64)).toBe('15,64 m')
    expect(formaterMetres(14)).toBe('14 m')
    expect(formaterMetres(1250)).toBe('1 250 m')
    expect(formaterNombre(400)).toBe('400')
    expect(formaterNombre(9.64)).toBe('9,64')
  })
})

describe('échelle graphique : longueur ronde adaptée au zoom', () => {
  it('prend la plus grande longueur 1, 2 ou 5 × 10ⁿ qui tient', () => {
    // 2 px par mètre à l'écran, 170 px au plus : 50 m (100 px).
    expect(longueurGraduee(2, 170)).toEqual({ metres: 50, longueur: 100 })
    expect(longueurGraduee(3, 170)).toEqual({ metres: 50, longueur: 150 })
    expect(longueurGraduee(1, 170)).toEqual({ metres: 100, longueur: 100 })
    expect(longueurGraduee(0.1, 170).metres).toBe(1000)
    expect(longueurGraduee(10, 170).metres).toBe(10)
    expect(longueurGraduee(40, 170).metres).toBe(2)
  })

  it('suit le zoom : zoomer ×4 raccourcit la longueur ronde', () => {
    const loin = longueurGraduee(4 * 0.25, 170)
    const pres = longueurGraduee(4 * 1, 170)
    expect(loin.metres).toBeGreaterThan(pres.metres)
    expect(pres.longueur).toBeLessThanOrEqual(170)
  })
})
