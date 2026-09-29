import type { Point } from './projet.ts'

// Le long d'une voie : abscisse curviligne (distance parcourue depuis le
// premier point, en suivant le tracé), point et direction à une abscisse,
// projection d'un point du plan sur la voie, portion de voie entre deux
// abscisses et bande qui l'entoure (pour dessiner une zone, coudes compris).

const longueurSegment = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)

// Abscisse de chaque point du tracé : 0 pour le premier, la longueur totale
// pour le dernier.
export function abscissesDesPoints(points: Point[]): number[] {
  const cumuls = [0]
  for (let i = 1; i < points.length; i++) cumuls.push(cumuls[i - 1] + longueurSegment(points[i - 1], points[i]))
  return cumuls
}

export function longueurPolyligne(points: Point[]): number {
  const cumuls = abscissesDesPoints(points)
  return cumuls[cumuls.length - 1] ?? 0
}

export function bornerAbscisse(points: Point[], abscisse: number): number {
  if (!Number.isFinite(abscisse)) return 0
  return Math.min(longueurPolyligne(points), Math.max(0, abscisse))
}

export type PointOriente = { point: Point; direction: Point }

// Point à une abscisse donnée (ramenée sur la voie) et direction du tracé à
// cet endroit (vecteur unitaire, dans le sens de tracé de la voie). Sur un
// coude, c'est la direction du segment qui arrive au coude.
export function pointAAbscisse(points: Point[], abscisse: number): PointOriente {
  if (points.length === 0) return { point: { x: 0, y: 0 }, direction: { x: 1, y: 0 } }
  const cumuls = abscissesDesPoints(points)
  const s = bornerAbscisse(points, abscisse)
  let direction = { x: 1, y: 0 }
  for (let i = 1; i < points.length; i++) {
    const longueur = cumuls[i] - cumuls[i - 1]
    if (longueur === 0) continue
    const a = points[i - 1]
    const b = points[i]
    direction = { x: (b.x - a.x) / longueur, y: (b.y - a.y) / longueur }
    if (s <= cumuls[i]) {
      const t = (s - cumuls[i - 1]) / longueur
      return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, direction }
    }
  }
  return { point: { ...points[points.length - 1] }, direction }
}

export type Projection = { abscisse: number; distance: number; point: Point }

// Point de la voie le plus proche de `p` : son abscisse, sa distance à `p`.
export function projeterSurPolyligne(points: Point[], p: Point): Projection {
  if (points.length === 0) return { abscisse: 0, distance: Infinity, point: { ...p } }
  const cumuls = abscissesDesPoints(points)
  let meilleure: Projection = { abscisse: 0, distance: longueurSegment(p, points[0]), point: { ...points[0] } }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const longueur = cumuls[i] - cumuls[i - 1]
    if (longueur === 0) continue
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (longueur * longueur)))
    const pied = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    const d = longueurSegment(p, pied)
    if (d < meilleure.distance) meilleure = { abscisse: cumuls[i - 1] + t * longueur, distance: d, point: pied }
  }
  return meilleure
}

// Portion du tracé entre deux abscisses (dans n'importe quel ordre), coudes
// compris : le point de départ, les points intermédiaires, le point d'arrivée.
export function sousPolyligne(points: Point[], debut: number, fin: number): Point[] {
  if (points.length === 0) return []
  const a = bornerAbscisse(points, Math.min(debut, fin))
  const b = bornerAbscisse(points, Math.max(debut, fin))
  const cumuls = abscissesDesPoints(points)
  const resultat = [pointAAbscisse(points, a).point]
  if (b === a) return resultat
  for (let i = 0; i < points.length; i++) {
    if (cumuls[i] > a && cumuls[i] < b) resultat.push({ ...points[i] })
  }
  resultat.push(pointAAbscisse(points, b).point)
  return resultat
}

// Au-delà, un coude très aigu ferait une pointe démesurée : l'angle est
// alors écrêté (comme la limite d'onglet d'un trait SVG).
const LIMITE_ONGLET = 4

// Contour d'une bande de demi-largeur donnée autour d'un tracé : le bord d'un
// côté à l'aller, le bord de l'autre côté au retour. Les coudes sont en
// onglet, les bouts coupés droit. Polygone vide si le tracé n'a pas de
// longueur.
export function bandeAutour(points: Point[], demiLargeur: number): Point[] {
  const nets: Point[] = []
  for (const p of points) {
    const dernier = nets[nets.length - 1]
    if (!dernier || dernier.x !== p.x || dernier.y !== p.y) nets.push(p)
  }
  if (nets.length < 2) return []
  // Normale unitaire de chaque segment.
  const normales: Point[] = []
  for (let i = 1; i < nets.length; i++) {
    const l = longueurSegment(nets[i - 1], nets[i])
    normales.push({ x: -(nets[i].y - nets[i - 1].y) / l, y: (nets[i].x - nets[i - 1].x) / l })
  }
  const decalages = nets.map((_, i) => {
    const n1 = normales[Math.max(0, i - 1)]
    const n2 = normales[Math.min(normales.length - 1, i)]
    const somme = { x: n1.x + n2.x, y: n1.y + n2.y }
    const norme = Math.hypot(somme.x, somme.y)
    // Demi-tour complet : on garde la normale du segment d'arrivée.
    if (norme < 1e-9) return { x: n1.x * demiLargeur, y: n1.y * demiLargeur }
    const m = { x: somme.x / norme, y: somme.y / norme }
    const cosinus = m.x * n1.x + m.y * n1.y
    const longueur = Math.min(demiLargeur / cosinus, demiLargeur * LIMITE_ONGLET)
    return { x: m.x * longueur, y: m.y * longueur }
  })
  const unCote = nets.map((p, i) => ({ x: p.x + decalages[i].x, y: p.y + decalages[i].y }))
  const autreCote = nets.map((p, i) => ({ x: p.x - decalages[i].x, y: p.y - decalages[i].y })).reverse()
  return [...unCote, ...autreCote]
}
