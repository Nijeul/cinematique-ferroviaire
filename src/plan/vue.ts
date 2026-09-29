import type { Point } from './projet.ts'

// La vue : quelle partie du plan est à l'écran. Un point du plan p s'affiche
// en  écran = p × zoom + décalage.  Zoom à la molette centré sur le curseur,
// déplacement à la main, recadrage sur l'ensemble du plan.

export type Vue = { zoom: number; dx: number; dy: number }

export const ZOOM_MIN = 0.02
export const ZOOM_MAX = 40

export function versPlan(vue: Vue, ecran: Point): Point {
  return { x: (ecran.x - vue.dx) / vue.zoom, y: (ecran.y - vue.dy) / vue.zoom }
}

export function versEcran(vue: Vue, plan: Point): Point {
  return { x: plan.x * vue.zoom + vue.dx, y: plan.y * vue.zoom + vue.dy }
}

// Zoome d'un facteur en gardant immobile le point du plan sous le curseur.
export function zoomerAutour(vue: Vue, ecran: Point, facteur: number): Vue {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vue.zoom * facteur))
  const sousCurseur = versPlan(vue, ecran)
  return { zoom, dx: ecran.x - sousCurseur.x * zoom, dy: ecran.y - sousCurseur.y * zoom }
}

// Facteur de zoom pour un cran de molette (deltaY en pixels).
export function facteurMolette(deltaY: number): number {
  return Math.exp(-deltaY * 0.0015)
}

export function deplacer(vue: Vue, dxEcran: number, dyEcran: number): Vue {
  return { zoom: vue.zoom, dx: vue.dx + dxEcran, dy: vue.dy + dyEcran }
}

// Vue d'ensemble : tout le plan visible et centré, avec une marge à l'écran.
export function recadrer(
  plan: { largeur: number; hauteur: number },
  ecran: { largeur: number; hauteur: number },
  marge = 24,
): Vue {
  const largeurUtile = ecran.largeur - 2 * marge
  const hauteurUtile = ecran.hauteur - 2 * marge
  if (largeurUtile <= 0 || hauteurUtile <= 0) return { zoom: 1, dx: 0, dy: 0 }
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(largeurUtile / plan.largeur, hauteurUtile / plan.hauteur)))
  return {
    zoom,
    dx: (ecran.largeur - plan.largeur * zoom) / 2,
    dy: (ecran.hauteur - plan.hauteur * zoom) / 2,
  }
}
