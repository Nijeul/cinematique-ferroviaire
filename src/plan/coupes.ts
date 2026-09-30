import { largeurBandeZone } from './dessin.ts'
import { formaterNombre, metresVersPlan, type Resultat } from './echelle.ts'
import { debutEstAGauche } from './etatsZones.ts'
import type { Echelle, Point, Voie, Zone } from './projet.ts'
import type { Synoptique } from './synoptique.ts'
import { pointAAbscisse } from './trace.ts'

// Les coupes de tronçonnage d'une zone, dans une image : des traits en travers
// de la voie tous les N mètres (panneaux de 6 m par défaut), calculés avec
// l'échelle du synoptique, depuis le bout gauche de la zone (côté Paris, Nord
// par défaut). Les deux bouts de la zone sont aussi des coupes. Chaque image
// a les siennes ; « Nouvelle image » les recopie.

// Par identifiant de zone : l'écart entre deux coupes, en mètres.
export type Coupes = Record<string, number>

export const PAS_COUPES_PAR_DEFAUT = 6
export const PAS_COUPES_MIN = 0.5
export const PAS_COUPES_MAX = 100
// Au-delà, les traits se toucheraient : on n'en dessine pas plus.
const COUPES_MAX = 400

export function erreurPasCoupes(pas: number): string | null {
  return Number.isFinite(pas) && pas >= PAS_COUPES_MIN && pas <= PAS_COUPES_MAX
    ? null
    : `L'écart entre deux coupes est un nombre de mètres de ${formaterNombre(PAS_COUPES_MIN)} à ${PAS_COUPES_MAX}.`
}

// Affiche (pas en mètres) ou retire (null) les coupes d'une zone de l'image.
export function reglerCoupes(s: Synoptique, index: number, zoneId: string, pas: number | null): Resultat<Synoptique> {
  const image = s.images[index]
  if (!image || !image.contenu.zones.some((z) => z.id === zoneId)) return { ok: true, valeur: s }
  if (pas !== null) {
    const erreur = erreurPasCoupes(pas)
    if (erreur) return { ok: false, erreur }
  }
  if ((image.contenu.coupes[zoneId] ?? null) === pas) return { ok: true, valeur: s }
  const coupes = { ...image.contenu.coupes }
  if (pas === null) delete coupes[zoneId]
  else coupes[zoneId] = pas
  return { ok: true, valeur: { ...s, images: s.images.map((im, i) => (i === index ? { ...im, contenu: { ...im.contenu, coupes } } : im)) } }
}

// Abscisses des coupes le long de la voie, du bout gauche de la zone vers le
// bout droit : les deux bouts, et un trait tous les `pas` mètres entre eux.
export function abscissesCoupes(voie: Pick<Voie, 'points'>, zone: Pick<Zone, 'debut' | 'fin'>, pas: number, echelle: Echelle): number[] {
  const longueur = zone.fin - zone.debut
  const ecart = metresVersPlan(echelle, pas)
  if (!(longueur > 0) || !(ecart > 0)) return []
  const depuisDebut = debutEstAGauche(voie, zone)
  const n = Math.min(COUPES_MAX, Math.floor(longueur / ecart + 1e-6))
  const interieures = Array.from({ length: n }, (_, k) => (k + 1) * ecart).filter((d) => d < longueur - 1e-6)
  const distances = [0, ...interieures, longueur]
  return distances.map((d) => (depuisDebut ? zone.debut + d : zone.fin - d))
}

// Les traits des coupes : en travers de la voie, un peu plus longs que la
// bande de la zone, pour se voir sur tous ses états.
export function traitsCoupes(voie: Pick<Voie, 'points' | 'epaisseur'>, zone: Pick<Zone, 'debut' | 'fin'>, pas: number, echelle: Echelle): [Point, Point][] {
  const demi = largeurBandeZone(voie) * 0.62
  return abscissesCoupes(voie, zone, pas, echelle).map((s) => {
    const { point, direction } = pointAAbscisse(voie.points, s)
    const n = { x: -direction.y, y: direction.x }
    return [
      { x: point.x + n.x * demi, y: point.y + n.y * demi },
      { x: point.x - n.x * demi, y: point.y - n.y * demi },
    ]
  })
}

export const epaisseurTraitCoupe = (voie: Pick<Voie, 'epaisseur'>): number => voie.epaisseur * 0.22

// « Coupes rail tous les 6 m »
export const texteCoupes = (pas: number): string => `Coupes rail tous les ${formaterNombre(pas)} m`

// Les écarts de coupes présents dans l'image (zones existantes), du plus petit au plus grand.
export function pasPresents(contenu: { zones: Zone[]; coupes: Coupes }): number[] {
  const ids = new Set(contenu.zones.map((z) => z.id))
  return [...new Set(Object.entries(contenu.coupes).filter(([id]) => ids.has(id)).map(([, pas]) => pas))].sort((a, b) => a - b)
}
