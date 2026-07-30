import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'

// Scène vide du lot 0 : un sol, une grille, des contrôles de caméra.
// Le cadrage par défaut est une vue inclinée du dessus, comme les synoptiques.
export function Scene() {
  return (
    <Canvas camera={{ position: [60, 80, 120], fov: 40, near: 0.5, far: 4000 }}>
      <color attach="background" args={['#dfe7ee']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[100, 200, 100]} intensity={1.2} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshLambertMaterial color="#b8bfa8" />
      </mesh>

      <Grid
        args={[2000, 2000]}
        cellSize={10}
        cellColor="#9aa18f"
        sectionSize={100}
        sectionColor="#6f7663"
        fadeDistance={800}
        followCamera={false}
      />

      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  )
}
