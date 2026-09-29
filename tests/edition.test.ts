import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ajouterVoie,
  deplacerPoint,
  modifierCalqueFond,
  modifierVoie,
  nomParDefaut,
  nouvelIdentifiant,
  remplacerFond,
  retirerFond,
  supprimerPoint,
  supprimerVoie,
} from '../src/plan/edition.ts'
import { creerProjet, EPAISSEUR_MAX, lireProjet, type Projet } from '../src/plan/projet.ts'

const exemple = (): Projet => {
  const lu = lireProjet(readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8'))
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.projet
}

describe('ajout de voie', () => {
  it('donne un identifiant et un nom nouveaux, la couleur et l’épaisseur par défaut', () => {
    const projet = exemple()
    const { projet: apres, id } = ajouterVoie(projet, [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    expect(id).toBe('voie-5')
    const voie = apres.voies.find((v) => v.id === id)!
    expect(voie.nom).toBe('Voie 5')
    expect(voie.couleur).toBe('#454f59')
    expect(voie.epaisseur).toBe(9)
    expect(voie.points).toHaveLength(2)
    // L'ancien projet n'est pas touché (sinon Annuler ne marcherait pas).
    expect(projet.voies).toHaveLength(4)
  })

  it('réaffiche le calque des voies s’il était masqué', () => {
    const projet = { ...creerProjet(), calques: { ...creerProjet().calques, voies: { visible: false } } }
    expect(ajouterVoie(projet, [{ x: 0, y: 0 }, { x: 1, y: 1 }]).projet.calques.voies.visible).toBe(true)
  })

  it('ne reprend pas un nom ou un identifiant déjà pris', () => {
    const { projet } = ajouterVoie(creerProjet(), [{ x: 0, y: 0 }, { x: 1, y: 1 }])
    const renomme = modifierVoie(projet, 'voie-1', { nom: 'Voie 2' })
    expect(nomParDefaut(renomme.voies)).toBe('Voie 3')
    expect(nouvelIdentifiant(renomme.voies)).toBe('voie-2')
  })
})

describe('modification de voie', () => {
  it('change nom, couleur et épaisseur, épaisseur bornée', () => {
    const projet = modifierVoie(exemple(), 'voie-2', { nom: 'VC bis', couleur: '#d98b1e', epaisseur: 9999 })
    const voie = projet.voies.find((v) => v.id === 'voie-2')!
    expect(voie).toMatchObject({ nom: 'VC bis', couleur: '#d98b1e', epaisseur: EPAISSEUR_MAX })
  })

  it('déplace un seul point', () => {
    const projet = deplacerPoint(exemple(), 'voie-1', 1, { x: 1, y: 2 })
    expect(projet.voies[0].points).toEqual([{ x: 180, y: 240 }, { x: 1, y: 2 }, { x: 760, y: 300 }])
  })
})

describe('suppression', () => {
  it('retire un point quand la voie en garde au moins deux', () => {
    const { projet, voieSupprimee } = supprimerPoint(exemple(), 'voie-1', 2)
    expect(voieSupprimee).toBe(false)
    expect(projet.voies[0].points).toHaveLength(2)
  })

  it('supprime la voie entière s’il ne resterait qu’un point', () => {
    const { projet, voieSupprimee } = supprimerPoint(exemple(), 'voie-2', 0)
    expect(voieSupprimee).toBe(true)
    expect(projet.voies.map((v) => v.id)).not.toContain('voie-2')
  })

  it('supprime une voie', () => {
    expect(supprimerVoie(exemple(), 'voie-3').voies).toHaveLength(3)
  })
})

describe('fond et calques', () => {
  const fond = { image: 'data:image/png;base64,AAAA', largeur: 3000, hauteur: 2000, nomFichier: 'plan.pdf', page: 1, nombrePages: 2 }

  it('donne au plan de travail la taille du fond importé, et le rend visible', () => {
    const cache = modifierCalqueFond(exemple(), { visible: false })
    const projet = remplacerFond(cache, fond)
    expect([projet.largeur, projet.hauteur]).toEqual([3000, 2000])
    expect(projet.calques.fond.visible).toBe(true)
  })

  it('garde la taille du plan quand on retire le fond', () => {
    const projet = retirerFond(remplacerFond(exemple(), fond))
    expect(projet.fond).toBeNull()
    expect(projet.largeur).toBe(3000)
  })

  it('borne l’opacité entre 0 et 1', () => {
    expect(modifierCalqueFond(exemple(), { opacite: 1.4 }).calques.fond.opacite).toBe(1)
    expect(modifierCalqueFond(exemple(), { opacite: -1 }).calques.fond.opacite).toBe(0)
  })
})
