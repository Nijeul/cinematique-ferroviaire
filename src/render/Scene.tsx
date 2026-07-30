import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { useApplication } from '../ui/store.ts'
import { Engins } from './Engins.tsx'
import { Lieux } from './Lieux.tsx'
import { Voies } from './Voies.tsx'
import { Zones } from './Zones.tsx'

// Cadre la caméra sur l'emprise des voies du projet : vue inclinée du dessus,
// site entier, comme le cadrage des synoptiques.
function cadrageDuSite(polylignes: [number, number][][]) {
  let xMin = 0
  let xMax = 100
  let yMin = -20
  let yMax = 20
  for (const polyligne of polylignes) {
    for (const [x, y] of polyligne) {
      xMin = Math.min(xMin, x)
      xMax = Math.max(xMax, x)
      yMin = Math.min(yMin, y)
      yMax = Math.max(yMax, y)
    }
  }
  const centre: [number, number] = [(xMin + xMax) / 2, (yMin + yMax) / 2]
  const etendue = Math.max(xMax - xMin, 120)
  return { centre, etendue }
}

export function Scene() {
  const projet = useApplication((etat) => etat.projet)
  const cadrage = useMemo(
    () => cadrageDuSite(projet ? projet.site.voies.map((v) => v.polyligne) : []),
    [projet],
  )
  const [cx, cy] = cadrage.centre

  return (
    <Canvas
      camera={{
        position: [cx, cadrage.etendue * 0.55, cy + cadrage.etendue * 0.65],
        fov: 40,
        near: 0.5,
        far: 6000,
      }}
    >
      <color attach="background" args={['#dfe7ee']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[cx + 150, 300, cy + 100]} intensity={1.15} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.05, cy]}>
        <planeGeometry args={[4000, 4000]} />
        <meshLambertMaterial color="#b8bfa8" />
      </mesh>

      <Grid
        position={[cx, -0.02, cy]}
        args={[4000, 4000]}
        cellSize={10}
        cellColor="#9aa18f"
        sectionSize={100}
        sectionColor="#6f7663"
        fadeDistance={1600}
        followCamera={false}
      />

      <Lieux />
      <Voies />
      <Zones />
      <Engins />

      <OrbitControls
        makeDefault
        target={[cx, 0, cy]}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </Canvas>
  )
}
