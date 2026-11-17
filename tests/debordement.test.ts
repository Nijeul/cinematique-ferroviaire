import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE_PAR_DEFAUT, type TypeEngin } from '../src/plan/catalogue.ts'
import type { Chantier } from '../src/plan/chantier.ts'
import {
  ajouterEngin,
  ajouterRame,
  avertissementDepassement,
  bornerMilieu,
  bornesMilieu,
  changerVoieEngin,
  changerVoieRame,
  composerRame,
  coteTete,
  GARDE_SUR_VOIE,
  groupeDe,
  inverserRame,
  placerEnginSurVoie,
  placerRame,
  silhouetteEngin,
  silhouetteRame,
  vehiculesDeGroupes,
  type Rame,
} from '../src/plan/engins.ts'
import { lireChantier, serialiserChantier } from '../src/plan/fichierChantier.ts'
import { legendeAffichee, texteEntree, type ListesChantier } from '../src/plan/legende.ts'
import { creerProjet } from '../src/plan/projet.ts'
import { modifierImage, projetDeImage, type PlanImage } from '../src/plan/synoptique.ts'
import { projeterSurPolyligne, projeterSurPolyligneProlongee } from '../src/plan/trace.ts'

// Une rame ou un engin peut déborder au-delà d'un bout de sa voie (un TTX de
// 400 m garé sur une voie de 188 m, la tête hors plan) : seule limite, qu'il
// en reste au moins 10 m sur la voie (la moitié d'un engin de moins de 20 m).

const type = (modele: string): TypeEngin => {
  const t = CATALOGUE_PAR_DEFAUT.find((x) => x.modele === modele)
  if (!t) throw new Error(modele)
  return t
}

// À 4 px par mètre : V1 droite de 1 000 px (250 m) ; V3 parallèle, plus
// longue côté Nord (500 m) ; V4 courte (125 m), seulement côté Sud.
const plan = (): PlanImage => ({
  ...creerProjet('Essai'),
  engins: [],
  rames: [],
  etatsZones: {},
  fleches: [],
  exploitation: {},
  commentaires: [],
  coupes: {},
  echelle: { pixelsParMetre: 4 },
  voies: [
    { id: 'voie-1', nom: 'V1', couleur: '#454f59', epaisseur: 9, points: [{ x: 100, y: 200 }, { x: 1100, y: 200 }] },
    { id: 'voie-3', nom: 'V3', couleur: '#454f59', epaisseur: 9, points: [{ x: -900, y: 300 }, { x: 1100, y: 300 }] },
    { id: 'voie-4', nom: 'V4', couleur: '#454f59', epaisseur: 9, points: [{ x: 600, y: 400 }, { x: 1100, y: 400 }] },
  ],
})

// TTX : BB 61000 + 20 × R39 = 412,5 m (1 650 px), plus long que V1.
const TTX = () => vehiculesDeGroupes([groupeDe(type('BB 61000')), groupeDe(type('R39'), 20)])
const TOTAL = 412.5 * 4
const GARDE = GARDE_SUR_VOIE * 4

const avecTTX = (abscisse = 500) => {
  const r = ajouterRame(plan(), TTX(), 'voie-1', abscisse)
  return { planche: r.planche, id: r.id, rame: () => r.planche.rames[0] }
}
const rameDe = (p: PlanImage): Rame => p.rames[0]

describe('bornes du milieu', () => {
  it('au moins 10 m sur la voie ; un objet court garde son milieu sur la voie', () => {
    expect(GARDE_SUR_VOIE).toBe(10)
    // Rame de 1 650 px sur une voie de 1 000 px, 40 px gardés.
    expect(bornesMilieu(1000, 1650, 40)).toEqual({ min: 40 - 825, max: 1000 - 40 + 825 })
    // Engin de 58 px (14,5 m) : la garde est sa moitié, comme avant.
    expect(bornesMilieu(1000, 58, 40)).toEqual({ min: 0, max: 1000 })
    // Sans longueur (pas d'échelle) : le milieu reste sur la voie.
    expect(bornesMilieu(1000, 0, 40)).toEqual({ min: 0, max: 1000 })
  })

  it('ramène dans les bornes, sans toucher une valeur permise', () => {
    const points = plan().voies[0].points
    expect(bornerMilieu(points, -5000, 1650, 40)).toBe(-785)
    expect(bornerMilieu(points, 5000, 1650, 40)).toBe(1785)
    expect(bornerMilieu(points, -300, 1650, 40)).toBe(-300)
    expect(bornerMilieu(points, Number.NaN, 1650, 40)).toBe(0)
  })
})

describe('rame qui déborde au-delà d’un bout de sa voie', () => {
  it('poussée vers le Nord : la tête hors plan, 10 m restent sur la voie', () => {
    const { planche, id } = avecTTX()
    expect(rameDe(planche).sens).toBe(-1) // tête côté Nord (à gauche)
    const p = placerRame(planche, id, -100000)
    const r = rameDe(p)
    expect(r.abscisse).toBeCloseTo(GARDE - TOTAL / 2)
    const s = silhouetteRame(p, r)!
    // Vraie longueur, aucun véhicule tronqué ni perdu.
    expect(s.vehicules).toHaveLength(21)
    expect(s.depassement).toBeCloseTo(412.5 - GARDE_SUR_VOIE)
    // La queue est sur la voie, la tête loin à gauche, dans le prolongement.
    const queue = s.vehicules[20]
    expect(queue.centre.y).toBeCloseTo(200)
    expect(queue.centre.x + queue.longueur / 2).toBeCloseTo(100 + GARDE)
    expect(s.vehicules[0].centre.x).toBeLessThan(100 - 1500)
    expect(s.vehicules[0].centre.y).toBeCloseTo(200)
    // Pastille sur le premier véhicule sur la voie, étiquette au milieu de la
    // partie sur la voie : elles restent sur la planche.
    expect(s.premierSurVoie).toBe(20)
    expect(s.milieu.centre.x).toBeCloseTo(100 + GARDE / 2)
    expect(coteTete(p, r)).toBe('Nord')
  })

  it('poussée vers le Sud : même limite à l’autre bout', () => {
    const { planche, id } = avecTTX()
    const r = rameDe(placerRame(planche, id, 100000))
    expect(r.abscisse).toBeCloseTo(1000 - GARDE + TOTAL / 2)
    const s = silhouetteRame(planche, r)!
    expect(s.depassement).toBeCloseTo(412.5 - GARDE_SUR_VOIE)
    expect(s.premierSurVoie).toBe(0)
    expect(s.milieu.centre.x).toBeCloseTo(1100 - GARDE / 2)
  })

  it('plus longue que la voie, elle se pose et se glisse librement entre les deux limites', () => {
    const { planche, id } = avecTTX()
    const s = silhouetteRame(planche, rameDe(planche))!
    // Centrée sur la voie : elle dépasse des deux côtés, rien n'est ramené.
    expect(rameDe(planche).abscisse).toBe(500)
    expect(s.depassement).toBeCloseTo(412.5 - 250)
    expect(s.milieu.centre.x).toBeCloseTo(600)
    const a300 = placerRame(planche, id, -300)
    expect(rameDe(a300).abscisse).toBe(-300)
    // La pastille passe sur le premier véhicule entièrement sur la voie.
    const s300 = silhouetteRame(a300, rameDe(a300))!
    expect(s300.premierSurVoie).toBe(15)
    expect(s300.vehicules[15].depassement).toBe(0)
    expect(s300.vehicules[14].depassement).toBeGreaterThan(0)
    expect(s.premierSurVoie).toBe(5) // la tête déborde déjà : la pastille est sur le 5e R39
    expect(rameDe(placerRame(planche, id, 1500)).abscisse).toBe(1500)
    // Inverser la garde à sa place.
    expect(rameDe(inverserRame(placerRame(planche, id, -300), id)).abscisse).toBe(-300)
  })

  it('suit la souris au-delà du bout de la voie, jusqu’à la limite', () => {
    const { planche, id } = avecTTX()
    // Comme dans l'image de travail : décalage le long de la voie prolongée.
    const glisser = (depart: { x: number; y: number }, p: { x: number; y: number }) => {
      const points = planche.voies[0].points
      const glisse = projeterSurPolyligneProlongee(points, p).abscisse - projeterSurPolyligneProlongee(points, depart).abscisse
      return rameDe(placerRame(planche, id, rameDe(planche).abscisse + glisse)).abscisse
    }
    const depart = { x: 600, y: 205 }
    // La souris va à x = -300, hors de la voie : la rame suit (avant : bloquée à 0).
    expect(glisser(depart, { x: -300, y: 230 })).toBeCloseTo(-400)
    // Encore plus loin : arrêtée à la limite.
    expect(glisser(depart, { x: -4000, y: 200 })).toBeCloseTo(GARDE - TOTAL / 2)
    // Vers le Sud.
    expect(glisser(depart, { x: 1300, y: 190 })).toBeCloseTo(1200)
  })

  it('une rame plus courte reste entière si on la pousse moins loin', () => {
    const r = ajouterRame(plan(), vehiculesDeGroupes([groupeDe(type('R39'), 3)]), 'voie-1', 500)
    const p = placerRame(r.planche, r.id, -1000)
    // 59,7 m : 10 m restent sur la voie, 49,7 m dépassent.
    expect(silhouetteRame(p, rameDe(p))!.depassement).toBeCloseTo(59.7 - GARDE_SUR_VOIE)
  })

  it('recomposée plus courte, elle est rapprochée de la voie', () => {
    const { planche, id } = avecTTX()
    const loin = placerRame(planche, id, -100000)
    const courte = composerRame(loin, id, vehiculesDeGroupes([groupeDe(type('R39'))]))
    // Un seul R39 (19,9 m) : son milieu revient au bout de la voie.
    expect(rameDe(courte).abscisse).toBeCloseTo(0)
    expect(silhouetteRame(courte, rameDe(courte))!.depassement).toBeCloseTo(19.9 / 2)
  })

  it('sans échelle, le milieu reste sur la voie, comme avant', () => {
    const sans = { ...plan(), echelle: null }
    const r = ajouterRame(sans, TTX(), 'voie-1', 500)
    expect(rameDe(placerRame(r.planche, r.id, -5000)).abscisse).toBe(0)
  })

  it('l’avertissement dit que la partie qui dépasse est dessinée, sans demander de la déplacer', () => {
    const { planche, id } = avecTTX()
    const p = placerRame(planche, id, -100000)
    const texte = avertissementDepassement('La rame « Rame 1 »', p.voies[0], silhouetteRame(p, rameDe(p))!.depassement)
    expect(texte).toBe(
      "La rame « Rame 1 » dépasse l'extrémité de la voie « V1 » de 402,5 m : la partie qui dépasse est dessinée dans le prolongement de la voie.",
    )
  })
})

describe('engin qui déborde', () => {
  it('un engin de moins de 20 m garde son milieu sur la voie, comme avant', () => {
    const { planche, id } = ajouterEngin(plan(), type('BB 61000'), { genre: 'voie', voieId: 'voie-1', abscisse: 300 })
    expect(placerEnginSurVoie(planche, id, -5000).engins[0].position).toMatchObject({ abscisse: 0 })
    expect(placerEnginSurVoie(planche, id, 5000).engins[0].position).toMatchObject({ abscisse: 1000 })
  })

  it('un engin plus long peut déborder jusqu’à ne garder que 10 m sur la voie', () => {
    const { planche, id } = ajouterEngin(plan(), type('Type 108-32 U'), { genre: 'voie', voieId: 'voie-1', abscisse: 300 })
    const p = placerEnginSurVoie(planche, id, -5000)
    expect(p.engins[0].position).toMatchObject({ abscisse: expect.closeTo(GARDE - (32.8 * 4) / 2, 6) })
    expect(silhouetteEngin(p, p.engins[0])!.depassement).toBeCloseTo(32.8 - GARDE_SUR_VOIE)
  })
})

describe('changer de voie avec un débordement', () => {
  const auNord = () => {
    const { planche, id } = avecTTX()
    return { planche: placerRame(planche, id, -100000), id }
  }

  it('la rame garde sa place, débordement compris, sur une voie qui la porte', () => {
    const { planche, id } = auNord()
    const centre = silhouetteRame(planche, rameDe(planche))!.vehicules.map((v) => v.centre.x)
    const sur3 = changerVoieRame(planche, id, 'voie-3')
    const r = rameDe(sur3)
    expect(r.voieId).toBe('voie-3')
    expect(r.sens).toBe(-1)
    const s = silhouetteRame(sur3, r)!
    s.vehicules.forEach((v, i) => expect(v.centre.x).toBeCloseTo(centre[i]))
    // Retour sur V1 : la même place qu'au départ.
    expect(rameDe(changerVoieRame(sur3, id, 'voie-1')).abscisse).toBeCloseTo(rameDe(planche).abscisse)
  })

  it('sur une voie plus courte, elle est ramenée à la limite', () => {
    const { planche, id } = auNord()
    const r = rameDe(changerVoieRame(planche, id, 'voie-4'))
    expect(r.abscisse).toBeCloseTo(GARDE - TOTAL / 2)
    const s = silhouetteRame(changerVoieRame(planche, id, 'voie-4'), r)!
    expect(s.depassement).toBeCloseTo(412.5 - GARDE_SUR_VOIE)
  })

  it('un engin qui déborde passe sur une autre voie au plus près, dans la limite', () => {
    const { planche, id } = ajouterEngin(plan(), type('Type 108-32 U'), { genre: 'voie', voieId: 'voie-1', abscisse: 0 })
    const loin = placerEnginSurVoie(planche, id, -5000)
    const sur3 = changerVoieEngin(loin, id, 'voie-3')
    expect(silhouetteEngin(sur3, sur3.engins[0])!.centre.x).toBeCloseTo(silhouetteEngin(loin, loin.engins[0])!.centre.x)
    const sur4 = changerVoieEngin(loin, id, 'voie-4')
    expect(sur4.engins[0].position).toMatchObject({ voieId: 'voie-4', abscisse: expect.closeTo(GARDE - (32.8 * 4) / 2, 6) })
    // Hors voie : il garde son milieu, au-delà du bout de la voie.
    const libre = changerVoieEngin(loin, id, null)
    expect(libre.engins[0].position).toMatchObject({ genre: 'libre', x: expect.closeTo(100 + GARDE - 65.6, 6), y: 200 })
  })
})

describe('projection sur la voie prolongée', () => {
  const coude = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]

  it('au-delà du premier ou du dernier point, l’abscisse sort de la voie', () => {
    expect(projeterSurPolyligneProlongee(coude, { x: -50, y: 10 })).toMatchObject({ abscisse: -50, distance: 10 })
    expect(projeterSurPolyligneProlongee(coude, { x: 95, y: 150 })).toMatchObject({ abscisse: 250, distance: 5 })
  })

  it('le long de la voie, elle est la projection habituelle', () => {
    for (const p of [
      { x: 50, y: 5 },
      { x: 150, y: -10 },
      { x: 120, y: 60 },
    ]) {
      expect(projeterSurPolyligneProlongee(coude, p)).toEqual(projeterSurPolyligne(coude, p))
    }
  })
})

describe('lecture et légende d’une rame qui déborde', () => {
  const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
  const lire = (texte: string): Chantier => {
    const lu = lireChantier(texte)
    if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
    return lu.chantier
  }

  it('un chantier dont une rame et un engin ont leur milieu hors de la voie se lit tel quel', () => {
    const brut = JSON.parse(texteFixture)
    const contenu = brut.synoptiques[0].images[0].contenu
    contenu.rames[0].abscisse = -800
    contenu.engins[0].position.abscisse = 1300
    const c = lire(JSON.stringify(brut))
    const lu = c.synoptiques[0].images[0].contenu
    expect(lu.rames[0].abscisse).toBe(-800)
    expect(lu.engins[0].position).toMatchObject({ abscisse: 1300 })
    // Et revient identique après enregistrement.
    expect(lire(serialiserChantier(c)).synoptiques[0].images[0].contenu.rames[0].abscisse).toBe(-800)
  })

  it('même une rame entièrement au-delà du bout se lit, et se dessine dans le prolongement', () => {
    const brut = JSON.parse(texteFixture)
    brut.synoptiques[0].images[0].contenu.rames[0].abscisse = -5000
    const s = lire(JSON.stringify(brut)).synoptiques[0]
    const planche = projetDeImage(s, s.images[0])
    const sil = silhouetteRame(planche, planche.rames[0])!
    expect(sil.depassement).toBeCloseTo(sil.longueur)
    sil.vehicules.forEach((v) => expect(v.depassement).toBeCloseTo(v.longueur / 4))
    // La glisser la ramène dans la limite.
    const r = rameDe(placerRame(planche, planche.rames[0].id, -5000))
    expect(r.abscisse).toBeCloseTo(GARDE - (sil.longueur * 4) / 2)
  })

  it('une zone de travaux hors de la voie reste refusée', () => {
    const brut = JSON.parse(texteFixture)
    brut.synoptiques[0].images[0].contenu.zones[0].debut = -50
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(false)
  })

  it('la légende de l’image garde la rame qui déborde', () => {
    const c = lire(texteFixture)
    const listes: ListesChantier = { etatsVoie: c.etatsVoie, typesFleches: c.typesFleches, catalogue: c.catalogue, etatsExploitation: c.etatsExploitation }
    const s = c.synoptiques[0]
    const avant = legendeAffichee(s, 0, listes).map(texteEntree)
    const pousse = modifierImage(s, 0, (p) => placerRame(p, p.rames[0].id, -100000))
    expect(pousse.images[0].contenu.rames[0].abscisse).toBeLessThan(0)
    expect(legendeAffichee(pousse, 0, listes).map(texteEntree)).toEqual(avant)
  })
})
