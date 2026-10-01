import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ETATS_PAR_DEFAUT } from '../src/plan/etatsVoie.ts'
import type { Chantier } from '../src/plan/chantier.ts'
import {
  angleCaisse,
  animationActive,
  nommerObjets,
  objetsDuContenu,
  poseEnPouces,
  scenesDeLaSuite,
  suiteDiapositives,
  transitionsDeLaSuite,
  verifierAnimation,
  type ObjetScene,
  type OptionsAnimation,
} from '../src/plan/exportAnime.ts'
import { OPTIONS_PAR_DEFAUT } from '../src/plan/export.ts'
import { lireChantier } from '../src/plan/fichierChantier.ts'
import type { Synoptique } from '../src/plan/synoptique.ts'
import { transition } from '../src/plan/animation.ts'

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const synoptique = (id: string): Synoptique => fixture().synoptiques.find((s) => s.id === id)!
const liste = [...ETATS_PAR_DEFAUT]
const CLIC: OptionsAnimation = { mode: 'clic', duree: 2, pause: 5 }
const AUTO: OptionsAnimation = { mode: 'auto', duree: 3, pause: 4 }

describe('réglages de l’animation', () => {
  it('« Au clic » par défaut, mouvement de 2 s, pause de 5 s', () => {
    expect(OPTIONS_PAR_DEFAUT.animation).toEqual(CLIC)
  })

  it('vérification : messages en français', () => {
    expect(verifierAnimation(CLIC)).toEqual([])
    expect(verifierAnimation({ mode: 'clic', duree: 0.2, pause: Number.NaN })).toEqual(['La durée du mouvement va de 0,5 à 20 secondes.'])
    expect(verifierAnimation({ mode: 'auto', duree: 2, pause: -1 })).toEqual(['La pause sur chaque image va de 0 à 600 secondes.'])
    expect(verifierAnimation({ mode: 'aucune', duree: Number.NaN, pause: Number.NaN })).toEqual([])
  })

  it('sans effet pour une seule image, ou « Aucune »', () => {
    expect(animationActive(CLIC, 1)).toBe(false)
    expect(animationActive({ ...CLIC, mode: 'aucune' }, 3)).toBe(false)
    expect(animationActive(CLIC, 2)).toBe(true)
    const s = synoptique('synoptique-5')
    expect(suiteDiapositives(s, [1], liste, CLIC).map((e) => e.genre)).toEqual(['principale'])
    expect(suiteDiapositives(s, [0, 1, 2], liste, { ...CLIC, mode: 'aucune' }).every((e) => e.genre === 'principale' && e.transition.morphoseMs === null)).toBe(true)
  })
})

describe('suite des diapositives', () => {
  it('principales et intermédiaires dans l’ordre ; les intermédiaires montrent le décor de l’image de départ', () => {
    const s = synoptique('synoptique-5')
    const suite = suiteDiapositives(s, [0, 1, 2], liste, CLIC)
    const principales = suite.filter((e) => e.genre === 'principale')
    expect(principales.map((e) => e.image)).toEqual([0, 1, 2])
    expect(suite[0]).toMatchObject({ genre: 'principale', image: 0, transition: { morphoseMs: null, depart: { genre: 'clic' } } })
    const i1 = suite.indexOf(principales[1])
    const entre = suite.slice(1, i1)
    expect(entre.length).toBeGreaterThan(0)
    for (const e of entre) expect(e).toMatchObject({ genre: 'intermediaire', image: 0, depuis: 0, vers: 1, transition: { depart: { genre: 'enchainer' } } })
    // Instants croissants ; chaque Morphose dure sa part du mouvement (2 s en tout).
    const ts = [...entre.map((e) => e.t), 1]
    expect([...ts].sort((a, b) => a - b)).toEqual(ts)
    const total = [...entre, principales[1]].reduce((t, e) => t + e.transition.morphoseMs!, 0)
    expect(total).toBeGreaterThanOrEqual(2000)
    expect(total).toBeLessThan(2000 + 50 * entre.length + 10)
    expect(principales[1]).toMatchObject({ depuis: 0, vers: 1, t: 1, transition: { depart: { genre: 'clic' } } })
  })

  it('en automatique : chaque image principale part seule après la pause', () => {
    const s = synoptique('synoptique-5')
    const suite = suiteDiapositives(s, [0, 1], liste, AUTO)
    for (const e of suite.filter((x) => x.genre === 'principale')) expect(e.transition.depart).toEqual({ genre: 'auto', apresMs: 4000 })
    const morphoses = suite.slice(1).reduce((t, e) => t + e.transition.morphoseMs!, 0)
    expect(morphoses).toBeGreaterThanOrEqual(3000)
  })

  it('une plage d’images : transitions entre images consécutives de la plage', () => {
    const s = synoptique('synoptique-2')
    const suite = suiteDiapositives(s, [2, 3], liste, CLIC)
    expect(suite.filter((e) => e.genre === 'principale').map((e) => e.image)).toEqual([2, 3])
    // Image 3 → 4 : la zone passe toute en « Voie neuve posée », 4 étapes.
    expect(suite.filter((e) => e.genre === 'intermediaire')).toHaveLength(4)
  })
})

describe('objets séparés et leurs noms', () => {
  it('rames puis engins, caisses, étiquette et pastilles ; sans numéro, pas de pastille ; calque masqué, rien', () => {
    const s = synoptique('synoptique-5')
    const image = transition(s, 0, 0, liste).en(0)
    const objets = objetsDuContenu(s, image)
    const cles = objets.map((o) => o.cle)
    expect(cles.slice(0, 7).every((c) => c.startsWith('rame-rame-1-'))).toBe(true)
    expect(cles[5]).toMatch(/-etiquette$/)
    expect(cles[6]).toMatch(/-pastille$/)
    expect(cles.slice(7)).toEqual([
      'engin-engin-1-type-13',
      'engin-engin-1-type-13-pastille',
      'engin-engin-2-type-13',
      'engin-engin-2-type-13-pastille',
      'engin-engin-3-type-13',
      'engin-engin-3-type-13-pastille',
      'engin-engin-4-type-13',
      'engin-engin-4-type-13-pastille',
    ])
    expect(objets.find((o) => o.cle.endsWith('-etiquette'))!.sprite).toMatchObject({ genre: 'etiquette', texte: 'TTX 1 — 94,1 m' })
    expect(objetsDuContenu({ ...s, numerosEngins: false }, image).some((o) => o.sprite.genre === 'pastille')).toBe(false)
    expect(objetsDuContenu({ ...s, calqueEngins: { visible: false, verrouille: false } }, image)).toEqual([])
  })

  it('angle des caisses : libellé lisible, près de 180° à l’horizontale (loin du passage 360° → 0°)', () => {
    expect(angleCaisse(0)).toBe(180)
    expect(angleCaisse(180)).toBe(180)
    expect(angleCaisse(-5)).toBe(175)
    expect(angleCaisse(5)).toBe(185)
    expect(angleCaisse(175)).toBe(175)
    expect(angleCaisse(55)).toBe(235)
  })

  it('noms « !! » uniques par diapositive, les mêmes d’une diapositive à l’autre, suffixe « ~n » aux discontinuités', () => {
    const s = synoptique('synoptique-5')
    const tr = transitionsDeLaSuite(s, [0, 1, 2], liste)
    const suite = suiteDiapositives(s, [0, 1, 2], liste, CLIC, tr)
    const scenes = scenesDeLaSuite(s, suite, liste, tr)
    const noms = nommerObjets(scenes)
    expect(noms).toHaveLength(suite.length)
    for (const n of noms) {
      expect(new Set(n).size).toBe(n.length)
      expect(n.every((x) => x.startsWith('!!'))).toBe(true)
    }
    // La pelle 1 roule : même nom partout.
    expect(noms.every((n) => n.includes('!!engin-engin-1-type-13'))).toBe(true)
    // La pelle 4 s'enraille (fondu à mi-chemin), puis repart hors voie : deux discontinuités.
    const pelle4 = noms.map((n) => n.find((x) => x.startsWith('!!engin-engin-4-type-13') && !x.includes('pastille')))
    expect(pelle4[0]).toBe('!!engin-engin-4-type-13')
    expect(pelle4[pelle4.length - 1]).toBe('!!engin-engin-4-type-13~2')
  })

  it('nommerObjets : suffixe à la rupture, au changement d’apparence, à un saut d’angle de plus de 90°', () => {
    const o = (angle: number, rupture = false, apparence = 'a'): ObjetScene => ({
      cle: 'x',
      sprite: { genre: 'pastille', couleur: '#000000', texte: '1', rayon: 1 },
      cleSprite: apparence,
      apparence,
      centre: { x: 0, y: 0 },
      angle,
      largeur: 1,
      hauteur: 1,
      bascule: rupture,
      rupture,
    })
    const noms = nommerObjets([o(180), o(200), o(200, true), o(250), o(30), o(30, false, 'b')].map((x) => ({ objets: [x] })))
    expect(noms.map((n) => n[0])).toEqual(['!!x', '!!x', '!!x~1', '!!x~1', '!!x~2', '!!x~3'])
  })

  it('place sur la diapositive : comme les zones de texte (versPage), rotation dans [0, 360)', () => {
    const planche = { x: 100, y: 50, largeur: 1000, hauteur: 500 }
    const cible = { x: 0.5, y: 0.25, largeur: 10, hauteur: 5 }
    const p = poseEnPouces({ centre: { x: 600, y: 300 }, angle: -90, largeur: 40, hauteur: 10 }, planche, cible)
    expect(p.x).toBeCloseTo(0.5 + 5 - 0.2, 9)
    expect(p.y).toBeCloseTo(0.25 + 2.5 - 0.05, 9)
    expect(p.largeur).toBeCloseTo(0.4, 9)
    expect(p.hauteur).toBeCloseTo(0.1, 9)
    expect(p.rotation).toBe(270)
    expect(poseEnPouces({ centre: { x: 0, y: 0 }, angle: 360, largeur: 1, hauteur: 1 }, planche, cible).rotation).toBe(0)
  })
})
