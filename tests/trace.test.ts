import { describe, expect, it } from 'vitest'
import {
  abscissesDesPoints,
  bandeAutour,
  bornerAbscisse,
  longueurPolyligne,
  pointAAbscisse,
  projeterSurPolyligne,
  sousPolyligne,
} from '../src/plan/trace.ts'

const P = (x: number, y: number) => ({ x, y })
// Une voie en L : 300 vers la droite, puis 400 vers le bas.
const coude = [P(0, 0), P(300, 0), P(300, 400)]

describe('abscisse curviligne', () => {
  it('mesure la distance parcourue le long du tracé', () => {
    expect(abscissesDesPoints(coude)).toEqual([0, 300, 700])
    expect(longueurPolyligne(coude)).toBe(700)
    expect(longueurPolyligne([P(0, 0), P(3, 4)])).toBe(5)
    expect(longueurPolyligne([])).toBe(0)
  })

  it('ramène une abscisse sur la voie', () => {
    expect(bornerAbscisse(coude, -20)).toBe(0)
    expect(bornerAbscisse(coude, 900)).toBe(700)
    expect(bornerAbscisse(coude, Number.NaN)).toBe(0)
  })
})

describe('point et direction à une abscisse', () => {
  it('suit le premier segment puis le second après le coude', () => {
    expect(pointAAbscisse(coude, 100)).toEqual({ point: P(100, 0), direction: P(1, 0) })
    expect(pointAAbscisse(coude, 500)).toEqual({ point: P(300, 200), direction: P(0, 1) })
  })

  it('au coude, prend la direction du segment qui arrive', () => {
    expect(pointAAbscisse(coude, 300)).toEqual({ point: P(300, 0), direction: P(1, 0) })
  })

  it('au-delà des bouts, reste sur le premier ou le dernier point', () => {
    expect(pointAAbscisse(coude, -5).point).toEqual(P(0, 0))
    expect(pointAAbscisse(coude, 5000)).toEqual({ point: P(300, 400), direction: P(0, 1) })
  })

  it('ignore les points doublés', () => {
    expect(pointAAbscisse([P(0, 0), P(0, 0), P(0, 10)], 4)).toEqual({ point: P(0, 4), direction: P(0, 1) })
  })
})

describe('projection d’un point sur une voie', () => {
  it('donne l’abscisse et la distance du point le plus proche', () => {
    expect(projeterSurPolyligne(coude, P(120, -8))).toEqual({ abscisse: 120, distance: 8, point: P(120, 0) })
    expect(projeterSurPolyligne(coude, P(310, 250))).toEqual({ abscisse: 550, distance: 10, point: P(300, 250) })
  })

  it('bute sur les bouts de la voie', () => {
    const avant = projeterSurPolyligne(coude, P(-30, 40))
    expect(avant.abscisse).toBe(0)
    expect(avant.distance).toBe(50)
  })
})

describe('portion de voie entre deux abscisses', () => {
  it('garde le coude quand la portion l’enjambe', () => {
    expect(sousPolyligne(coude, 200, 450)).toEqual([P(200, 0), P(300, 0), P(300, 150)])
  })

  it('accepte les abscisses dans n’importe quel ordre', () => {
    expect(sousPolyligne(coude, 450, 200)).toEqual(sousPolyligne(coude, 200, 450))
  })

  it('reste sur un segment sans coude', () => {
    expect(sousPolyligne(coude, 20, 80)).toEqual([P(20, 0), P(80, 0)])
  })

  it('réduit une portion de longueur nulle à un point', () => {
    expect(sousPolyligne(coude, 300, 300)).toEqual([P(300, 0)])
  })
})

describe('bande autour d’un tracé', () => {
  it('entoure un segment droit d’un rectangle', () => {
    const bande = bandeAutour([P(0, 0), P(100, 0)], 10)
    expect(bande).toHaveLength(4)
    const ys = bande.map((p) => p.y).sort((a, b) => a - b)
    expect(ys).toEqual([-10, -10, 10, 10])
    expect(bande.map((p) => p.x).sort((a, b) => a - b)).toEqual([0, 0, 100, 100])
  })

  it('fait un angle droit net au coude (onglet)', () => {
    const bande = bandeAutour([P(0, 0), P(300, 0), P(300, 400)], 10)
    expect(bande).toHaveLength(6)
    // Les deux coins du coude : extérieur (310, -10) et intérieur (290, 10).
    const coins = [bande[1], bande[4]].map((p) => [Math.round(p.x), Math.round(p.y)])
    expect(coins).toContainEqual([310, -10])
    expect(coins).toContainEqual([290, 10])
  })

  it('écrête un coude très aigu', () => {
    const bande = bandeAutour([P(0, 0), P(100, 0), P(0, 1)], 10)
    for (const p of bande) expect(Math.hypot(p.x - 100, p.y)).toBeLessThanOrEqual(100 + 40.01)
  })

  it('ne dessine rien pour un tracé sans longueur', () => {
    expect(bandeAutour([P(5, 5)], 10)).toEqual([])
    expect(bandeAutour([P(5, 5), P(5, 5)], 10)).toEqual([])
  })
})
