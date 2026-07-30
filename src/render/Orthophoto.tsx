import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { cadreImage } from '../geometry/ancrage.ts'
import { useApplication } from '../ui/store.ts'

// Orthophoto posée au sol : l'image calée par ses deux points d'ancrage
// devient la texture d'un plan sous les voies.
export function Orthophoto() {
  const orthophoto = useApplication((etat) => etat.orthophoto)

  // TextureLoader.load renvoie la texture immédiatement et la remplit quand
  // l'image est décodée : pas d'état React nécessaire.
  const texture = useMemo(() => {
    if (!orthophoto) return null
    const chargee = new THREE.TextureLoader().load(orthophoto.image)
    chargee.colorSpace = THREE.SRGBColorSpace
    return chargee
  }, [orthophoto])

  useEffect(() => () => texture?.dispose(), [texture])

  const cadre = useMemo(() => {
    if (!orthophoto) return null
    try {
      return cadreImage(orthophoto.ancrages, orthophoto.largeurPx, orthophoto.hauteurPx)
    } catch {
      return null
    }
  }, [orthophoto])

  if (!cadre || !texture) return null
  return (
    <mesh
      position={[cadre.centre[0], 0.015, cadre.centre[1]]}
      rotation={[-Math.PI / 2, 0, -cadre.angle]}
    >
      <planeGeometry args={[cadre.largeur, cadre.hauteur]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
