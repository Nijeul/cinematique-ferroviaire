import { describe, expect, it } from 'vitest'
import { annuler, creerHistorique, enregistrer, LIMITE_HISTORIQUE, peutAnnuler, peutRetablir, retablir } from '../src/plan/historique.ts'

describe('annuler / rétablir', () => {
  it('annule puis rétablit dans l’ordre', () => {
    let h = creerHistorique('a')
    h = enregistrer(h, 'b')
    h = enregistrer(h, 'c')
    h = annuler(h)
    expect(h.present).toBe('b')
    h = annuler(h)
    expect(h.present).toBe('a')
    expect(peutAnnuler(h)).toBe(false)
    h = retablir(h)
    expect(h.present).toBe('b')
    h = retablir(h)
    expect(h.present).toBe('c')
    expect(peutRetablir(h)).toBe(false)
  })

  it('oublie ce qui pouvait être rétabli après une nouvelle modification', () => {
    let h = enregistrer(enregistrer(creerHistorique('a'), 'b'), 'c')
    h = enregistrer(annuler(h), 'd')
    expect(peutRetablir(h)).toBe(false)
    expect(annuler(h).present).toBe('b')
  })

  it('ne fait rien quand il n’y a rien à annuler ou à rétablir', () => {
    const h = creerHistorique('a')
    expect(annuler(h)).toBe(h)
    expect(retablir(h)).toBe(h)
  })

  it('ignore une « modification » qui ne change rien', () => {
    const h = creerHistorique('a')
    expect(enregistrer(h, 'a')).toBe(h)
  })

  it('regroupe les modifications successives de même clé en un seul Annuler', () => {
    let h = creerHistorique('')
    for (const texte of ['V', 'V1', 'V1 ', 'V1 b']) h = enregistrer(h, texte, 'nom:voie-1')
    h = enregistrer(h, 'autre chose')
    expect(annuler(h).present).toBe('V1 b')
    expect(annuler(annuler(h)).present).toBe('')
  })

  it('ne regroupe plus après un Annuler', () => {
    let h = enregistrer(creerHistorique('a'), 'b', 'cle')
    h = enregistrer(annuler(h), 'c', 'cle')
    expect(h.passe).toEqual(['a'])
    h = enregistrer(h, 'd', 'cle')
    expect(h.passe).toEqual(['a'])
    expect(h.present).toBe('d')
  })

  it('limite la mémoire aux dernières modifications', () => {
    let h = creerHistorique(0)
    for (let i = 1; i <= LIMITE_HISTORIQUE + 20; i++) h = enregistrer(h, i)
    expect(h.passe).toHaveLength(LIMITE_HISTORIQUE)
    expect(h.passe[0]).toBe(20)
  })
})
