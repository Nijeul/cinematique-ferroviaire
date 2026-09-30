import { creerEtatsExploitation } from '../src/plan/exploitation.ts'
import { describe, expect, it } from 'vitest'
import {
  ajouterEtape,
  couperLignes,
  deplacerEtape,
  lignesCreneau,
  miseEnPage,
  modifierCreneau,
  modifierEtape,
  numeroEtapePropose,
  supprimerEtape,
  texteEtape,
} from '../src/plan/planche.ts'
import { creerCatalogue } from '../src/plan/catalogue.ts'
import { creerEtatsVoie } from '../src/plan/etatsVoie.ts'
import { creerTypesFleches } from '../src/plan/fleches.ts'
import { creerProjet } from '../src/plan/projet.ts'
import { creerSynoptique, modifierHorairesImage, nouvelleImage, type Synoptique } from '../src/plan/synoptique.ts'
import { partiesHoraire } from '../src/plan/temps.ts'

const QUAND = '2026-09-29T15:00:00.000Z'
const LISTES = { etatsVoie: creerEtatsVoie(), typesFleches: creerTypesFleches(), catalogue: creerCatalogue(), etatsExploitation: creerEtatsExploitation() }

const valeur = <T>(r: { ok: true; valeur: T } | { ok: false; erreur: string }): T => {
  if (!r.ok) throw new Error(r.erreur)
  return r.valeur
}

// Vendredi 22h30 → samedi 06h30, cadré sur 900 × 460 px du plan.
const synoptique = (): Synoptique =>
  creerSynoptique(
    'synoptique-1',
    { nom: 'Nuit 1', t0: '2026-10-09T22:30', fin: 480, cadrage: { x: 200, y: 180, largeur: 900, hauteur: 460 } },
    { id: 'plan-1', projet: creerProjet('Plan fictif') },
    QUAND,
  )

// Trois images : 22h30 – 00h30, 00h30 – 02h30, 02h30 – 04h30.
const troisImages = (): Synoptique => {
  let s = valeur(modifierHorairesImage(synoptique(), 0, { fin: 120 }))
  s = nouvelleImage(s, 0).synoptique
  return nouvelleImage(s, 1).synoptique
}

const avecEtape = (s: Synoptique, index: number, libelle: string): Synoptique => {
  const r = ajouterEtape(s, index)
  return valeur(modifierEtape(r.synoptique, index, r.position, { libelle }))
}

describe('encart PHASAGE : étapes numérotées', () => {
  it('une image neuve n’a pas d’étape ; le premier numéro proposé est 1', () => {
    const s = synoptique()
    expect(s.images[0].phasage).toEqual([])
    expect(numeroEtapePropose(s, 0)).toBe(1)
  })

  it('numéro proposé : le plus grand des images précédentes (et de celle-ci), plus 1', () => {
    let s = troisImages()
    s = avecEtape(s, 0, 'Interception')
    s = avecEtape(s, 0, 'Dépose des rails')
    expect(s.images[0].phasage.map((e) => e.numero)).toEqual([1, 2])
    expect(numeroEtapePropose(s, 1)).toBe(3)
    s = avecEtape(s, 1, 'Déballastage')
    expect(numeroEtapePropose(s, 2)).toBe(4)
    // Une image plus loin qui a déjà un grand numéro ne compte pas pour les précédentes.
    s = valeur(modifierEtape(avecEtape(s, 2, 'Pose'), 2, 0, { numero: 12 }))
    expect(numeroEtapePropose(s, 1)).toBe(4)
    expect(numeroEtapePropose(s, 2)).toBe(13)
  })

  it('modifier, réordonner, supprimer ; numéro entier à partir de 1', () => {
    let s = avecEtape(avecEtape(synoptique(), 0, 'A'), 0, 'B')
    expect(modifierEtape(s, 0, 0, { numero: 0 }).ok).toBe(false)
    expect(modifierEtape(s, 0, 0, { numero: 2.5 }).ok).toBe(false)
    s = valeur(modifierEtape(s, 0, 1, { libelle: 'B\nsur deux lignes' }))
    s = deplacerEtape(s, 0, 1, -1)
    expect(s.images[0].phasage).toEqual([
      { numero: 2, libelle: 'B\nsur deux lignes' },
      { numero: 1, libelle: 'A' },
    ])
    expect(deplacerEtape(s, 0, 0, -1)).toBe(s)
    s = supprimerEtape(s, 0, 0)
    expect(s.images[0].phasage).toEqual([{ numero: 1, libelle: 'A' }])
    expect(texteEtape({ numero: 3, libelle: 'Dépose des rails' })).toBe('3 – Dépose des rails')
  })

  it('« Nouvelle image » ne recopie pas les étapes, ni le titre du créneau', () => {
    let s = avecEtape(synoptique(), 0, 'Dépose')
    s = valeur(modifierHorairesImage(s, 0, { fin: 120 }))
    s = modifierCreneau(s, 0, { titre: 'Phase avant travaux', heures: 'aucune' })
    const r = nouvelleImage(s, 0)
    expect(r.synoptique.images[1]).toMatchObject({ phasage: [], titre: '', heures: 'plage' })
    expect(r.synoptique.images[0].phasage).toHaveLength(1)
    expect(numeroEtapePropose(r.synoptique, 1)).toBe(2)
  })
})

describe('créneau horaire', () => {
  const image = (champs: Partial<{ debut: number; fin: number; titre: string; heures: 'plage' | 'debut' | 'aucune' }>) => ({
    debut: 120,
    fin: 300,
    titre: '',
    heures: 'plage' as const,
    ...champs,
  })
  const T0 = '2026-10-09T22:30'

  it('début et fin la même nuit : « Ve/Sa » puis « 00h30 – 03h30 »', () => {
    expect(lignesCreneau(T0, image({}))).toEqual({ titre: [], heures: ['Ve/Sa', '00h30 – 03h30'] })
    expect(lignesCreneau(T0, image({})).heures.join(' ')).toBe('Ve/Sa 00h30 – 03h30')
  })

  it('début et fin à des jours différents', () => {
    expect(lignesCreneau(T0, image({ debut: 0, fin: 180 })).heures).toEqual(['Ve 22h30 –', 'Ve/Sa 01h30'])
  })

  it('début seul : « Sa 20h00 »', () => {
    expect(lignesCreneau(T0, image({ debut: 1290, heures: 'debut' })).heures).toEqual(['Sa 20h00'])
  })

  it('titre au-dessus des heures, ou à leur place', () => {
    expect(lignesCreneau(T0, image({ titre: ' Phase avant travaux ' }))).toEqual({ titre: ['Phase avant travaux'], heures: ['Ve/Sa', '00h30 – 03h30'] })
    expect(lignesCreneau(T0, image({ titre: 'Phase avant\ntravaux', heures: 'aucune' }))).toEqual({ titre: ['Phase avant', 'travaux'], heures: [] })
    // Sans titre, jamais de créneau vide : les heures restent.
    expect(lignesCreneau(T0, image({ heures: 'aucune' })).heures).toEqual(['Ve/Sa', '00h30 – 03h30'])
  })

  it('le jour et l’heure se lisent séparément', () => {
    expect(partiesHoraire(T0, 0)).toEqual({ jour: 'Ve', heure: '22h30' })
    expect(partiesHoraire(T0, 180)).toEqual({ jour: 'Ve/Sa', heure: '01h30' })
    expect(partiesHoraire('pas une date', 0)).toBeNull()
  })
})

describe('mise en page de la planche', () => {
  it('coupe les libellés longs aux espaces, garde les retours à la ligne', () => {
    expect(couperLignes('Dépose des rails et des traverses', 100, 10)).toEqual(['Dépose des rails', 'et des traverses'])
    expect(couperLignes('Ligne 1\nLigne 2', 1000, 10)).toEqual(['Ligne 1', 'Ligne 2'])
    expect(couperLignes('Motextrêmementlong', 20, 10)).toEqual(['Motextrêmementlong'])
  })

  it('créneau en haut à droite, au-dessus du plan ; ni bandeau ni encart quand ils sont vides', () => {
    const s = synoptique()
    const p = miseEnPage(s, 0, LISTES)
    expect(p.carte).toEqual({ x: 200, y: 180, largeur: 900, hauteur: 460 })
    expect(p.bandeau).toBeNull()
    expect(p.phasage).toBeNull()
    const c = p.creneau.boite
    // Dans la bande du haut, contre le bord droit, sans toucher le plan.
    expect(c.y).toBeGreaterThan(p.planche.y)
    expect(c.y + c.hauteur).toBeLessThan(p.carte.y)
    expect(c.x + c.largeur).toBeLessThanOrEqual(p.carte.x + p.carte.largeur)
    expect(c.x).toBeGreaterThan(p.carte.x + p.carte.largeur * 0.7)
    // Pas de bande du bas sans étape.
    expect(p.planche.y + p.planche.hauteur).toBe(p.carte.y + p.carte.hauteur)
  })

  it('bandeau de titre centré en haut, sur plusieurs lignes, sans toucher le créneau', () => {
    const s = { ...synoptique(), bandeau: 'RVB sur 80 m en deux zones\nAbaissement de voie' }
    const p = miseEnPage(s, 0, LISTES)
    expect(p.bandeau!.lignes.map((l) => l.texte)).toEqual(['RVB sur 80 m en deux zones', 'Abaissement de voie'])
    const b = p.bandeau!.boite
    expect(b.x + b.largeur / 2).toBeCloseTo(p.carte.x + p.carte.largeur / 2)
    expect(b.x + b.largeur).toBeLessThan(p.creneau.boite.x)
    expect(b.y + b.hauteur).toBeLessThan(p.carte.y)
  })

  it('le bandeau s’arrête avant le plus large des créneaux, sur toutes les images', () => {
    let s = { ...troisImages(), bandeau: 'RVB V1 sur 50 m — OCP fictive, dépose et repose de la voie' }
    s = { ...s, images: s.images.map((im, i) => (i === 1 ? { ...im, titre: 'Dépose de la voie et déballastage' } : im)) }
    const pages = [0, 1, 2].map((i) => miseEnPage(s, i, LISTES))
    const larges = Math.min(...pages.map((p) => p.creneau.boite.x))
    for (const p of pages) {
      expect(p.bandeau!.boite).toEqual(pages[0].bandeau!.boite)
      expect(p.bandeau!.boite.x + p.bandeau!.boite.largeur).toBeLessThan(larges)
      expect(p.bandeau!.boite.x + p.bandeau!.boite.largeur / 2).toBeCloseTo(p.carte.x + p.carte.largeur / 2)
    }
  })

  it('encart PHASAGE sous le plan, à gauche ; même hauteur de bande sur toutes les images', () => {
    let s = troisImages()
    s = avecEtape(s, 0, 'Dépose des rails et des traverses sur le RVB 80 m. Les rails seront positionnés aux extrémités des traverses.')
    s = avecEtape(s, 0, 'Arrivée du TTX 1')
    s = avecEtape(s, 1, 'Déballastage')
    const [p1, p2, p3] = [0, 1, 2].map((i) => miseEnPage(s, i, LISTES))
    const e = p1.phasage!
    expect(e.titre.texte).toBe('PHASAGE')
    expect(e.boite.x).toBe(p1.carte.x)
    expect(e.boite.y).toBe(p1.carte.y + p1.carte.hauteur)
    expect(e.boite.largeur).toBeLessThan(p1.carte.largeur * 0.6)
    // Le long libellé va à la ligne ; le numéro ouvre la première ligne.
    expect(e.lignes.length).toBeGreaterThan(2)
    expect(e.lignes[0].texte.startsWith('1 – Dépose')).toBe(true)
    expect(e.lignes.every((l) => l.y < e.boite.y + e.boite.hauteur)).toBe(true)
    // Bandes identiques d'une image à l'autre ; l'image 3, sans étape, n'a pas d'encart.
    expect(p2.planche).toEqual(p1.planche)
    expect(p3.planche).toEqual(p1.planche)
    expect(p2.phasage!.boite).toEqual(e.boite)
    expect(p3.phasage).toBeNull()
  })

  it('le titre du créneau passe au-dessus des heures, et va à la ligne s’il est long', () => {
    const s = modifierCreneau(synoptique(), 0, { titre: 'Phase avant travaux' })
    const lignes = miseEnPage(s, 0, LISTES).creneau.lignes
    expect(lignes.map((l) => [l.texte, l.gras])).toEqual([
      ['Phase avant', true],
      ['travaux', true],
      ['Ve 22h30 –', false],
      ['Sa 06h30', false],
    ])
    expect(lignes[0].y).toBeLessThan(lignes[1].y)
  })
})
