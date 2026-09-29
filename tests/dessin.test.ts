import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  boutsAppareil,
  cotesEtiquettesZones,
  emprise,
  etiquetteAppareil,
  etiquetteZone,
  libelleSens,
  positionsExtremites,
  sensAppareil,
  triangleDePointe,
} from '../src/plan/dessin.ts'
import { modifierExtremites } from '../src/plan/edition.ts'
import { ajouterZone, inverserAppareil } from '../src/plan/elements.ts'
import { lireProjet } from '../src/plan/lecture.ts'
import { creerProjet, type Projet, type Zone } from '../src/plan/projet.ts'

const exemple = (): Projet => {
  const lu = lireProjet(readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8'))
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.projet
}

describe('sens d’un BS', () => {
  it('pointe à gauche du talon → côté gauche ; à droite → côté droit', () => {
    expect(sensAppareil({ x: 100, y: 0 }, { x: 180, y: 50 })).toBe('gauche')
    expect(sensAppareil({ x: 180, y: 50 }, { x: 100, y: 0 })).toBe('droite')
    expect(sensAppareil({ x: 100, y: 0 }, { x: 100, y: 50 })).toBeNull()
  })

  it('affiche « pointe côté … » avec les noms des extrémités du plan', () => {
    const projet = exemple()
    const bs = projet.appareils[0]
    expect(libelleSens(projet, bs)).toBe('pointe côté Nord')
    const renomme = modifierExtremites(projet, { gauche: 'Paris', droite: 'Poitiers' })
    expect(libelleSens(renomme, bs)).toBe('pointe côté Paris')
    const inverse = inverserAppareil(renomme, bs.id)
    expect(libelleSens(inverse, inverse.appareils[0])).toBe('pointe côté Poitiers')
  })

  it('donne à chaque BS d’une communication son propre sens', () => {
    const projet = exemple()
    expect(libelleSens(projet, projet.appareils[1])).toBe('pointe côté Nord')
    expect(libelleSens(projet, projet.appareils[2])).toBe('pointe côté Sud')
  })

  it('place les bouts sur les voies, avec l’épaisseur de la plus fine', () => {
    const bouts = boutsAppareil(exemple(), exemple().appareils[1])
    expect(bouts).toEqual({ pointe: { x: 880, y: 460 }, talon: { x: 950, y: 560 }, epaisseur: 9 })
  })
})

describe('triangle de pointe', () => {
  it('part de la pointe et pointe vers le talon', () => {
    const [a, sommet, b] = triangleDePointe({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(sommet.y).toBe(0)
    expect(sommet.x).toBeGreaterThan(a.x)
    expect(a.x).toBe(b.x)
    expect(a.x).toBeGreaterThanOrEqual(0)
    expect(Math.abs(a.y - b.y)).toBeCloseTo(20)
  })

  it('reste sur la première moitié d’un biais court', () => {
    const [, sommet] = triangleDePointe({ x: 0, y: 0 }, { x: 0, y: 20 }, 10)
    expect(sommet.y).toBeLessThanOrEqual(10)
  })

  it('rien pour un biais de longueur nulle', () => {
    expect(triangleDePointe({ x: 1, y: 1 }, { x: 1, y: 1 }, 10)).toEqual([])
  })
})

describe('étiquettes', () => {
  it('met les noms au-dessus tant qu’ils ne se chevauchent pas', () => {
    const cotes = cotesEtiquettesZones(exemple())
    // « RVB 50 m » et « RR 14 m » se touchent sur V1 mais leurs noms tiennent côte à côte.
    expect(cotes.get('zone-1')).toBe('dessus')
    expect(cotes.get('zone-2')).toBe('dessus')
    expect(cotes.get('zone-3')).toBe('dessus')
  })

  it('passe dessous le nom d’une zone voisine qui chevaucherait, puis revient dessus', () => {
    let projet = ajouterZone(exemple(), 'voie-3', 450, 480).projet
    projet = ajouterZone(projet, 'voie-3', 480, 500).projet
    projet = ajouterZone(projet, 'voie-3', 1000, 1100).projet
    const cotes = cotesEtiquettesZones(projet)
    expect(cotes.get('zone-5')).toBe('dessous')
    expect(cotes.get('zone-6')).toBe('dessus')
    expect(cotes.get('zone-7')).toBe('dessus')
  })

  it('place le nom d’une zone au-dessus ou au-dessous de la bande, centré', () => {
    const projet = exemple()
    const voie = projet.voies[2]
    const zone = projet.zones[0] as Zone
    const dessus = etiquetteZone(voie, zone, 'dessus')
    const dessous = etiquetteZone(voie, zone, 'dessous')
    expect(dessus).toMatchObject({ x: 180 + 315, ancre: 'middle' })
    expect(dessus.y).toBeLessThan(460 - 9)
    expect(dessous.y).toBeGreaterThan(460 + 9)
  })

  it('place le nom d’un appareil à droite de son biais', () => {
    const pos = etiquetteAppareil({ x: 0, y: 0 }, { x: 60, y: 100 }, 9)
    expect(pos.ancre).toBe('start')
    expect(pos.x).toBeGreaterThan(30)
  })

  it('au-dessus d’un biais presque horizontal', () => {
    const pos = etiquetteAppareil({ x: 0, y: 0 }, { x: 200, y: 20 }, 9)
    expect(pos.ancre).toBe('middle')
    expect(pos.y).toBeLessThan(10)
  })
})

describe('extrémités du plan', () => {
  it('Nord à gauche et Sud à droite par défaut', () => {
    expect(creerProjet().extremites).toEqual({ gauche: 'Nord', droite: 'Sud' })
  })

  it('se placent en haut de l’emprise dessinée, à gauche et à droite', () => {
    const projet = exemple()
    expect(emprise(projet)).toEqual({ x: 180, y: 240, largeur: 1260, hauteur: 430 })
    const pos = positionsExtremites(projet)
    expect(pos.gauche.x).toBe(180)
    expect(pos.droite.x).toBe(1440)
    expect(pos.gauche.y).toBeLessThan(240)
  })

  it('sans rien de dessiné, prennent la feuille entière sans en sortir', () => {
    const pos = positionsExtremites(creerProjet())
    expect(pos.gauche).toEqual({ x: 0, y: pos.taille * 1.2 })
    expect(pos.droite.x).toBe(1600)
  })
})
