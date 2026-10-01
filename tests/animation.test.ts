import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  angleIntermediaire,
  apparier,
  contenuIntermediaire,
  ecartALaCorde,
  instantsIntermediaires,
  interpolerEtatZone,
  mouvementEngin,
  nombreIntermediaires,
  transition,
} from '../src/plan/animation.ts'
import { CATALOGUE_PAR_DEFAUT } from '../src/plan/catalogue.ts'
import type { Chantier } from '../src/plan/chantier.ts'
import { ajouterEngin, ajouterRame, silhouetteEngin, type Engin } from '../src/plan/engins.ts'
import { ETATS_PAR_DEFAUT } from '../src/plan/etatsVoie.ts'
import type { EtatZone } from '../src/plan/etatsZones.ts'
import { toleranceCorde } from '../src/plan/exportAnime.ts'
import { lireChantier } from '../src/plan/fichierChantier.ts'
import { projetDeImage, rectangleAffiche, type Synoptique } from '../src/plan/synoptique.ts'
import { pointAAbscisse, projeterSurPolyligne } from '../src/plan/trace.ts'

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const synoptique = (c: Chantier, id: string): Synoptique => c.synoptiques.find((s) => s.id === id)!
const liste = [...ETATS_PAR_DEFAUT]
const engin = (s: Synoptique, i: number, id: string): Engin => s.images[i].contenu.engins.find((e) => e.id === id)!

// Le synoptique « Nuit 5 » de la fixture : la pelle 1 roule sur V2 et passe
// le coude ; la pelle 2 passe de V1 à V2 par la communication ; la pelle 3
// entre sur V1 par le BS 1, pris par le talon (rebroussement) ; la pelle 4
// s'enraille ; le TTX 1 avance sur VC puis entre sur V1 par le BS 1 ; la
// zone RVB 50 m se déballaste depuis le Nord.
const nuit5 = () => synoptique(fixture(), 'synoptique-5')

describe('appariement d’une image à la suivante', () => {
  it('même identifiant et même type : le même engin ; sinon l’un disparaît et l’autre apparaît', () => {
    const s = nuit5()
    const a = s.images[0].contenu
    const autreType = { ...a.engins[0], typeId: 'type-8' }
    const b = { engins: [autreType, ...s.images[1].contenu.engins.slice(1)], rames: s.images[1].contenu.rames }
    const p = apparier(a, b)
    expect(p.engins.paires.map(([x]) => x.id)).toEqual(['engin-2', 'engin-3', 'engin-4'])
    expect(p.engins.disparus.map((x) => x.id)).toEqual(['engin-1'])
    expect(p.engins.apparus.map((x) => `${x.id} ${x.typeId}`)).toEqual(['engin-1 type-8'])
    expect(p.rames.paires).toHaveLength(1)
    // Une rame recomposée n'est plus la même.
    const recomposee = { ...b.rames[0], vehicules: b.rames[0].vehicules.slice(1) }
    expect(apparier(a, { engins: [], rames: [recomposee] }).rames).toMatchObject({ paires: [], disparus: [{ id: 'rame-1' }], apparus: [{ id: 'rame-1' }] })
  })
})

describe('mouvement d’un engin', () => {
  it('sur la même voie : il roule le long de la voie ; à mi-chemin dans le coude, son milieu est sur la voie', () => {
    const s = nuit5()
    const planA = projetDeImage(s, s.images[0])
    const m = mouvementEngin(planA, projetDeImage(s, s.images[1]), engin(s, 0, 'engin-1'), engin(s, 1, 'engin-1'))!
    expect(m.genre).toBe('voie')
    const v2 = planA.voies.find((v) => v.id === 'voie-4')!
    const milieu = m.en(0.5)
    expect(projeterSurPolyligne(v2.points, milieu.centre).distance).toBeLessThan(1e-9)
    expect(milieu.centre).toEqual(pointAAbscisse(v2.points, (650 + 1080) / 2).point)
    // Exactement A au départ, B à l'arrivée.
    expect(m.en(0)).toEqual(silhouetteEngin(planA, engin(s, 0, 'engin-1')))
    expect(m.en(1)).toEqual(silhouetteEngin(planA, engin(s, 1, 'engin-1')))
  })

  it('hors voie : il glisse et tourne au plus court (350° → 10° passe par 0°)', () => {
    expect(angleIntermediaire(350, 10, 0.5) % 360).toBeCloseTo(0, 9)
    expect(angleIntermediaire(10, 350, 0.25)).toBeCloseTo(5, 9)
    expect(Math.abs(angleIntermediaire(0, 180, 0.5))).toBeCloseTo(90, 9)
    const s = nuit5()
    const plan = projetDeImage(s, s.images[0])
    const a = engin(s, 0, 'engin-4')
    const libre = (x: number, angle: number): Engin => ({ ...a, position: { genre: 'libre', x, y: 645, angle } })
    const m = mouvementEngin(plan, plan, libre(400, 350), libre(500, 10))!
    expect(m.genre).toBe('libre')
    const milieu = m.en(0.5)
    expect(milieu.centre).toEqual({ x: 450, y: 645 })
    expect(Math.cos((milieu.angle * Math.PI) / 180)).toBeCloseTo(1, 9)
  })

  it('changement de voie par un appareil : à mi-chemin, l’engin est sur l’itinéraire', () => {
    const s = nuit5()
    const planA = projetDeImage(s, s.images[0])
    for (const id of ['engin-2', 'engin-3']) {
      const m = mouvementEngin(planA, projetDeImage(s, s.images[1]), engin(s, 0, id), engin(s, 1, id))!
      expect(m.genre).toBe('itineraire')
      for (const t of [0.25, 0.5, 0.7, 0.75]) expect(projeterSurPolyligne(m.itineraire!.points, m.en(t).centre).distance).toBeLessThan(1e-6)
    }
    // La pelle 3 rebrousse : elle passe sur le talon du BS 1 (770, 460).
    const m3 = mouvementEngin(planA, projetDeImage(s, s.images[1]), engin(s, 0, 'engin-3'), engin(s, 1, 'engin-3'))!
    expect(m3.itineraire!.rebroussements).toHaveLength(1)
    expect(m3.itineraire!.appareils).toEqual(['BS 1'])
  })

  it('enraillement (libre → voie) et voies non reliées : bascule à mi-chemin, donc un fondu', () => {
    const s = nuit5()
    const planA = projetDeImage(s, s.images[0])
    const planB = projetDeImage(s, s.images[1])
    const a = engin(s, 0, 'engin-4')
    const b = engin(s, 1, 'engin-4')
    const m = mouvementEngin(planA, planB, a, b)!
    expect(m.genre).toBe('bascule')
    expect(m.en(0.49)).toEqual(silhouetteEngin(planA, a))
    expect(m.en(0.5)).toEqual(silhouetteEngin(planB, b))
    const tiroir: Engin = { ...b, position: { genre: 'voie', voieId: 'voie-1', abscisse: 200 } }
    expect(mouvementEngin(planA, planB, engin(s, 0, 'engin-1'), { ...tiroir, id: 'engin-1' })!.genre).toBe('bascule')
  })
})

describe('états des zones', () => {
  const ze = (etat: string, avancement: EtatZone['avancement'] = null): EtatZone => ({ etat, avancement })

  it('« Nuit 2 », image 1 → 2 : la zone se déballaste de 0 à 40 % depuis la droite', () => {
    const s = synoptique(fixture(), 'synoptique-2')
    const a = s.images[0].contenu.etatsZones['zone-1']
    const b = s.images[1].contenu.etatsZones['zone-1']
    expect(interpolerEtatZone(a, b, 0, liste)).toBe(a)
    expect(interpolerEtatZone(a, b, 1, liste)).toBe(b)
    expect(interpolerEtatZone(a, b, 0.5, liste)).toEqual(ze('etat-3', { pourcentage: 20, depuis: 'droite', reste: 'etat-2' }))
  })

  it('deux états entiers : le nouveau avance depuis la gauche (Nord) ; un avancement poursuit son côté', () => {
    expect(interpolerEtatZone(ze('etat-4'), ze('etat-5'), 0.25, liste)).toEqual(ze('etat-5', { pourcentage: 25, depuis: 'gauche', reste: 'etat-4' }))
    const partiel = ze('etat-3', { pourcentage: 60, depuis: 'droite', reste: 'etat-2' })
    expect(interpolerEtatZone(partiel, ze('etat-3'), 0.5, liste)).toEqual(ze('etat-3', { pourcentage: 80, depuis: 'droite', reste: 'etat-2' }))
    // Zone absente de l'image : le premier état de la liste (Avant travaux).
    expect(interpolerEtatZone(undefined, ze('etat-2'), 0.5, liste)).toEqual(ze('etat-2', { pourcentage: 50, depuis: 'gauche', reste: 'etat-1' }))
    // L'avancement de B vu depuis l'autre état : même front.
    expect(interpolerEtatZone(ze('etat-3', { pourcentage: 30, depuis: 'gauche', reste: 'etat-2' }), ze('etat-2', { pourcentage: 40, depuis: 'droite', reste: 'etat-3' }), 0.5, liste)).toEqual(
      ze('etat-2', { pourcentage: 55, depuis: 'droite', reste: 'etat-3' }),
    )
  })

  it('trois états, ou deux avancements de sens opposés : bascule à mi-chemin', () => {
    const a = ze('etat-3', { pourcentage: 40, depuis: 'droite', reste: 'etat-2' })
    const b = ze('etat-4')
    expect(interpolerEtatZone(a, b, 0.4, liste)).toBe(a)
    expect(interpolerEtatZone(a, b, 0.5, liste)).toBe(b)
    const c = ze('etat-3', { pourcentage: 70, depuis: 'gauche', reste: 'etat-2' })
    expect(interpolerEtatZone(a, c, 0.6, liste)).toBe(c)
    expect(interpolerEtatZone(ze('etat-2'), ze('etat-2'), 0.5, liste)).toEqual(ze('etat-2'))
  })
})

describe('image intermédiaire', () => {
  it('décor de A (flèches, commentaires, PHASAGE…) jusqu’à l’arrivée ; zones, engins et rames interpolés', () => {
    const s = synoptique(fixture(), 'synoptique-4')
    const milieu = contenuIntermediaire(s, 0, 1, 0.5, liste)
    expect(milieu.contenu.commentaires).toBe(s.images[0].contenu.commentaires)
    expect(milieu.contenu.coupes).toBe(s.images[0].contenu.coupes)
    expect(milieu.contenu.exploitation).toBe(s.images[0].contenu.exploitation)
    expect(contenuIntermediaire(s, 0, 1, 1, liste).contenu.commentaires).toBe(s.images[1].contenu.commentaires)
    expect(contenuIntermediaire(s, 0, 1, 0, liste).contenu.etatsZones).toBe(s.images[0].contenu.etatsZones)
    // Le TTX de l'image 1 n'est plus dans l'image 2 : il disparaît à mi-chemin.
    expect(contenuIntermediaire(s, 0, 1, 0.49, liste).rames).toHaveLength(1)
    expect(milieu.rames).toHaveLength(0)
  })
})

describe('nombre de diapositives intermédiaires', () => {
  const carte = (s: Synoptique) => rectangleAffiche(s)

  it('aucune si rien ne bouge en courbe et si aucune zone n’avance', () => {
    const s = synoptique(fixture(), 'synoptique-1')
    const tr = transition(s, 0, 1, liste)
    expect(tr.mouvements.length).toBeGreaterThan(0)
    expect(nombreIntermediaires(tr, carte(s), toleranceCorde(s))).toBe(0)
  })

  it('au moins une dans un coude, au plus 6 sans appareil', () => {
    const s = nuit5()
    // Seule la pelle 1 bouge : elle passe le coude de V2.
    const seule = (i: number) => ({ ...s.images[i], contenu: { ...s.images[i].contenu, engins: [engin(s, i, 'engin-1')], rames: [], etatsZones: {} } })
    const s1: Synoptique = { ...s, images: [seule(0), seule(1)] }
    const tr = transition(s1, 0, 1, liste)
    const n = nombreIntermediaires(tr, carte(s1), toleranceCorde(s1))
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).toBeLessThanOrEqual(6)
    expect(ecartALaCorde(tr.mouvements, [])).toBeGreaterThan(toleranceCorde(s1))
    expect(ecartALaCorde(tr.mouvements, instantsIntermediaires(tr, carte(s1), toleranceCorde(s1)))).toBeLessThanOrEqual(toleranceCorde(s1))
  })

  it('les passages sur les appareils et les rebroussements sont des instants imposés ; au plus 12 avec un appareil', () => {
    const s = nuit5()
    const tr = transition(s, 0, 1, liste)
    expect(tr.parAppareil).toBe(true)
    const instants = instantsIntermediaires(tr, carte(s), toleranceCorde(s))
    expect(instants.length).toBeLessThanOrEqual(12)
    for (const t of tr.imposes) expect(instants.some((u) => Math.abs(u - t) < 0.005)).toBe(true)
    expect([...instants].sort((a, b) => a - b)).toEqual(instants)
    expect(instants.every((t) => t > 0 && t < 1)).toBe(true)
  })

  it('une zone qui avance : de 2 à 6 étapes régulières selon la course du front', () => {
    const s = synoptique(fixture(), 'synoptique-2')
    // Image 3 → 4 : toute la zone (150 unités) ; image 1 → 2 : 40 % (60 unités).
    expect(nombreIntermediaires(transition(s, 2, 3, liste), carte(s), toleranceCorde(s))).toBe(4)
    expect(nombreIntermediaires(transition(s, 0, 1, liste), carte(s), toleranceCorde(s))).toBe(2)
    // Image 2 → 3 : trois états, la zone bascule (fondu) : rien à découper.
    expect(nombreIntermediaires(transition(s, 1, 2, liste), carte(s), toleranceCorde(s))).toBe(0)
  })
})

describe('identifiants uniques sur tout le synoptique', () => {
  it('un nouvel engin ou une nouvelle rame ne reprend pas l’identifiant d’un autre, posé dans une autre image', () => {
    const s = nuit5()
    // Une image vide qui suivrait l'image 3 (où les engins 1 à 4 existent).
    const vide = { ...projetDeImage(s, s.images[2]), engins: [], rames: [] }
    const tous = s.images.flatMap((im) => im.contenu.engins)
    const pelle = CATALOGUE_PAR_DEFAUT.find((t) => t.categorie === 'Pelle RR')!
    expect(ajouterEngin(vide, pelle, { genre: 'libre', x: 0, y: 0, angle: 0 }).id).toBe('engin-1')
    expect(ajouterEngin(vide, pelle, { genre: 'libre', x: 0, y: 0, angle: 0 }, tous).id).toBe('engin-5')
    const rames = s.images.flatMap((im) => im.contenu.rames)
    expect(ajouterRame(vide, s.images[0].contenu.rames[0].vehicules, 'voie-2', 300, rames).id).toBe('rame-2')
  })
})
