import { describe, expect, it } from 'vitest'
import { cleEcran, decrireErreur, detailTechnique, MESSAGE_ERREUR_ECRAN, retoursApresErreur } from '../src/plan/erreur.ts'

describe("barrière d'erreur : message, retours, détail technique", () => {
  it('le message rassure sur les chantiers', () => {
    expect(MESSAGE_ERREUR_ECRAN).toBe('Une erreur est survenue sur cet écran. Vos chantiers sont conservés dans ce navigateur.')
  })

  it('propose de revenir au chantier ouvert, et à l’accueil', () => {
    expect(retoursApresErreur({ ecran: 'synoptique', chantierId: 'chantier-2', synoptiqueId: 'synoptique-1', image: 3 })).toEqual({
      chantier: { ecran: 'chantier', chantierId: 'chantier-2' },
      accueil: { ecran: 'accueil' },
    })
    expect(retoursApresErreur({ ecran: 'plan', chantierId: 'c', planId: 'p' }).chantier).toEqual({ ecran: 'chantier', chantierId: 'c' })
    expect(retoursApresErreur({ ecran: 'accueil' })).toEqual({ chantier: null, accueil: { ecran: 'accueil' } })
  })

  it('changer d’image ne change pas d’écran ; changer de synoptique, si', () => {
    const image = (n: number, s = 'synoptique-1') => cleEcran({ ecran: 'synoptique', chantierId: 'c', synoptiqueId: s, image: n })
    expect(image(1)).toBe(image(4))
    expect(image(1)).not.toBe(image(1, 'synoptique-2'))
    expect(cleEcran({ ecran: 'chantier', chantierId: 'c' })).not.toBe(cleEcran({ ecran: 'plan', chantierId: 'c', planId: 'p' }))
    expect(cleEcran({ ecran: 'accueil' })).toBe('accueil')
  })

  it('décrit toute valeur lancée, erreur ou non', () => {
    const e = new TypeError("Cannot read properties of undefined (reading 'map')")
    expect(decrireErreur(e)).toMatchObject({ nom: 'TypeError', message: "Cannot read properties of undefined (reading 'map')" })
    expect(decrireErreur(e).pile).toContain('TypeError')
    expect(decrireErreur('texte')).toEqual({ nom: 'Erreur', message: 'texte', pile: null })
    expect(decrireErreur({ code: 3 })).toEqual({ nom: 'Erreur', message: '{"code":3}', pile: null })
    expect(decrireErreur(undefined).message).toBe('undefined')
    const boucle: Record<string, unknown> = {}
    boucle.moi = boucle
    expect(decrireErreur(boucle).message).toBe('[object Object]')
  })

  it('le détail à transmettre contient l’erreur, l’écran, la date, le navigateur et les piles', () => {
    const texte = detailTechnique({
      nom: 'TypeError',
      message: 'x is undefined',
      pile: 'TypeError: x is undefined\n    at ImageCadree (index.js:1:2)\n',
      pileComposants: '\n    at ImageCadree\n    at Vignettes',
      adresse: '#/chantier/c/synoptique/s/image/2',
      navigateur: 'Mozilla/5.0 Edg/140',
      quand: '2026-09-29T20:00:00.000Z',
    })
    expect(texte.split('\n').slice(0, 4)).toEqual([
      'TypeError : x is undefined',
      'Écran : #/chantier/c/synoptique/s/image/2',
      'Date : 2026-09-29T20:00:00.000Z',
      'Navigateur : Mozilla/5.0 Edg/140',
    ])
    expect(texte).toContain('Pile :\nTypeError: x is undefined\n    at ImageCadree (index.js:1:2)')
    expect(texte).toContain('Composants :\nat ImageCadree\n    at Vignettes')
  })

  it('sans pile ni adresse, le détail reste lisible', () => {
    const texte = detailTechnique({ nom: 'Erreur', message: 'm', pile: null, pileComposants: null, adresse: '', navigateur: 'n', quand: 'q' })
    expect(texte).toBe('Erreur : m\nÉcran : #/\nDate : q\nNavigateur : n')
  })
})
