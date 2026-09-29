import { describe, expect, it } from 'vitest'
import { deplacer, facteurMolette, recadrer, versEcran, versPlan, zoomerAutour, ZOOM_MAX, ZOOM_MIN, type Vue } from '../src/plan/vue.ts'

describe('passage écran ↔ plan', () => {
  const vue: Vue = { zoom: 2.5, dx: 40, dy: -12 }

  it('fait l’aller-retour sans perte', () => {
    const p = { x: 123.4, y: 56.7 }
    const retour = versPlan(vue, versEcran(vue, p))
    expect(retour.x).toBeCloseTo(p.x, 9)
    expect(retour.y).toBeCloseTo(p.y, 9)
  })

  it('applique le zoom puis le décalage', () => {
    expect(versEcran(vue, { x: 10, y: 20 })).toEqual({ x: 65, y: 38 })
  })
})

describe('zoom à la molette', () => {
  it('garde immobile le point du plan sous le curseur', () => {
    const vue: Vue = { zoom: 1, dx: 100, dy: 50 }
    const curseur = { x: 400, y: 300 }
    const avant = versPlan(vue, curseur)
    const apres = zoomerAutour(vue, curseur, 1.7)
    expect(apres.zoom).toBeCloseTo(1.7)
    const sous = versPlan(apres, curseur)
    expect(sous.x).toBeCloseTo(avant.x, 9)
    expect(sous.y).toBeCloseTo(avant.y, 9)
  })

  it('reste dans les bornes de zoom', () => {
    const vue: Vue = { zoom: 1, dx: 0, dy: 0 }
    expect(zoomerAutour(vue, { x: 0, y: 0 }, 1e6).zoom).toBe(ZOOM_MAX)
    expect(zoomerAutour(vue, { x: 0, y: 0 }, 1e-6).zoom).toBe(ZOOM_MIN)
  })

  it('zoome en avant quand la molette monte, en arrière quand elle descend', () => {
    expect(facteurMolette(-100)).toBeGreaterThan(1)
    expect(facteurMolette(100)).toBeLessThan(1)
    expect(facteurMolette(100) * facteurMolette(-100)).toBeCloseTo(1)
  })
})

describe('déplacement et recadrage', () => {
  it('déplace la vue sans changer le zoom', () => {
    expect(deplacer({ zoom: 3, dx: 1, dy: 2 }, 10, -5)).toEqual({ zoom: 3, dx: 11, dy: -3 })
  })

  it('montre tout le plan, centré, avec la marge demandée', () => {
    const plan = { largeur: 1600, hauteur: 900 }
    const ecran = { largeur: 1000, hauteur: 800 }
    const vue = recadrer(plan, ecran, 20)
    expect(vue.zoom).toBeCloseTo(960 / 1600)
    const hautGauche = versEcran(vue, { x: 0, y: 0 })
    const basDroit = versEcran(vue, { x: 1600, y: 900 })
    expect(hautGauche.x).toBeCloseTo(20)
    expect(basDroit.x).toBeCloseTo(980)
    // Centré verticalement.
    expect(hautGauche.y).toBeCloseTo(800 - basDroit.y)
  })

  it('ne casse pas sur une zone d’affichage vide', () => {
    expect(recadrer({ largeur: 100, hauteur: 100 }, { largeur: 0, hauteur: 0 })).toEqual({ zoom: 1, dx: 0, dy: 0 })
  })
})
