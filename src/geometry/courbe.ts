// Courbe de voie : une polyligne en mètres (système local du site), munie de
// son abscisse curviligne. Aucune dépendance à Three ni React.

export type Point2 = [number, number]

export type Pose2D = {
  x: number
  y: number
  // Cap de la voie en radians, dans le plan du sol (0 = +x).
  angle: number
}

export type Courbe = {
  points: Point2[]
  // Abscisse curviligne cumulée au droit de chaque point.
  abscisses: number[]
  longueur: number
}

export function creerCourbe(polyligne: Point2[]): Courbe {
  if (polyligne.length < 2) throw new Error('une courbe demande au moins deux points')
  const abscisses = [0]
  for (let i = 1; i < polyligne.length; i++) {
    const [x0, y0] = polyligne[i - 1]
    const [x1, y1] = polyligne[i]
    abscisses.push(abscisses[i - 1] + Math.hypot(x1 - x0, y1 - y0))
  }
  return { points: polyligne, abscisses, longueur: abscisses[abscisses.length - 1] }
}

// Projection d'un point du plan sur la courbe : abscisse du point le plus
// proche et distance à la voie. Sert à la saisie à la souris (cliquer une
// voie pour obtenir un PK).
export function projeterSurCourbe(courbe: Courbe, point: Point2): { s: number; distance: number } {
  let meilleur = { s: 0, distance: Number.POSITIVE_INFINITY }
  const [px, py] = point
  for (let i = 1; i < courbe.points.length; i++) {
    const [x0, y0] = courbe.points[i - 1]
    const [x1, y1] = courbe.points[i]
    const dx = x1 - x0
    const dy = y1 - y0
    const longueurCarree = dx * dx + dy * dy
    const fraction =
      longueurCarree === 0
        ? 0
        : Math.min(Math.max(((px - x0) * dx + (py - y0) * dy) / longueurCarree, 0), 1)
    const qx = x0 + dx * fraction
    const qy = y0 + dy * fraction
    const distance = Math.hypot(px - qx, py - qy)
    if (distance < meilleur.distance) {
      meilleur = { s: courbe.abscisses[i - 1] + Math.sqrt(longueurCarree) * fraction, distance }
    }
  }
  return meilleur
}

// Position et cap à l'abscisse s (m), décalée de `offset` (m) perpendiculairement
// à la voie, à gauche dans le sens des abscisses croissantes.
// s est borné à la courbe : pas d'extrapolation.
export function poseSurCourbe(courbe: Courbe, s: number, offset = 0): Pose2D {
  const sBorne = Math.min(Math.max(s, 0), courbe.longueur)
  let i = 1
  while (i < courbe.abscisses.length - 1 && courbe.abscisses[i] < sBorne) i++
  const [x0, y0] = courbe.points[i - 1]
  const [x1, y1] = courbe.points[i]
  const longueurSegment = courbe.abscisses[i] - courbe.abscisses[i - 1]
  const fraction = longueurSegment === 0 ? 0 : (sBorne - courbe.abscisses[i - 1]) / longueurSegment
  const dx = x1 - x0
  const dy = y1 - y0
  const norme = Math.hypot(dx, dy) || 1
  const nx = -dy / norme
  const ny = dx / norme
  return {
    x: x0 + dx * fraction + nx * offset,
    y: y0 + dy * fraction + ny * offset,
    angle: Math.atan2(dy, dx),
  }
}
