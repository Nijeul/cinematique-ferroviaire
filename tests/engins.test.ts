import { describe, expect, it } from 'vitest'
import { CATALOGUE_PAR_DEFAUT } from '../src/plan/catalogue.ts'
import { dansPolygone, elementSousPointeur, enginSousPointeur, poigneesDe } from '../src/plan/detection.ts'
import { dependancesVoie, deplacerPoint, modifierCalque, supprimerVoie } from '../src/plan/edition.ts'
import { supprimerElement } from '../src/plan/elements.ts'
import {
  abscissesVehicules,
  ajouterEngin,
  ajouterGroupe,
  ajouterRame,
  angleVers,
  appliquerType,
  avertissementDepassement,
  changerNombre,
  composerRame,
  coteTete,
  coteEtiquetteRame,
  couleurTexteSur,
  deplacerGroupe,
  etiquetteRame,
  FACTEUR_LARGEUR_MIN,
  glisserEnginLibre,
  groupeDe,
  groupesDeVehicules,
  inverserRame,
  libelleARetourner,
  largeurVisible,
  longueurRame,
  modifierEngin,
  placerEnginSurVoie,
  placerRame,
  positionPastille,
  retirerGroupe,
  silhouetteEngin,
  silhouetteRame,
  tailleLibelle,
  texteComposition,
  tournerEngin,
  vehiculesDeGroupes,
} from '../src/plan/engins.ts'
import { distance, distancePointPolyligne } from '../src/plan/geometrie.ts'
import { creerProjet, type Point, type Projet, type TypeEngin } from '../src/plan/projet.ts'
import { longueurPolyligne } from '../src/plan/trace.ts'

const type = (modele: string): TypeEngin => {
  const t = CATALOGUE_PAR_DEFAUT.find((x) => x.modele === modele)
  if (!t) throw new Error(modele)
  return t
}

// Arc de cercle de rayon 400, approché par 60 segments (une voie courbe).
const arc = (): Point[] =>
  Array.from({ length: 61 }, (_, i) => {
    const a = Math.PI + (i / 60) * (Math.PI / 2)
    return { x: 900 + 400 * Math.cos(a), y: 900 + 400 * Math.sin(a) }
  })

// Plan à 4 px par mètre (1 600 px = 400 m) : une voie droite de 1 000 px
// (250 m) et une voie courbe.
const plan = (): Projet => ({
  ...creerProjet('Essai'),
  echelle: { pixelsParMetre: 4 },
  voies: [
    { id: 'voie-1', nom: 'V1', couleur: '#454f59', epaisseur: 9, points: [{ x: 100, y: 200 }, { x: 1100, y: 200 }] },
    { id: 'voie-2', nom: 'V2', couleur: '#454f59', epaisseur: 9, points: arc() },
  ],
})

const long = (a: Point, b: Point) => distance(a, b)

describe('engin posé sur une voie', () => {
  it('se pose à l’abscisse cliquée, le long de la voie, rectangle à l’échelle', () => {
    const { projet, id } = ajouterEngin(plan(), type('R39'), { genre: 'voie', voieId: 'voie-1', abscisse: 300 })
    const engin = projet.engins.find((e) => e.id === id)!
    expect(engin).toMatchObject({ typeId: 'type-12', couleur: '#ff9933', numero: '', type: { modele: 'R39', longueur: 19.9 } })
    const s = silhouetteEngin(projet, engin)!
    // 19,9 m × 4 px/m = 79,6 px, exactement.
    expect(s.longueur).toBeCloseTo(79.6, 9)
    expect(long(s.coins[0], s.coins[1])).toBeCloseTo(79.6, 9)
    expect(s.centre).toEqual({ x: 400, y: 200 })
    expect(s.angle).toBeCloseTo(0)
    // 3 m × 4 = 12 px de large (plus que la voie de 9 px).
    expect(s.largeur).toBeCloseTo(12)
    expect(long(s.coins[1], s.coins[2])).toBeCloseTo(12)
    expect(s.depassement).toBe(0)
  })

  it('une BML 108-32 U fait 32,8 m à l’échelle', () => {
    const { projet } = ajouterEngin(plan(), type('Type 108-32 U'), { genre: 'voie', voieId: 'voie-1', abscisse: 500 })
    expect(silhouetteEngin(projet, projet.engins[0])!.longueur / 4).toBeCloseTo(32.8, 9)
  })

  it('en courbe, reste sur la voie et suit la tangente locale, longueur exacte', () => {
    const { projet } = ajouterEngin(plan(), type('Type 08-32U'), { genre: 'voie', voieId: 'voie-2', abscisse: 300 })
    const s = silhouetteEngin(projet, projet.engins[0])!
    expect(distancePointPolyligne(s.centre, arc())).toBeLessThan(1e-6)
    expect(s.longueur).toBeCloseTo(31 * 4, 9)
    // Tangente d'un cercle : perpendiculaire au rayon.
    const rayon = { x: s.centre.x - 900, y: s.centre.y - 900 }
    expect(Math.abs(rayon.x * s.direction.x + rayon.y * s.direction.y) / 400).toBeLessThan(0.01)
  })

  it('glisse le long de sa voie, sans en sortir', () => {
    const { projet, id } = ajouterEngin(plan(), type('BB 61000'), { genre: 'voie', voieId: 'voie-1', abscisse: 300 })
    const glisse = placerEnginSurVoie(projet, id, 450)
    expect(silhouetteEngin(glisse, glisse.engins[0])!.centre).toEqual({ x: 550, y: 200 })
    expect(placerEnginSurVoie(projet, id, 5000).engins[0].position).toMatchObject({ abscisse: 1000 })
  })

  it('signale un engin qui dépasse le bout de la voie, avec sa vraie longueur', () => {
    const { projet } = ajouterEngin(plan(), type('R39'), { genre: 'voie', voieId: 'voie-1', abscisse: 20 })
    const s = silhouetteEngin(projet, projet.engins[0])!
    expect(s.longueur).toBeCloseTo(79.6)
    expect(s.depassement).toBeCloseTo((39.8 - 20) / 4)
    expect(avertissementDepassement('« R39 »', projet.voies[0], s.depassement)).toBe(
      "« R39 » dépasse l'extrémité de la voie « V1 » de 4,95 m : déplacez-la ou raccourcissez-la.",
    )
    expect(avertissementDepassement('x', projet.voies[0], 0)).toBeNull()
  })
})

describe('engin hors voie', () => {
  it('se pose librement et tourne', () => {
    const { projet, id } = ajouterEngin(plan(), type('CAT 323'), { genre: 'libre', x: 600, y: 600, angle: 30 })
    const s = silhouetteEngin(projet, projet.engins[0])!
    expect(s.angle).toBeCloseTo(30)
    expect(s.longueur).toBeCloseTo(9.5 * 4)
    expect(s.largeur).toBeCloseTo(3.2 * 4)
    const cote = { x: s.coins[1].x - s.coins[0].x, y: s.coins[1].y - s.coins[0].y }
    expect((Math.atan2(cote.y, cote.x) * 180) / Math.PI).toBeCloseTo(30)
    expect(tournerEngin(projet, id, -30).engins[0].position).toMatchObject({ angle: 330 })
    expect(tournerEngin(projet, id, 725).engins[0].position).toMatchObject({ angle: 5 })
    expect(glisserEnginLibre(projet, id, { x: 10, y: -5 }).engins[0].position).toMatchObject({ x: 610, y: 595 })
  })

  it('la poignée de rotation règle l’angle, par pas de 15° avec Maj', () => {
    const { projet } = ajouterEngin(plan(), type('CAT 323'), { genre: 'libre', x: 600, y: 600, angle: 0 })
    const [poignee] = poigneesDe(projet, { genre: 'engin', id: projet.engins[0].id })
    expect(poignee.cle).toBe('rotation')
    expect(poignee.point.y).toBeCloseTo(600)
    expect(poignee.point.x).toBeGreaterThan(600 + 19)
    expect(angleVers({ x: 0, y: 0 }, { x: 10, y: 10 })).toBeCloseTo(45)
    expect(angleVers({ x: 0, y: 0 }, { x: 10, y: 4 }, 15)).toBe(15)
    // Un engin sur voie n'a pas de poignée : il se glisse le long de la voie.
    const surVoie = ajouterEngin(plan(), type('R39'), { genre: 'voie', voieId: 'voie-1', abscisse: 300 }).projet
    expect(poigneesDe(surVoie, { genre: 'engin', id: surVoie.engins[0].id })).toEqual([])
  })
})

describe('largeur minimale visible', () => {
  it('jamais plus fine que la voie dessinée ; la longueur reste à l’échelle', () => {
    expect(largeurVisible(12, 9)).toBe(12)
    expect(largeurVisible(1.5, 9)).toBe(9 * FACTEUR_LARGEUR_MIN)
    // À 0,5 px par mètre, un wagon de 3 m ferait 1,5 px : il passe à la largeur minimale.
    const p = { ...plan(), echelle: { pixelsParMetre: 0.5 } }
    const { projet } = ajouterEngin(p, type('R39'), { genre: 'voie', voieId: 'voie-1', abscisse: 300 })
    const s = silhouetteEngin(projet, projet.engins[0])!
    expect(s.largeur).toBeCloseTo(9 * FACTEUR_LARGEUR_MIN)
    expect(s.longueur).toBeCloseTo(19.9 * 0.5)
  })
})

describe('rame', () => {
  const compo = () => vehiculesDeGroupes([groupeDe(type('BB 61000')), groupeDe(type('R39'), 10)])

  it('compose « BB 61000 + 10 × R39 » : 11 véhicules, 213,5 m', () => {
    const v = compo()
    expect(v).toHaveLength(11)
    expect(longueurRame(v)).toBeCloseTo(213.5, 9)
    expect(texteComposition(v)).toBe('BB 61000 + 10 × R39')
    const { projet } = ajouterRame(plan(), v, 'voie-1', 600)
    expect(etiquetteRame(projet.rames[0])).toBe('Rame 1 — 213,5 m')
  })

  it('pose les véhicules bout à bout, chacun à sa propre abscisse, tête côté gauche', () => {
    const { projet } = ajouterRame(plan(), compo(), 'voie-1', 500)
    const rame = projet.rames[0]
    // Voie tracée de gauche à droite : la tête va vers les abscisses décroissantes.
    expect(rame.sens).toBe(-1)
    expect(coteTete(projet, rame)).toBe('Nord')
    const abscisses = abscissesVehicules(rame, 4)
    const total = 213.5 * 4
    expect(abscisses[0]).toBeCloseTo(500 - total / 2 + (14.5 * 4) / 2)
    expect(abscisses[1] - abscisses[0]).toBeCloseTo(((14.5 + 19.9) / 2) * 4)
    for (let i = 2; i < abscisses.length; i++) expect(abscisses[i] - abscisses[i - 1]).toBeCloseTo(19.9 * 4)
    const s = silhouetteRame(projet, rame)!
    expect(s.longueur).toBeCloseTo(213.5)
    expect(s.depassement).toBe(0)
    // Les caisses se touchent : fin de l'une = début de la suivante.
    expect(s.vehicules[0].centre.x + s.vehicules[0].longueur / 2).toBeCloseTo(s.vehicules[1].centre.x - s.vehicules[1].longueur / 2)
    expect(s.vehicules.map((v) => Math.round(v.longueur * 100) / 400)).toEqual([14.5, ...Array(10).fill(19.9)])
  })

  it('inverser le sens garde la place de la rame et passe la tête à l’autre bout', () => {
    const { projet, id } = ajouterRame(plan(), compo(), 'voie-1', 500)
    const inverse = inverserRame(projet, id)
    const avant = silhouetteRame(projet, projet.rames[0])!
    const apres = silhouetteRame(inverse, inverse.rames[0])!
    // La voie commence en x = 100 : tête à gauche en x = 202, à droite en x = 998.
    expect(avant.vehicules[0].centre.x).toBeCloseTo(100 + 500 - 213.5 * 2 + 14.5 * 2)
    expect(apres.vehicules[0].centre.x).toBeCloseTo(100 + 500 + 213.5 * 2 - 14.5 * 2)
    expect(Math.min(...apres.vehicules.map((v) => v.coins[0].x))).toBeCloseTo(Math.min(...avant.vehicules.map((v) => v.coins[0].x)))
    expect(coteTete(inverse, inverse.rames[0])).toBe('Sud')
  })

  it('suit la courbe véhicule par véhicule', () => {
    // Loco et 5 R39 (114 m) au milieu d'une courbe de 157 m.
    const v = vehiculesDeGroupes([groupeDe(type('BB 61000')), groupeDe(type('R39'), 5)])
    const { projet } = ajouterRame(plan(), v, 'voie-2', 314)
    const s = silhouetteRame(projet, projet.rames[0])!
    expect(s.depassement).toBe(0)
    for (const v of s.vehicules) expect(distancePointPolyligne(v.centre, arc())).toBeLessThan(1e-6)
    // Courbe en ∩ : l'étiquette passe au-dessus, à l'extérieur ; sur une voie droite, dessous.
    expect(coteEtiquetteRame(s)).toBe('dessus')
    const droite = ajouterRame(plan(), v, 'voie-1', 500).projet
    expect(coteEtiquetteRame(silhouetteRame(droite, droite.rames[0])!)).toBe('dessous')
    const angles = s.vehicules.map((v) => v.angle)
    expect(new Set(angles.map((a) => Math.round(a))).size).toBe(6)
  })

  it('prévient quand la rame dépasse le bout de la voie, sans la tronquer', () => {
    const { projet } = ajouterRame(plan(), compo(), 'voie-1', 0)
    const s = silhouetteRame(projet, projet.rames[0])!
    expect(s.vehicules).toHaveLength(11)
    expect(s.depassement).toBeCloseTo(213.5 / 2)
    expect(s.vehicules[0].depassement).toBeGreaterThan(0)
    expect(s.vehicules[10].depassement).toBe(0)
    // Voie trop courte (250 m) pour 12 R39 et une loco (253,3 m).
    const longue = vehiculesDeGroupes([groupeDe(type('BB 61000')), groupeDe(type('R39'), 12)])
    const r = ajouterRame(plan(), longue, 'voie-1', 500)
    expect(longueurPolyligne(r.projet.voies[0].points) / 4).toBe(250)
    expect(silhouetteRame(r.projet, r.projet.rames[0])!.depassement).toBeCloseTo(3.3)
  })

  it('glisse d’un bloc le long de sa voie', () => {
    const { projet, id } = ajouterRame(plan(), compo(), 'voie-1', 500)
    const avant = abscissesVehicules(projet.rames[0], 4)
    const glisse = placerRame(projet, id, 600)
    for (const [i, s] of abscissesVehicules(glisse.rames[0], 4).entries()) expect(s - avant[i]).toBeCloseTo(100)
  })

  it('se recompose : ajout, retrait, ordre, nombre', () => {
    let g = [groupeDe(type('BB 61000'))]
    g = ajouterGroupe(g, groupeDe(type('R39'), 5))
    g = ajouterGroupe(g, groupeDe(type('R39'), 7))
    expect(g.map((x) => [x.type.modele, x.nombre])).toEqual([
      ['BB 61000', 1],
      ['R39', 12],
    ])
    g = changerNombre(g, 1, 10)
    g = ajouterGroupe(g, groupeDe(type('V211')))
    g = deplacerGroupe(g, 2, -1)
    expect(texteComposition(vehiculesDeGroupes(g))).toBe('BB 61000 + V211 + 10 × R39')
    expect(changerNombre(g, 0, 0)[0].nombre).toBe(1)
    g = retirerGroupe(g, 1)
    expect(groupesDeVehicules(vehiculesDeGroupes(g))).toEqual(g)
    const { projet, id } = ajouterRame(plan(), compo(), 'voie-1', 600)
    expect(composerRame(projet, id, vehiculesDeGroupes(g)).rames[0].vehicules).toHaveLength(11)
    expect(composerRame(projet, id, [])).toBe(projet)
  })
})

describe('numéro, couleur et libellé', () => {
  it('numéro et couleur par engin ; couleur de catégorie par défaut', () => {
    const { projet, id } = ajouterEngin(plan(), type('CAT 323'), { genre: 'voie', voieId: 'voie-1', abscisse: 300 })
    expect(projet.engins[0].couleur).toBe('#e8a33d')
    const p = modifierEngin(projet, id, { numero: '3', couleur: '#ff0000' })
    expect(p.engins[0]).toMatchObject({ numero: '3', couleur: '#ff0000' })
  })

  it('pastille au-dessus de l’engin, texte lisible sur sa couleur', () => {
    const s = { centre: { x: 100, y: 100 }, direction: { x: 1, y: 0 }, largeur: 12 }
    const p = positionPastille(s, 10)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeLessThan(100 - 6 - 10)
    expect(couleurTexteSur('#66ff99')).toBe('#1c2430')
    expect(couleurTexteSur('#1f3a5f')).toBe('#ffffff')
  })

  it('le modèle s’écrit dans le rectangle s’il tient, jamais à l’envers', () => {
    expect(tailleLibelle('R39', 79.6, 12)).toBeCloseTo(12 * 0.62)
    expect(tailleLibelle('Type 108-32 U', 20, 12)).toBeNull()
    expect(libelleARetourner(30)).toBe(false)
    expect(libelleARetourner(-29.999999999999996)).toBe(false)
    expect(libelleARetourner(200)).toBe(true)
    expect(libelleARetourner(-120)).toBe(true)
    expect(libelleARetourner(90)).toBe(false)
  })
})

describe('détection sous le pointeur', () => {
  it('trouve l’engin ou la rame cliqués, au-dessus de la voie', () => {
    let { projet } = ajouterEngin(plan(), type('R39'), { genre: 'voie', voieId: 'voie-1', abscisse: 100 })
    projet = ajouterRame(projet, vehiculesDeGroupes([groupeDe(type('BB 61000')), groupeDe(type('R39'), 3)]), 'voie-1', 700).projet
    expect(elementSousPointeur(projet, { x: 200, y: 203 }, 2)).toEqual({ genre: 'engin', id: 'engin-1' })
    expect(elementSousPointeur(projet, { x: 800, y: 198 }, 2)).toEqual({ genre: 'rame', id: 'rame-1' })
    expect(elementSousPointeur(projet, { x: 1050, y: 200 }, 2)).toEqual({ genre: 'voie', id: 'voie-1' })
    expect(enginSousPointeur(projet, { x: 200, y: 260 }, 2)).toBeNull()
    // Calque verrouillé : on ne choisit plus les engins.
    expect(elementSousPointeur(modifierCalque(projet, 'engins', { verrouille: true }), { x: 200, y: 203 }, 2)).toEqual({ genre: 'voie', id: 'voie-1' })
  })

  it('point dans un rectangle tourné', () => {
    const carre = [
      { x: 0, y: -10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: -10, y: 0 },
    ]
    expect(dansPolygone(carre, { x: 0, y: 0 })).toBe(true)
    expect(dansPolygone(carre, { x: 8, y: 8 })).toBe(false)
    expect(dansPolygone(carre, { x: 6, y: 6 }, 2)).toBe(true)
  })
})

describe('suppression en cascade et voies modifiées', () => {
  const avecEngins = () => {
    let { projet } = ajouterEngin(plan(), type('R39'), { genre: 'voie', voieId: 'voie-1', abscisse: 100 })
    projet = ajouterEngin(projet, type('CAT 323'), { genre: 'libre', x: 50, y: 50, angle: 0 }).projet
    projet = ajouterEngin(projet, type('BB 61000'), { genre: 'voie', voieId: 'voie-2', abscisse: 100 }).projet
    return ajouterRame(projet, vehiculesDeGroupes([groupeDe(type('R39'), 2)]), 'voie-1', 600).projet
  }

  it('supprimer une voie supprime les engins et les rames posés dessus, pas les autres', () => {
    const projet = avecEngins()
    expect(dependancesVoie(projet, 'voie-1')).toEqual({ zones: 0, appareils: 0, engins: 1, rames: 1 })
    const apres = supprimerVoie(projet, 'voie-1')
    expect(apres.engins.map((e) => e.type.modele)).toEqual(['CAT 323', 'BB 61000'])
    expect(apres.rames).toEqual([])
  })

  it('supprime un engin ou une rame seuls', () => {
    const projet = avecEngins()
    expect(supprimerElement(projet, { genre: 'engin', id: 'engin-2' }).engins).toHaveLength(2)
    expect(supprimerElement(projet, { genre: 'rame', id: 'rame-1' }).rames).toHaveLength(0)
  })

  it('une voie raccourcie ramène ses engins sur elle', () => {
    let projet = ajouterEngin(plan(), type('R39'), { genre: 'voie', voieId: 'voie-1', abscisse: 900 }).projet
    projet = ajouterRame(projet, vehiculesDeGroupes([groupeDe(type('R39'))]), 'voie-1', 950).projet
    const court = deplacerPoint(projet, 'voie-1', 1, { x: 600, y: 200 })
    expect(court.engins[0].position).toMatchObject({ abscisse: 500 })
    expect(court.rames[0].abscisse).toBe(500)
  })
})

describe('recalage de l’échelle', () => {
  it('les engins prennent leur nouvelle taille ; leurs longueurs en mètres ne changent pas', () => {
    let projet = ajouterEngin(plan(), type('R39'), { genre: 'voie', voieId: 'voie-1', abscisse: 500 }).projet
    projet = ajouterRame(projet, vehiculesDeGroupes([groupeDe(type('BB 61000')), groupeDe(type('R39'), 2)]), 'voie-1', 300).projet
    const recale = { ...projet, echelle: { pixelsParMetre: 2 } }
    expect(silhouetteEngin(projet, projet.engins[0])!.longueur).toBeCloseTo(79.6)
    expect(silhouetteEngin(recale, recale.engins[0])!.longueur).toBeCloseTo(39.8)
    expect(recale.engins).toBe(projet.engins)
    const rame = silhouetteRame(recale, recale.rames[0])!
    expect(rame.vehicules[0].centre.x + rame.vehicules[0].longueur / 2).toBeCloseTo(rame.vehicules[1].centre.x - rame.vehicules[1].longueur / 2)
    expect(rame.longueur).toBeCloseTo(54.3)
  })

  it('sans échelle, rien ne se dessine', () => {
    const { projet } = ajouterEngin(plan(), type('R39'), { genre: 'voie', voieId: 'voie-1', abscisse: 500 })
    expect(silhouetteEngin({ ...projet, echelle: null }, projet.engins[0])).toBeNull()
  })
})

describe('type du catalogue modifié', () => {
  it('les engins posés prennent les nouvelles dimensions ; une couleur choisie à la main est gardée', () => {
    const r39 = type('R39')
    let projet = ajouterEngin(plan(), r39, { genre: 'voie', voieId: 'voie-1', abscisse: 100 }).projet
    projet = ajouterEngin(projet, r39, { genre: 'voie', voieId: 'voie-1', abscisse: 300 }).projet
    projet = modifierEngin(projet, 'engin-2', { couleur: '#123456' })
    projet = ajouterRame(projet, vehiculesDeGroupes([groupeDe(r39, 2)]), 'voie-1', 700).projet
    const apres = appliquerType(projet, r39, { ...r39, longueur: 20.5, couleur: '#ffaa00' })
    expect(apres.engins.map((e) => [e.type.longueur, e.couleur])).toEqual([
      [20.5, '#ffaa00'],
      [20.5, '#123456'],
    ])
    expect(apres.rames[0].vehicules.every((v) => v.type.longueur === 20.5)).toBe(true)
    expect(appliquerType(projet, type('V211'), type('V211'))).toBe(projet)
  })
})
