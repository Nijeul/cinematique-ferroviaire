import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ajouterSynoptique, creerChantier, ajouterPlan, remplacerPlan } from '../src/plan/chantier.ts'
import { deplacerPoint } from '../src/plan/edition.ts'
import { modifierZone } from '../src/plan/elements.ts'
import { lireProjet } from '../src/plan/lecture.ts'
import type { Projet } from '../src/plan/projet.ts'
import {
  avertissementsImages,
  CADRAGE_MIN,
  creerSynoptique,
  modifierDebut,
  modifierFin,
  modifierHorairesImage,
  nouvelleImage,
  normaliserCadrage,
  projetDeImage,
  rectangleAffiche,
  supprimerImage,
  verifierDemande,
  type DemandeValide,
  type Synoptique,
} from '../src/plan/synoptique.ts'
import { ajusterSurRectangle, versEcran } from '../src/plan/vue.ts'

const exemple = (): Projet => {
  const lu = lireProjet(readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8'))
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return {
    ...lu.projet,
    fond: { image: 'data:image/png;base64,iVBORw0KGgo=', largeur: 1600, hauteur: 900, nomFichier: 'plan.png', page: null, nombrePages: null },
  }
}

// Vendredi 22h30 → lundi 06h30 (3 360 minutes).
const DEMANDE: DemandeValide = { nom: 'Nuit 1', t0: '2026-10-09T22:30', fin: 3360, cadrage: null }
const QUAND = '2026-09-29T15:00:00.000Z'

const synoptique = (fin = 3360): Synoptique => creerSynoptique('synoptique-1', { ...DEMANDE, fin }, { id: 'plan-1', projet: exemple() }, QUAND)

const valeur = <T>(r: { ok: true; valeur: T } | { ok: false; erreur: string }): T => {
  if (!r.ok) throw new Error(r.erreur)
  return r.valeur
}

describe('formulaire « Nouveau synoptique »', () => {
  it('accepte un nom et des horaires, et passe en minutes depuis T0', () => {
    const r = verifierDemande({ nom: '  Nuit 1 ', debut: '2026-10-09T22:30', fin: '2026-10-12T06:30', cadrage: null })
    expect(r).toEqual({ ok: true, valeur: DEMANDE })
  })

  it('exige une fin après le début, avec un message clair', () => {
    const r = verifierDemande({ nom: 'N', debut: '2026-10-09T22:30', fin: '2026-10-09T22:30', cadrage: null })
    expect(r).toEqual({ ok: false, erreurs: ["L'heure de fin doit être après l'heure de début."] })
  })

  it('signale un nom vide et des horaires incomplets', () => {
    const r = verifierDemande({ nom: ' ', debut: '', fin: '2026-10-09', cadrage: null })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erreurs).toHaveLength(3)
      expect(r.erreurs.join(' ')).toContain('Donnez un nom')
      expect(r.erreurs.join(' ')).toContain('début est incomplète')
    }
  })
})

describe('création : copie figée du plan', () => {
  it('copie le plan entier, fond compris, avec une première image sur tout le synoptique', () => {
    const plan = exemple()
    const s = creerSynoptique('synoptique-1', DEMANDE, { id: 'plan-1', projet: plan }, QUAND)
    expect(s.origine).toEqual({ planId: 'plan-1', nomPlan: plan.nom, copieLe: QUAND })
    expect(s.fond).toEqual(plan.fond)
    expect(s.images).toHaveLength(1)
    expect(s.images[0]).toMatchObject({ debut: 0, fin: 3360 })
    expect({ ...projetDeImage(s, s.images[0]), nom: plan.nom }).toEqual(plan)
  })

  it('reste intacte quand on modifie le plan ensuite (voie déplacée, zone renommée)', () => {
    let chantier = ajouterPlan(creerChantier('chantier-1', 'C', QUAND), exemple()).chantier
    chantier = ajouterSynoptique(chantier, chantier.plans[0], DEMANDE, QUAND).chantier
    const avant = structuredClone(chantier.synoptiques[0])
    const plan = chantier.plans[0].projet
    let modifie = deplacerPoint(plan, plan.voies[0].id, 0, { x: 5, y: 5 })
    modifie = modifierZone(modifie, modifie.zones[0].id, { nom: 'Autre nom', couleur: '#ff0000' })
    chantier = remplacerPlan(chantier, 'plan-1', modifie)
    expect(chantier.plans[0].projet.voies[0].points[0]).toEqual({ x: 5, y: 5 })
    expect(chantier.synoptiques[0]).toEqual(avant)
  })

  it('ne partage aucun élément avec le plan (même en mémoire)', () => {
    const plan = exemple()
    const s = creerSynoptique('s', DEMANDE, { id: 'p', projet: plan }, QUAND)
    plan.voies[0].points[0].x = -999
    expect(s.images[0].contenu.voies[0].points[0].x).not.toBe(-999)
  })
})

describe('cadrage', () => {
  const plan = { largeur: 1600, hauteur: 900 }

  it('normalise un rectangle glissé dans n’importe quel sens', () => {
    expect(normaliserCadrage({ x: 900, y: 600 }, { x: 300, y: 200 }, plan)).toEqual({ x: 300, y: 200, largeur: 600, hauteur: 400 })
  })

  it('le ramène dans les limites du plan', () => {
    expect(normaliserCadrage({ x: -100, y: 800 }, { x: 400, y: 2000 }, plan)).toEqual({ x: 0, y: 800, largeur: 400, hauteur: 100 })
  })

  it('ignore un rectangle trop petit (un clic)', () => {
    expect(normaliserCadrage({ x: 10, y: 10 }, { x: 10 + CADRAGE_MIN - 1, y: 300 }, plan)).toBeNull()
  })

  it('montre tout le plan sans cadrage', () => {
    expect(rectangleAffiche({ cadrage: null, ...plan })).toEqual({ x: 0, y: 0, largeur: 1600, hauteur: 900 })
  })

  it('ajuste la vue sur le cadre : il remplit l’écran, centré, avec la marge', () => {
    const cadre = { x: 400, y: 200, largeur: 800, hauteur: 200 }
    const vue = ajusterSurRectangle(cadre, { largeur: 1000, hauteur: 600 }, 20)
    expect(vue.zoom).toBeCloseTo(960 / 800)
    const hautGauche = versEcran(vue, { x: 400, y: 200 })
    const basDroit = versEcran(vue, { x: 1200, y: 400 })
    expect(hautGauche.x).toBeCloseTo(20)
    expect(basDroit.x).toBeCloseTo(980)
    expect(hautGauche.y).toBeCloseTo(600 - basDroit.y)
  })
})

describe('nouvelle image', () => {
  it('duplique l’image courante juste après, qui commence à sa fin et dure autant', () => {
    let s = valeur(modifierHorairesImage(synoptique(), 0, { fin: 180 }))
    const r = nouvelleImage(s, 0)
    s = r.synoptique
    expect(r.index).toBe(1)
    expect(r.message).toBeNull()
    expect(s.images.map((i) => [i.debut, i.fin])).toEqual([
      [0, 180],
      [180, 360],
    ])
    expect(s.images[1].contenu).toEqual(s.images[0].contenu)
    expect(s.images[1].contenu).not.toBe(s.images[0].contenu)
    expect(s.images[1].id).not.toBe(s.images[0].id)
  })

  it('s’insère après l’image courante, pas à la fin', () => {
    let s = valeur(modifierHorairesImage(synoptique(), 0, { fin: 60 }))
    s = nouvelleImage(s, 0).synoptique
    s = nouvelleImage(s, 0).synoptique
    expect(s.images.map((i) => i.id)).toEqual(['image-1', 'image-3', 'image-2'])
  })

  it('est bornée à la fin du synoptique', () => {
    const s = valeur(modifierHorairesImage(synoptique(300), 0, { fin: 200 }))
    expect(nouvelleImage(s, 0).synoptique.images[1]).toMatchObject({ debut: 200, fin: 300 })
  })

  it('reprend les horaires de la courante quand il ne reste pas de place, et le dit', () => {
    const r = nouvelleImage(synoptique(), 0)
    expect(r.synoptique.images[1]).toMatchObject({ debut: 0, fin: 3360 })
    expect(r.message).toContain('reprend ses horaires')
  })

  it('a ses propres éléments : les changer ne touche pas l’image d’origine', () => {
    const s = nouvelleImage(synoptique(), 0).synoptique
    s.images[1].contenu.zones[0].couleur = '#ff0000'
    expect(s.images[0].contenu.zones[0].couleur).not.toBe('#ff0000')
  })
})

describe('suppression d’image', () => {
  it('supprime l’image demandée', () => {
    const s = nouvelleImage(synoptique(), 0).synoptique
    expect(valeur(supprimerImage(s, 0)).images.map((i) => i.id)).toEqual(['image-2'])
  })

  it('refuse de supprimer la dernière image', () => {
    const r = supprimerImage(synoptique(), 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erreur).toContain('seule image')
  })
})

describe('horaires des images', () => {
  it('refuse une fin avant le début, ou hors du synoptique', () => {
    const s = synoptique()
    const erreur = (h: { debut?: number; fin?: number }) => {
      const r = modifierHorairesImage(s, 0, h)
      return r.ok ? '' : r.erreur
    }
    expect(erreur({ debut: 100, fin: 100 })).toContain('après son début')
    expect(erreur({ debut: -30 })).toContain('avant le début du synoptique (Ve 22h30)')
    expect(erreur({ fin: 3400 })).toContain('après la fin du synoptique (Lu 06h30)')
    expect(modifierHorairesImage(s, 0, { debut: 60, fin: 120 }).ok).toBe(true)
  })

  it('avertit, sans bloquer, des chevauchements et des trous', () => {
    let s = valeur(modifierHorairesImage(synoptique(), 0, { fin: 180 }))
    s = nouvelleImage(s, 0).synoptique // 180 → 360
    s = nouvelleImage(s, 1).synoptique // 360 → 540
    expect(avertissementsImages(s)).toEqual([])
    s = valeur(modifierHorairesImage(s, 1, { debut: 150 }))
    s = valeur(modifierHorairesImage(s, 2, { debut: 420 }))
    expect(avertissementsImages(s)).toEqual([
      'Les images 1 et 2 se chevauchent (Ve/Sa 01h00 → Ve/Sa 01h30).',
      'Trou entre les images 2 et 3 : rien de Ve/Sa 04h30 → Ve/Sa 05h30.',
    ])
  })
})

describe('horaires du synoptique', () => {
  it('avance le début : chaque image garde son heure réelle', () => {
    const s = valeur(modifierDebut(synoptique(), '2026-10-09T21:30'))
    expect(s.t0).toBe('2026-10-09T21:30')
    expect(s.fin).toBe(3420)
    expect(s.images[0]).toMatchObject({ debut: 60, fin: 3420 })
  })

  it('refuse un début qui laisserait une image avant lui', () => {
    const r = modifierDebut(synoptique(), '2026-10-09T23:00')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erreur).toContain("L'image 1 (Ve 22h30 → Lu 06h30) commencerait avant")
  })

  it('refuse une fin qui couperait une image, accepte une fin plus tardive', () => {
    const r = modifierFin(synoptique(), '2026-10-12T05:00')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erreur).toContain('finirait après')
    expect(valeur(modifierFin(synoptique(), '2026-10-12T08:00')).fin).toBe(3360 + 90)
    expect(modifierFin(synoptique(), '2026-10-09T20:00').ok).toBe(false)
  })
})
