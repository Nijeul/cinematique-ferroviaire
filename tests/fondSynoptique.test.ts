import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { migrerChantier, type Chantier } from '../src/plan/chantier.ts'
import { lireChantier, serialiserChantier, VERSION_CHANTIER } from '../src/plan/fichierChantier.ts'
import { modifierOpaciteFond, OPACITE_FOND_PAR_DEFAUT, opaciteFond, pourcentBorne, pourcentOpaciteFond } from '../src/plan/fondSynoptique.ts'
import { annuler, creerHistorique, enregistrer } from '../src/plan/historique.ts'
import { creerProjet } from '../src/plan/projet.ts'
import { creerSynoptique, nouvelleImage, projetDeImage, type Synoptique } from '../src/plan/synoptique.ts'

// Complément de l'étape 10 : opacité du fond de plan réglée depuis le
// synoptique (« Je voudrais pouvoir modifier l'opacité du fond du plan depuis
// le synoptique »). Données fictives.

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const synoptique = (c: Chantier, id: string): Synoptique => c.synoptiques.find((s) => s.id === id)!
const opacites = (s: Synoptique) => s.images.map((im) => projetDeImage(s, im).calques.fond.opacite)

describe('opacité du fond de plan d’un synoptique', () => {
  it('borne la valeur entre 0 et 100 %, arrondie', () => {
    expect(pourcentBorne(-5)).toBe(0)
    expect(pourcentBorne(150)).toBe(100)
    expect(pourcentBorne(42.4)).toBe(42)
    expect(pourcentBorne(Number.NaN)).toBe(100)
  })

  it('par défaut, reprend l’opacité du fond du plan copiée à la création', () => {
    const projet = creerProjet('Plan')
    projet.calques.fond.opacite = 0.35
    const s = creerSynoptique('s', { nom: 'Essai', t0: '2026-10-09T22:00', fin: 480, cadrage: null }, { id: 'plan-1', projet }, '2026-09-30T10:00:00Z')
    expect(pourcentOpaciteFond(s, 0)).toBe(35)
    // Un plan neuf : fond plein.
    const neuf = creerSynoptique('t', { nom: 'Essai', t0: '2026-10-09T22:00', fin: 480, cadrage: null }, { id: 'plan-2', projet: creerProjet('P') }, '2026-09-30T10:00:00Z')
    expect(opaciteFond(neuf, 0)).toBe(OPACITE_FOND_PAR_DEFAUT)
    expect(pourcentOpaciteFond(synoptique(fixture(), 'synoptique-4'), 0)).toBe(100)
  })

  it('s’applique à toutes les images, sans toucher au plan ni au reste', () => {
    const c = fixture()
    const avant = synoptique(c, 'synoptique-4')
    const planAvant = structuredClone(c.plans)
    const s = modifierOpaciteFond(avant, 60)
    expect(opacites(s)).toEqual(s.images.map(() => 0.6))
    expect(pourcentOpaciteFond(s, 1)).toBe(60)
    // Le synoptique d'avant et le plan ne changent pas.
    expect(opacites(avant)).toEqual(avant.images.map(() => 1))
    expect(c.plans).toEqual(planAvant)
    // Seule l'opacité change.
    s.images.forEach((im, i) => {
      const { calques, ...reste } = im.contenu
      const { calques: calquesAvant, ...resteAvant } = avant.images[i].contenu
      expect(reste).toEqual(resteAvant)
      expect({ ...calques, fond: { ...calques.fond, opacite: 1 } }).toEqual(calquesAvant)
    })
    // Même valeur : même synoptique ; hors bornes : ramenée à 0 ou 100 %.
    expect(modifierOpaciteFond(s, 60)).toBe(s)
    expect(opacites(modifierOpaciteFond(s, 250))).toEqual(s.images.map(() => 1))
    expect(opacites(modifierOpaciteFond(s, -10))).toEqual(s.images.map(() => 0))
    // « Nouvelle image » garde l'opacité.
    const r = nouvelleImage(s, 0)
    expect(pourcentOpaciteFond(r.synoptique, r.index)).toBe(60)
  })

  it('images réglées différemment (ancien synoptique) : le curseur montre l’image courante et les aligne toutes', () => {
    const avant = modifierOpaciteFond(synoptique(fixture(), 'synoptique-4'), 100)
    const melange: Synoptique = {
      ...avant,
      images: avant.images.map((im, i) =>
        i === 1 ? { ...im, contenu: { ...im.contenu, calques: { ...im.contenu.calques, fond: { ...im.contenu.calques.fond, opacite: 0.4 } } } } : im,
      ),
    }
    expect(pourcentOpaciteFond(melange, 0)).toBe(100)
    expect(pourcentOpaciteFond(melange, 1)).toBe(40)
    expect(opacites(modifierOpaciteFond(melange, 40))).toEqual(melange.images.map(() => 0.4))
  })

  it('une série de mouvements du curseur s’annule d’un seul coup', () => {
    const s0 = synoptique(fixture(), 'synoptique-4')
    let h = creerHistorique(s0)
    for (const p of [90, 75, 60, 45]) h = enregistrer(h, modifierOpaciteFond(h.present, p), 'opacite-fond:1')
    expect(pourcentOpaciteFond(h.present, 0)).toBe(45)
    h = annuler(h)
    expect(h.present).toBe(s0)
  })
})

describe('fichier et navigateur : opacité du fond', () => {
  it('reste en version 6 : aucun nouveau champ', () => {
    expect(VERSION_CHANTIER).toBe(6)
  })

  it('s’enregistre et se relit', () => {
    const c = fixture()
    const s = modifierOpaciteFond(synoptique(c, 'synoptique-4'), 60)
    const lu = lireChantier(serialiserChantier({ ...c, synoptiques: c.synoptiques.map((x) => (x.id === s.id ? s : x)) }))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(opacites(synoptique(lu.chantier, 'synoptique-4'))).toEqual(s.images.map(() => 0.6))
    expect(pourcentOpaciteFond(synoptique(lu.chantier, 'synoptique-1'), 0)).toBe(100)
  })

  it('un fichier sans opacité s’ouvre avec un fond plein ; une opacité hors bornes est refusée', () => {
    const brut = JSON.parse(texteFixture)
    for (const im of brut.synoptiques[0].images) delete im.contenu.calques.fond.opacite
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(true)
    if (lu.ok) expect(pourcentOpaciteFond(lu.chantier.synoptiques[0], 0)).toBe(100)
    brut.synoptiques[0].images[0].contenu.calques.fond.opacite = 1.5
    const refuse = lireChantier(JSON.stringify(brut))
    expect(refuse.ok).toBe(false)
    if (!refuse.ok) expect(refuse.erreurs.join('\n')).toMatch(/opacité du fond/)
  })

  it('un chantier gardé dans le navigateur garde son réglage ; un calque « Fond » incomplet est complété', () => {
    const c = fixture()
    const regle = { ...c, synoptiques: c.synoptiques.map((s) => (s.id === 'synoptique-4' ? modifierOpaciteFond(s, 60) : s)) }
    expect(pourcentOpaciteFond(synoptique(migrerChantier(regle).chantier, 'synoptique-4'), 0)).toBe(60)
    const ancien = JSON.parse(JSON.stringify(c))
    for (const im of ancien.synoptiques[0].images) im.contenu.calques.fond = { visible: false }
    delete ancien.plans[0].projet.calques.fond.opacite
    const { chantier } = migrerChantier(ancien)
    expect(chantier.synoptiques[0].images[0].contenu.calques.fond).toEqual({ visible: false, opacite: 1, verrouille: false })
    expect(chantier.plans[0].projet.calques.fond.opacite).toBe(1)
  })
})
