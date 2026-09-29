import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  creerProjet,
  epaisseurParDefaut,
  EXTENSION_FICHIER,
  lireProjet,
  nomDeFichier,
  serialiserProjet,
  type Projet,
} from '../src/plan/projet.ts'

const texteExemple = readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8')

const exemple = (): Projet => {
  const lu = lireProjet(texteExemple)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.projet
}

const erreursDe = (contenu: unknown): string => {
  const lu = lireProjet(JSON.stringify(contenu))
  expect(lu.ok).toBe(false)
  return lu.ok ? '' : lu.erreurs.join('\n')
}

const brutExemple = () => JSON.parse(texteExemple)

describe('lecture du projet', () => {
  it('ouvre le projet d’exemple sans erreur, sans fond, sur la toile par défaut', () => {
    const projet = exemple()
    expect(projet.voies.length).toBeGreaterThanOrEqual(3)
    expect(projet.fond).toBeNull()
    expect(projet.largeur).toBe(1600)
    expect(projet.hauteur).toBe(900)
  })

  it('relit à l’identique un projet enregistré, fond compris', () => {
    const projet: Projet = {
      ...exemple(),
      fond: {
        image: 'data:image/png;base64,iVBORw0KGgo=',
        largeur: 2400,
        hauteur: 1700,
        nomFichier: 'plan.pdf',
        page: 2,
        nombrePages: 3,
      },
    }
    const relu = lireProjet(serialiserProjet(projet))
    expect(relu).toEqual({ ok: true, projet })
  })

  it('refuse un fichier qui n’est pas du JSON, en français', () => {
    const lu = lireProjet('{ pas du json')
    expect(lu.ok).toBe(false)
    if (!lu.ok) expect(lu.erreurs[0]).toContain("n'est pas lisible")
  })

  it('reconnaît un ancien fichier .cinef de la version 3D', () => {
    expect(erreursDe({ site: {}, phasage: [] })).toContain('ancienne version 3D')
  })

  it('refuse un fichier sans marque de format', () => {
    expect(erreursDe({ nom: 'x', voies: [] })).toContain('marque de format')
  })

  it('refuse un projet d’une version plus récente', () => {
    expect(erreursDe({ ...brutExemple(), version: 99 })).toContain('plus récente')
  })

  it('désigne la voie fautive par son numéro et son nom', () => {
    const brut = brutExemple()
    brut.voies[1].couleur = 'rouge'
    const erreurs = erreursDe(brut)
    expect(erreurs).toContain('Voie n°2 (« VC »)')
    expect(erreurs).toContain('#rrggbb')
  })

  it('exige au moins deux points par voie et des coordonnées valides', () => {
    const brut = brutExemple()
    brut.voies[0].points = [{ x: 1, y: 2 }]
    brut.voies[2].points = [{ x: 1, y: 2 }, { x: 'a', y: 3 }]
    const erreurs = erreursDe(brut)
    expect(erreurs).toContain('au moins deux points')
    expect(erreurs).toContain('coordonnées')
  })

  it('refuse deux voies de même identifiant', () => {
    const brut = brutExemple()
    brut.voies[1].id = brut.voies[0].id
    expect(erreursDe(brut)).toContain('en double')
  })

  it('refuse une épaisseur hors bornes et une opacité hors de 0…1', () => {
    const brut = brutExemple()
    brut.voies[0].epaisseur = 0
    brut.calques.fond.opacite = 3
    const erreurs = erreursDe(brut)
    expect(erreurs).toContain('épaisseur')
    expect(erreurs).toContain('opacité')
  })

  it('refuse un fond dont l’image n’est pas une image', () => {
    const brut = { ...brutExemple(), fond: { image: 'http://ailleurs/plan.png', largeur: 10, hauteur: 10 } }
    expect(erreursDe(brut)).toContain('fond de plan est illisible')
  })

  it('complète les réglages de calques absents par les valeurs par défaut', () => {
    const brut = brutExemple()
    delete brut.calques
    const lu = lireProjet(JSON.stringify(brut))
    expect(lu.ok && lu.projet.calques).toEqual(creerProjet().calques)
  })
})

describe('enregistrement', () => {
  it('nomme le fichier d’après le projet, sans caractère interdit', () => {
    expect(nomDeFichier('OCP Nord : phase 1/2')).toBe(`OCP Nord - phase 1-2${EXTENSION_FICHIER}`)
    expect(nomDeFichier('   ')).toBe(`projet${EXTENSION_FICHIER}`)
  })

  it('propose une épaisseur de voie proportionnelle à la taille du plan', () => {
    expect(epaisseurParDefaut({ largeur: 1600, hauteur: 900 })).toBe(9)
    expect(epaisseurParDefaut({ largeur: 3200, hauteur: 4096 })).toBeGreaterThan(20)
    expect(epaisseurParDefaut({ largeur: 100, hauteur: 80 })).toBe(4)
  })
})
