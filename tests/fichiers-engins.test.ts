import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { creerCatalogue, type TypeEngin } from '../src/plan/catalogue.ts'
import {
  ajouterSynoptique,
  ajouterTypeChantier,
  copierPlan,
  migrerChantier,
  modifierTypeChantier,
  nouveauPlan,
  supprimerTypeChantier,
  synoptiquesDuType,
  type Chantier,
} from '../src/plan/chantier.ts'
import {
  ajouterEngin,
  ajouterRame,
  groupeDe,
  placerEnginSurVoie,
  placerRame,
  silhouetteEngin,
  silhouetteRame,
  supprimerEngin,
  vehiculesDeGroupes,
} from '../src/plan/engins.ts'
import { lireChantier, lirePlanImporte, serialiserChantier } from '../src/plan/fichierChantier.ts'
import { avisEnginsRetires, lireProjet } from '../src/plan/lecture.ts'
import { creerProjet, FORMAT_FICHIER, serialiserProjet } from '../src/plan/projet.ts'
import { calerEchelleSynoptique, modifierCalqueEngins, modifierImage, nouvelleImage, projetDeImage, type Synoptique } from '../src/plan/synoptique.ts'

const QUAND = '2026-09-29T15:00:00.000Z'
const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const texteProjet = readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8')

const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}

const type = (modele: string): TypeEngin => creerCatalogue().find((t) => t.modele === modele)!

type Brut = Record<string, unknown> & { calques: Record<string, unknown> }

// Le même chantier tel que l'étape 4 le gardait dans le navigateur : ni
// catalogue, ni échelle, ni engins.
const enEtape4 = (c: Chantier) => {
  const brut = JSON.parse(serialiserChantier(c))
  delete brut.catalogue
  delete brut.format
  delete brut.version
  brut.plans.forEach((p: { projet: Brut }) => delete p.projet.echelle)
  brut.synoptiques.forEach((s: Brut & { images: { contenu: Brut }[] }) => {
    delete s.echelle
    delete s.calqueEngins
    s.images.forEach((im) => {
      delete im.contenu.engins
      delete im.contenu.rames
    })
  })
  return brut
}

// Le même chantier tel que la première version de l'étape 5 (PR #7) le
// gardait : des engins et une rame sur chaque plan, un calque « Engins » dans
// les calques des plans et des images, pas de calque « Engins » au niveau du
// synoptique.
const enPR7 = (c: Chantier) => {
  const brut = JSON.parse(serialiserChantier(c))
  delete brut.format
  delete brut.version
  const contenu1 = brut.synoptiques[0].images[0].contenu
  brut.plans.forEach((p: { projet: Brut }) => {
    p.projet.engins = contenu1.engins
    p.projet.rames = contenu1.rames
    p.projet.calques.engins = { visible: true, verrouille: false }
  })
  brut.synoptiques.forEach((s: Brut & { images: { contenu: Brut }[] }) => {
    delete s.calqueEngins
    s.images.forEach((im) => (im.contenu.calques.engins = { visible: true, verrouille: false }))
  })
  return brut
}

describe('chantier d’exemple de l’étape 5', () => {
  it('a des plans à l’échelle, sans aucun engin', () => {
    const c = fixture()
    for (const { projet } of c.plans) {
      expect(projet.echelle).toEqual({ pixelsParMetre: 4 })
      expect(Object.keys(projet)).not.toContain('engins')
      expect(Object.keys(projet)).not.toContain('rames')
      expect(Object.keys(projet.calques)).toEqual(['fond', 'cadres', 'voies', 'zones', 'appareils', 'textes'])
    }
    expect(c.catalogue).toEqual(creerCatalogue())
  })

  it('a un synoptique dont les images ont leurs engins, à des positions différentes', () => {
    const s = fixture().synoptiques[0]
    expect(s.echelle).toEqual({ pixelsParMetre: 4 })
    expect(s.calqueEngins).toEqual({ visible: true, verrouille: false })
    const [image1, image2] = s.images.map((im) => im.contenu)
    expect(image1.engins.map((e) => [e.type.modele, e.numero, e.position.genre])).toEqual([
      ['Type 08-32U', '', 'voie'],
      ['CAT 323', '3', 'voie'],
      ['CAT 323', 'P4', 'libre'],
    ])
    expect(image1.rames[0].vehicules).toHaveLength(13)
    // La pelle n°3 et la rame ont avancé entre l'image 1 et l'image 2.
    expect(image1.engins[1].position).toMatchObject({ abscisse: 300 })
    expect(image2.engins[1].position).toMatchObject({ abscisse: 520 })
    expect([image1.rames[0].abscisse, image2.rames[0].abscisse]).toEqual([600, 700])
    // La BML 08-32U fait 31 m dans l'image, à l'échelle du synoptique.
    const planche = projetDeImage(s, s.images[0])
    expect(silhouetteEngin(planche, planche.engins[0])!.longueur / 4).toBeCloseTo(31)
  })
})

describe('le plan ne contient aucun engin', () => {
  it('un plan neuf ou créé par l’assistant n’a ni engins, ni rames, ni calque « Engins »', () => {
    for (const p of [creerProjet(), nouveauPlan('Phase 1', null, { pixelsParMetre: 4 })]) {
      expect(p).not.toHaveProperty('engins')
      expect(p).not.toHaveProperty('rames')
      expect(p.calques).not.toHaveProperty('engins')
    }
  })

  it('un plan des étapes 2 et 3 s’ouvre sans échelle, rien n’est retiré', () => {
    const lu = lireProjet(texteProjet)
    expect(lu.ok && [lu.projet.echelle, lu.retires]).toEqual([null, { engins: 0, rames: 0 }])
  })

  it('le fichier de plan (version 4) garde l’échelle', () => {
    const plan = fixture().plans[0].projet
    expect(lireProjet(serialiserProjet(plan))).toEqual({ ok: true, projet: plan, retires: { engins: 0, rames: 0 } })
    expect(JSON.parse(serialiserProjet(plan)).version).toBe(4)
  })
})

describe('plans enregistrés avec des engins (première version de l’étape 5)', () => {
  const planPR7 = () => ({ format: FORMAT_FICHIER, version: 4, ...enPR7(fixture()).plans[0].projet })

  it('un fichier de plan s’ouvre : engins et rames retirés et comptés', () => {
    const lu = lireProjet(JSON.stringify(planPR7()))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.retires).toEqual({ engins: 3, rames: 1 })
    expect(lu.projet).toEqual(fixture().plans[0].projet)
    expect(avisEnginsRetires(lu.projet.nom, lu.retires)).toBe(
      'Les engins ne se posent plus sur le plan mais dans les synoptiques : 3 engins et 1 rame retirés du plan « Phase définitive ».',
    )
    expect(lirePlanImporte(JSON.stringify(planPR7()))).toEqual(lu)
  })

  it('même abîmés ou sans échelle, les engins d’un plan ne bloquent pas son ouverture', () => {
    const brut = { ...planPR7(), echelle: null }
    brut.engins[1].position.voieId = 'voie-inconnue'
    const lu = lireProjet(JSON.stringify(brut))
    expect(lu.ok && lu.retires).toEqual({ engins: 3, rames: 1 })
  })

  it('l’avis se lit au singulier comme au pluriel', () => {
    expect(avisEnginsRetires('P', { engins: 0, rames: 0 })).toBeNull()
    expect(avisEnginsRetires('P', { engins: 1, rames: 0 })).toContain(': 1 engin retiré du plan « P ».')
    expect(avisEnginsRetires('P', { engins: 0, rames: 1 })).toContain(': 1 rame retirée du plan « P ».')
    expect(avisEnginsRetires('P', { engins: 2, rames: 0 })).toContain(': 2 engins retirés du plan « P ».')
  })

  it('un chantier gardé dans le navigateur est corrigé, avec un avis par plan ; les engins des synoptiques restent', () => {
    const { chantier, avis } = migrerChantier(enPR7(fixture()))
    expect(avis).toEqual([
      'Les engins ne se posent plus sur le plan mais dans les synoptiques : 3 engins et 1 rame retirés du plan « Phase définitive ».',
      'Les engins ne se posent plus sur le plan mais dans les synoptiques : 3 engins et 1 rame retirés du plan « Phase provisoire ».',
    ])
    expect(chantier).toEqual(fixture())
    // Une fois corrigé, il n'y a plus rien à dire : l'avis ne revient pas.
    expect(migrerChantier(chantier)).toEqual({ chantier, avis: [] })
  })

  it('un fichier de chantier s’importe : plans nettoyés, avis, synoptique intact', () => {
    const lu = lireChantier(JSON.stringify({ format: 'cinematique-ferroviaire/chantier', version: 2, ...enPR7(fixture()) }))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.avis).toHaveLength(2)
    expect(lu.chantier).toEqual(fixture())
    expect(lu.chantier.synoptiques[0].images[1].contenu.rames[0].abscisse).toBe(700)
  })
})

describe('chantiers et fichiers de l’étape 4', () => {
  it('un chantier gardé dans le navigateur reçoit le catalogue par défaut ; plans et synoptiques restent sans échelle', () => {
    const { chantier: c, avis } = migrerChantier(enEtape4(fixture()))
    expect(avis).toEqual([])
    expect(c.catalogue).toEqual(creerCatalogue())
    expect(c.plans.every((p) => p.projet.echelle === null)).toBe(true)
    expect(c.plans[0].projet.voies).toEqual(fixture().plans[0].projet.voies)
    expect(c.synoptiques[0].echelle).toBeNull()
    expect(c.synoptiques[0].calqueEngins).toEqual({ visible: true, verrouille: false })
    expect(c.synoptiques[0].images.every((im) => im.contenu.engins.length === 0 && im.contenu.rames.length === 0)).toBe(true)
    // Le chantier migré s'exporte et se relit tel quel.
    expect(lireChantier(serialiserChantier(c))).toEqual({ ok: true, chantier: c, avis: [] })
  })

  it('un chantier déjà complet ne change pas', () => {
    const c = fixture()
    expect(migrerChantier(c)).toEqual({ chantier: c, avis: [] })
  })

  it('un fichier de chantier de l’étape 4 (version 1) s’importe', () => {
    const lu = lireChantier(JSON.stringify({ format: 'cinematique-ferroviaire/chantier', version: 1, ...enEtape4(fixture()) }))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.chantier.catalogue).toHaveLength(13)
    expect(lu.chantier.plans[0].projet.echelle).toBeNull()
    expect(lu.chantier.synoptiques[0].echelle).toBeNull()
    expect(lu.chantier.synoptiques[0].images[0].contenu.engins).toEqual([])
  })
})

describe('copie du plan dans un synoptique', () => {
  it('le synoptique reprend le plan et son échelle, sans engin', () => {
    let c = fixture()
    const plan = c.plans[0]
    const r = ajouterSynoptique(c, plan, { nom: 'Nuit 2', t0: '2026-10-16T22:00', fin: 480, cadrage: null }, QUAND)
    c = r.chantier
    const s = c.synoptiques.find((x) => x.id === r.id)!
    expect(s.echelle).toEqual({ pixelsParMetre: 4 })
    expect(s.echelle).not.toBe(plan.projet.echelle)
    expect(s.calqueEngins).toEqual({ visible: true, verrouille: false })
    const image = projetDeImage(s, s.images[0])
    expect([image.engins, image.rames]).toEqual([[], []])
    expect(image.voies).toEqual(plan.projet.voies)
  })

  it('la copie d’un plan reprend son échelle', () => {
    const r = copierPlan(fixture(), 'plan-1')
    expect(r.chantier.plans.find((p) => p.id === r.id)!.projet.echelle).toEqual({ pixelsParMetre: 4 })
  })
})

describe('engins d’une image', () => {
  // Synoptique de la fixture, image 1 : on travaille sur l'image d'index 1
  // (la deuxième), les autres ne doivent pas bouger.
  const depart = () => fixture().synoptiques[0]
  const contenus = (s: Synoptique) => s.images.map((im) => im.contenu)

  it('poser un engin et une rame change l’image courante seulement', () => {
    const s = depart()
    let apres = modifierImage(s, 1, (p) => ajouterEngin(p, type('BB 61000'), { genre: 'voie', voieId: 'voie-3', abscisse: 200 }).planche)
    apres = modifierImage(apres, 1, (p) =>
      ajouterRame(p, vehiculesDeGroupes([groupeDe(type('BB 61000')), groupeDe(type('R39'), 10)]), 'voie-4', 600).planche,
    )
    expect(apres.images[1].contenu.engins.map((e) => e.type.modele)).toEqual(['Type 08-32U', 'CAT 323', 'CAT 323', 'BB 61000'])
    expect(apres.images[1].contenu.rames).toHaveLength(2)
    const planche = projetDeImage(apres, apres.images[1])
    expect(silhouetteRame(planche, planche.rames[1])!.longueur).toBeCloseTo(213.5)
    // Les autres images et le reste de l'image (copie figée du plan) sont intacts.
    expect(apres.images[0]).toBe(s.images[0])
    expect(apres.images[2]).toBe(s.images[2])
    expect(apres.images[1].contenu.voies).toBe(s.images[1].contenu.voies)
  })

  it('déplacer un engin ou une rame sur une image ne change pas les autres', () => {
    const s = depart()
    const apres = modifierImage(modifierImage(s, 0, (p) => placerEnginSurVoie(p, 'engin-2', 800)), 0, (p) => placerRame(p, 'rame-1', 650))
    expect(apres.images[0].contenu.engins[1].position).toMatchObject({ abscisse: 800 })
    expect(apres.images[0].contenu.rames[0].abscisse).toBe(650)
    expect(contenus(apres).slice(1)).toEqual(contenus(s).slice(1))
  })

  it('supprimer un engin sur une image le garde sur les autres', () => {
    const s = depart()
    const apres = modifierImage(s, 1, (p) => supprimerEngin(p, { genre: 'engin', id: 'engin-2' }))
    expect(apres.images[1].contenu.engins.map((e) => e.id)).toEqual(['engin-1', 'engin-3'])
    expect(apres.images[0].contenu.engins.map((e) => e.id)).toEqual(['engin-1', 'engin-2', 'engin-3'])
    expect(apres.images[2].contenu.engins.map((e) => e.id)).toEqual(['engin-1', 'engin-2', 'engin-3'])
  })

  it('une modification sans effet laisse le synoptique tel quel', () => {
    const s = depart()
    expect(modifierImage(s, 0, (p) => p)).toBe(s)
    expect(modifierImage(s, 9, (p) => supprimerEngin(p, { genre: 'engin', id: 'engin-1' }))).toBe(s)
  })

  it('« Nouvelle image » emporte les engins ; les déplacer ensuite ne touche pas l’image d’origine', () => {
    const s = depart()
    const { synoptique: avec, index } = nouvelleImage(s, 0)
    expect(index).toBe(1)
    expect(avec.images[1].contenu.engins).toEqual(s.images[0].contenu.engins)
    expect(avec.images[1].contenu.rames).toEqual(s.images[0].contenu.rames)
    expect(avec.images[1].contenu.engins).not.toBe(s.images[0].contenu.engins)
    const deplace = modifierImage(avec, 1, (p) => placerRame(placerEnginSurVoie(p, 'engin-2', 900), 'rame-1', 800))
    expect(deplace.images[0]).toEqual(s.images[0])
    expect(deplace.images[1].contenu.rames[0].abscisse).toBe(800)
  })

  it('le calque « Engins » se masque ou se verrouille pour tout le synoptique', () => {
    const d = depart()
    const s = modifierCalqueEngins(d, { verrouille: true })
    expect(s.calqueEngins).toEqual({ visible: true, verrouille: true })
    expect(s.images).toBe(d.images)
  })
})

describe('échelle calée dans un synoptique', () => {
  it('un synoptique sans échelle se cale, et l’on peut alors poser des engins à la bonne taille', () => {
    const { chantier } = migrerChantier(enEtape4(fixture()))
    const sans = chantier.synoptiques[0]
    expect(sans.echelle).toBeNull()
    const avecEngin = (s: Synoptique) =>
      modifierImage(s, 0, (p) => ajouterEngin(p, type('R39'), { genre: 'voie', voieId: 'voie-3', abscisse: 500 }).planche)
    // Sans échelle, un engin n'a pas de taille : rien ne se dessine.
    const essai = projetDeImage(avecEngin(sans), avecEngin(sans).images[0])
    expect(silhouetteEngin(essai, essai.engins[0])).toBeNull()
    const cale = calerEchelleSynoptique(sans, { pixelsParMetre: 5 })
    expect(cale.echelle).toEqual({ pixelsParMetre: 5 })
    expect(cale.images).toBe(sans.images)
    const pose = avecEngin(cale)
    const planche = projetDeImage(pose, pose.images[0])
    expect(silhouetteEngin(planche, planche.engins[0])!.longueur).toBeCloseTo(19.9 * 5)
    // Le plan d'origine n'a pas changé : il reste sans échelle.
    expect(chantier.plans[0].projet.echelle).toBeNull()
  })
})

describe('export et import du chantier', () => {
  it('relit à l’identique un chantier avec engins dans ses images et catalogue modifié', () => {
    // Dimensions factices, pour l'essai seulement.
    const r = ajouterTypeChantier(fixture(), { categorie: 'PEM LEM', modele: 'Essai', longueur: 12, largeur: 4, couleur: '#aa66cc' })
    if (!r.ok) throw new Error(r.erreur)
    let c = supprimerTypeChantier(r.valeur.chantier, 'type-2')
    const s = modifierImage(c.synoptiques[0], 2, (p) => supprimerEngin(p, { genre: 'rame', id: 'rame-1' }))
    c = { ...c, synoptiques: [{ ...s, calqueEngins: { visible: false, verrouille: true } }] }
    const relu = lireChantier(serialiserChantier(c))
    expect(relu).toEqual({ ok: true, chantier: c, avis: [] })
    expect(relu.ok && relu.chantier.catalogue.map((t) => t.modele)).toContain('Essai')
    expect(relu.ok && relu.chantier.synoptiques[0].images.map((im) => im.contenu.rames.length)).toEqual([1, 1, 0])
    expect(JSON.parse(serialiserChantier(c)).version).toBe(2)
  })

  it('un catalogue abîmé est refusé, avec le type fautif', () => {
    const brut = JSON.parse(texteFixture)
    brut.catalogue[11].longueur = -3
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok || lu.erreurs.join('\n')).toContain("Type d'engin n°12 : la longueur doit être un nombre de mètres positif.")
  })

  it('un engin abîmé dans une image est refusé, avec le synoptique, l’image et l’engin fautifs', () => {
    const brut = JSON.parse(texteFixture)
    brut.synoptiques[0].images[1].contenu.engins[1].position.voieId = 'voie-inconnue'
    brut.synoptiques[0].images[2].contenu.rames[0].vehicules = []
    const lu = lireChantier(JSON.stringify(brut))
    const erreurs = lu.ok ? '' : lu.erreurs.join('\n')
    expect(erreurs).toContain(
      "Synoptique n°1 (« Nuit 1 — RVB V1 »), image 2 : Engin n°2 (« CAT 323 ») : la voie « voie-inconnue » n'existe pas.",
    )
    expect(erreurs).toContain('image 3 : Rame n°1 (« Rame 1 ») : une rame doit avoir au moins un véhicule.')
  })

  it('refuse des engins dans un synoptique sans échelle', () => {
    const brut = JSON.parse(texteFixture)
    brut.synoptiques[0].echelle = null
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok || lu.erreurs.join(' ')).toContain("l'échelle manque")
  })
})

describe('catalogue du chantier et engins posés', () => {
  it('modifier un type ne change pas les engins déjà posés dans les synoptiques (copies figées)', () => {
    const c = fixture()
    const pelle = c.catalogue.find((t) => t.modele === 'CAT 323')!
    expect(synoptiquesDuType(c, pelle.id)).toBe(1)
    expect(synoptiquesDuType(c, type('V211').id)).toBe(0)
    const r = modifierTypeChantier(c, pelle.id, { longueur: 10 })
    if (!r.ok) throw new Error(r.erreur)
    expect(r.valeur.catalogue.find((t) => t.id === pelle.id)!.longueur).toBe(10)
    expect(r.valeur.synoptiques).toBe(c.synoptiques)
    expect(r.valeur.plans).toBe(c.plans)
    expect(modifierTypeChantier(c, pelle.id, { longueur: 0 }).ok).toBe(false)
  })
})
