import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Voie } from '../domain/projet.ts'
import { courbeDeVoie } from '../geometry/referencement.ts'
import { posesRegulieres, rubanRectangulaire } from '../geometry/ruban.ts'
import { useApplication } from '../ui/store.ts'
import { ALTITUDES, COTES } from './cotes.ts'
import { geometrieDepuisMaille, poserInstance } from './maillage.ts'

// Rendu d'une voie complète : ruban de ballast, traverses instanciées
// (obligatoire : plusieurs milliers d'instances sur un site réel), deux rails
// extrudés le long de la courbe. Lot 3 : aspect uniforme « voie en place » ;
// le rendu par état de zone arrive au lot 4.

const COULEURS = {
  ballast: '#8d8d89',
  traverse: '#7a6f5f',
  rail: '#5c6670',
}

function Ballast({ voie }: { voie: Voie }) {
  const geometrie = useMemo(() => {
    const courbe = courbeDeVoie(voie)
    return geometrieDepuisMaille(
      rubanRectangulaire(courbe, 0, courbe.longueur, {
        largeur: COTES.ballast.largeur,
        base: ALTITUDES.ballastBase,
        hauteur: COTES.ballast.hauteur,
      }),
    )
  }, [voie])
  return (
    <mesh geometry={geometrie}>
      <meshLambertMaterial color={COULEURS.ballast} />
    </mesh>
  )
}

function Rails({ voie }: { voie: Voie }) {
  const geometrie = useMemo(() => {
    const courbe = courbeDeVoie(voie)
    const gauche = rubanRectangulaire(courbe, 0, courbe.longueur, {
      largeur: COTES.rail.largeur,
      base: ALTITUDES.railBase,
      hauteur: COTES.rail.hauteur,
      offset: COTES.rail.demiEcartement,
    })
    const droite = rubanRectangulaire(courbe, 0, courbe.longueur, {
      largeur: COTES.rail.largeur,
      base: ALTITUDES.railBase,
      hauteur: COTES.rail.hauteur,
      offset: -COTES.rail.demiEcartement,
    })
    return [geometrieDepuisMaille(gauche), geometrieDepuisMaille(droite)]
  }, [voie])
  return (
    <>
      {geometrie.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshLambertMaterial color={COULEURS.rail} />
        </mesh>
      ))}
    </>
  )
}

function Traverses({ voie }: { voie: Voie }) {
  const poses = useMemo(() => {
    const courbe = courbeDeVoie(voie)
    return posesRegulieres(courbe, 0, courbe.longueur, COTES.traverse.pas)
  }, [voie])
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    poses.forEach((pose, i) =>
      poserInstance(mesh, i, pose, ALTITUDES.traverseBase + COTES.traverse.hauteur / 2),
    )
    mesh.instanceMatrix.needsUpdate = true
  }, [poses])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, poses.length]} frustumCulled={false}>
      <boxGeometry
        args={[COTES.traverse.largeurAssise, COTES.traverse.hauteur, COTES.traverse.longueur]}
      />
      <meshLambertMaterial color={COULEURS.traverse} />
    </instancedMesh>
  )
}

export function Voies() {
  const projet = useApplication((etat) => etat.projet)
  if (!projet) return null
  return (
    <>
      {projet.site.voies.map((voie) => (
        <group key={voie.id}>
          <Ballast voie={voie} />
          <Traverses voie={voie} />
          <Rails voie={voie} />
        </group>
      ))}
    </>
  )
}
