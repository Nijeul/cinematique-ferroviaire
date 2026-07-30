import { useFrame } from '@react-three/fiber'
import { useApplication } from '../ui/store.ts'

// Fait avancer le temps pendant la lecture, au rythme choisi. Le temps du
// modèle reste en minutes depuis T0 ; ici on ne fait que le faire défiler.
export function Lecture() {
  const avancer = useApplication((etat) => etat.avancer)
  useFrame((_, delta) => avancer(Math.min(delta, 0.25)))
  return null
}
