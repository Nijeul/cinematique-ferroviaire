import { describe, expect, it } from 'vitest'
import { cadreImage, transformationImage, type Ancrage } from '../src/geometry/ancrage.ts'

describe('transformationImage', () => {
  it('déduit l’échelle d’une image alignée sur les axes', () => {
    const ancrages: [Ancrage, Ancrage] = [
      { pixel: [100, 500], monde: [0, 0] },
      { pixel: [1100, 500], monde: [500, 0] },
    ]
    const transformation = transformationImage(ancrages)
    expect(transformation.echelle).toBeCloseTo(0.5)
    expect(transformation.angle).toBeCloseTo(0)
    expect(transformation.versMonde(600, 500)).toEqual([250, 0])
    // L'axe pixel y descend : 100 px plus bas = 50 m plus au sud.
    const [, y] = transformation.versMonde(100, 600)
    expect(y).toBeCloseTo(-50)
  })

  it('déduit une rotation quand l’image est inclinée', () => {
    // Le segment pixel horizontal correspond à un segment monde à 90°.
    const ancrages: [Ancrage, Ancrage] = [
      { pixel: [0, 0], monde: [0, 0] },
      { pixel: [100, 0], monde: [0, 100] },
    ]
    const transformation = transformationImage(ancrages)
    expect(transformation.angle).toBeCloseTo(Math.PI / 2)
    expect(transformation.versMonde(100, 0)[1]).toBeCloseTo(100)
  })

  it('refuse deux ancrages confondus', () => {
    expect(() =>
      transformationImage([
        { pixel: [10, 10], monde: [0, 0] },
        { pixel: [10, 10], monde: [5, 5] },
      ]),
    ).toThrow('distincts')
  })
})

describe('cadreImage', () => {
  it('pose le rectangle image dans le monde', () => {
    const cadre = cadreImage(
      [
        { pixel: [0, 1000], monde: [0, 0] },
        { pixel: [2000, 1000], monde: [1000, 0] },
      ],
      2000,
      1000,
    )
    expect(cadre.largeur).toBeCloseTo(1000)
    expect(cadre.hauteur).toBeCloseTo(500)
    expect(cadre.centre[0]).toBeCloseTo(500)
    expect(cadre.centre[1]).toBeCloseTo(250)
  })
})
