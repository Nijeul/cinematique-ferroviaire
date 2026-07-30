import * as THREE from 'three'
import type { MailleRuban } from '../geometry/ruban.ts'
import type { Pose2D } from '../geometry/courbe.ts'

// Passerelle entre les maillages calculés dans geometry/ (sans Three) et les
// objets Three du rendu. Convention d'axes : le plan du site (x, y) devient
// (x, z) à l'écran, l'altitude devient y.

export function geometrieDepuisMaille(maille: MailleRuban): THREE.BufferGeometry {
  const geometrie = new THREE.BufferGeometry()
  geometrie.setAttribute('position', new THREE.BufferAttribute(maille.positions, 3))
  geometrie.setIndex(new THREE.BufferAttribute(maille.indices, 1))
  geometrie.computeVertexNormals()
  return geometrie
}

const matriceTravail = new THREE.Matrix4()
const positionTravail = new THREE.Vector3()
const rotationTravail = new THREE.Quaternion()
const echelleTravail = new THREE.Vector3(1, 1, 1)
const axeY = new THREE.Vector3(0, 1, 0)

// Écrit dans un InstancedMesh la matrice de l'instance i à partir d'une pose
// du plan du site.
export function poserInstance(
  mesh: THREE.InstancedMesh,
  indice: number,
  pose: Pose2D,
  altitude: number,
  angleSupplement = 0,
): void {
  positionTravail.set(pose.x, altitude, pose.y)
  rotationTravail.setFromAxisAngle(axeY, -pose.angle + angleSupplement)
  matriceTravail.compose(positionTravail, rotationTravail, echelleTravail)
  mesh.setMatrixAt(indice, matriceTravail)
}
