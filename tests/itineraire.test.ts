import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { reseau, itineraire, surItineraire } from '../src/plan/itineraire.ts'
import { lireProjet } from '../src/plan/lecture.ts'
import type { Appareil, Point, Projet, Voie } from '../src/plan/projet.ts'
import { longueurPolyligne, pointAAbscisse, projeterSurPolyligne } from '../src/plan/trace.ts'
import { silhouetteRameSurTrace, type Vehicule } from '../src/plan/engins.ts'

// Plan d'exemple : VC (y = 360), V1 (y = 460), V2 (y = 560, coudée au bout) ;
// BS 1 : pointe sur VC à l'abscisse 520 (x = 700), talon sur V1 à 590
// (x = 770) ; communication BS 2a / BS 2b entre V1 (700, x = 880) et V2
// (770, x = 950). Toutes les branches partent vers la droite (le Sud).
const projet = (): Projet => {
  const lu = lireProjet(readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8'))
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.projet
}

const VC = 'voie-2'
const V1 = 'voie-3'
const V2 = 'voie-4'
const PELLE = 38
const MARGE = 20

const passePar = (points: Point[], p: Point) => points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-6)

describe('réseau des appareils', () => {
  it('un BS est une branche ; une communication (deux BS) un seul passage ; le sens de départ de chaque bout', () => {
    const r = reseau(projet())
    expect(r.branches.map((b) => b.id)).toEqual(['bs-1', 'com-1'])
    const [bs1, com] = r.branches
    // BS 1 : la branche part de VC vers la droite (+1), et arrive sur V1 depuis la gauche (-1).
    expect(bs1.a).toMatchObject({ voieId: VC, abscisse: 520, cote: 1, point: { x: 700, y: 360 } })
    expect(bs1.b).toMatchObject({ voieId: V1, abscisse: 590, cote: -1, point: { x: 770, y: 460 } })
    expect(bs1.longueur).toBeCloseTo(Math.hypot(70, 100), 9)
    expect(com.nom).toBe('BS 2a / BS 2b')
    expect(com.a).toMatchObject({ voieId: V1, abscisse: 700, cote: 1 })
    expect(com.b).toMatchObject({ voieId: V2, abscisse: 770, cote: -1 })
  })
})

describe('itinéraire à travers les appareils', () => {
  it('V1 → V2 par la communication : la polyligne passe exactement par la pointe et le talon, sans rebroussement', () => {
    const it = itineraire(projet(), { voieId: V1, abscisse: 300 }, { voieId: V2, abscisse: 1000 }, PELLE, MARGE)!
    expect(it).not.toBeNull()
    expect(it.appareils).toEqual(['BS 2a / BS 2b'])
    expect(it.rebroussements).toEqual([])
    expect(passePar(it.points, { x: 880, y: 460 })).toBe(true)
    expect(passePar(it.points, { x: 950, y: 560 })).toBe(true)
    // Départ et arrivée exacts, longueur = chemin parcouru.
    expect(it.points[0]).toEqual({ x: 480, y: 460 })
    expect(it.points[it.points.length - 1]).toEqual(pointAAbscisse(projet().voies[3].points, 1000).point)
    expect(it.longueur).toBeCloseTo(longueurPolyligne(it.points), 9)
    expect(it.longueur).toBeCloseTo(400 + Math.hypot(70, 100) + 230, 9)
    expect(it.passages).toHaveLength(2)
  })

  it('par le BS 1 en venant du côté de la pointe : sans rebroussement', () => {
    const it = itineraire(projet(), { voieId: VC, abscisse: 300 }, { voieId: V1, abscisse: 800 }, PELLE, MARGE)!
    expect(it.appareils).toEqual(['BS 1'])
    expect(it.rebroussements).toEqual([])
    expect(it.troncons).toHaveLength(1)
    expect(it.sensDepart).toBe(1)
    expect(it.sensArrivee).toBe(1)
  })

  it('par le BS 1 en venant du côté du talon : un rebroussement, l’engin entier dépasse l’appareil', () => {
    const it = itineraire(projet(), { voieId: VC, abscisse: 1000 }, { voieId: V1, abscisse: 800 }, PELLE, MARGE)!
    expect(it.appareils).toEqual(['BS 1'])
    expect(it.rebroussements).toHaveLength(1)
    expect(it.troncons).toHaveLength(2)
    expect(it.sensDepart).toBe(-1)
    expect(it.sensArrivee).toBe(1)
    // Le milieu va au-delà de la pointe (x = 700) de la demi-longueur plus
    // la marge : la queue a dégagé l'appareil.
    const bout = pointAAbscisse(it.points, it.rebroussements[0]).point
    expect(bout).toEqual({ x: 700 - (PELLE / 2 + MARGE), y: 360 })
    expect(700 - bout.x - PELLE / 2).toBeGreaterThanOrEqual(MARGE)
    // Puis il revient, prend la branche et roule sur V1.
    expect(passePar(it.points, { x: 770, y: 460 })).toBe(true)
    expect(it.longueur).toBeCloseTo(480 + 2 * (PELLE / 2 + MARGE) + Math.hypot(70, 100) + 210, 9)
  })

  it('voies que rien ne relie : pas d’itinéraire (fondu)', () => {
    expect(itineraire(projet(), { voieId: 'voie-1', abscisse: 100 }, { voieId: V1, abscisse: 800 }, PELLE, MARGE)).toBeNull()
    expect(itineraire(projet(), { voieId: 'inconnue', abscisse: 100 }, { voieId: V1, abscisse: 800 }, PELLE, MARGE)).toBeNull()
  })

  it('le plus court des deux itinéraires possibles', () => {
    const voie = (id: string, y: number): Voie => ({ id, nom: id, couleur: '#454f59', epaisseur: 8, points: [{ x: 0, y }, { x: 2000, y }] })
    const bs = (id: string, x: number): Appareil => ({
      id,
      nom: id,
      pointe: { voieId: 'A', abscisse: x },
      talon: { voieId: 'B', abscisse: x + 80 },
      communication: null,
    })
    const plan = { voies: [voie('A', 0), voie('B', 100)], appareils: [bs('loin', 200), bs('pres', 1000)] }
    const it = itineraire(plan, { voieId: 'A', abscisse: 900 }, { voieId: 'B', abscisse: 1500 }, PELLE, MARGE)!
    expect(it.appareils).toEqual(['pres'])
    expect(it.rebroussements).toEqual([])
    // Depuis 1100, le plus court passe aussi par « pres », en rebroussant.
    const retour = itineraire(plan, { voieId: 'A', abscisse: 1100 }, { voieId: 'B', abscisse: 1500 }, PELLE, MARGE)!
    expect(retour.appareils).toEqual(['pres'])
    expect(retour.rebroussements).toHaveLength(1)
  })

  it('rame : chaque véhicule reste sur la polyligne, et la tête s’inverse au rebroussement', () => {
    const vehicules: Vehicule[] = [
      { typeId: 'loco', type: { categorie: 'Loco', modele: 'BB', longueur: 15, largeur: 3, couleur: '#66ff99' } },
      { typeId: 'wagon', type: { categorie: 'Wagon', modele: 'R39', longueur: 20, largeur: 3, couleur: '#ff9933' } },
      { typeId: 'wagon', type: { categorie: 'Wagon', modele: 'R39', longueur: 20, largeur: 3, couleur: '#ff9933' } },
    ]
    const echelle = { pixelsParMetre: 4 }
    const total = 55 * 4
    const it = itineraire(projet(), { voieId: VC, abscisse: 1100 }, { voieId: V1, abscisse: 900 }, total, MARGE)!
    expect(it.rebroussements).toHaveLength(1)
    // La tête (loco) devant au départ (sens de marche), derrière après le rebroussement.
    const tete = (u: number) => {
      const { troncon, abscisse, rang } = surItineraire(it, u)
      const sens = (rang % 2 === 0 ? 1 : -1) as 1 | -1
      const sil = silhouetteRameSurTrace(troncon.points, { abscisse, sens, vehicules }, echelle, 9)
      // Chaque véhicule est sur son tronçon (voies et branches comprises).
      for (const v of sil.vehicules) expect(projeterSurPolyligne(troncon.points, v.centre).distance).toBeLessThan(1e-6)
      return { tete: sil.vehicules[0].centre, queue: sil.vehicules[2].centre, rang }
    }
    const avant = tete(100)
    expect(avant.rang).toBe(0)
    expect(avant.tete.x).toBeLessThan(avant.queue.x) // roule vers la gauche, tête devant
    const apres = tete(it.rebroussements[0] + 50)
    expect(apres.rang).toBe(1)
    expect(apres.tete.x).toBeLessThan(apres.queue.x) // roule vers la droite : la tête est derrière
    // Toute la polyligne parcourue reste sur VC, la branche du BS 1 et V1.
    const r = reseau(projet())
    const surLeReseau = (p: Point) =>
      Math.abs(p.y - 360) < 1e-6 || Math.abs(p.y - 460) < 1e-6 || projeterSurPolyligne([r.branches[0].a.point, r.branches[0].b.point], p).distance < 1e-6
    expect(it.points.every(surLeReseau)).toBe(true)
  })
})
