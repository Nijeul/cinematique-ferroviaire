import type { Point2 } from './courbe.ts'

// Lecture minimale d'un fichier DXF (l'export ouvert des DWG) : on extrait
// les polylignes, lignes et arcs de la section ENTITIES, regroupés par
// calque. Suffisant pour récupérer un tracé de voies sans redessiner.
// Volontairement sans dépendance : le format DXF texte est une simple
// suite de paires code / valeur.

export type CalquesDxf = Record<string, Point2[][]>

export type LectureDxf = {
  calques: CalquesDxf
  // Entités non comprises (splines, blocs…), pour prévenir l'utilisateur.
  entitesIgnorees: number
}

type Entite = { type: string; donnees: [number, string][] }

function decouperEntites(lignes: string[]): Entite[] {
  // Repère la section ENTITIES puis découpe en entités (chaque code 0).
  const entites: Entite[] = []
  let dansEntites = false
  let courante: Entite | null = null
  for (let i = 0; i + 1 < lignes.length; i += 2) {
    const code = Number(lignes[i])
    const valeur = lignes[i + 1]
    if (code === 0 && valeur === 'SECTION' && lignes[i + 3] === 'ENTITIES') {
      dansEntites = true
      i += 2
      continue
    }
    if (!dansEntites) continue
    if (code === 0 && valeur === 'ENDSEC') break
    if (code === 0) {
      courante = { type: valeur, donnees: [] }
      entites.push(courante)
    } else if (courante) {
      courante.donnees.push([code, valeur])
    }
  }
  return entites
}

const valeurDe = (entite: Entite, code: number): string | undefined =>
  entite.donnees.find(([c]) => c === code)?.[1]

const nombreDe = (entite: Entite, code: number): number | undefined => {
  const valeur = valeurDe(entite, code)
  return valeur === undefined ? undefined : Number(valeur)
}

function pointsDePolyligneLegere(entite: Entite): Point2[] {
  // LWPOLYLINE : les sommets sont des paires 10 (x) / 20 (y) successives.
  const points: Point2[] = []
  let x: number | null = null
  for (const [code, valeur] of entite.donnees) {
    if (code === 10) x = Number(valeur)
    else if (code === 20 && x !== null) {
      points.push([x, Number(valeur)])
      x = null
    }
  }
  return points
}

function pointsDArc(entite: Entite): Point2[] {
  const cx = nombreDe(entite, 10) ?? 0
  const cy = nombreDe(entite, 20) ?? 0
  const rayon = nombreDe(entite, 40) ?? 0
  const depart = ((nombreDe(entite, 50) ?? 0) * Math.PI) / 180
  let arrivee = ((nombreDe(entite, 51) ?? 360) * Math.PI) / 180
  if (arrivee <= depart) arrivee += Math.PI * 2
  const pas = Math.max(3, Math.ceil(((arrivee - depart) / Math.PI) * 18))
  const points: Point2[] = []
  for (let i = 0; i <= pas; i++) {
    const angle = depart + ((arrivee - depart) * i) / pas
    points.push([cx + Math.cos(angle) * rayon, cy + Math.sin(angle) * rayon])
  }
  return points
}

export function lirePolylignesDxf(texte: string): LectureDxf {
  const lignes = texte.split(/\r\n|\r|\n/).map((l) => l.trim())
  const entites = decouperEntites(lignes)
  const calques: CalquesDxf = {}
  let entitesIgnorees = 0

  const ajouter = (calque: string, points: Point2[]) => {
    if (points.length < 2) return
    ;(calques[calque] ??= []).push(points)
  }

  for (let i = 0; i < entites.length; i++) {
    const entite = entites[i]
    const calque = valeurDe(entite, 8) ?? '0'
    switch (entite.type) {
      case 'LWPOLYLINE':
        ajouter(calque, pointsDePolyligneLegere(entite))
        break
      case 'LINE': {
        const points: Point2[] = [
          [nombreDe(entite, 10) ?? 0, nombreDe(entite, 20) ?? 0],
          [nombreDe(entite, 11) ?? 0, nombreDe(entite, 21) ?? 0],
        ]
        ajouter(calque, points)
        break
      }
      case 'ARC':
        ajouter(calque, pointsDArc(entite))
        break
      case 'POLYLINE': {
        // Ancien format : suivi d'entités VERTEX jusqu'à SEQEND.
        const points: Point2[] = []
        while (i + 1 < entites.length && entites[i + 1].type === 'VERTEX') {
          i++
          points.push([nombreDe(entites[i], 10) ?? 0, nombreDe(entites[i], 20) ?? 0])
        }
        if (i + 1 < entites.length && entites[i + 1].type === 'SEQEND') i++
        ajouter(calque, points)
        break
      }
      case 'VERTEX':
      case 'SEQEND':
        break
      default:
        entitesIgnorees++
    }
  }
  return { calques, entitesIgnorees }
}

// Prépare des polylignes de voies : échelle (1 unité DXF = `echelle` mètres),
// recentrage optionnel sur l'origine du site, points quasi confondus fusionnés.
export function preparerVoiesDxf(
  polylignes: Point2[][],
  options: { echelle: number; recentrer: boolean },
): Point2[][] {
  const { echelle, recentrer } = options
  let xMin = Infinity
  let yMin = Infinity
  if (recentrer) {
    for (const polyligne of polylignes) {
      for (const [x, y] of polyligne) {
        xMin = Math.min(xMin, x)
        yMin = Math.min(yMin, y)
      }
    }
  } else {
    xMin = 0
    yMin = 0
  }
  return polylignes
    .map((polyligne) => {
      const points: Point2[] = []
      for (const [x, y] of polyligne) {
        const point: Point2 = [
          Math.round((x - xMin) * echelle * 100) / 100,
          Math.round((y - yMin) * echelle * 100) / 100,
        ]
        const dernier = points[points.length - 1]
        if (!dernier || Math.hypot(point[0] - dernier[0], point[1] - dernier[1]) > 0.05) {
          points.push(point)
        }
      }
      return points
    })
    .filter((points) => points.length >= 2)
}
