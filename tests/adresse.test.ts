import { describe, expect, it } from 'vitest'
import { ecrireAdresse, lireAdresse, type Route } from '../src/plan/adresse.ts'

describe('adresses des écrans', () => {
  it('reconnaît chaque écran', () => {
    expect(lireAdresse('')).toEqual({ ecran: 'accueil' })
    expect(lireAdresse('#/')).toEqual({ ecran: 'accueil' })
    expect(lireAdresse('#/chantier/chantier-2')).toEqual({ ecran: 'chantier', chantierId: 'chantier-2' })
    expect(lireAdresse('#/chantier/chantier-2/plan/plan-1')).toEqual({ ecran: 'plan', chantierId: 'chantier-2', planId: 'plan-1' })
    expect(lireAdresse('#/chantier/chantier-2/synoptique/synoptique-1/image/3')).toEqual({
      ecran: 'synoptique',
      chantierId: 'chantier-2',
      synoptiqueId: 'synoptique-1',
      image: 3,
    })
  })

  it('ouvre la première image quand le numéro manque ou est fantaisiste', () => {
    expect(lireAdresse('#/chantier/c/synoptique/s')).toMatchObject({ ecran: 'synoptique', image: 1 })
    expect(lireAdresse('#/chantier/c/synoptique/s/image/0')).toMatchObject({ image: 1 })
    expect(lireAdresse('#/chantier/c/synoptique/s/image/deux')).toMatchObject({ image: 1 })
  })

  it('ramène à l’accueil ou au chantier une adresse inconnue ou abîmée', () => {
    expect(lireAdresse('#/n-importe-quoi')).toEqual({ ecran: 'accueil' })
    expect(lireAdresse('#/chantier/')).toEqual({ ecran: 'accueil' })
    expect(lireAdresse('#/chantier/%E0%A4%A')).toEqual({ ecran: 'accueil' })
    expect(lireAdresse('#/chantier/c/plan')).toEqual({ ecran: 'chantier', chantierId: 'c' })
    expect(lireAdresse('#/chantier/c/autre/x')).toEqual({ ecran: 'chantier', chantierId: 'c' })
  })

  it('relit ce qu’elle écrit, caractères spéciaux compris', () => {
    const routes: Route[] = [
      { ecran: 'accueil' },
      { ecran: 'chantier', chantierId: 'chantier/à é' },
      { ecran: 'plan', chantierId: 'c', planId: 'plan 1' },
      { ecran: 'synoptique', chantierId: 'c', synoptiqueId: 's#1', image: 2 },
    ]
    for (const route of routes) expect(lireAdresse(ecrireAdresse(route))).toEqual(route)
  })
})
