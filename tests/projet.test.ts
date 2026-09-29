import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lireProjet } from '../src/plan/lecture.ts'
import {
  creerProjet,
  epaisseurParDefaut,
  EXTENSION_FICHIER,
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

describe('fichiers de l’étape 2 (version 2)', () => {
  const etape2 = () => {
    const brut = brutExemple()
    for (const cle of ['zones', 'appareils', 'cadres', 'textes', 'extremites']) delete brut[cle]
    brut.version = 2
    brut.calques = { fond: { visible: true, opacite: 0.5, verrouille: false }, voies: { visible: false } }
    return brut
  }

  it('s’ouvrent toujours : listes vides, Nord à gauche et Sud à droite', () => {
    const lu = lireProjet(JSON.stringify(etape2()))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.projet.voies).toHaveLength(4)
    expect([lu.projet.zones, lu.projet.appareils, lu.projet.cadres, lu.projet.textes]).toEqual([[], [], [], []])
    expect(lu.projet.extremites).toEqual({ gauche: 'Nord', droite: 'Sud' })
  })

  it('gardent les réglages de calques existants et complètent les autres', () => {
    const lu = lireProjet(JSON.stringify(etape2()))
    expect(lu.ok && lu.projet.calques).toEqual({
      ...creerProjet().calques,
      fond: { visible: true, opacite: 0.5, verrouille: false },
      voies: { visible: false, verrouille: false },
    })
  })

  it('sont réenregistrés au format actuel', () => {
    const lu = lireProjet(JSON.stringify(etape2()))
    if (!lu.ok) throw new Error()
    expect(JSON.parse(serialiserProjet(lu.projet)).version).toBe(3)
  })
})

describe('vérification des zones, appareils, cadres et textes', () => {
  it('ouvre l’exemple avec ses zones, son BS, sa communication, son cadre et son texte', () => {
    const projet = exemple()
    expect(projet.zones).toHaveLength(4)
    expect(projet.appareils.map((a) => a.communication)).toEqual([null, 'com-1', 'com-1'])
    expect(projet.cadres[0]).toMatchObject({ nom: 'Stockage vieilles TBA', pointille: true })
    expect(projet.textes).toHaveLength(1)
  })

  it('refuse une zone sur une voie qui n’existe pas', () => {
    const brut = brutExemple()
    brut.zones[0].voieId = 'voie-99'
    expect(erreursDe(brut)).toContain('Zone n°1 (« RVB 50 m ») : la voie « voie-99 » n\'existe pas')
  })

  it('refuse une zone qui sort de sa voie ou dont le début est après la fin', () => {
    const brut = brutExemple()
    brut.zones[0].fin = 5000
    brut.zones[1].debut = 460
    const erreurs = erreursDe(brut)
    expect(erreurs).toContain('hors de la voie « V1 »')
    expect(erreurs).toContain('le début est après la fin')
  })

  it('refuse un appareil dont la pointe et le talon sont sur la même voie', () => {
    const brut = brutExemple()
    brut.appareils[0].talon.voieId = brut.appareils[0].pointe.voieId
    expect(erreursDe(brut)).toContain('même voie')
  })

  it('refuse un appareil sans talon', () => {
    const brut = brutExemple()
    delete brut.appareils[0].talon
    expect(erreursDe(brut)).toContain('le talon est absent')
  })

  it('refuse une communication incomplète ou dont les BS ne sont pas talon contre talon', () => {
    const incomplete = brutExemple()
    incomplete.appareils.pop()
    expect(erreursDe(incomplete)).toContain('exactement deux BS')
    const decalee = brutExemple()
    decalee.appareils[2].talon.abscisse = 650
    expect(erreursDe(decalee)).toContain('pas talon contre talon')
  })

  it('refuse un cadre sans largeur et un texte de taille impossible', () => {
    const brut = brutExemple()
    brut.cadres[0].largeur = -4
    brut.textes[0].taille = 0
    const erreurs = erreursDe(brut)
    expect(erreurs).toContain('Cadre n°1 (« Stockage vieilles TBA ») : largeur et hauteur doivent être positives')
    expect(erreurs).toContain('Texte n°1 (« Accès base arrière ») : la taille')
  })

  it('refuse deux zones de même identifiant', () => {
    const brut = brutExemple()
    brut.zones[1].id = brut.zones[0].id
    expect(erreursDe(brut)).toContain('en double')
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
