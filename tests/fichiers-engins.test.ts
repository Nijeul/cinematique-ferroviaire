import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { creerCatalogue } from '../src/plan/catalogue.ts'
import {
  ajouterSynoptique,
  ajouterTypeChantier,
  copierPlan,
  enginsDuType,
  migrerChantier,
  modifierTypeChantier,
  remplacerPlan,
  supprimerTypeChantier,
  type Chantier,
} from '../src/plan/chantier.ts'
import { placerEnginSurVoie, silhouetteEngin } from '../src/plan/engins.ts'
import { lireChantier, serialiserChantier } from '../src/plan/fichierChantier.ts'
import { lireProjet } from '../src/plan/lecture.ts'
import { FORMAT_FICHIER, serialiserProjet } from '../src/plan/projet.ts'
import { projetDeImage } from '../src/plan/synoptique.ts'

const QUAND = '2026-09-29T15:00:00.000Z'
const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const texteProjet = readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8')

const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}

// Le même chantier tel que l'étape 4 le gardait dans le navigateur : ni
// catalogue, ni échelle, ni engins, ni calque « Engins ».
type Brut = Record<string, unknown> & { calques: Record<string, unknown> }
const enEtape4 = (c: Chantier) => {
  const brut = JSON.parse(serialiserChantier(c))
  const nettoyer = (p: Brut) => {
    delete p.echelle
    delete p.engins
    delete p.rames
    delete p.calques.engins
  }
  delete brut.catalogue
  delete brut.format
  delete brut.version
  brut.plans.forEach((p: { projet: Brut }) => nettoyer(p.projet))
  brut.synoptiques.forEach((s: Brut & { images: { contenu: Brut }[] }) => {
    delete s.echelle
    s.images.forEach((im) => nettoyer(im.contenu))
  })
  return brut
}

describe('chantier d’exemple de l’étape 5', () => {
  it('a un plan à l’échelle avec quelques engins et une rame, copiés dans le synoptique', () => {
    const c = fixture()
    const plan = c.plans[0].projet
    expect(plan.echelle).toEqual({ pixelsParMetre: 4 })
    expect(plan.engins.map((e) => [e.type.modele, e.numero, e.position.genre])).toEqual([
      ['Type 08-32U', '', 'voie'],
      ['CAT 323', '3', 'voie'],
      ['CAT 323', 'P4', 'libre'],
    ])
    expect(plan.rames).toHaveLength(1)
    expect(plan.rames[0].vehicules).toHaveLength(13)
    expect(c.catalogue).toEqual(creerCatalogue())
    const s = c.synoptiques[0]
    expect(s.echelle).toEqual({ pixelsParMetre: 4 })
    expect(s.images.every((im) => im.contenu.engins.length === 3 && im.contenu.rames.length === 1)).toBe(true)
  })
})

describe('migration des chantiers de l’étape 4', () => {
  it('un chantier gardé dans le navigateur reçoit le catalogue par défaut, ses plans restent sans échelle', () => {
    const ancien = enEtape4(fixture())
    const c = migrerChantier(ancien)
    expect(c.catalogue).toEqual(creerCatalogue())
    expect(c.plans.every((p) => p.projet.echelle === null && p.projet.engins.length === 0 && p.projet.rames.length === 0)).toBe(true)
    expect(c.plans[0].projet.calques.engins).toEqual({ visible: true, verrouille: false })
    expect(c.plans[0].projet.voies).toEqual(fixture().plans[0].projet.voies)
    expect(c.synoptiques[0].echelle).toBeNull()
    expect(c.synoptiques[0].images.every((im) => im.contenu.engins.length === 0 && im.contenu.calques.engins.visible)).toBe(true)
    // Le chantier migré s'exporte et se relit tel quel.
    expect(lireChantier(serialiserChantier(c))).toEqual({ ok: true, chantier: c })
  })

  it('un chantier déjà complet ne change pas', () => {
    const c = fixture()
    expect(migrerChantier(c)).toEqual(c)
  })

  it('un fichier de chantier de l’étape 4 (version 1) s’importe', () => {
    const lu = lireChantier(JSON.stringify({ format: 'cinematique-ferroviaire/chantier', version: 1, ...enEtape4(fixture()) }))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.chantier.catalogue).toHaveLength(13)
    expect(lu.chantier.plans[0].projet.echelle).toBeNull()
    expect(lu.chantier.synoptiques[0].images[0].contenu.engins).toEqual([])
  })

  it('un plan des étapes 2 et 3 s’ouvre sans échelle ni engins', () => {
    const lu = lireProjet(texteProjet)
    expect(lu.ok && [lu.projet.echelle, lu.projet.engins, lu.projet.rames, lu.projet.calques.engins]).toEqual([
      null,
      [],
      [],
      { visible: true, verrouille: false },
    ])
  })
})

describe('export et import du chantier avec son catalogue', () => {
  it('le catalogue modifié voyage avec le chantier', () => {
    // Dimensions factices, pour l'essai seulement.
    const r = ajouterTypeChantier(fixture(), { categorie: 'PEM LEM', modele: 'Essai', longueur: 12, largeur: 4, couleur: '#aa66cc' })
    if (!r.ok) throw new Error(r.erreur)
    const c = supprimerTypeChantier(r.valeur.chantier, 'type-2')
    const relu = lireChantier(serialiserChantier(c))
    expect(relu).toEqual({ ok: true, chantier: c })
    expect(relu.ok && relu.chantier.catalogue.map((t) => t.modele)).toContain('Essai')
    expect(JSON.parse(serialiserChantier(c)).version).toBe(2)
  })

  it('un catalogue abîmé est refusé, avec le type fautif', () => {
    const brut = JSON.parse(texteFixture)
    brut.catalogue[11].longueur = -3
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok || lu.erreurs.join('\n')).toContain("Type d'engin n°12 : la longueur doit être un nombre de mètres positif.")
  })

  it('un engin abîmé est refusé, avec le plan et l’engin fautifs', () => {
    const brut = JSON.parse(texteFixture)
    brut.plans[0].projet.engins[1].position.voieId = 'voie-inconnue'
    brut.plans[0].projet.rames[0].vehicules = []
    const lu = lireChantier(JSON.stringify(brut))
    const erreurs = lu.ok ? '' : lu.erreurs.join('\n')
    expect(erreurs).toContain('Plan n°1 (« Phase définitive ») : Engin n°2 (« CAT 323 ») : la voie « voie-inconnue » n\'existe pas.')
    expect(erreurs).toContain('au moins un véhicule')
  })
})

describe('fichier de plan (version 4)', () => {
  it('garde échelle, engins et rames', () => {
    const plan = fixture().plans[0].projet
    const lu = lireProjet(serialiserProjet(plan))
    expect(lu).toEqual({ ok: true, projet: plan })
    expect(JSON.parse(serialiserProjet(plan)).version).toBe(4)
  })

  it('refuse des engins sans échelle', () => {
    const brut = { ...JSON.parse(serialiserProjet(fixture().plans[0].projet)), echelle: null, format: FORMAT_FICHIER }
    const lu = lireProjet(JSON.stringify(brut))
    expect(lu.ok || lu.erreurs.join(' ')).toContain("l'échelle du plan manque")
  })
})

describe('catalogue et plans du chantier', () => {
  it('modifier un type met à jour les engins des plans, pas ceux des synoptiques', () => {
    const c = fixture()
    const pelle = c.catalogue.find((t) => t.modele === 'CAT 323')!
    expect(enginsDuType(c, pelle.id)).toBe(4)
    const r = modifierTypeChantier(c, pelle.id, { longueur: 10 })
    if (!r.ok) throw new Error(r.erreur)
    expect(r.valeur.plans.flatMap((p) => p.projet.engins.filter((e) => e.typeId === pelle.id).map((e) => e.type.longueur))).toEqual([10, 10, 10, 10])
    expect(r.valeur.synoptiques[0].images[0].contenu.engins.filter((e) => e.typeId === pelle.id).map((e) => e.type.longueur)).toEqual([9.5, 9.5])
    expect(modifierTypeChantier(c, pelle.id, { longueur: 0 }).ok).toBe(false)
  })

  it('la copie d’un plan reprend son échelle et ses engins', () => {
    const r = copierPlan(fixture(), 'plan-1')
    const copie = r.chantier.plans.find((p) => p.id === r.id)!.projet
    expect(copie.echelle).toEqual({ pixelsParMetre: 4 })
    expect(copie.engins).toHaveLength(3)
  })
})

describe('copie dans le synoptique', () => {
  it('échelle, engins et rames sont copiés, figés', () => {
    let c = fixture()
    const plan = c.plans[0]
    const r = ajouterSynoptique(c, plan, { nom: 'Nuit 2', t0: '2026-10-16T22:00', fin: 480, cadrage: null }, QUAND)
    c = r.chantier
    const s = c.synoptiques.find((x) => x.id === r.id)!
    const image = projetDeImage(s, s.images[0])
    expect(image.echelle).toEqual({ pixelsParMetre: 4 })
    expect(image.engins).toEqual(plan.projet.engins)
    expect(image.rames).toEqual(plan.projet.rames)
    // Un engin affiché dans l'image est à l'échelle : la BML fait 31 m.
    expect(silhouetteEngin(image, image.engins[0])!.longueur / 4).toBeCloseTo(31)
    // Déplacer un engin sur le plan ne change pas le synoptique.
    c = remplacerPlan(c, plan.id, placerEnginSurVoie(plan.projet, plan.projet.engins[0].id, 100))
    expect(c.synoptiques.find((x) => x.id === r.id)!.images[0].contenu.engins[0].position).toEqual(plan.projet.engins[0].position)
    // Recaler l'échelle du plan ne change pas celle du synoptique.
    c = remplacerPlan(c, plan.id, { ...plan.projet, echelle: { pixelsParMetre: 2 } })
    expect(c.synoptiques.find((x) => x.id === r.id)!.echelle).toEqual({ pixelsParMetre: 4 })
  })
})
