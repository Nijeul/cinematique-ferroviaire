import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chargerProjet } from '../src/domain/chargement.ts'
import type { Projet } from '../src/domain/projet.ts'
import { creerCourbe, poseSurCourbe } from '../src/geometry/courbe.ts'
import { abscisseSurVoie, courbeDeVoie, pose } from '../src/geometry/referencement.ts'
import { posesRegulieres, rubanRectangulaire } from '../src/geometry/ruban.ts'

const chargerFixture = (nom: string): Projet => {
  const resultat = chargerProjet(
    readFileSync(new URL(`../fixtures/${nom}`, import.meta.url), 'utf-8'),
  )
  if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
  return resultat.projet
}

describe('courbe', () => {
  const droite = creerCourbe([[0, 0], [100, 0]])
  const coudee = creerCourbe([[0, 0], [100, 0], [100, 50]])

  it('mesure la longueur d’une polyligne', () => {
    expect(droite.longueur).toBe(100)
    expect(coudee.longueur).toBe(150)
    expect(creerCourbe([[0, 0], [3, 4]]).longueur).toBe(5)
  })

  it('positionne un point à une abscisse donnée', () => {
    expect(poseSurCourbe(droite, 40)).toEqual({ x: 40, y: 0, angle: 0 })
    const apresCoude = poseSurCourbe(coudee, 120)
    expect(apresCoude.x).toBeCloseTo(100)
    expect(apresCoude.y).toBeCloseTo(20)
    expect(apresCoude.angle).toBeCloseTo(Math.PI / 2)
  })

  it('décale perpendiculairement à la voie', () => {
    expect(poseSurCourbe(droite, 40, 2).y).toBeCloseTo(2)
    // Après le coude, la voie monte en +y : la gauche est en -x.
    expect(poseSurCourbe(coudee, 120, 2).x).toBeCloseTo(98)
  })

  it('borne l’abscisse sans extrapoler', () => {
    expect(poseSurCourbe(droite, -10).x).toBe(0)
    expect(poseSurCourbe(droite, 500).x).toBe(100)
  })
})

describe('référencement PK', () => {
  it('convertit PK en abscisse via pkOrigine', () => {
    const voie = { id: 'v', nom: 'V', polyligne: [[0, 0], [640, 0]] as [number, number][], pkOrigine: 100.0 }
    expect(abscisseSurVoie(voie, 100.13)).toBeCloseTo(130)
    expect(pose(voie, 100.13).x).toBeCloseTo(130)
    expect(pose(voie, 100.13, 3).y).toBeCloseTo(3)
  })

  it.each(['ocp1-sud.cinef', 'chantier-test.cinef'])(
    'place chaque zone et chaque appareil de %s sur sa voie',
    (nom) => {
      const projet = chargerFixture(nom)
      const voies = new Map(projet.site.voies.map((v) => [v.id, v]))
      for (const zone of projet.site.zones) {
        const voie = voies.get(zone.voie)!
        const courbe = courbeDeVoie(voie)
        expect(abscisseSurVoie(voie, zone.pkDebut), `${zone.id} début`).toBeGreaterThanOrEqual(0)
        expect(abscisseSurVoie(voie, zone.pkFin), `${zone.id} fin`).toBeLessThanOrEqual(
          courbe.longueur + 0.01,
        )
      }
      for (const adv of projet.site.appareils) {
        const voie = voies.get(adv.voieDirecte)!
        const s = abscisseSurVoie(voie, adv.pkPointe)
        expect(s, adv.id).toBeGreaterThanOrEqual(0)
        expect(s, adv.id).toBeLessThanOrEqual(courbeDeVoie(voie).longueur)
      }
    },
  )
})

describe('rubans et poses régulières', () => {
  const courbe = creerCourbe([[0, 0], [100, 0]])

  it('maille un ruban fermé le long de la courbe', () => {
    const maille = rubanRectangulaire(courbe, 10, 50, { largeur: 4, base: 0, hauteur: 0.3 })
    expect(maille.positions.length % 12).toBe(0)
    expect(maille.indices.length % 3).toBe(0)
    // Tous les sommets restent dans l'emprise attendue.
    for (let i = 0; i < maille.positions.length; i += 3) {
      expect(maille.positions[i]).toBeGreaterThanOrEqual(10)
      expect(maille.positions[i]).toBeLessThanOrEqual(50)
      expect(maille.positions[i + 2]).toBeGreaterThanOrEqual(-2)
      expect(maille.positions[i + 2]).toBeLessThanOrEqual(2)
    }
  })

  it('espace les traverses au pas demandé', () => {
    const poses = posesRegulieres(courbe, 0, 60, 0.6)
    expect(poses).toHaveLength(100)
    expect(poses[1].x - poses[0].x).toBeCloseTo(0.6)
  })
})
