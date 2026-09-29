import type { Point, Voie } from './projet.ts'

// Géométrie du tracé : contrainte Maj, distances pour la sélection à la
// souris, position du nom de voie.

const RACINE_DEMI = Math.SQRT1_2

// Les huit directions permises avec Maj : horizontale, verticale et 45°.
// Valeurs exactes pour qu'une voie horizontale le soit au pixel près.
const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: RACINE_DEMI, y: RACINE_DEMI },
  { x: 0, y: 1 },
  { x: -RACINE_DEMI, y: RACINE_DEMI },
  { x: -1, y: 0 },
  { x: -RACINE_DEMI, y: -RACINE_DEMI },
  { x: 0, y: -1 },
  { x: RACINE_DEMI, y: -RACINE_DEMI },
]

// Ramène le point `vers` sur la direction permise la plus proche, vue depuis
// `depuis` (projection : la longueur suit la souris).
export function contraindre(depuis: Point, vers: Point): Point {
  const vx = vers.x - depuis.x
  const vy = vers.y - depuis.y
  if (vx === 0 && vy === 0) return { ...depuis }
  let meilleure = DIRECTIONS[0]
  let produitMax = -Infinity
  for (const d of DIRECTIONS) {
    const produit = vx * d.x + vy * d.y
    if (produit > produitMax) {
      produitMax = produit
      meilleure = d
    }
  }
  return { x: depuis.x + meilleure.x * produitMax, y: depuis.y + meilleure.y * produitMax }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function distancePointSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const longueur2 = abx * abx + aby * aby
  if (longueur2 === 0) return distance(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / longueur2))
  return distance(p, { x: a.x + t * abx, y: a.y + t * aby })
}

export function distancePointPolyligne(p: Point, points: Point[]): number {
  if (points.length === 0) return Infinity
  if (points.length === 1) return distance(p, points[0])
  let min = Infinity
  for (let i = 1; i < points.length; i++) {
    min = Math.min(min, distancePointSegment(p, points[i - 1], points[i]))
  }
  return min
}

// Voie sous le pointeur : la plus proche, si elle est à moins de la
// tolérance (en unités du plan) du bord de sa bande. À distance égale, la
// voie dessinée en dernier (au-dessus) l'emporte.
export function voieSousPointeur(voies: Voie[], p: Point, tolerance: number): string | null {
  let trouvee: string | null = null
  let meilleure = Infinity
  for (const voie of voies) {
    const d = distancePointPolyligne(p, voie.points) - voie.epaisseur / 2
    if (d <= tolerance && d <= meilleure) {
      meilleure = d
      trouvee = voie.id
    }
  }
  return trouvee
}

// Indice du point (poignée) le plus proche du pointeur, ou null.
export function pointSousPointeur(points: Point[], p: Point, tolerance: number): number | null {
  let trouve: number | null = null
  let meilleure = Infinity
  points.forEach((q, i) => {
    const d = distance(p, q)
    if (d <= tolerance && d < meilleure) {
      meilleure = d
      trouve = i
    }
  })
  return trouve
}

// Fin d'un tracé : retire les points doublés (le double-clic final pose deux
// fois le même point). Renvoie null s'il reste moins de deux points.
export function terminerTrace(points: Point[], tolerance: number): Point[] | null {
  const nets: Point[] = []
  for (const p of points) {
    if (nets.length === 0 || distance(nets[nets.length - 1], p) > tolerance) nets.push(p)
  }
  return nets.length >= 2 ? nets : null
}

// Taille du nom de voie, proportionnelle à l'épaisseur de la bande, dans les
// proportions de l'aperçu de l'étape 1 (nom de 15 px pour une bande de 8,5 px).
export function tailleNom(epaisseur: number): number {
  return Math.round(2 + epaisseur * 1.6)
}

// Position du nom : juste avant le premier point, dans le prolongement de la
// voie (à gauche d'une voie tracée vers la droite, comme sur l'aperçu).
export function positionNom(voie: Voie): { x: number; y: number; ancre: 'start' | 'middle' | 'end' } {
  const [a, b] = voie.points
  const taille = tailleNom(voie.epaisseur)
  const longueur = distance(a, b) || 1
  const ux = (b.x - a.x) / longueur
  const uy = (b.y - a.y) / longueur
  const ecart = taille * 0.6
  // Voie plutôt verticale : nom centré au-dessus ou au-dessous du départ.
  if (Math.abs(uy) > 0.8) {
    return uy > 0
      ? { x: a.x, y: a.y - ecart, ancre: 'middle' }
      : { x: a.x, y: a.y + ecart + taille * 0.75, ancre: 'middle' }
  }
  return {
    x: a.x - ux * ecart,
    y: a.y - uy * ecart + taille * 0.35,
    ancre: ux >= 0 ? 'end' : 'start',
  }
}
