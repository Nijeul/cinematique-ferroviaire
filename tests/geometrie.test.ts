import { describe, expect, it } from 'vitest'
import {
  contraindre,
  distancePointPolyligne,
  distancePointSegment,
  pointSousPointeur,
  positionNom,
  tailleNom,
  terminerTrace,
  voieSousPointeur,
} from '../src/plan/geometrie.ts'
import type { Voie } from '../src/plan/projet.ts'

const voie = (id: string, points: [number, number][], epaisseur = 8): Voie => ({
  id,
  nom: id,
  couleur: '#454f59',
  epaisseur,
  points: points.map(([x, y]) => ({ x, y })),
})

describe('contrainte Maj', () => {
  const depart = { x: 100, y: 100 }

  it('rend un segment presque horizontal exactement horizontal', () => {
    expect(contraindre(depart, { x: 300, y: 112 })).toEqual({ x: 300, y: 100 })
    expect(contraindre(depart, { x: -50, y: 95 })).toEqual({ x: -50, y: 100 })
  })

  it('rend un segment presque vertical exactement vertical', () => {
    expect(contraindre(depart, { x: 108, y: 400 })).toEqual({ x: 100, y: 400 })
  })

  it('ramène un segment oblique sur 45°', () => {
    const p = contraindre(depart, { x: 200, y: 190 })
    expect(p.x - depart.x).toBeCloseTo(p.y - depart.y, 9)
    expect(p.x).toBeCloseTo(195, 9)
    const q = contraindre(depart, { x: 0, y: 205 })
    expect(q.x - depart.x).toBeCloseTo(-(q.y - depart.y), 9)
  })

  it('laisse le point de départ tel quel si la souris n’a pas bougé', () => {
    expect(contraindre(depart, depart)).toEqual(depart)
  })
})

describe('distances pour la sélection', () => {
  it('mesure la distance à un segment, extrémités comprises', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 10, y: 0 }
    expect(distancePointSegment({ x: 5, y: 3 }, a, b)).toBe(3)
    expect(distancePointSegment({ x: 13, y: 4 }, a, b)).toBe(5)
    expect(distancePointSegment({ x: 3, y: 4 }, a, a)).toBe(5)
  })

  it('prend le segment le plus proche d’une polyligne', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    expect(distancePointPolyligne({ x: 12, y: 6 }, points)).toBe(2)
    expect(distancePointPolyligne({ x: 1, y: 1 }, [])).toBe(Infinity)
  })

  it('trouve la voie sous le pointeur en tenant compte de son épaisseur', () => {
    const voies = [voie('haut', [[0, 0], [100, 0]], 10), voie('bas', [[0, 40], [100, 40]], 10)]
    // 8 du centre = 3 du bord de la bande : dans une tolérance de 4.
    expect(voieSousPointeur(voies, { x: 50, y: 8 }, 4)).toBe('haut')
    expect(voieSousPointeur(voies, { x: 50, y: 33 }, 4)).toBe('bas')
    expect(voieSousPointeur(voies, { x: 50, y: 20 }, 4)).toBeNull()
  })

  it('préfère la voie dessinée au-dessus quand deux se superposent', () => {
    const voies = [voie('dessous', [[0, 0], [100, 0]]), voie('dessus', [[0, 0], [100, 0]])]
    expect(voieSousPointeur(voies, { x: 50, y: 1 }, 4)).toBe('dessus')
  })

  it('trouve la poignée la plus proche dans la tolérance', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 12, y: 0 }]
    expect(pointSousPointeur(points, { x: 11.8, y: 0.5 }, 3)).toBe(2)
    expect(pointSousPointeur(points, { x: 5, y: 5 }, 3)).toBeNull()
  })
})

describe('fin de tracé', () => {
  it('retire le point doublé par le double-clic final', () => {
    const points = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50.5, y: 0.2 }]
    expect(terminerTrace(points, 2)).toEqual([{ x: 0, y: 0 }, { x: 50, y: 0 }])
  })

  it('refuse une voie de moins de deux points distincts', () => {
    expect(terminerTrace([{ x: 0, y: 0 }, { x: 1, y: 0 }], 2)).toBeNull()
    expect(terminerTrace([], 2)).toBeNull()
  })
})

describe('position du nom de voie', () => {
  it('garde les proportions de l’aperçu : nom d’environ 15 px pour une bande de 8,5 px', () => {
    expect(tailleNom(8.5)).toBe(16)
    expect(tailleNom(20)).toBeGreaterThan(tailleNom(9))
  })

  it('place le nom à gauche d’une voie tracée vers la droite, aligné à droite', () => {
    const pos = positionNom(voie('v', [[100, 200], [500, 200]], 9))
    expect(pos.ancre).toBe('end')
    expect(pos.x).toBeLessThan(100)
  })

  it('place le nom à droite d’une voie tracée vers la gauche', () => {
    const pos = positionNom(voie('v', [[500, 200], [100, 200]], 9))
    expect(pos.ancre).toBe('start')
    expect(pos.x).toBeGreaterThan(500)
  })

  it('centre le nom au-dessus d’une voie tracée vers le bas', () => {
    const pos = positionNom(voie('v', [[100, 200], [100, 600]], 9))
    expect(pos.ancre).toBe('middle')
    expect(pos.y).toBeLessThan(200)
  })
})
