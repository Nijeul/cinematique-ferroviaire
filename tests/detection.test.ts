import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { accrocherVoie, boiteTexte, elementSousPointeur, poigneesDe, poigneeSousPointeur } from '../src/plan/detection.ts'
import { modifierCalque } from '../src/plan/edition.ts'
import { lireProjet } from '../src/plan/lecture.ts'
import type { Projet } from '../src/plan/projet.ts'

const exemple = (): Projet => {
  const lu = lireProjet(readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8'))
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.projet
}

const sous = (projet: Projet, x: number, y: number) => elementSousPointeur(projet, { x, y }, 4)

describe('élément sous le pointeur', () => {
  it('trouve une voie hors de toute zone', () => {
    expect(sous(exemple(), 1300, 462)).toEqual({ genre: 'voie', id: 'voie-3' })
  })

  it('préfère la zone à la voie qu’elle recouvre', () => {
    expect(sous(exemple(), 450, 470)).toEqual({ genre: 'zone', id: 'zone-1' })
  })

  it('trouve une zone qui passe un coude', () => {
    // « RVB 41 m » sur V2 enjambe le coude en (1100, 560).
    expect(sous(exemple(), 1120, 564)).toEqual({ genre: 'zone', id: 'zone-4' })
  })

  it('trouve un BS sur son biais', () => {
    expect(sous(exemple(), 735, 410)).toEqual({ genre: 'appareil', id: 'bs-1' })
  })

  it('dans une communication, choisit le BS dont la pointe est la plus proche', () => {
    // Biais de (880, 460) — pointe de BS 2a — à (950, 560) — pointe de BS 2b.
    expect(sous(exemple(), 890, 475)).toEqual({ genre: 'appareil', id: 'bs-2' })
    expect(sous(exemple(), 940, 545)).toEqual({ genre: 'appareil', id: 'bs-3' })
  })

  it('trouve un cadre en cliquant à l’intérieur', () => {
    expect(sous(exemple(), 400, 640)).toEqual({ genre: 'cadre', id: 'cadre-1' })
  })

  it('trouve un texte sur ses lettres', () => {
    const boite = boiteTexte(exemple().textes[0])
    expect(sous(exemple(), boite.x + boite.largeur / 2, boite.y + boite.hauteur / 2)).toEqual({ genre: 'texte', id: 'texte-1' })
  })

  it('rien dans le vide', () => {
    expect(sous(exemple(), 1500, 100)).toBeNull()
  })

  it('ignore les calques masqués ou verrouillés : on atteint le calque du dessous', () => {
    const sansZones = modifierCalque(exemple(), 'zones', { verrouille: true })
    expect(sous(sansZones, 450, 462)).toEqual({ genre: 'voie', id: 'voie-3' })
    const sansAppareils = modifierCalque(exemple(), 'appareils', { visible: false })
    expect(sous(sansAppareils, 735, 410)).toBeNull()
  })
})

describe('poignées', () => {
  it('aux deux bouts d’une zone, sur la voie', () => {
    expect(poigneesDe(exemple(), { genre: 'zone', id: 'zone-1' })).toEqual([
      { cle: 'debut', point: { x: 420, y: 460 } },
      { cle: 'fin', point: { x: 570, y: 460 } },
    ])
  })

  it('à la pointe et au talon d’un appareil', () => {
    expect(poigneesDe(exemple(), { genre: 'appareil', id: 'bs-1' }).map((p) => p.cle)).toEqual(['pointe', 'talon'])
  })

  it('aux quatre coins d’un cadre, aux points d’une voie, aucune pour un texte', () => {
    expect(poigneesDe(exemple(), { genre: 'cadre', id: 'cadre-1' })).toHaveLength(4)
    expect(poigneesDe(exemple(), { genre: 'voie', id: 'voie-1' }).map((p) => p.cle)).toEqual(['point-0', 'point-1', 'point-2'])
    expect(poigneesDe(exemple(), { genre: 'texte', id: 'texte-1' })).toEqual([])
  })

  it('trouve la poignée la plus proche dans la tolérance', () => {
    const poignees = poigneesDe(exemple(), { genre: 'cadre', id: 'cadre-1' })
    expect(poigneeSousPointeur(poignees, { x: 657, y: 668 }, 6)).toBe('coin-2')
    expect(poigneeSousPointeur(poignees, { x: 480, y: 640 }, 6)).toBeNull()
  })
})

describe('accrochage à une voie', () => {
  it('prend la voie la plus proche et l’abscisse du point projeté', () => {
    expect(accrocherVoie(exemple().voies, { x: 500, y: 452 }, 6)).toEqual({
      voieId: 'voie-3',
      abscisse: 320,
      point: { x: 500, y: 460 },
    })
  })

  it('refuse un clic trop loin de toute voie', () => {
    expect(accrocherVoie(exemple().voies, { x: 500, y: 410 }, 6)).toBeNull()
  })

  it('peut écarter une voie (talon sur une autre voie que la pointe)', () => {
    expect(accrocherVoie(exemple().voies, { x: 500, y: 460 }, 6, 'voie-3')).toBeNull()
    // Plus près de VC (y = 360) que de V2 (y = 560).
    expect(accrocherVoie(exemple().voies, { x: 500, y: 455 }, 100, 'voie-3')?.voieId).toBe('voie-2')
  })
})
