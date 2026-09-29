import { describe, expect, it } from 'vitest'
import { bornerPage, COTE_MAX_RENDU, echelleRendu, typeDeFond } from '../src/plan/fond.ts'
import { decouper, recomposer } from '../src/plan/sauvegarde.ts'
import { creerProjet, type Projet } from '../src/plan/projet.ts'
import { ajouterVoie, remplacerFond } from '../src/plan/edition.ts'

describe('fichier de fond', () => {
  it('reconnaît un PDF, une image PNG ou JPG, et refuse le reste', () => {
    expect(typeDeFond('Plan.PDF', '')).toBe('pdf')
    expect(typeDeFond('x', 'application/pdf')).toBe('pdf')
    expect(typeDeFond('photo.jpeg', '')).toBe('image')
    expect(typeDeFond('plan', 'image/png')).toBe('image')
    expect(typeDeFond('plan.dwg', 'application/octet-stream')).toBeNull()
  })
})

describe('choix de la page d’un PDF', () => {
  it('ramène la page demandée dans le document', () => {
    expect(bornerPage(2, 5)).toBe(2)
    expect(bornerPage(0, 5)).toBe(1)
    expect(bornerPage(-3, 5)).toBe(1)
    expect(bornerPage(9, 5)).toBe(5)
    expect(bornerPage(2.6, 5)).toBe(3)
  })

  it('revient à la page 1 sur une saisie vide ou fantaisiste', () => {
    expect(bornerPage(Number(''), 5)).toBe(1)
    expect(bornerPage(Number('abc'), 5)).toBe(1)
    expect(bornerPage(3, 0)).toBe(1)
  })
})

describe('résolution du rendu PDF', () => {
  it('rend une page A3 au double de sa taille', () => {
    expect(echelleRendu(1191, 842)).toBe(2)
  })

  it('plafonne les grands formats pour ménager la mémoire', () => {
    const echelle = echelleRendu(2384, 3370) // A0
    expect(3370 * echelle).toBeCloseTo(COTE_MAX_RENDU)
    expect(echelle).toBeLessThan(2)
  })
})

describe('sauvegarde automatique', () => {
  const avecFond = (): Projet =>
    ajouterVoie(
      remplacerFond(creerProjet(), {
        image: 'data:image/jpeg;base64,/9j/AAAA',
        largeur: 2000,
        hauteur: 1400,
        nomFichier: 'plan.pdf',
        page: 2,
        nombrePages: 2,
      }),
      [{ x: 10, y: 10 }, { x: 900, y: 10 }],
    ).projet

  it('sépare l’image (lourde) du reste du projet, puis recompose à l’identique', () => {
    const projet = avecFond()
    const morceaux = decouper(projet)
    expect(morceaux.projet).not.toContain('base64')
    expect(morceaux.image).toBe(projet.fond!.image)
    expect(recomposer(morceaux.projet, morceaux.image)).toEqual({ ok: true, projet, fondManquant: false })
  })

  it('rend les voies même quand l’image n’a pas pu être sauvée, et le signale', () => {
    const projet = avecFond()
    const restauration = recomposer(decouper(projet).projet, null)
    expect(restauration.ok).toBe(true)
    if (!restauration.ok) return
    expect(restauration.fondManquant).toBe(true)
    expect(restauration.projet.voies).toEqual(projet.voies)
    expect(restauration.projet.fond?.nomFichier).toBe('plan.pdf')
    expect(restauration.projet.largeur).toBe(2000)
  })

  it('ne signale rien pour un projet sans fond', () => {
    const morceaux = decouper(creerProjet())
    expect(morceaux.image).toBeNull()
    const restauration = recomposer(morceaux.projet, null)
    expect(restauration.ok && restauration.fondManquant).toBe(false)
  })
})
