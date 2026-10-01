import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { redacteurPptx } from '../src/export/ecrirePptx.ts'
import { insererTransition, xmlTransition } from '../src/export/transitions.ts'
import type { Chantier } from '../src/plan/chantier.ts'
import { OPTIONS_PAR_DEFAUT, pageDeGarde, planchesAExporter, tailleDePage, type ImageRendue } from '../src/plan/export.ts'
import {
  NOTE_INTERMEDIAIRE,
  nommerObjets,
  poseEnPouces,
  scenesDeLaSuite,
  suiteDiapositives,
  transitionsDeLaSuite,
  type OptionsAnimation,
} from '../src/plan/exportAnime.ts'
import { lireChantier } from '../src/plan/fichierChantier.ts'
import type { ListesChantier } from '../src/plan/legende.ts'
import { miseEnPage } from '../src/plan/planche.ts'
import { lireZip, methodesZip } from './lireZip.ts'

const MORPH = (ms: number, depart: string) =>
  '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
  '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" Requires="p159">' +
  `<p:transition spd="slow" p14:dur="${ms}"${depart}><p159:morph option="byObject"/></p:transition>` +
  '</mc:Choice>' +
  `<mc:Fallback><p:transition spd="slow"${depart}><p:fade/></p:transition></mc:Fallback>` +
  '</mc:AlternateContent>'

describe('XML des transitions', () => {
  it('arrivée sur une image, au clic : Morphose (et repli en fondu), départ au clic par défaut', () => {
    expect(xmlTransition({ morphoseMs: 667, depart: { genre: 'clic' } })).toBe(MORPH(667, ''))
  })

  it('en automatique : départ après la pause', () => {
    expect(xmlTransition({ morphoseMs: 400, depart: { genre: 'auto', apresMs: 5000 } })).toBe(MORPH(400, ' advTm="5000"'))
    expect(xmlTransition({ morphoseMs: null, depart: { genre: 'auto', apresMs: 5000 } })).toBe('<p:transition advTm="5000"/>')
  })

  it('intermédiaire : elle s’enchaîne seule, sans clic, dès la Morphose jouée', () => {
    expect(xmlTransition({ morphoseMs: 166.6, depart: { genre: 'enchainer' } })).toBe(MORPH(167, ' advClick="0" advTm="0"'))
  })

  it('première image au clic : rien à écrire', () => {
    expect(xmlTransition({ morphoseMs: null, depart: { genre: 'clic' } })).toBeNull()
  })

  it('insérée juste après <p:clrMapOvr> ; erreur claire si la balise manque', () => {
    const xml = '<p:sld><p:cSld/><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
    expect(insererTransition(xml, '<p:transition/>')).toBe('<p:sld><p:cSld/><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:transition/></p:sld>')
    expect(() => insererTransition('<p:sld><p:cSld/></p:sld>', '<p:transition/>')).toThrow(/clrMapOvr/)
  })
})

// ——— De bout en bout : le PowerPoint animé du synoptique « Nuit 5 » ———

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}

// Deux images factices (1 × 1 pixel PNG), à la place des rendus : toutes
// les couches et tous les objets partagent l'une ou l'autre.
const PNG_A = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PNG_B = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const image = (donnees: string): ImageRendue => ({ donnees, largeur: 1, hauteur: 1 })

async function genererAnime(animation: OptionsAnimation) {
  const c = fixture()
  const s = c.synoptiques.find((x) => x.id === 'synoptique-5')!
  const listes: ListesChantier = { etatsVoie: c.etatsVoie, typesFleches: c.typesFleches, catalogue: c.catalogue, etatsExploitation: c.etatsExploitation }
  const options = { ...OPTIONS_PAR_DEFAUT, animation }
  const indices = [0, 1, 2]
  const tr = transitionsDeLaSuite(s, indices, c.etatsVoie)
  const suite = suiteDiapositives(s, indices, c.etatsVoie, animation, tr)
  const scenes = scenesDeLaSuite(s, suite, c.etatsVoie, tr)
  const noms = nommerObjets(scenes)
  const r = redacteurPptx({ titre: s.nom, sujet: 'Synoptique' })
  r.garde(pageDeGarde(tailleDePage(options), { chantier: c.nom, synoptique: s.nom }, s.cartouche), image(PNG_A), { morphoseMs: null, depart: { genre: 'clic' } })
  scenes.forEach((scene, i) => {
    const planche = planchesAExporter(s, [scene.etape.image], listes, options)[0]
    const mise = miseEnPage(s, scene.etape.image, listes)
    r.diapositive!({
      cible: planche.cible,
      dessous: { ...image(PNG_A), nom: '!!dessous-1' },
      objets: scene.objets.map((o, j) => {
        const p = poseEnPouces(o, mise.planche, planche.cible)
        return { ...image(PNG_B), nom: noms[i][j], x: p.x, y: p.y, w: p.largeur, h: p.hauteur, rotation: p.rotation }
      }),
      dessus: { ...image(PNG_B), nom: `!!dessus-${scene.etape.image}` },
      zones: planche.zones,
      transition: scene.etape.transition,
      note: scene.etape.genre === 'intermediaire' ? NOTE_INTERMEDIAIRE : null,
    })
  })
  const octets = await r.terminer()
  return { octets, suite, scenes }
}

const diapositives = (zip: Map<string, Buffer>) =>
  [...zip.keys()]
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    .map((n) => zip.get(n)!.toString('utf8'))

describe('PowerPoint animé, de bout en bout', () => {
  it('au clic : Morphose à chaque arrivée, intermédiaires enchaînées, noms « !! », rotations, médias uniques, DEFLATE', async () => {
    const { octets, suite, scenes } = await genererAnime({ mode: 'clic', duree: 2, pause: 5 })
    const zip = lireZip(octets)
    const xml = diapositives(zip)
    // Page de garde, puis une diapositive par étape de la suite.
    expect(xml).toHaveLength(1 + suite.length)
    expect(xml[0]).not.toContain('<p:transition')
    expect(xml[1]).not.toContain('<p:transition')
    suite.forEach((e, i) => {
      const x = xml[i + 1]
      if (e.transition.morphoseMs !== null) {
        expect(x).toContain('<p159:morph option="byObject"/>')
        expect(x).toContain('<p:fade/>')
        expect(x).toContain(`p14:dur="${e.transition.morphoseMs}"`)
      }
      if (e.genre === 'intermediaire') expect(x).toContain('advClick="0" advTm="0"')
      else expect(x).not.toContain('advClick')
      // Ordre imposé par le format : la transition suit <p:clrMapOvr>.
      if (x.includes('<p:transition')) expect(x.indexOf('</p:clrMapOvr>')).toBeLessThan(x.indexOf('<mc:AlternateContent'))
      // Noms « !! » uniques sur la diapositive.
      const noms = [...x.matchAll(/<p:cNvPr id="\d+" name="(!![^"]*)"/g)].map((m) => m[1])
      expect(new Set(noms).size).toBe(noms.length)
      expect(noms).toContain('!!dessous-1')
      expect(noms).toContain('!!creneau')
      // Marges blanches autour de la planche, par-dessus les engins qui dépasseraient.
      expect(noms).toContain('!!marge-haut')
    })
    // Rotation : angle × 60 000 (la pelle 1 horizontale, sa caisse à 180°).
    const pelle = scenes[0].objets.find((o) => o.cle === 'engin-engin-1-type-13')!
    expect(pelle.angle).toBe(180)
    expect(xml[1]).toMatch(/name="!!engin-engin-1-type-13" descr="[^"]*">\s*<\/p:cNvPr>[\s\S]*?<a:xfrm rot="10800000">/)
    // Intermédiaires : la note « ne pas modifier ».
    const notes = [...zip.keys()].filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).map((n) => zip.get(n)!.toString('utf8'))
    expect(notes.filter((n) => n.includes('Diapositive de transition générée')).length).toBe(suite.filter((e) => e.genre === 'intermediaire').length)
    // Médias : deux images différentes en tout, chacune une fois ; tous les liens pointent sur un média présent.
    const medias = [...zip.keys()].filter((n) => n.startsWith('ppt/media/') && !n.endsWith('/'))
    expect(medias).toHaveLength(2)
    const cibles = [...zip.entries()].filter(([n]) => n.endsWith('.rels')).flatMap(([, x]) => [...x.toString('utf8').matchAll(/Target="\.\.\/media\/([^"]+)"/g)].map((m) => m[1]))
    expect(cibles.length).toBeGreaterThan(100)
    for (const c of cibles) expect(zip.has(`ppt/media/${c}`)).toBe(true)
    // Compression DEFLATE.
    const methodes = methodesZip(octets)
    expect(methodes.get('ppt/slides/slide2.xml')).toBe(8)
    expect(methodes.get('[Content_Types].xml')).toBe(8)
  })

  it('en automatique : chaque image principale part seule après la pause', async () => {
    const { octets, suite } = await genererAnime({ mode: 'auto', duree: 2, pause: 5 })
    const xml = diapositives(lireZip(octets))
    expect(xml[1]).toContain('<p:transition advTm="5000"/>')
    suite.forEach((e, i) => {
      if (e.genre === 'principale' && i > 0) expect(xml[i + 1]).toContain('advTm="5000"')
    })
  })
})
