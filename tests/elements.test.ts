import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { dependancesVoie, deplacerPoint, modifierCalque, supprimerPoint, supprimerVoie } from '../src/plan/edition.ts'
import {
  ajouterAppareil,
  ajouterCadre,
  ajouterCommunication,
  ajouterTexte,
  ajouterZone,
  deplacerBoutAppareil,
  deplacerBoutZone,
  glisserAppareil,
  glisserCadre,
  glisserTexte,
  glisserZone,
  inverserAppareil,
  jumeau,
  modifierTexte,
  normaliserRectangle,
  redimensionnerCadre,
  supprimerElement,
} from '../src/plan/elements.ts'
import { lireProjet } from '../src/plan/lecture.ts'
import { serialiserProjet, TAILLE_TEXTE_MAX, type Projet } from '../src/plan/projet.ts'

const exemple = (): Projet => {
  const lu = lireProjet(readFileSync(new URL('../fixtures/projet-exemple.json', import.meta.url), 'utf-8'))
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.projet
}

// Un projet modifié doit toujours pouvoir être enregistré puis rouvert.
const resteLisible = (projet: Projet) => {
  const relu = lireProjet(serialiserProjet(projet))
  expect(relu.ok ? [] : relu.erreurs).toEqual([])
}

describe('zones', () => {
  it('crée une zone entre deux abscisses, dans l’ordre, avec nom et couleur par défaut', () => {
    const { projet, id } = ajouterZone(exemple(), 'voie-2', 300, 120)
    const zone = projet.zones.find((z) => z.id === id)!
    expect(zone).toMatchObject({ id: 'zone-5', nom: 'Zone 5', voieId: 'voie-2', debut: 120, fin: 300, couleur: '#33506b' })
    resteLisible(projet)
  })

  it('ramène les bouts sur la voie', () => {
    const { projet, id } = ajouterZone(exemple(), 'voie-2', -50, 5000)
    expect(projet.zones.find((z) => z.id === id)).toMatchObject({ debut: 0, fin: 1260 })
  })

  it('réaffiche le calque des zones s’il était masqué', () => {
    const cache = modifierCalque(exemple(), 'zones', { visible: false })
    expect(ajouterZone(cache, 'voie-2', 10, 50).projet.calques.zones.visible).toBe(true)
  })

  it('déplace un bout le long de la voie ; les bouts échangent leur rôle s’ils se croisent', () => {
    const projet = deplacerBoutZone(exemple(), 'zone-1', 'fin', 300)
    expect(projet.zones[0]).toMatchObject({ debut: 240, fin: 300 })
    const croise = deplacerBoutZone(exemple(), 'zone-1', 'fin', 100)
    expect(croise.zones[0]).toMatchObject({ debut: 100, fin: 240 })
  })

  it('glisse d’un bloc sans changer de longueur ni sortir de la voie', () => {
    expect(glisserZone(exemple(), 'zone-1', 50).zones[0]).toMatchObject({ debut: 290, fin: 440 })
    expect(glisserZone(exemple(), 'zone-1', -1000).zones[0]).toMatchObject({ debut: 0, fin: 150 })
    expect(glisserZone(exemple(), 'zone-1', 5000).zones[0]).toMatchObject({ debut: 1110, fin: 1260 })
  })
})

describe('appareils (BS)', () => {
  it('crée un BS : pointe sur la voie directe, talon sur la déviée, nom suivant', () => {
    const { projet, id } = ajouterAppareil(exemple(), { voieId: 'voie-1', abscisse: 100 }, { voieId: 'voie-2', abscisse: 180 })
    const bs = projet.appareils.find((a) => a.id === id)!
    expect(bs).toMatchObject({
      nom: 'BS 3',
      pointe: { voieId: 'voie-1', abscisse: 100 },
      talon: { voieId: 'voie-2', abscisse: 180 },
      communication: null,
    })
    resteLisible(projet)
  })

  it('inverse le sens : la pointe passe à l’autre bout', () => {
    const projet = inverserAppareil(exemple(), 'bs-1')
    expect(projet.appareils[0]).toMatchObject({
      pointe: { voieId: 'voie-3', abscisse: 590 },
      talon: { voieId: 'voie-2', abscisse: 520 },
    })
    expect(inverserAppareil(projet, 'bs-1').appareils[0]).toEqual(exemple().appareils[0])
  })

  it('n’inverse pas un BS de communication (ses pointes sont déjà aux deux bouts)', () => {
    const projet = exemple()
    expect(inverserAppareil(projet, 'bs-2').appareils).toEqual(projet.appareils)
  })

  it('déplace la pointe le long de sa voie', () => {
    const projet = deplacerBoutAppareil(exemple(), 'bs-1', 'pointe', 700)
    expect(projet.appareils[0].pointe).toEqual({ voieId: 'voie-2', abscisse: 700 })
  })

  it('glisse d’un bloc : chaque bout reste sur sa voie', () => {
    const projet = glisserAppareil(exemple(), 'bs-1', { x: 40, y: 25 })
    expect(projet.appareils[0].pointe).toEqual({ voieId: 'voie-2', abscisse: 560 })
    expect(projet.appareils[0].talon).toEqual({ voieId: 'voie-3', abscisse: 630 })
  })
})

describe('communications', () => {
  it('crée deux BS liés, talon contre talon, nommés « BS na » et « BS nb »', () => {
    const { projet, ids } = ajouterCommunication(exemple(), { voieId: 'voie-2', abscisse: 200 }, { voieId: 'voie-3', abscisse: 260 })
    const [a, b] = ids.map((id) => projet.appareils.find((x) => x.id === id)!)
    expect([a.nom, b.nom]).toEqual(['BS 3a', 'BS 3b'])
    expect(a.communication).toBe('com-2')
    expect(b.communication).toBe('com-2')
    expect(a.pointe).toEqual(b.talon)
    expect(a.talon).toEqual(b.pointe)
    expect(jumeau(projet, a)?.id).toBe(b.id)
    resteLisible(projet)
  })

  it('déplacer un bout d’un BS fait suivre son jumeau', () => {
    const projet = deplacerBoutAppareil(exemple(), 'bs-2', 'pointe', 650)
    const [a, b] = projet.appareils.slice(1)
    expect(a.pointe.abscisse).toBe(650)
    expect(b.talon.abscisse).toBe(650)
    resteLisible(projet)
  })

  it('supprimer un BS supprime toute la communication', () => {
    const projet = supprimerElement(exemple(), { genre: 'appareil', id: 'bs-3' })
    expect(projet.appareils.map((a) => a.id)).toEqual(['bs-1'])
  })
})

describe('suppression en cascade et voies modifiées', () => {
  it('supprimer une voie supprime ses zones et ses appareils, communication comprise', () => {
    const projet = exemple()
    expect(dependancesVoie(projet, 'voie-3')).toEqual({ zones: 2, appareils: 3 })
    const apres = supprimerVoie(projet, 'voie-3')
    expect(apres.zones.map((z) => z.id)).toEqual(['zone-3', 'zone-4'])
    expect(apres.appareils).toEqual([])
    resteLisible(apres)
  })

  it('une voie sans rien dessus part seule', () => {
    const projet = exemple()
    expect(dependancesVoie(projet, 'voie-1')).toEqual({ zones: 0, appareils: 0 })
    expect(supprimerVoie(projet, 'voie-1').zones).toEqual(projet.zones)
  })

  it('ce qui est posé suit la voie quand on déplace ses points', () => {
    // V1 descend de 40 : zones et bouts d'appareils gardent leur abscisse.
    let projet = deplacerPoint(exemple(), 'voie-3', 0, { x: 180, y: 500 })
    projet = deplacerPoint(projet, 'voie-3', 1, { x: 1440, y: 500 })
    expect(projet.zones[0]).toEqual(exemple().zones[0])
    expect(projet.appareils[0].talon).toEqual(exemple().appareils[0].talon)
  })

  it('une voie raccourcie ramène sur elle les zones et appareils qui dépassent', () => {
    const projet = deplacerPoint(exemple(), 'voie-3', 1, { x: 780, y: 460 })
    expect(projet.zones[1]).toMatchObject({ debut: 390, fin: 450 })
    expect(projet.appareils[0].talon.abscisse).toBe(590)
    expect(projet.appareils[1].pointe.abscisse).toBe(600)
    expect(projet.appareils[2].talon.abscisse).toBe(600)
    resteLisible(projet)
    const court = deplacerPoint(exemple(), 'voie-3', 1, { x: 400, y: 460 })
    expect(court.zones[0]).toMatchObject({ debut: 220, fin: 220 })
    resteLisible(court)
  })

  it('retirer le dernier point superflu d’une voie supprime aussi ce qui est dessus', () => {
    const { projet, voieSupprimee } = supprimerPoint(exemple(), 'voie-3', 0)
    expect(voieSupprimee).toBe(true)
    expect(projet.zones.some((z) => z.voieId === 'voie-3')).toBe(false)
  })
})

describe('cadres', () => {
  it('normalise un rectangle tracé dans n’importe quel sens', () => {
    const attendu = { x: 10, y: 20, largeur: 90, hauteur: 30 }
    expect(normaliserRectangle({ x: 10, y: 20 }, { x: 100, y: 50 })).toEqual(attendu)
    expect(normaliserRectangle({ x: 100, y: 50 }, { x: 10, y: 20 })).toEqual(attendu)
    expect(normaliserRectangle({ x: 100, y: 20 }, { x: 10, y: 50 })).toEqual(attendu)
    expect(normaliserRectangle({ x: 5, y: 5 }, { x: 5, y: 5 })).toMatchObject({ largeur: 1, hauteur: 1 })
  })

  it('crée un cadre en pointillés, rempli, nommé « Cadre n »', () => {
    const { projet, id } = ajouterCadre(exemple(), { x: 500, y: 300 }, { x: 400, y: 200 })
    expect(projet.cadres.find((c) => c.id === id)).toMatchObject({
      nom: 'Cadre 2',
      x: 400,
      y: 200,
      largeur: 100,
      hauteur: 100,
      pointille: true,
      rempli: true,
    })
  })

  it('redimensionne par un coin, le coin opposé reste en place', () => {
    // Coin bas droit (n°2) tiré ; le haut gauche (300, 610) ne bouge pas.
    const projet = redimensionnerCadre(exemple(), 'cadre-1', 2, { x: 700, y: 700 })
    expect(projet.cadres[0]).toMatchObject({ x: 300, y: 610, largeur: 400, hauteur: 90 })
    // Coin tiré au-delà du coin opposé : le cadre se retourne proprement.
    const retourne = redimensionnerCadre(exemple(), 'cadre-1', 2, { x: 200, y: 600 })
    expect(retourne.cadres[0]).toMatchObject({ x: 200, y: 600, largeur: 100, hauteur: 10 })
  })

  it('glisse d’un bloc', () => {
    expect(glisserCadre(exemple(), 'cadre-1', { x: -20, y: 5 }).cadres[0]).toMatchObject({ x: 280, y: 615, largeur: 360 })
  })
})

describe('textes', () => {
  it('crée un texte à la taille des noms de voie', () => {
    const { projet, id } = ajouterTexte(exemple(), { x: 50, y: 60 })
    expect(projet.textes.find((t) => t.id === id)).toMatchObject({ texte: 'Texte', x: 50, y: 60, taille: 16, gras: false })
  })

  it('modifie le texte, borne la taille, glisse', () => {
    let projet = modifierTexte(exemple(), 'texte-1', { texte: 'Base arrière', gras: true, taille: 9999 })
    expect(projet.textes[0]).toMatchObject({ texte: 'Base arrière', gras: true, taille: TAILLE_TEXTE_MAX })
    projet = glisserTexte(projet, 'texte-1', { x: 10, y: -10 })
    expect(projet.textes[0]).toMatchObject({ x: 1210, y: 770 })
  })

  it('se supprime', () => {
    expect(supprimerElement(exemple(), { genre: 'texte', id: 'texte-1' }).textes).toEqual([])
  })
})
