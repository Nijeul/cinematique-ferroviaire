import { boutsAppareil, largeurBandeZone, largeurTexteEstimee } from './dessin.ts'
import { coinsCadre, type Rectangle } from './elements.ts'
import { silhouetteEngin, silhouetteRame } from './engins.ts'
import { distance, distancePointPolyligne, distancePointSegment, voieSousPointeur } from './geometrie.ts'
import type { NomCalque, Point, Projet, Texte, Voie } from './projet.ts'
import { pointAAbscisse, projeterSurPolyligne, sousPolyligne } from './trace.ts'

// Ce qui est sous le pointeur : élément, poignée, voie où accrocher une zone
// ou un appareil. Tolérances en unités du plan (l'interface les convertit
// depuis des pixels d'écran).

export type Genre = 'cadre' | 'voie' | 'zone' | 'appareil' | 'engin' | 'rame' | 'texte'
export type Reference = { genre: Genre; id: string }

export const CALQUE_DU_GENRE: Record<Genre, NomCalque> = {
  cadre: 'cadres',
  voie: 'voies',
  zone: 'zones',
  appareil: 'appareils',
  engin: 'engins',
  rame: 'engins',
  texte: 'textes',
}

// Un élément se choisit sur le plan si son calque est visible et non verrouillé.
export const calqueActif = (projet: Projet, genre: Genre): boolean => {
  const calque = projet.calques[CALQUE_DU_GENRE[genre]]
  return calque.visible && !calque.verrouille
}

export function existe(projet: Projet, ref: Reference): boolean {
  const listes: Record<Genre, { id: string }[]> = {
    cadre: projet.cadres,
    voie: projet.voies,
    zone: projet.zones,
    appareil: projet.appareils,
    engin: projet.engins,
    rame: projet.rames,
    texte: projet.textes,
  }
  return listes[ref.genre].some((e) => e.id === ref.id)
}

// Boîte occupée par un texte (largeur estimée), ligne de base en t.y.
export function boiteTexte(t: Texte): Rectangle {
  return {
    x: t.x,
    y: t.y - t.taille * 0.8,
    largeur: largeurTexteEstimee(t.texte, t.taille, t.gras),
    hauteur: t.taille,
  }
}

const dansRectangle = (r: Rectangle, p: Point, marge: number): boolean =>
  p.x >= r.x - marge && p.x <= r.x + r.largeur + marge && p.y >= r.y - marge && p.y <= r.y + r.hauteur + marge

// Point dans un polygone (règle pair-impair), ou à moins de `marge` de son bord.
export function dansPolygone(polygone: Point[], p: Point, marge = 0): boolean {
  let dedans = false
  for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
    const a = polygone[i]
    const b = polygone[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dedans = !dedans
  }
  return dedans || (marge > 0 && distancePointPolyligne(p, [...polygone, polygone[0]]) <= marge)
}

// Engin ou rame sous le pointeur : le dernier posé (dessiné au-dessus) d'abord.
export function enginSousPointeur(projet: Projet, p: Point, tolerance: number): Reference | null {
  for (let i = projet.rames.length - 1; i >= 0; i--) {
    const s = silhouetteRame(projet, projet.rames[i])
    if (s?.vehicules.some((v) => dansPolygone(v.coins, p, tolerance))) return { genre: 'rame', id: projet.rames[i].id }
  }
  for (let i = projet.engins.length - 1; i >= 0; i--) {
    const s = silhouetteEngin(projet, projet.engins[i])
    if (s && dansPolygone(s.coins, p, tolerance)) return { genre: 'engin', id: projet.engins[i].id }
  }
  return null
}

// Élément sous le pointeur, en commençant par le calque du dessus : textes,
// engins et rames, appareils, zones, voies, cadres.
export function elementSousPointeur(projet: Projet, p: Point, tolerance: number): Reference | null {
  if (calqueActif(projet, 'texte')) {
    for (let i = projet.textes.length - 1; i >= 0; i--) {
      if (dansRectangle(boiteTexte(projet.textes[i]), p, tolerance)) return { genre: 'texte', id: projet.textes[i].id }
    }
  }

  if (calqueActif(projet, 'engin')) {
    const ref = enginSousPointeur(projet, p, tolerance)
    if (ref) return ref
  }

  if (calqueActif(projet, 'appareil')) {
    // Les deux BS d'une communication partagent le biais : on prend celui
    // dont la pointe est la plus proche du clic.
    let trouve: string | null = null
    let meilleur = { d: Infinity, pointe: Infinity }
    for (const appareil of projet.appareils) {
      const bouts = boutsAppareil(projet, appareil)
      if (!bouts) continue
      const d = distancePointSegment(p, bouts.pointe, bouts.talon) - bouts.epaisseur / 2
      const pointe = distance(p, bouts.pointe)
      if (d <= tolerance && (d < meilleur.d - 1e-9 || (Math.abs(d - meilleur.d) <= 1e-9 && pointe < meilleur.pointe))) {
        meilleur = { d, pointe }
        trouve = appareil.id
      }
    }
    if (trouve) return { genre: 'appareil', id: trouve }
  }

  if (calqueActif(projet, 'zone')) {
    let trouve: string | null = null
    let meilleur = Infinity
    for (const zone of projet.zones) {
      const voie = projet.voies.find((v) => v.id === zone.voieId)
      if (!voie) continue
      const d = distancePointPolyligne(p, sousPolyligne(voie.points, zone.debut, zone.fin)) - largeurBandeZone(voie) / 2
      if (d <= tolerance && d <= meilleur) {
        meilleur = d
        trouve = zone.id
      }
    }
    if (trouve) return { genre: 'zone', id: trouve }
  }

  if (calqueActif(projet, 'voie')) {
    const id = voieSousPointeur(projet.voies, p, tolerance)
    if (id) return { genre: 'voie', id }
  }

  if (calqueActif(projet, 'cadre')) {
    // Cadres imbriqués : le plus petit qui contient le clic.
    let trouve: string | null = null
    let aire = Infinity
    for (const cadre of projet.cadres) {
      if (dansRectangle(cadre, p, tolerance) && cadre.largeur * cadre.hauteur < aire) {
        aire = cadre.largeur * cadre.hauteur
        trouve = cadre.id
      }
    }
    if (trouve) return { genre: 'cadre', id: trouve }
  }
  return null
}

// Poignée : un point qu'on attrape pour modifier l'élément choisi.
// Clés : « point-2 » (voie), « debut » / « fin » (zone), « pointe » /
// « talon » (appareil), « coin-0 » à « coin-3 » (cadre), « rotation » (engin
// hors voie ; un engin sur voie ou une rame se glissent d'un bloc).
export type Poignee = { cle: string; point: Point }

export function poigneesDe(projet: Projet, ref: Reference): Poignee[] {
  switch (ref.genre) {
    case 'voie': {
      const voie = projet.voies.find((v) => v.id === ref.id)
      return voie?.points.map((point, i) => ({ cle: `point-${i}`, point })) ?? []
    }
    case 'zone': {
      const zone = projet.zones.find((z) => z.id === ref.id)
      const voie = zone && projet.voies.find((v) => v.id === zone.voieId)
      if (!zone || !voie) return []
      return [
        { cle: 'debut', point: pointAAbscisse(voie.points, zone.debut).point },
        { cle: 'fin', point: pointAAbscisse(voie.points, zone.fin).point },
      ]
    }
    case 'appareil': {
      const appareil = projet.appareils.find((a) => a.id === ref.id)
      const bouts = appareil && boutsAppareil(projet, appareil)
      if (!bouts) return []
      return [
        { cle: 'pointe', point: bouts.pointe },
        { cle: 'talon', point: bouts.talon },
      ]
    }
    case 'cadre': {
      const cadre = projet.cadres.find((c) => c.id === ref.id)
      return cadre ? coinsCadre(cadre).map((point, i) => ({ cle: `coin-${i}`, point })) : []
    }
    case 'engin': {
      const engin = projet.engins.find((e) => e.id === ref.id)
      const s = engin?.position.genre === 'libre' ? silhouetteEngin(projet, engin) : null
      if (!s) return []
      const ecart = s.longueur / 2 + s.largeur * 1.2
      return [{ cle: 'rotation', point: { x: s.centre.x + s.direction.x * ecart, y: s.centre.y + s.direction.y * ecart } }]
    }
    case 'rame':
    case 'texte':
      return []
  }
}

// Poignée la plus proche du pointeur, dans la tolérance.
export function poigneeSousPointeur(poignees: Poignee[], p: Point, tolerance: number): string | null {
  let trouvee: string | null = null
  let meilleure = Infinity
  for (const poignee of poignees) {
    const d = distance(p, poignee.point)
    if (d <= tolerance && d < meilleure) {
      meilleure = d
      trouvee = poignee.cle
    }
  }
  return trouvee
}

export type Accroche = { voieId: string; abscisse: number; point: Point }

// Voie la plus proche du pointeur (distance au bord de sa bande), pour y
// accrocher une zone ou un bout d'appareil ; `exclure` écarte une voie (le
// talon d'un BS doit être sur une autre voie que la pointe).
export function accrocherVoie(voies: Voie[], p: Point, tolerance: number, exclure?: string): Accroche | null {
  let trouvee: Accroche | null = null
  let meilleure = Infinity
  for (const voie of voies) {
    if (voie.id === exclure) continue
    const projection = projeterSurPolyligne(voie.points, p)
    const d = projection.distance - voie.epaisseur / 2
    if (d <= tolerance && d <= meilleure) {
      meilleure = d
      trouvee = { voieId: voie.id, abscisse: projection.abscisse, point: projection.point }
    }
  }
  return trouvee
}
