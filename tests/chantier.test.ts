import { creerEtatsExploitation } from '../src/plan/exploitation.ts'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ajouterPlan,
  ajouterSynoptique,
  chantierRecupere,
  copierPlan,
  creerChantier,
  descriptionPerte,
  identifiantChantierLibre,
  nomLibre,
  nomPlanPropose,
  nouveauPlan,
  NOM_CHANTIER_RECUPERE,
  renommerPlan,
  renommerSynoptique,
  resumePlan,
  supprimerPlan,
  supprimerSynoptique,
  type Chantier,
} from '../src/plan/chantier.ts'
import { creerCatalogue } from '../src/plan/catalogue.ts'
import { creerEtatsVoie } from '../src/plan/etatsVoie.ts'
import { creerTypesFleches } from '../src/plan/fleches.ts'
import { lireChantier, lirePlanImporte, nomFichierChantier, serialiserChantier } from '../src/plan/fichierChantier.ts'
import { lireProjet } from '../src/plan/lecture.ts'
import { creerProjet, FORMAT_FICHIER, serialiserProjet } from '../src/plan/projet.ts'
import { recomposer } from '../src/plan/sauvegarde.ts'
import { formaterPlage } from '../src/plan/temps.ts'

const QUAND = '2026-09-29T15:00:00.000Z'
const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const texteProjet = readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8')

const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}

const erreursDe = (brut: unknown): string => {
  const lu = lireChantier(JSON.stringify(brut))
  expect(lu.ok).toBe(false)
  return lu.ok ? '' : lu.erreurs.join('\n')
}

describe('chantier d’exemple', () => {
  it('contient deux plans et un synoptique de trois images qui se suivent', () => {
    const c = fixture()
    expect(c.plans.map((p) => p.projet.nom)).toEqual(['Phase définitive', 'Phase provisoire'])
    // Le deuxième synoptique (étape 6) raconte les états d'une zone : voir
    // etats.test.ts ; le troisième (étape 7) a des flèches et une légende :
    // voir fleches.test.ts et legende.test.ts ; le cinquième (étape 11a)
    // fait rouler les engins : voir animation.test.ts.
    expect(c.synoptiques).toHaveLength(5)
    const s = c.synoptiques[0]
    expect(s.images).toHaveLength(3)
    expect(s.cadrage).not.toBeNull()
    expect(formaterPlage(s.t0, 0, s.fin)).toBe('Ve 22h30 → Lu 06h30')
    expect(s.images.map((i) => formaterPlage(s.t0, i.debut, i.fin))).toEqual([
      'Ve 22h30 → Ve/Sa 01h30',
      'Ve/Sa 01h30 → Ve/Sa 04h30',
      'Ve/Sa 04h30 → Lu 06h30',
    ])
  })
})

describe('modèle du chantier', () => {
  it('crée un chantier vide et nomme les nouveaux sans doublon', () => {
    expect(creerChantier('chantier-1', 'A', QUAND)).toEqual({
      id: 'chantier-1',
      nom: 'A',
      modifieLe: QUAND,
      plans: [],
      synoptiques: [],
      catalogue: creerCatalogue(),
      etatsVoie: creerEtatsVoie(),
      typesFleches: creerTypesFleches(),
      etatsExploitation: creerEtatsExploitation(),
    })
    expect(nomLibre([], 'Nouveau chantier')).toBe('Nouveau chantier')
    expect(nomLibre(['Nouveau chantier', 'Nouveau chantier 2'], 'Nouveau chantier')).toBe('Nouveau chantier 3')
    expect(identifiantChantierLibre(['chantier-1', 'chantier-4'])).toBe('chantier-5')
  })

  it('l’assistant « Nouveau plan » crée un plan nommé, avec son fond et son échelle', () => {
    let c = creerChantier('c', 'C', QUAND)
    expect(nomPlanPropose(c)).toBe('Plan 1')
    c = ajouterPlan(c, nouveauPlan('Plan 1', null, { pixelsParMetre: 4 })).chantier
    expect(nomPlanPropose(c)).toBe('Plan 2')
    const fond = { image: 'data:image/png;base64,iVBORw0KGgo=', largeur: 1200, hauteur: 700, nomFichier: 'plan.png', page: null, nombrePages: null }
    const r = ajouterPlan(c, nouveauPlan('  Phase définitive ', fond, { pixelsParMetre: 2.5 }))
    expect(r.id).toBe('plan-2')
    const projet = r.chantier.plans[1].projet
    expect(projet).toMatchObject({ nom: 'Phase définitive', largeur: 1200, hauteur: 700, echelle: { pixelsParMetre: 2.5 }, voies: [] })
    expect(projet).not.toHaveProperty('engins')
    expect(projet.fond?.nomFichier).toBe('plan.png')
    expect(r.chantier.plans[0].projet).toMatchObject({ largeur: 1600, fond: null, echelle: { pixelsParMetre: 4 } })
  })

  it('copie un plan juste après lui, sans lien avec l’original', () => {
    const c = fixture()
    const r = copierPlan(c, 'plan-1')
    expect(r.id).toBe('plan-3')
    expect(r.chantier.plans.map((p) => p.projet.nom)).toEqual(['Phase définitive', 'Phase définitive (copie)', 'Phase provisoire'])
    const copie = r.chantier.plans[1].projet
    expect(copie.voies).toEqual(c.plans[0].projet.voies)
    copie.voies[0].points[0].x = -1
    expect(c.plans[0].projet.voies[0].points[0].x).not.toBe(-1)
  })

  it('renomme et supprime un plan ; les synoptiques issus de ce plan restent', () => {
    let c = renommerPlan(fixture(), 'plan-1', 'Définitive')
    expect(c.plans[0].projet.nom).toBe('Définitive')
    c = supprimerPlan(c, 'plan-1')
    expect(c.plans.map((p) => p.id)).toEqual(['plan-2'])
    expect(c.synoptiques).toHaveLength(5)
    expect(c.synoptiques[0].origine.nomPlan).toBe('Phase définitive')
  })

  it('ajoute, renomme et supprime un synoptique', () => {
    let c = fixture()
    const r = ajouterSynoptique(c, c.plans[1], { nom: 'Nuit 2', t0: '2026-10-16T22:00', fin: 480, cadrage: null }, QUAND)
    expect(r.id).toBe('synoptique-6')
    c = renommerSynoptique(r.chantier, 'synoptique-6', 'Nuit 6 bis')
    expect(c.synoptiques[5]).toMatchObject({ nom: 'Nuit 6 bis', origine: { planId: 'plan-2', nomPlan: 'Phase provisoire' } })
    expect(supprimerSynoptique(c, 'synoptique-1').synoptiques.map((s) => s.id)).toEqual([
      'synoptique-2',
      'synoptique-3',
      'synoptique-4',
      'synoptique-5',
      'synoptique-6',
    ])
  })

  it('résume un plan en une ligne', () => {
    const c = fixture()
    expect(resumePlan(c.plans[0].projet)).toBe('4 voies · 4 zones · 3 appareils · 1 cadre · 1 texte · sans fond')
    const vide = creerProjet()
    expect(resumePlan(vide)).toBe('rien de tracé · sans fond · échelle non définie')
    const avecFond = { ...vide, echelle: { pixelsParMetre: 1 }, fond: { image: '', largeur: 1, hauteur: 1, nomFichier: 'plan.pdf', page: 2, nombrePages: 3 } }
    expect(resumePlan(avecFond)).toBe('rien de tracé · fond plan.pdf (page 2)')
  })

  it('dit ce qui sera perdu en supprimant le chantier', () => {
    expect(descriptionPerte(fixture())).toBe('2 plans et 5 synoptiques (14 images), fonds de plan compris.')
    expect(descriptionPerte(ajouterPlan(creerChantier('c', 'C', QUAND), creerProjet()).chantier)).toBe('1 plan, fonds de plan compris.')
    expect(descriptionPerte(creerChantier('c', 'C', QUAND))).toBe('Ce chantier est vide.')
  })
})

describe('export et import d’un chantier', () => {
  it('relit à l’identique un chantier exporté, fonds compris', () => {
    const c = fixture()
    c.plans[0].projet.fond = { image: 'data:image/png;base64,iVBORw0KGgo=', largeur: 1600, hauteur: 900, nomFichier: 'plan.png', page: null, nombrePages: null }
    c.synoptiques[0].fond = { ...c.plans[0].projet.fond }
    expect(lireChantier(serialiserChantier(c))).toEqual({ ok: true, chantier: c, avis: [] })
  })

  it('nomme le fichier d’après le chantier', () => {
    expect(nomFichierChantier('Gare de X : nuit 1/2')).toBe('Gare de X - nuit 1-2.chantier.json')
  })

  it('refuse un fichier illisible, étranger ou trop récent, en français', () => {
    const lu = lireChantier('{ pas du json')
    expect(lu.ok || lu.erreurs[0]).toContain("n'est pas lisible")
    expect(erreursDe({ nom: 'x' })).toContain('marque de format')
    expect(erreursDe({ ...JSON.parse(texteFixture), version: 99 })).toContain('plus récente')
  })

  it('reconnaît un fichier de plan et renvoie vers « Importer un plan »', () => {
    expect(erreursDe(JSON.parse(texteProjet))).toContain('Importer un plan')
  })

  it('désigne le plan, le synoptique ou l’image fautifs', () => {
    const brut = JSON.parse(texteFixture)
    brut.plans[1].projet.voies[0].couleur = 'rouge'
    brut.synoptiques[0].images[1].fin = brut.synoptiques[0].images[1].debut - 10
    brut.synoptiques[0].images[2].contenu.zones[0].voieId = 'voie-inconnue'
    const erreurs = erreursDe(brut)
    expect(erreurs).toContain('Plan n°2 (« Phase provisoire ») : Voie n°1')
    expect(erreurs).toContain('Synoptique n°1 (« Nuit 1 — RVB V1 »), image 2 : la fin est avant le début.')
    expect(erreurs).toContain('Synoptique n°1 (« Nuit 1 — RVB V1 »), image 3 : Zone n°1')
  })

  it('vérifie les horaires, le cadrage et la présence d’images', () => {
    const brut = JSON.parse(texteFixture)
    const s = brut.synoptiques[0]
    s.images[2].fin = s.fin + 60
    s.cadrage = { x: 1500, y: 0, largeur: 400, hauteur: 100 }
    s.t0 = 'vendredi soir'
    const erreurs = erreursDe(brut)
    expect(erreurs).toContain('heure de début illisible')
    const brut2 = JSON.parse(texteFixture)
    brut2.synoptiques[0].images[2].fin += 60
    brut2.synoptiques[0].cadrage = { x: 1700, y: 0, largeur: 400, hauteur: 100 }
    const erreurs2 = erreursDe(brut2)
    expect(erreurs2).toContain('image 3 : horaires en dehors du synoptique')
    expect(erreurs2).toContain('le cadrage ne montre rien du plan')
    // Un cadrage qui déborde du plan (rame garée au-delà du bout d'une voie) mais en montre une partie est accepté.
    const brut4 = JSON.parse(texteFixture)
    brut4.synoptiques[0].cadrage = { x: 1500, y: 600, largeur: 400, hauteur: 500 }
    expect(lireChantier(JSON.stringify(brut4)).ok).toBe(true)
    const brut3 = JSON.parse(texteFixture)
    brut3.synoptiques[0].images = []
    expect(erreursDe(brut3)).toContain('au moins une image')
  })

  it('refuse deux plans de même identifiant', () => {
    const brut = JSON.parse(texteFixture)
    brut.plans[1].id = brut.plans[0].id
    expect(erreursDe(brut)).toContain('identifiant « plan-1 » en double')
  })
})

describe('fichiers de plan des étapes 2 et 3', () => {
  it('s’importent comme plan d’un chantier', () => {
    const lu = lirePlanImporte(texteProjet)
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    const c = ajouterPlan(creerChantier('c', 'C', QUAND), lu.projet).chantier
    expect(c.plans[0].projet.voies.length).toBeGreaterThanOrEqual(3)
  })

  it('un fichier de l’étape 2 (version 2) s’importe aussi', () => {
    const brut = JSON.parse(texteProjet)
    const etape2 = { format: FORMAT_FICHIER, version: 2, nom: 'Étape 2', largeur: 1600, hauteur: 900, fond: null, voies: brut.voies }
    const lu = lirePlanImporte(JSON.stringify(etape2))
    expect(lu.ok && lu.projet.voies.length).toBe(brut.voies.length)
    expect(lu.ok && lu.projet.zones).toEqual([])
  })

  it('un chantier choisi par erreur est renvoyé vers « Importer un chantier »', () => {
    const lu = lirePlanImporte(texteFixture)
    expect(lu.ok || lu.erreurs[0]).toContain('Importer un chantier')
  })
})

describe('reprise de la sauvegarde automatique des étapes 2 et 3', () => {
  it('range le plan sauvegardé dans le « Chantier récupéré »', () => {
    const lu = lireProjet(texteProjet)
    if (!lu.ok) throw new Error()
    const avecFond = { ...lu.projet, fond: { image: '', largeur: 1600, hauteur: 900, nomFichier: 'plan.png', page: null, nombrePages: null } }
    // La sauvegarde de l'étape 3 : le projet sans l'image, et l'image à part.
    const restauration = recomposer(serialiserProjet(avecFond), 'data:image/png;base64,iVBORw0KGgo=')
    expect(restauration.ok).toBe(true)
    if (!restauration.ok) return
    const c = chantierRecupere('chantier-1', restauration.projet, QUAND)
    expect(c.nom).toBe(NOM_CHANTIER_RECUPERE)
    expect(c.plans).toHaveLength(1)
    expect(c.plans[0].projet.voies).toEqual(lu.projet.voies)
    expect(c.plans[0].projet.fond?.image).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(lireChantier(serialiserChantier(c))).toEqual({ ok: true, chantier: c, avis: [] })
  })

  it('garde un plan vide sans fond tel quel', () => {
    const c = chantierRecupere('chantier-1', creerProjet(), QUAND)
    expect(c.plans[0].projet).toEqual(creerProjet())
  })
})
