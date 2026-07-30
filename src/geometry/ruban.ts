import { poseSurCourbe, type Courbe, type Pose2D } from './courbe.ts'

// Maillages calculés sans Three : le rendu ne fait que les envelopper dans un
// BufferGeometry. Convention : le plan du site (x, y) devient (x, z) à l'écran,
// l'altitude devient y.

export type MailleRuban = {
  positions: Float32Array
  indices: Uint32Array
}

export type OptionsRuban = {
  largeur: number
  // Altitude de la base et hauteur du ruban.
  base: number
  hauteur: number
  // Décalage latéral du centre du ruban par rapport à l'axe de la voie.
  offset?: number
  // Pas d'échantillonnage le long de la courbe, en mètres.
  pas?: number
}

// Ruban rectangulaire extrudé le long de la courbe entre les abscisses s0 et
// s1 : quatre faces longitudinales et deux bouchons.
export function rubanRectangulaire(
  courbe: Courbe,
  s0: number,
  s1: number,
  options: OptionsRuban,
): MailleRuban {
  const { largeur, base, hauteur, offset = 0, pas = 2 } = options
  const debut = Math.min(Math.max(s0, 0), courbe.longueur)
  const fin = Math.min(Math.max(s1, 0), courbe.longueur)
  const etendue = Math.max(fin - debut, 0.01)
  const nombrePas = Math.max(1, Math.ceil(etendue / pas))

  const positions: number[] = []
  const indices: number[] = []
  const demiLargeur = largeur / 2

  for (let i = 0; i <= nombrePas; i++) {
    const s = debut + (etendue * i) / nombrePas
    const gauche = poseSurCourbe(courbe, s, offset + demiLargeur)
    const droite = poseSurCourbe(courbe, s, offset - demiLargeur)
    // Quatre sommets par section : bas gauche, bas droite, haut droite, haut gauche.
    positions.push(gauche.x, base, gauche.y)
    positions.push(droite.x, base, droite.y)
    positions.push(droite.x, base + hauteur, droite.y)
    positions.push(gauche.x, base + hauteur, gauche.y)
  }

  for (let i = 0; i < nombrePas; i++) {
    const a = i * 4
    const b = (i + 1) * 4
    // dessus
    indices.push(a + 3, b + 3, b + 2, a + 3, b + 2, a + 2)
    // flancs
    indices.push(a, b, b + 3, a, b + 3, a + 3)
    indices.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1)
    // dessous
    indices.push(a, a + 1, b + 1, a, b + 1, b)
  }
  // bouchons
  const dernier = nombrePas * 4
  indices.push(0, 3, 2, 0, 2, 1)
  indices.push(dernier, dernier + 1, dernier + 2, dernier, dernier + 2, dernier + 3)

  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
}

// Poses régulières le long de la courbe (traverses, poteaux…), tous les `pas`
// mètres entre s0 et s1.
export function posesRegulieres(
  courbe: Courbe,
  s0: number,
  s1: number,
  pas: number,
  offset = 0,
): Pose2D[] {
  const debut = Math.min(Math.max(s0, 0), courbe.longueur)
  const fin = Math.min(Math.max(s1, 0), courbe.longueur)
  const poses: Pose2D[] = []
  for (let s = debut + pas / 2; s < fin; s += pas) {
    poses.push(poseSurCourbe(courbe, s, offset))
  }
  return poses
}
