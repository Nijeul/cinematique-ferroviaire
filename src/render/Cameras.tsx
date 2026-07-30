import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import type { Vue } from '../domain/projet.ts'
import { etatAtMemoise } from '../state/etatAt.ts'
import { useApplication } from '../ui/store.ts'
import { positionMonde } from './positionMonde.ts'

// Caméras selon les vues du fichier .cinef. La vue « libre » garde les
// contrôles souris ; les autres reprennent les cadrages déclarés :
// - orthographique_inclinee : le cadrage des synoptiques, site entier ;
// - cadree : un secteur du site ;
// - suivi : caméra attachée à un engin, avec recul.

type Cadrage = { centre: [number, number]; etendue: number }

function VueOrthographique({ vue, cadrage }: { vue: Vue; cadrage: Cadrage }) {
  const angle = ((vue.angle ?? 35) * Math.PI) / 180
  const [cx, cy] = cadrage.centre
  const distance = cadrage.etendue * 1.2
  const demiLargeur = cadrage.etendue * 0.58
  const demiHauteur = demiLargeur * 0.56
  return (
    <OrthographicCamera
      makeDefault
      position={[cx, Math.sin(angle) * distance, cy + Math.cos(angle) * distance]}
      left={-demiLargeur}
      right={demiLargeur}
      top={demiHauteur}
      bottom={-demiHauteur}
      near={1}
      far={distance * 4}
      onUpdate={(camera) => camera.lookAt(cx, 0, cy)}
    />
  )
}

function VueCadree({ vue }: { vue: Vue }) {
  const [x0, y0, x1, y1] = vue.zone ?? [0, -30, 100, 30]
  const angle = ((vue.angle ?? 40) * Math.PI) / 180
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const distance = Math.max(x1 - x0, y1 - y0) * 0.9
  return (
    <PerspectiveCamera
      makeDefault
      fov={40}
      position={[cx, Math.sin(angle) * distance, cy + Math.cos(angle) * distance]}
      near={0.5}
      far={6000}
      onUpdate={(camera) => camera.lookAt(cx, 0, cy)}
    />
  )
}

function VueSuivi({ vue }: { vue: Vue }) {
  const referenceCamera = useRef<THREE.PerspectiveCamera>(null)
  const cible = useRef(new THREE.Vector3())

  useFrame(() => {
    const camera = referenceCamera.current
    const { projet, t } = useApplication.getState()
    if (!camera || !projet || !vue.ressource) return
    const etatRessource = etatAtMemoise(projet, t).ressources[vue.ressource]
    if (!etatRessource) return
    const monde = positionMonde(projet, etatRessource.position)
    const recul = vue.recul ?? 40
    cible.current.set(monde.x, 0, monde.y)
    camera.position.lerp(
      new THREE.Vector3(monde.x - recul * 0.55, recul * 0.75, monde.y + recul * 0.8),
      0.08,
    )
    camera.lookAt(cible.current)
  })

  return <PerspectiveCamera ref={referenceCamera} makeDefault fov={45} near={0.5} far={6000} />
}

export function Cameras({ cadrage }: { cadrage: Cadrage }) {
  const projet = useApplication((etat) => etat.projet)
  const vueActive = useApplication((etat) => etat.vueActive)
  const [cx, cy] = cadrage.centre

  const vue = projet?.vues.find((v) => v.id === vueActive)
  if (!projet || !vue || vueActive === 'libre') {
    return (
      <>
        <PerspectiveCamera
          makeDefault
          fov={40}
          position={[cx, cadrage.etendue * 0.55, cy + cadrage.etendue * 0.65]}
          near={0.5}
          far={6000}
        />
        <OrbitControls makeDefault target={[cx, 0, cy]} maxPolarAngle={Math.PI / 2 - 0.05} />
      </>
    )
  }
  if (vue.type === 'orthographique_inclinee') return <VueOrthographique vue={vue} cadrage={cadrage} />
  if (vue.type === 'cadree') return <VueCadree vue={vue} />
  return <VueSuivi vue={vue} />
}
