import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { redacteurPdf } from '../src/export/ecrirePdf.ts'
import { redacteurPptx } from '../src/export/ecrirePptx.ts'
import { cartoucheVide, CHAMPS_CARTOUCHE, creerCartouche, lireCartouche, modifierCartouche, resumeCartouche } from '../src/plan/cartouche.ts'
import { migrerChantier, type Chantier } from '../src/plan/chantier.ts'
import {
  ajusterDansPage,
  DIAPOSITIVE,
  imagesChoisies,
  margePage,
  nomFichierExport,
  OPTIONS_PAR_DEFAUT,
  PAGES_PDF,
  pageDeGarde,
  planchesAExporter,
  tailleDePage,
  tailleRendu,
  typeImageRendue,
  versPage,
  zonesTexte,
  type ImageRendue,
  type OptionsExport,
  type Redacteur,
  type ZoneTexte,
} from '../src/plan/export.ts'
import { lireChantier, serialiserChantier, VERSION_CHANTIER } from '../src/plan/fichierChantier.ts'
import type { ListesChantier } from '../src/plan/legende.ts'
import { miseEnPage } from '../src/plan/planche.ts'
import type { Synoptique } from '../src/plan/synoptique.ts'
import { lireZip } from './lireZip.ts'

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const listesDe = (c: Chantier): ListesChantier => ({ etatsVoie: c.etatsVoie, typesFleches: c.typesFleches, catalogue: c.catalogue, etatsExploitation: c.etatsExploitation })
const synoptique = (c: Chantier, id: string): Synoptique => c.synoptiques.find((s) => s.id === id)!

const proche = (a: number, b: number, tolerance = 1e-9) => Math.abs(a - b) <= tolerance
const dedans = (r: { x: number; y: number; largeur: number; hauteur: number }, page: { largeur: number; hauteur: number }) =>
  r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.largeur <= page.largeur + 1e-9 && r.y + r.hauteur <= page.hauteur + 1e-9

describe('choix des images à exporter', () => {
  it('toutes les images, dans l’ordre', () => {
    expect(imagesChoisies(4, 2, { genre: 'toutes' })).toEqual({ ok: true, valeur: [0, 1, 2, 3] })
  })

  it('l’image courante seule', () => {
    expect(imagesChoisies(4, 2, { genre: 'courante' })).toEqual({ ok: true, valeur: [2] })
    expect(imagesChoisies(4, 9, { genre: 'courante' })).toEqual({ ok: true, valeur: [3] })
  })

  it('« de n à m » : numéros à partir de 1, bornes comprises', () => {
    expect(imagesChoisies(4, 0, { genre: 'plage', de: 2, a: 3 })).toEqual({ ok: true, valeur: [1, 2] })
    expect(imagesChoisies(4, 0, { genre: 'plage', de: 3, a: 3 })).toEqual({ ok: true, valeur: [2] })
    expect(imagesChoisies(4, 0, { genre: 'plage', de: 1, a: 4 })).toEqual({ ok: true, valeur: [0, 1, 2, 3] })
  })

  it('bornes invalides : message en français', () => {
    const erreur = (de: number, a: number) => {
      const r = imagesChoisies(4, 0, { genre: 'plage', de, a })
      return r.ok ? null : r.erreur
    }
    expect(erreur(0, 2)).toBe("Les numéros d'image vont de 1 à 4.")
    expect(erreur(2, 5)).toBe("Les numéros d'image vont de 1 à 4.")
    expect(erreur(5, 6)).toBe("Les numéros d'image vont de 1 à 4.")
    expect(erreur(3, 2)).toBe('Le premier numéro (3) doit être inférieur ou égal au second (2).')
    expect(erreur(1.5, 2)).toBe("Indiquez deux numéros d'image entiers.")
    expect(erreur(Number.NaN, 2)).toBe("Indiquez deux numéros d'image entiers.")
    expect(imagesChoisies(0, 0, { genre: 'toutes' })).toEqual({ ok: false, erreur: "Ce synoptique n'a aucune image." })
  })
})

describe('planche ajustée dans la page', () => {
  const pages = { '16/9': PAGES_PDF['16/9'], A4: PAGES_PDF.A4, A3: PAGES_PDF.A3 }

  it('formats : 16/9 comme la diapositive, A4 et A3 paysage', () => {
    expect(PAGES_PDF['16/9']).toMatchObject(DIAPOSITIVE)
    expect(proche(DIAPOSITIVE.largeur / DIAPOSITIVE.hauteur, 16 / 9)).toBe(true)
    expect(proche(PAGES_PDF.A4.largeur * 25.4, 297, 1e-6) && proche(PAGES_PDF.A4.hauteur * 25.4, 210, 1e-6)).toBe(true)
    expect(proche(PAGES_PDF.A3.largeur * 25.4, 420, 1e-6) && proche(PAGES_PDF.A3.hauteur * 25.4, 297, 1e-6)).toBe(true)
    expect(tailleDePage({ format: 'pptx', page: 'A3' })).toBe(DIAPOSITIVE)
    expect(tailleDePage({ format: 'pdf', page: 'A3' })).toBe(PAGES_PDF.A3)
  })

  for (const [nom, page] of Object.entries(pages)) {
    for (const planche of [
      { largeur: 1000, hauteur: 780 },
      { largeur: 3000, hauteur: 600 },
      { largeur: 500, hauteur: 900 },
    ]) {
      it(`${nom}, planche ${planche.largeur} × ${planche.hauteur} : ratio conservé, centrée, marge respectée`, () => {
        const r = ajusterDansPage(planche, page)
        const marge = margePage(page)
        expect(proche(r.largeur / r.hauteur, planche.largeur / planche.hauteur)).toBe(true)
        expect(proche(r.x + r.largeur / 2, page.largeur / 2)).toBe(true)
        expect(proche(r.y + r.hauteur / 2, page.hauteur / 2)).toBe(true)
        expect(r.x).toBeGreaterThanOrEqual(marge - 1e-9)
        expect(r.y).toBeGreaterThanOrEqual(marge - 1e-9)
        // Le plus grand possible : elle touche la marge d'un côté au moins.
        expect(proche(r.x, marge) || proche(r.y, marge)).toBe(true)
      })
    }
  }

  it('la marge est petite : environ 5 mm en 16/9 et en A4, 7 mm en A3', () => {
    expect(margePage(PAGES_PDF['16/9']) * 25.4).toBeCloseTo(4.76, 1)
    expect(margePage(PAGES_PDF.A4) * 25.4).toBeCloseTo(5.25, 2)
    expect(margePage(PAGES_PDF.A3) * 25.4).toBeCloseTo(7.43, 2)
  })

  it('taille de l’image rendue : environ 2 400 pixels, sans déformation', () => {
    expect(tailleRendu({ largeur: 1000, hauteur: 780 })).toEqual({ largeur: 2400, hauteur: 1872 })
    expect(tailleRendu({ largeur: 500, hauteur: 1000 })).toEqual({ largeur: 1200, hauteur: 2400 })
    expect(tailleRendu({ largeur: 1000, hauteur: 500 }, 1600)).toEqual({ largeur: 1600, hauteur: 800 })
    expect(typeImageRendue(false)).toBe('image/png')
    expect(typeImageRendue(true)).toBe('image/jpeg')
  })
})

describe('zones de texte PowerPoint : exactement à leur place sur la planche', () => {
  const c = fixture()
  const listes = listesDe(c)
  const s = synoptique(c, 'synoptique-2')
  const mise = miseEnPage(s, 0, listes)
  const cible = ajusterDansPage(mise.planche, DIAPOSITIVE)
  const zones = zonesTexte(s, 0, mise, cible)
  const zone = (nom: ZoneTexte['nom'], liste = zones) => liste.find((z) => z.nom === nom)!
  const k = cible.largeur / mise.planche.largeur

  it('bandeau, créneau, bandeau PHASAGE et étapes, dans cet ordre', () => {
    expect(zones.map((z) => z.nom)).toEqual(['bandeau', 'creneau', 'phasage-titre', 'phasage-etapes'])
  })

  it('coordonnées de la planche → pouces sur la diapositive', () => {
    expect(versPage(mise.planche, mise.planche, cible)).toEqual(cible)
    const b = versPage(mise.bandeau!.boite, mise.planche, cible)
    expect(zone('bandeau')).toMatchObject({ x: b.x, y: b.y, largeur: b.largeur, hauteur: b.hauteur })
    expect(b.x).toBeCloseTo(cible.x + (mise.bandeau!.boite.x - mise.planche.x) * k, 12)
    const cr = versPage(mise.creneau.boite, mise.planche, cible)
    expect(zone('creneau')).toMatchObject({ x: cr.x, y: cr.y, largeur: cr.largeur, hauteur: cr.hauteur })
    const e = versPage(mise.phasage!.entete, mise.planche, cible)
    expect(zone('phasage-titre')).toMatchObject({ x: e.x, y: e.y, largeur: e.largeur, hauteur: e.hauteur })
    // Les étapes : sous le bandeau PHASAGE, jusqu'au bas de l'encart.
    const etapes = zone('phasage-etapes')
    expect(etapes.x).toBeCloseTo(e.x, 12)
    expect(etapes.y).toBeCloseTo(e.y + e.hauteur, 12)
    expect(etapes.largeur).toBeCloseTo(e.largeur, 12)
    expect(etapes.y + etapes.hauteur).toBeCloseTo(cible.y + (mise.phasage!.boite.y + mise.phasage!.boite.hauteur - mise.planche.y) * k, 12)
    for (const z of zones) expect(dedans(z, DIAPOSITIVE)).toBe(true)
    // Le créneau à droite, le bandeau au centre, le PHASAGE en bas à gauche.
    expect(zone('creneau').x).toBeGreaterThan(zone('bandeau').x + zone('bandeau').largeur)
    expect(zone('bandeau').x + zone('bandeau').largeur / 2).toBeCloseTo(cible.x + cible.largeur / 2, 9)
    expect(zone('phasage-titre').x).toBeCloseTo(cible.x, 12)
    expect(zone('phasage-etapes').y + zone('phasage-etapes').hauteur).toBeCloseTo(cible.y + cible.hauteur, 9)
  })

  it('tailles de texte et épaisseurs de bord en points, à l’échelle de la planche', () => {
    expect(zone('bandeau').taille).toBeCloseTo(mise.bandeau!.lignes[0].taille * k * 72, 9)
    expect(zone('creneau').taille).toBeCloseTo(mise.creneau.lignes[0].taille * k * 72, 9)
    expect(zone('phasage-etapes').taille).toBeCloseTo(mise.phasage!.titre.taille * k * 72, 9)
    // Tailles lisibles sur une diapositive.
    for (const z of zones) expect(z.taille).toBeGreaterThan(8)
    expect(zone('bandeau').bord!.epaisseur).toBeCloseTo(mise.trait * 2.2 * k * 72, 9)
    expect(zone('creneau').bord!.epaisseur).toBeCloseTo(mise.trait * 2.6 * k * 72, 9)
    expect(zone('phasage-etapes').marges.gauche).toBeCloseTo(mise.retrait * k * 72, 9)
    expect(zone('phasage-etapes').interligne).toBeCloseTo(zone('phasage-etapes').taille * 1.3, 9)
  })

  it('dans le style de la planche : bandeau bleu clair, créneau gris bordé de rouge, PHASAGE gris foncé et gris clair', () => {
    expect(zone('bandeau')).toMatchObject({ fond: '#e4eff9', bord: { couleur: '#1f4e8c' }, alignement: 'centre' })
    expect(zone('creneau')).toMatchObject({ fond: '#efefef', bord: { couleur: '#e0201b' }, alignement: 'centre' })
    expect(zone('phasage-titre')).toMatchObject({ fond: '#76726f', couleur: '#ffffff', bord: null })
    expect(zone('phasage-etapes')).toMatchObject({ fond: '#ececec', couleur: '#3c3c3c', alignement: 'gauche', vertical: 'haut' })
  })

  it('contenu : bandeau sur deux lignes, titre du créneau puis les heures, étapes numérotées', () => {
    expect(zone('bandeau').paragraphes).toEqual([
      { texte: 'RVB V1 sur 50 m — OCP fictive', gras: true },
      { texte: 'Données d’exemple', gras: true },
    ])
    expect(zone('creneau').paragraphes).toEqual([
      { texte: 'Dépose de la voie', gras: true },
      { texte: 'Ve 22h30 –', gras: false },
      { texte: 'Ve/Sa 00h30', gras: false },
    ])
    expect(zone('phasage-titre').paragraphes).toEqual([{ texte: 'PHASAGE', gras: true }])
    expect(zone('phasage-etapes').paragraphes).toEqual([
      { texte: '1 – Interception de la V1 et dépose des rails', gras: false },
      { texte: '2 – Dépose des traverses par la pelle RR 1', gras: false },
    ])
  })

  it('créneau « début seul » : une ligne en gras ; sans titre, les heures en gras', () => {
    const z4 = zonesTexte(s, 3, miseEnPage(s, 3, listes), cible)
    expect(zone('creneau', z4).paragraphes).toEqual([{ texte: 'Ve/Sa 04h30', gras: true }])
    const z2 = zonesTexte(s, 1, miseEnPage(s, 1, listes), cible)
    expect(zone('creneau', z2).paragraphes).toEqual([
      { texte: 'Ve/Sa', gras: true },
      { texte: '00h30 – 02h30', gras: true },
    ])
    expect(zone('phasage-etapes', z2).paragraphes).toEqual([{ texte: '3 – Déballastage côté Sud avec deux pelles RR', gras: false }])
  })

  it('sans bandeau ni étape : le créneau seul ; une étape sur plusieurs lignes garde ses retours à la ligne', () => {
    const s1 = synoptique(c, 'synoptique-1')
    const m1 = miseEnPage(s1, 0, listes)
    expect(zonesTexte(s1, 0, m1, ajusterDansPage(m1.planche, DIAPOSITIVE)).map((z) => z.nom)).toEqual(['creneau'])
    const multi = { ...s, images: s.images.map((im, i) => (i === 0 ? { ...im, phasage: [{ numero: 7, libelle: 'Dépose\ndu BS 7a' }] } : im)) }
    const zm = zonesTexte(multi, 0, miseEnPage(multi, 0, listes), cible)
    expect(zone('phasage-etapes', zm).paragraphes).toEqual([{ texte: '7 – Dépose\ndu BS 7a', gras: false }])
  })

  it('planches à exporter : zones seulement pour PowerPoint « Textes modifiables »', () => {
    const options = (o: Partial<OptionsExport>): OptionsExport => ({ ...OPTIONS_PAR_DEFAUT, ...o })
    const modifiables = planchesAExporter(s, [0, 3], listes, options({}))
    expect(modifiables.map((p) => [p.index, p.textesAPart, p.zones.length])).toEqual([
      [0, true, 4],
      [3, true, 4],
    ])
    expect(modifiables[0].cible).toEqual(cible)
    const image = planchesAExporter(s, [0], listes, options({ textes: 'image' }))
    expect(image[0]).toMatchObject({ textesAPart: false, zones: [] })
    const pdf = planchesAExporter(s, [0], listes, options({ format: 'pdf', page: 'A3', textes: 'modifiables' }))
    expect(pdf[0]).toMatchObject({ textesAPart: false, zones: [] })
    expect(pdf[0].cible).toEqual(ajusterDansPage(mise.planche, PAGES_PDF.A3))
  })
})

describe('cartouche de la page de garde', () => {
  it('modèle et valeurs par défaut : tout vide, type de document « Synoptique »', () => {
    expect(creerCartouche()).toEqual({
      emetteur: '',
      typeDocument: 'Synoptique',
      indice: '',
      date: '',
      etabliPar: '',
      validePar: '',
      approuvePar: '',
      modification: '',
    })
    expect(CHAMPS_CARTOUCHE.map((c) => c.libelle)).toEqual([
      'Émetteur',
      'Type de document',
      'Indice',
      'Date',
      'Établi par',
      'Validé par',
      'Approuvé par',
      'Modification',
    ])
    expect(cartoucheVide(creerCartouche())).toBe(true)
    expect(resumeCartouche(creerCartouche())).toBe('à remplir')
  })

  it('relecture : champs absents ou illisibles vides, les autres gardés', () => {
    expect(lireCartouche(undefined)).toEqual(creerCartouche())
    expect(lireCartouche('n’importe quoi')).toEqual(creerCartouche())
    expect(lireCartouche({ indice: 'C', date: 12, etabliPar: 'A. Exemple', inconnu: 'x' })).toEqual({ ...creerCartouche(), indice: 'C', etabliPar: 'A. Exemple' })
  })

  it('modifier et résumer', () => {
    const s = modifierCartouche(synoptique(fixture(), 'synoptique-1'), { indice: 'A', date: '01/10/2026', etabliPar: 'A. Exemple' })
    expect(s.cartouche).toMatchObject({ indice: 'A', date: '01/10/2026', typeDocument: 'Synoptique' })
    expect(resumeCartouche(s.cartouche)).toBe('indice A · 01/10/2026 · établi par A. Exemple')
    expect(resumeCartouche({ ...creerCartouche(), emetteur: 'X' })).toBe('rempli en partie')
  })

  it('voyage avec l’export et l’import du chantier (depuis le fichier version 5)', () => {
    const c = fixture()
    expect(synoptique(c, 'synoptique-3').cartouche).toMatchObject({ emetteur: 'Entreprise fictive', indice: 'B', etabliPar: 'A. Exemple' })
    const relu = lireChantier(serialiserChantier(c))
    expect(relu.ok && relu.chantier).toEqual(c)
    expect(JSON.parse(serialiserChantier(c)).version).toBe(VERSION_CHANTIER)
  })

  it('migration : un fichier de l’étape 7 (version 4) s’ouvre, cartouches vides', () => {
    const brut = JSON.parse(texteFixture)
    brut.version = 4
    for (const s of brut.synoptiques) delete s.cartouche
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(true)
    if (lu.ok) for (const s of lu.chantier.synoptiques) expect(s.cartouche).toEqual(creerCartouche())
  })

  it('migration : un chantier gardé dans le navigateur à l’étape 7 reçoit des cartouches vides', () => {
    const ancien = JSON.parse(JSON.stringify(fixture()))
    for (const s of ancien.synoptiques) delete s.cartouche
    const { chantier } = migrerChantier(ancien)
    for (const s of chantier.synoptiques) expect(s.cartouche).toEqual(creerCartouche())
    // Un cartouche déjà rempli n'est pas touché.
    expect(synoptique(migrerChantier(fixture()).chantier, 'synoptique-3').cartouche).toEqual(synoptique(fixture(), 'synoptique-3').cartouche)
  })

  it('page de garde : titre, vignette et tableau dans la page, colonnes dans l’ordre', () => {
    const s = synoptique(fixture(), 'synoptique-3')
    for (const page of [DIAPOSITIVE, PAGES_PDF.A4, PAGES_PDF.A3]) {
      const g = pageDeGarde(page, { chantier: ' Chantier d’exemple ', synoptique: s.nom }, s.cartouche)
      expect(g.lignesTitre).toEqual(['Chantier d’exemple', 'Nuit 3 — flèches et légende'])
      expect(dedans(g.titre, page) && dedans(g.zoneVignette, page)).toBe(true)
      const t = g.tableau
      expect(dedans({ x: t.x, y: t.y, largeur: t.largeur, hauteur: t.hauteurEntete + t.hauteurValeurs }, page)).toBe(true)
      expect(t.colonnes.reduce((l, col) => l + col.largeur, 0)).toBeCloseTo(t.largeur, 9)
      expect(t.colonnes.map((col) => col.valeur)).toEqual([
        'Entreprise fictive',
        'Synoptique',
        'B',
        '23/10/2026',
        'A. Exemple',
        'B. Modèle',
        'C. Fictif',
        'Création du synoptique (données fictives)',
      ])
      // Le titre au-dessus de la vignette, la vignette au-dessus du tableau.
      expect(g.titre.y + g.titre.hauteur).toBeLessThan(g.zoneVignette.y)
      expect(g.zoneVignette.y + g.zoneVignette.hauteur).toBeLessThan(t.y)
      expect(t.taille).toBeGreaterThan(9)
    }
  })
})

describe('nom du fichier exporté', () => {
  it('le nom du synoptique, nettoyé des caractères interdits', () => {
    expect(nomFichierExport('Nuit 1 — RVB V1', 'pptx')).toBe('Nuit 1 — RVB V1.pptx')
    expect(nomFichierExport('OCP 1/2 : V1*V2 "Sud" <test>?', 'pdf')).toBe('OCP 1-2 - V1-V2 -Sud- -test-.pdf')
    expect(nomFichierExport('  Phase\ttransitoire.  ', 'pdf')).toBe('Phase transitoire.pdf')
    expect(nomFichierExport('a\\b|c', 'pptx')).toBe('a-b-c.pptx')
    expect(nomFichierExport('   ', 'pptx')).toBe('synoptique.pptx')
    expect(nomFichierExport('x'.repeat(300), 'pdf')).toBe(`${'x'.repeat(150)}.pdf`)
  })
})

// ——— Génération des fichiers, sans navigateur ———

// Une image factice (1 × 1 pixel PNG) à la place du rendu de la planche.
const IMAGE_FACTICE: ImageRendue = {
  donnees: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  largeur: 1,
  hauteur: 1,
}

async function generer(redacteur: Redacteur, s: Synoptique, c: Chantier, options: OptionsExport, indices: number[]): Promise<ArrayBuffer> {
  if (options.pageDeGarde) redacteur.garde(pageDeGarde(tailleDePage(options), { chantier: c.nom, synoptique: s.nom }, s.cartouche), IMAGE_FACTICE)
  for (const p of planchesAExporter(s, indices, listesDe(c), options)) redacteur.planche(p, IMAGE_FACTICE)
  return redacteur.terminer()
}

const diapositives = (zip: Map<string, Buffer>) =>
  [...zip.keys()]
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    .map((n) => zip.get(n)!.toString('utf8'))

describe('génération du PowerPoint', () => {
  const c = fixture()
  const s = synoptique(c, 'synoptique-3')
  const infos = { titre: s.nom, sujet: 'Synoptique' }

  it('page de garde et une diapositive par image, textes modifiables et cartouche dans le XML', async () => {
    const zip = lireZip(await generer(redacteurPptx(infos), s, c, OPTIONS_PAR_DEFAUT, [0, 1]))
    const xml = diapositives(zip)
    expect(xml).toHaveLength(3)
    // Diapositive 16/9 (12 192 000 × 6 858 000 EMU).
    expect(zip.get('ppt/presentation.xml')!.toString('utf8')).toContain('<p:sldSz cx="12192000" cy="6858000"')
    // Page de garde : titre et cartouche en tableau natif.
    expect(xml[0]).toContain('<a:tbl>')
    for (const t of ['Chantier d’exemple (données fictives)', 'Nuit 3 — flèches et légende', 'Émetteur', 'Établi par', 'Entreprise fictive', 'A. Exemple', 'Création du synoptique (données fictives)'])
      expect(xml[0]).toContain(t)
    // Planches : l'image, puis les zones de texte natives.
    expect(xml[1]).toContain('<p:pic>')
    expect(xml[1]).toContain('txBox="1"')
    for (const t of ['RVB V1 sur 50 m — OCP fictive', 'Flèches et légende', 'Ve 22h30 –', 'Sa 01h30', 'PHASAGE', '1 – Déballastage du RVB 50 m depuis le Sud avec les pelles RR 1 et 2', '2 – Chargement des déblais dans le TTX 1'])
      expect(xml[1]).toContain(t)
    expect(xml[2]).toContain('3 – Sous-couche ballast sur le RVB 50 m')
    expect(xml[2]).not.toContain('1 – Déballastage')
    // Police, couleurs du style des planches, langue française.
    expect(xml[1]).toContain('typeface="Arial"')
    expect(xml[1]).toContain('<a:srgbClr val="E4EFF9"/>')
    expect(xml[1]).toContain('<a:srgbClr val="E0201B"/>')
    expect(xml[1]).toContain('lang="fr-FR"')
    expect([...zip.keys()].filter((n) => /^ppt\/media\/.+\.png$/.test(n))).toHaveLength(3)
  })

  it('« Tout en image » sur la plage 2 à 2, sans page de garde : une diapositive, aucune zone de texte', async () => {
    const options: OptionsExport = { ...OPTIONS_PAR_DEFAUT, textes: 'image', pageDeGarde: false }
    const xml = diapositives(lireZip(await generer(redacteurPptx(infos), s, c, options, [1])))
    expect(xml).toHaveLength(1)
    expect(xml[0]).toContain('<p:pic>')
    expect(xml[0]).not.toContain('txBox="1"')
    expect(xml[0]).not.toContain('PHASAGE')
  })

  it('une étape sur deux lignes : deux paragraphes, XML valide (propriétés en tête de paragraphe)', async () => {
    const multi = { ...s, images: [{ ...s.images[0], phasage: [{ numero: 7, libelle: 'Dépose\ndu BS 7a' }] }] }
    const xml = diapositives(lireZip(await generer(redacteurPptx(infos), multi, c, { ...OPTIONS_PAR_DEFAUT, pageDeGarde: false }, [0])))
    expect(xml[0]).toMatch(/<a:t>7 – Dépose<\/a:t><\/a:r><a:endParaRPr[^>]*\/><\/a:p><a:p><a:pPr[^>]*>.*?<a:t>du BS 7a<\/a:t>/)
    // Jamais de propriétés de paragraphe au milieu d'un paragraphe.
    for (const p of xml[0].match(/<a:p>.*?<\/a:p>/g)!) expect(p.indexOf('<a:pPr', 1)).toBeLessThanOrEqual(5)
    expect(xml[0]).not.toContain('<a:br/>')
  })
})

describe('génération du PDF', () => {
  const c = fixture()
  const s = synoptique(c, 'synoptique-2')
  const infos = { titre: s.nom, sujet: 'Synoptique' }
  const pages = (octets: ArrayBuffer) => Buffer.from(octets).toString('latin1').match(/\/Type \/Page\b(?!s)/g)?.length ?? 0
  const tailles = (octets: ArrayBuffer) =>
    [...Buffer.from(octets).toString('latin1').matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [Number(m[1]), Number(m[2])])

  it('16/9 : page de garde et une page par image', async () => {
    const octets = await generer(redacteurPdf(PAGES_PDF['16/9'], infos), s, c, { ...OPTIONS_PAR_DEFAUT, format: 'pdf' }, [0, 1, 2, 3])
    expect(Buffer.from(octets).subarray(0, 5).toString()).toBe('%PDF-')
    expect(pages(octets)).toBe(5)
    for (const [l, h] of tailles(octets)) {
      expect(l).toBeCloseTo(960, 0)
      expect(h).toBeCloseTo(540, 0)
    }
  })

  it('A3 paysage sans page de garde, plage 2 à 3 : deux pages de 420 × 297 mm', async () => {
    const options: OptionsExport = { ...OPTIONS_PAR_DEFAUT, format: 'pdf', page: 'A3', pageDeGarde: false }
    const octets = await generer(redacteurPdf(PAGES_PDF.A3, infos), s, c, options, [1, 2])
    expect(pages(octets)).toBe(2)
    for (const [l, h] of tailles(octets)) {
      expect((l / 72) * 25.4).toBeCloseTo(420, 0)
      expect((h / 72) * 25.4).toBeCloseTo(297, 0)
    }
  })
})
