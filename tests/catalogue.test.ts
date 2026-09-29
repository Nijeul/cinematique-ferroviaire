import { describe, expect, it } from 'vitest'
import {
  ajouterType,
  CATALOGUE_PAR_DEFAUT,
  COULEUR_NOUVELLE_CATEGORIE,
  couleurDeCategorie,
  creerCatalogue,
  LARGEUR_PAR_DEFAUT_M,
  modifierType,
  parCategorie,
  supprimerType,
} from '../src/plan/catalogue.ts'

describe('catalogue d’engins par défaut', () => {
  it('contient les 12 modèles du tableau du commanditaire, longueurs exactes', () => {
    const tableau = CATALOGUE_PAR_DEFAUT.filter((t) => t.categorie !== 'Pelle RR').map((t) => [t.categorie, t.modele, t.longueur])
    expect(tableau).toEqual([
      ['Loco', 'BB 61000', 14.5],
      ['Loco', 'V211', 12.3],
      ['Ballastière', 'D12', 14],
      ['Ballastière', 'Ex 100', 15.64],
      ['Ballastière', 'C12', 9.64],
      ['Bigrue', 'Type DGS82BG', 32.6],
      ['Bigrue', 'Socofer', 19.9],
      ['BML', 'Type 08-32U', 31],
      ['BML', 'Type 08 GV', 31.5],
      ['BML', 'Type 108-32 U', 32.8],
      ['Stabilisateur', 'Type DGS82', 32.8],
      ['Wagon', 'R39', 19.9],
    ])
  })

  it('reprend la couleur de chaque catégorie de son tableau', () => {
    const couleur = (categorie: string) => new Set(CATALOGUE_PAR_DEFAUT.filter((t) => t.categorie === categorie).map((t) => t.couleur))
    expect(couleur('Loco')).toEqual(new Set(['#66ff99']))
    expect(couleur('Ballastière')).toEqual(new Set(['#ff9933']))
    expect(couleur('Bigrue')).toEqual(new Set(['#ccccff']))
    expect(couleur('BML')).toEqual(new Set(['#ff9999']))
    expect(couleur('Stabilisateur')).toEqual(new Set(['#3399ff']))
    expect(couleur('Wagon')).toEqual(new Set(['#ff9933']))
  })

  it('ajoute la Pelle RR aux dimensions d’une Caterpillar 323 (transport, à confirmer)', () => {
    const pelle = CATALOGUE_PAR_DEFAUT.find((t) => t.categorie === 'Pelle RR')
    expect(pelle).toMatchObject({ modele: 'CAT 323', longueur: 9.5, largeur: 3.2, couleur: '#e8a33d' })
    expect(CATALOGUE_PAR_DEFAUT).toHaveLength(13)
  })

  it('donne 3 m de large aux engins ferroviaires, faute de mieux', () => {
    expect(LARGEUR_PAR_DEFAUT_M).toBe(3)
    expect(CATALOGUE_PAR_DEFAUT.filter((t) => t.categorie !== 'Pelle RR').every((t) => t.largeur === 3)).toBe(true)
  })

  it('a des identifiants uniques, et chaque chantier reçoit sa propre copie', () => {
    expect(new Set(CATALOGUE_PAR_DEFAUT.map((t) => t.id)).size).toBe(13)
    const a = creerCatalogue()
    a[0].longueur = 99
    expect(CATALOGUE_PAR_DEFAUT[0].longueur).toBe(14.5)
  })

  it('se groupe par catégorie, dans l’ordre du tableau', () => {
    expect(parCategorie(creerCatalogue()).map((g) => `${g.categorie} (${g.types.length})`)).toEqual([
      'Loco (2)',
      'Ballastière (3)',
      'Bigrue (2)',
      'BML (3)',
      'Stabilisateur (1)',
      'Wagon (1)',
      'Pelle RR (1)',
    ])
  })
})

describe('modification du catalogue', () => {
  // Dimensions factices, pour l'essai seulement : pas de vraies valeurs de PEM LEM.
  const ESSAI = { categorie: 'PEM LEM', modele: 'Essai', longueur: 12, largeur: 4, couleur: '#aa66cc' }

  it('ajoute un type saisi par l’utilisateur', () => {
    const r = ajouterType(creerCatalogue(), ESSAI)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valeur.id).toBe('type-14')
    expect(r.valeur.catalogue.at(-1)).toEqual({ id: 'type-14', ...ESSAI })
  })

  it('refuse un type sans longueur, sans largeur ou sans nom, sans rien inventer', () => {
    expect(ajouterType([], { ...ESSAI, longueur: NaN })).toEqual({ ok: false, erreur: 'La longueur doit être un nombre de mètres plus grand que zéro.' })
    expect(ajouterType([], { ...ESSAI, largeur: 0 }).ok).toBe(false)
    expect(ajouterType([], { ...ESSAI, modele: '  ' }).ok).toBe(false)
    expect(ajouterType([], { ...ESSAI, categorie: '' }).ok).toBe(false)
  })

  it('propose la couleur de la catégorie si elle existe déjà', () => {
    expect(couleurDeCategorie(creerCatalogue(), 'wagon')).toBe('#ff9933')
    expect(couleurDeCategorie(creerCatalogue(), 'PEM LEM')).toBe(COULEUR_NOUVELLE_CATEGORIE)
  })

  it('modifie et supprime un type', () => {
    const r = modifierType(creerCatalogue(), 'type-12', { longueur: 20.1 })
    expect(r.ok && r.valeur.find((t) => t.id === 'type-12')?.longueur).toBe(20.1)
    expect(modifierType(creerCatalogue(), 'type-12', { longueur: 0 }).ok).toBe(false)
    expect(supprimerType(creerCatalogue(), 'type-12').some((t) => t.modele === 'R39')).toBe(false)
  })
})
