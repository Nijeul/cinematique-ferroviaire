import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ajouterTypeFlecheChantier,
  deplacerTypeFlecheChantier,
  imagesDuTypeFleche,
  migrerChantier,
  modifierTypeFlecheChantier,
  supprimerTypeFlecheChantier,
  type Chantier,
} from '../src/plan/chantier.ts'
import { lireChantier, serialiserChantier, VERSION_CHANTIER } from '../src/plan/fichierChantier.ts'
import {
  ajouterFleche,
  ajouterTypeFleche,
  creerTypesFleches,
  deplacerFleche,
  deplacerPointFleche,
  dimensionsFleche,
  erreurTypeFleche,
  flecheSousPointeur,
  geometrieFleche,
  modifierCalqueFleches,
  modifierFleche,
  modifierFlechesImage,
  pointDeTrace,
  positionLibelle,
  supprimerFleche,
  TYPES_FLECHES_PAR_DEFAUT,
  uniteFleche,
  type Fleche,
  type TypeFleche,
} from '../src/plan/fleches.ts'
import { distancePointSegment } from '../src/plan/geometrie.ts'
import type { Point } from '../src/plan/projet.ts'
import { nouvelleImage } from '../src/plan/synoptique.ts'
import { longueurPolyligne } from '../src/plan/trace.ts'

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')

const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}

const valeur = <T>(r: { ok: true; valeur: T } | { ok: false; erreur: string }): T => {
  if (!r.ok) throw new Error(r.erreur)
  return r.valeur
}

const TYPES = creerTypesFleches()
const type = (nom: string): TypeFleche => TYPES.find((t) => t.nom === nom)!
const P = (x: number, y: number): Point => ({ x, y })
const proche = (a: Point, b: Point) => {
  expect(a.x).toBeCloseTo(b.x, 6)
  expect(a.y).toBeCloseTo(b.y, 6)
}

describe('types de flèches par défaut', () => {
  it('les cinq flèches des synoptiques, dans l’ordre', () => {
    expect(TYPES.map((t) => [t.nom, t.trait, t.pointes])).toEqual([
      ['Sens de travail', 'plein', 'fin'],
      ['Sens avancement TTX', 'plein', 'fin'],
      ['Cheminement', 'plein', 'fin'],
      ['Cheminement retour', 'pointilles', 'fin'],
      ['Chemin de roule', 'double', 'aucune'],
    ])
    // Rouge fine, bleue épaisse, magenta moyenne, rouge en double trait.
    expect(type('Sens de travail').couleur).toBe(type('Chemin de roule').couleur)
    expect(type('Cheminement').couleur).toBe(type('Cheminement retour').couleur)
    expect(type('Sens de travail').epaisseur).toBeLessThan(type('Cheminement').epaisseur)
    expect(type('Cheminement').epaisseur).toBeLessThan(type('Sens avancement TTX').epaisseur)
    for (const t of TYPES) expect(erreurTypeFleche(t)).toBeNull()
  })

  it('chaque chantier a sa propre copie de la liste', () => {
    const a = creerTypesFleches()
    a[0].couleur = '#000000'
    expect(TYPES_FLECHES_PAR_DEFAUT[0].couleur).not.toBe('#000000')
    expect(creerTypesFleches()).toEqual(TYPES_FLECHES_PAR_DEFAUT)
  })

  it('ajouter, modifier, réordonner ; valeurs impossibles refusées', () => {
    let c = fixture()
    const r = valeur(ajouterTypeFlecheChantier(c, '  Évacuation '))
    c = r.chantier
    expect(c.typesFleches.at(-1)).toMatchObject({ id: 'type-fleche-6', nom: 'Évacuation', trait: 'plein', pointes: 'fin' })
    c = valeur(modifierTypeFlecheChantier(c, r.id, { couleur: '#00aa00', epaisseur: 4.5, trait: 'pointilles', pointes: 'deux' }))
    expect(c.typesFleches.at(-1)).toMatchObject({ couleur: '#00aa00', epaisseur: 4.5, trait: 'pointilles', pointes: 'deux' })
    c = deplacerTypeFlecheChantier(c, r.id, -1)
    expect(c.typesFleches.map((t) => t.nom).slice(-2)).toEqual(['Évacuation', 'Chemin de roule'])
    expect(ajouterTypeFleche(c.typesFleches, '  ').ok).toBe(false)
    expect(modifierTypeFlecheChantier(c, r.id, { epaisseur: 0 }).ok).toBe(false)
    expect(modifierTypeFlecheChantier(c, r.id, { epaisseur: 31 }).ok).toBe(false)
    expect(modifierTypeFlecheChantier(c, r.id, { couleur: 'rouge' }).ok).toBe(false)
  })
})

describe('géométrie d’une flèche', () => {
  const u = 1

  it('une épaisseur de 8 points est celle d’une voie tracée par défaut', () => {
    expect(uniteFleche({ largeur: 1600, hauteur: 900 }) * 8).toBe(9)
  })

  it('pointe en triangle au dernier point, proportionnée à l’épaisseur', () => {
    const points = [P(0, 0), P(300, 0)]
    const fine = geometrieFleche(points, type('Sens de travail'), u)!
    expect(fine.pointes).toHaveLength(1)
    const [sommet, b1, b2] = fine.pointes[0]
    proche(sommet, P(300, 0))
    // Base perpendiculaire à la flèche, centrée sur elle, en arrière du sommet.
    expect(b1.x).toBeCloseTo(300 - fine.longueurPointe)
    expect(Math.abs(b1.y - b2.y)).toBeCloseTo(fine.largeurPointe)
    expect(b1.y + b2.y).toBeCloseTo(0)
    // Pointe fine : quatre fois et demie son trait ; grosse flèche : un peu plus de deux fois.
    expect(fine.largeurPointe / fine.trait).toBeCloseTo(4.5)
    const grosse = geometrieFleche(points, type('Sens avancement TTX'), u)!
    expect(grosse.largeurPointe / grosse.trait).toBeGreaterThan(2)
    expect(grosse.largeurPointe / grosse.trait).toBeLessThan(3)
    expect(grosse.largeurPointe).toBeGreaterThan(fine.largeurPointe)
    // Le trait s'arrête sous la pointe : il ne dépasse pas du sommet.
    const fin = fine.traits[0].at(-1)!
    expect(fin.x).toBeLessThan(300)
    expect(fin.x).toBeGreaterThan(300 - fine.longueurPointe)
  })

  it('aux deux bouts, ou aucune ; pointe réduite sur une flèche très courte', () => {
    const deux = geometrieFleche([P(0, 0), P(200, 0)], { ...type('Cheminement'), pointes: 'deux' }, u)!
    expect(deux.pointes).toHaveLength(2)
    proche(deux.pointes[1][0], P(0, 0))
    expect(deux.traits[0][0].x).toBeGreaterThan(0)
    const aucune = geometrieFleche([P(0, 0), P(200, 0)], { ...type('Cheminement'), pointes: 'aucune' }, u)!
    expect(aucune.pointes).toEqual([])
    expect(aucune.traits[0]).toEqual([P(0, 0), P(200, 0)])
    const courte = geometrieFleche([P(0, 0), P(10, 0)], type('Sens avancement TTX'), u)!
    expect(courte.longueurPointe).toBeLessThanOrEqual(10 * 0.45 + 1e-9)
    // Un seul point (ou deux fois le même) : pas de flèche.
    expect(geometrieFleche([P(5, 5), P(5, 5)], type('Sens de travail'), u)).toBeNull()
  })

  it('pointillés : tirets proportionnés ; trait plein : aucun', () => {
    const g = geometrieFleche([P(0, 0), P(300, 0)], type('Cheminement retour'), u)!
    expect(g.tirets).not.toBeNull()
    expect(g.tirets![0]).toBeGreaterThan(g.trait)
    expect(geometrieFleche([P(0, 0), P(300, 0)], type('Cheminement'), u)!.tirets).toBeNull()
  })

  it('double trait : deux traits parallèles, de part et d’autre de l’axe, coins compris', () => {
    const coude = [P(0, 0), P(200, 0), P(200, 150)]
    const g = geometrieFleche(coude, type('Chemin de roule'), u)!
    expect(g.pointes).toEqual([])
    expect(g.traits).toHaveLength(2)
    const d = g.ecart / 2
    expect(d).toBeGreaterThan(g.trait)
    for (const trait of g.traits) {
      expect(trait).toHaveLength(3)
      // Chaque segment reste à la distance d du segment correspondant de l'axe.
      for (let i = 1; i < trait.length; i++) {
        const milieu = P((trait[i - 1].x + trait[i].x) / 2, (trait[i - 1].y + trait[i].y) / 2)
        expect(distancePointSegment(milieu, coude[i - 1], coude[i])).toBeCloseTo(d, 6)
      }
    }
    // Le coin est en onglet : décalé de d sur chacun des deux axes.
    const coins = g.traits.map((t) => t[1])
    expect(coins.map((c) => [Math.abs(c.x - 200), Math.abs(c.y)])).toEqual([
      [expect.closeTo(d, 6), expect.closeTo(d, 6)],
      [expect.closeTo(d, 6), expect.closeTo(d, 6)],
    ])
    // Les deux traits sont de chaque côté de l'axe.
    expect(Math.sign(g.traits[0][0].y)).toBe(-Math.sign(g.traits[1][0].y))
  })

  it('libellé au milieu du plus long segment, au-dessus, jamais à l’envers', () => {
    const pos = positionLibelle([P(600, 100), P(100, 100), P(80, 80)], 10, 12)!
    expect(pos.angle).toBe(0)
    expect(pos.x).toBeCloseTo(350)
    expect(pos.y).toBeLessThan(100)
    const vertical = positionLibelle([P(0, 0), P(0, 300)], 10, 12)!
    expect(vertical.angle).toBe(90)
  })
})

describe('tracé : contrainte Maj', () => {
  it('Maj : horizontale, verticale ou 45° depuis le point précédent ; sans Maj : le point cliqué', () => {
    const trace = [P(100, 100)]
    expect(pointDeTrace(trace, P(300, 112), true)).toEqual(P(300, 100))
    expect(pointDeTrace(trace, P(104, 250), true)).toEqual(P(100, 250))
    const diagonale = pointDeTrace(trace, P(200, 190), true)
    expect(diagonale.x - 100).toBeCloseTo(diagonale.y - 100)
    expect(pointDeTrace(trace, P(300, 112), false)).toEqual(P(300, 112))
    // Le premier point n'a pas de précédent.
    expect(pointDeTrace([], P(300, 112), true)).toEqual(P(300, 112))
  })
})

describe('choix sous le pointeur', () => {
  const fleches: Fleche[] = [
    { id: 'fleche-1', typeId: 'type-fleche-1', points: [P(0, 100), P(400, 100)], libelle: '' },
    { id: 'fleche-2', typeId: 'type-fleche-2', points: [P(0, 200), P(400, 200)], libelle: '' },
    { id: 'fleche-3', typeId: 'type-fleche-1', points: [P(200, 0), P(200, 300)], libelle: '' },
  ]

  it('trouve la flèche touchée, la dernière posée d’abord', () => {
    expect(flecheSousPointeur(fleches, TYPES, 1, P(50, 103), 3)).toBe('fleche-1')
    expect(flecheSousPointeur(fleches, TYPES, 1, P(50, 130), 3)).toBeNull()
    // Au croisement, la flèche posée en dernier (dessinée au-dessus).
    expect(flecheSousPointeur(fleches, TYPES, 1, P(200, 100), 3)).toBe('fleche-3')
  })

  it('une flèche épaisse se touche plus loin de son axe', () => {
    const { corps } = dimensionsFleche(type('Sens avancement TTX'), 1)
    expect(flecheSousPointeur(fleches, TYPES, 1, P(50, 200 + corps / 2 + 2), 3)).toBe('fleche-2')
    expect(flecheSousPointeur(fleches, TYPES, 1, P(50, 100 + corps / 2 + 2), 3)).toBeNull()
  })

  it('une flèche d’un type disparu ne se choisit pas', () => {
    expect(flecheSousPointeur(fleches, TYPES.slice(1), 1, P(50, 100), 3)).toBeNull()
  })
})

describe('flèches d’une image', () => {
  it('ajouter, changer de type et de libellé, déplacer un point ou toute la flèche, supprimer', () => {
    let f = ajouterFleche([], 'type-fleche-1', [P(0, 0), P(100, 0)]).fleches
    const r = ajouterFleche(f, 'type-fleche-5', [P(0, 50), P(100, 50), P(150, 100)])
    expect(r.id).toBe('fleche-2')
    f = modifierFleche(r.fleches, 'fleche-2', { typeId: 'type-fleche-3', libelle: 'vers base arrière' })
    expect(f[1]).toMatchObject({ typeId: 'type-fleche-3', libelle: 'vers base arrière' })
    f = deplacerPointFleche(f, 'fleche-2', 2, P(160, 120))
    expect(f[1].points[2]).toEqual(P(160, 120))
    f = deplacerFleche(f, 'fleche-2', P(10, -5))
    expect(f[1].points).toEqual([P(10, 45), P(110, 45), P(170, 115)])
    expect(f[0].points).toEqual([P(0, 0), P(100, 0)])
    expect(longueurPolyligne(f[1].points)).toBeGreaterThan(100)
    expect(supprimerFleche(f, 'fleche-1').map((x) => x.id)).toEqual(['fleche-2'])
  })

  it('ne modifie que l’image courante ; calque visible et verrouillé', () => {
    const s = fixture().synoptiques[2]
    const avant = s.images[0].contenu.fleches
    const apres = modifierFlechesImage(s, 1, (f) => supprimerFleche(f, 'fleche-1'))
    expect(apres.images[0].contenu.fleches).toBe(avant)
    expect(apres.images[1].contenu.fleches.map((f) => f.id)).not.toContain('fleche-1')
    expect(modifierFlechesImage(s, 1, (f) => f)).toBe(s)
    expect(modifierCalqueFleches(s, { verrouille: true }).calqueFleches).toEqual({ visible: true, verrouille: true })
  })
})

describe('« Nouvelle image » recopie les flèches', () => {
  it('copie indépendante : déplacer une flèche de la nouvelle image ne change pas l’image d’origine', () => {
    const s = fixture().synoptiques[2]
    const r = nouvelleImage(s, 0)
    const copie = r.synoptique.images[1]
    expect(copie.contenu.fleches).toEqual(s.images[0].contenu.fleches)
    const bouge = modifierFlechesImage(r.synoptique, 1, (f) => deplacerFleche(f, 'fleche-1', P(-50, 0)))
    expect(bouge.images[0].contenu.fleches).toEqual(s.images[0].contenu.fleches)
    expect(bouge.images[1].contenu.fleches[0].points[0].x).toBe(s.images[0].contenu.fleches[0].points[0].x - 50)
  })
})

describe('supprimer un type de flèche utilisé', () => {
  it('compte les images concernées, puis retire ses flèches de toutes les images', () => {
    const c = fixture()
    const ttx = c.typesFleches.find((t) => t.nom === 'Sens avancement TTX')!
    const roule = c.typesFleches.find((t) => t.nom === 'Chemin de roule')!
    // Dans la fixture : la flèche d'avancement du TTX n'est que sur l'image 1.
    expect(imagesDuTypeFleche(c, ttx.id)).toBe(1)
    expect(imagesDuTypeFleche(c, roule.id)).toBe(2)
    const sans = supprimerTypeFlecheChantier(c, roule.id)
    expect(sans.typesFleches.map((t) => t.nom)).not.toContain('Chemin de roule')
    const toutes = sans.synoptiques.flatMap((s) => s.images.flatMap((im) => im.contenu.fleches))
    expect(toutes.some((f) => f.typeId === roule.id)).toBe(false)
    expect(toutes.filter((f) => f.typeId === ttx.id)).toHaveLength(1)
    // Les synoptiques sans ce type ne changent pas.
    expect(sans.synoptiques[0]).toBe(c.synoptiques[0])
    expect(imagesDuTypeFleche(sans, roule.id)).toBe(0)
  })
})

describe('fixture : un synoptique avec des flèches de chaque type', () => {
  it('les cinq types, un libellé, et la flèche d’avancement du TTX retirée à l’image 2', () => {
    const c = fixture()
    const s = c.synoptiques[2]
    const noms = (i: number) => s.images[i].contenu.fleches.map((f) => c.typesFleches.find((t) => t.id === f.typeId)!.nom)
    expect(new Set(noms(0))).toEqual(new Set(c.typesFleches.map((t) => t.nom)))
    expect(noms(1)).not.toContain('Sens avancement TTX')
    expect(s.images[0].contenu.fleches.some((f) => f.libelle !== '')).toBe(true)
    // Le chemin de roule est coudé.
    const roule = s.images[0].contenu.fleches.find((f) => f.typeId === 'type-fleche-5')!
    expect(roule.points.length).toBeGreaterThan(2)
  })
})

// Le même chantier tel que l'étape 6 le gardait (navigateur) ou l'exportait
// (fichier version 3) : ni types de flèches, ni flèches, ni description
// d'engins, ni calque « Flèches », ni réglages de légende.
const enEtape6 = (c: Chantier) => {
  const brut = JSON.parse(serialiserChantier(c))
  delete brut.typesFleches
  for (const s of brut.synoptiques) {
    delete s.calqueFleches
    delete s.afficherLegende
    for (const im of s.images) {
      delete im.legendeMasquee
      delete im.contenu.fleches
      for (const e of im.contenu.engins) delete e.description
      for (const r of im.contenu.rames) delete r.description
    }
  }
  return brut
}

describe('chantiers et synoptiques des étapes 4 à 6', () => {
  const sansFleches = (c: Chantier): Chantier => ({
    ...c,
    synoptiques: c.synoptiques.map((s) => ({
      ...s,
      images: s.images.map((im) => ({
        ...im,
        contenu: {
          ...im.contenu,
          fleches: [],
          engins: im.contenu.engins.map((e) => ({ ...e, description: '' })),
          rames: im.contenu.rames.map((r) => ({ ...r, description: '' })),
        },
      })),
    })),
  })

  it('rangé dans le navigateur à l’étape 6 : flèches par défaut, images sans flèche, légende affichée', () => {
    const brut = enEtape6(fixture())
    delete brut.format
    delete brut.version
    const { chantier } = migrerChantier(brut)
    expect(chantier.typesFleches).toEqual(TYPES_FLECHES_PAR_DEFAUT)
    for (const s of chantier.synoptiques) {
      expect(s.calqueFleches).toEqual({ visible: true, verrouille: false })
      expect(s.afficherLegende).toBe(true)
      for (const im of s.images) {
        expect(im.legendeMasquee).toEqual([])
        expect(im.contenu.fleches).toEqual([])
        expect(im.contenu.engins.every((e) => e.description === '')).toBe(true)
        expect(im.contenu.rames.every((r) => r.description === '')).toBe(true)
      }
    }
    // Rien d'autre ne change.
    expect(chantier).toEqual(sansFleches(fixture()))
  })

  it('rangé à l’étape 5 ou 4 : complété aussi', () => {
    const brut = enEtape6(fixture())
    delete brut.format
    delete brut.version
    delete brut.etatsVoie
    delete brut.catalogue
    for (const s of brut.synoptiques) {
      delete s.bandeau
      delete s.calqueEngins
      for (const im of s.images) {
        delete im.phasage
        delete im.titre
        delete im.heures
        delete im.contenu.etatsZones
        delete im.contenu.engins
        delete im.contenu.rames
      }
    }
    const { chantier } = migrerChantier(brut)
    expect(chantier.typesFleches).toEqual(TYPES_FLECHES_PAR_DEFAUT)
    expect(chantier.synoptiques[0].images[0]).toMatchObject({ legendeMasquee: [], contenu: { fleches: [], engins: [], rames: [] } })
  })

  it('fichier exporté à l’étape 6 (version 3) : s’ouvre, sans flèche', () => {
    const lu = lireChantier(JSON.stringify({ ...enEtape6(fixture()), version: 3 }))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.chantier).toEqual({ ...sansFleches(fixture()), modifieLe: lu.chantier.modifieLe })
  })
})

describe('export et import', () => {
  it('types de flèches, flèches, descriptions et réglages de légende voyagent avec le chantier', () => {
    let c = fixture()
    c = valeur(modifierTypeFlecheChantier(c, 'type-fleche-1', { couleur: '#aa0000', epaisseur: 2.5 }))
    const s = c.synoptiques[2]
    c = {
      ...c,
      synoptiques: c.synoptiques.map((x) =>
        x.id === s.id
          ? { ...x, afficherLegende: false, calqueFleches: { visible: false, verrouille: true }, images: x.images.map((im, i) => (i === 0 ? { ...im, legendeMasquee: ['etat:etat-2'] } : im)) }
          : x,
      ),
    }
    const texte = serialiserChantier(c)
    expect(JSON.parse(texte).version).toBe(VERSION_CHANTIER)
    expect(VERSION_CHANTIER).toBeGreaterThanOrEqual(4)
    const relu = lireChantier(texte)
    expect(relu.ok).toBe(true)
    if (relu.ok) expect(relu.chantier).toEqual(c)
  })

  it('refuse un type inconnu, une flèche d’un seul point, un type illisible', () => {
    const brut = JSON.parse(serialiserChantier(fixture()))
    brut.synoptiques[2].images[0].contenu.fleches[0].typeId = 'type-fleche-99'
    brut.synoptiques[2].images[0].contenu.fleches[1].points = [{ x: 1, y: 2 }]
    brut.typesFleches[0].epaisseur = 50
    brut.typesFleches[1].trait = 'ondulé'
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(false)
    if (!lu.ok) {
      const texte = lu.erreurs.join('\n')
      expect(texte).toContain('type inconnu')
      expect(texte).toContain('au moins deux points')
      expect(texte).toContain('épaisseur illisible')
      expect(texte).toContain('trait illisible')
    }
  })
})
