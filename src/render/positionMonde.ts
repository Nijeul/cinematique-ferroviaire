import type { Projet } from '../domain/projet.ts'
import type { Position } from '../state/etatScene.ts'
import type { Pose2D } from '../geometry/courbe.ts'
import { pose } from '../geometry/referencement.ts'

// Résolution d'une position du moteur — (voie, pk), lieu ou transit — en
// coordonnées du plan du site. C'est la seule passerelle : les objets
// ferroviaires ne stockent jamais de XYZ.

export function centreDeLieu(projet: Projet, lieuId: string): [number, number] {
  const lieu = projet.site.lieux.find((l) => l.id === lieuId)
  if (!lieu) return [0, 0]
  const n = lieu.contour.length
  const somme = lieu.contour.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0])
  return [somme[0] / n, somme[1] / n]
}

export function positionMonde(
  projet: Projet,
  position: Position,
  decalage: [number, number] = [0, 0],
): Pose2D {
  switch (position.type) {
    case 'voie': {
      const voie = projet.site.voies.find((v) => v.id === position.voie)
      if (!voie) return { x: 0, y: 0, angle: 0 }
      return pose(voie, position.pk, position.offset ?? 0)
    }
    case 'lieu': {
      const [x, y] = centreDeLieu(projet, position.lieu)
      return { x: x + decalage[0], y: y + decalage[1], angle: 0 }
    }
    case 'transit': {
      const de = positionMonde(projet, position.de, decalage)
      const vers = positionMonde(projet, position.vers, decalage)
      const x = de.x + (vers.x - de.x) * position.fraction
      const y = de.y + (vers.y - de.y) * position.fraction
      return { x, y, angle: Math.atan2(vers.y - de.y, vers.x - de.x) }
    }
  }
}
