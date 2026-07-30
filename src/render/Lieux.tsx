import { useMemo } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import type { Lieu } from '../domain/projet.ts'
import { useApplication } from '../ui/store.ts'
import { centreDeLieu } from './positionMonde.ts'

// Lieux hors voie : surfaces plates teintées avec leur nom — base arrière,
// stockages, accès, ouvrages. Repères indispensables pour lire les flux.

const COULEURS_LIEU: Record<Lieu['type'], string> = {
  base_arriere: '#d8d2b8',
  stockage: '#c9d4c4',
  acces: '#d5cfc2',
  zone_speciale: '#ddcfcf',
  ouvrage: '#c3c8d2',
}

function LieuRendu({ lieu }: { lieu: Lieu }) {
  const projet = useApplication((etat) => etat.projet)
  const geometrie = useMemo(() => {
    const forme = new THREE.Shape(lieu.contour.map(([x, y]) => new THREE.Vector2(x, -y)))
    const geo = new THREE.ShapeGeometry(forme)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [lieu])

  if (!projet) return null
  const [cx, cy] = centreDeLieu(projet, lieu.id)
  return (
    <group>
      <mesh geometry={geometrie} position={[0, 0.01, 0]}>
        <meshLambertMaterial color={COULEURS_LIEU[lieu.type]} />
      </mesh>
      <Text
        position={[cx, 0.05, cy]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={2.2}
        color="#4a5040"
        anchorX="center"
        anchorY="middle"
      >
        {lieu.nom}
      </Text>
    </group>
  )
}

export function Lieux() {
  const projet = useApplication((etat) => etat.projet)
  if (!projet) return null
  return (
    <>
      {projet.site.lieux.map((lieu) => (
        <LieuRendu key={lieu.id} lieu={lieu} />
      ))}
    </>
  )
}
