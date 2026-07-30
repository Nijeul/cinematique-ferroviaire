import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Voie } from '../domain/projet.ts'
import { courbeDeVoie } from '../geometry/referencement.ts'
import { posesRegulieres, rubanRectangulaire } from '../geometry/ruban.ts'
import { ALTITUDES, COTES } from './cotes.ts'
import {
  COULEUR_MARQUE_COUPE,
  COULEURS_BALLAST,
  COULEURS_RAILS,
  COULEURS_SOUS_COUCHE,
  COULEURS_TRAVERSES,
} from './couleurs.ts'
import { geometrieDepuisMaille, poserInstance } from './maillage.ts'

// Briques de rendu d'un tronçon de voie [s0, s1] pour chaque couche, selon la
// valeur d'état. Le tableau de SPEC.md §4 est le cahier des charges.

// Bruit déterministe : pas de Math.random, le rendu d'un instant t doit être
// identique d'une image à l'autre (export vidéo).
const bruit = (graine: number): number => {
  const x = Math.sin(graine * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function BallastTroncon({ voie, s0, s1, valeur }: { voie: Voie; s0: number; s1: number; valeur: string }) {
  const rendu = COULEURS_BALLAST[valeur]
  const geometrie = useMemo(() => {
    if (!rendu) return null
    return geometrieDepuisMaille(
      rubanRectangulaire(courbeDeVoie(voie), s0, s1, {
        largeur: COTES.ballast.largeur,
        base: ALTITUDES.ballastBase,
        hauteur: rendu.hauteur,
      }),
    )
  }, [voie, s0, s1, rendu])
  if (!rendu || !geometrie) return null
  return (
    <mesh geometry={geometrie}>
      <meshLambertMaterial color={rendu.couleur} />
    </mesh>
  )
}

export function SousCoucheTroncon({ voie, s0, s1, valeur }: { voie: Voie; s0: number; s1: number; valeur: string }) {
  const rendu = COULEURS_SOUS_COUCHE[valeur]
  const geometrie = useMemo(() => {
    if (!rendu) return null
    return geometrieDepuisMaille(
      rubanRectangulaire(courbeDeVoie(voie), s0, s1, {
        largeur: COTES.ballast.largeur - 0.4,
        base: ALTITUDES.ballastBase,
        hauteur: rendu.hauteur,
      }),
    )
  }, [voie, s0, s1, rendu])
  if (!rendu || !geometrie) return null
  return (
    <mesh geometry={geometrie}>
      <meshLambertMaterial color={rendu.couleur} />
    </mesh>
  )
}

export function PlateformeTroncon({ voie, s0, s1, couleur }: { voie: Voie; s0: number; s1: number; couleur: string }) {
  const geometrie = useMemo(
    () =>
      geometrieDepuisMaille(
        rubanRectangulaire(courbeDeVoie(voie), s0, s1, {
          largeur: COTES.ballast.largeur + 1,
          base: -0.12,
          hauteur: 0.08,
        }),
      ),
    [voie, s0, s1],
  )
  return (
    <mesh geometry={geometrie}>
      <meshLambertMaterial color={couleur} />
    </mesh>
  )
}

export function TraversesTroncon({ voie, s0, s1, valeur }: { voie: Voie; s0: number; s1: number; valeur: string }) {
  const couleur = COULEURS_TRAVERSES[valeur]

  const poses = useMemo(() => {
    if (!couleur) return []
    const courbe = courbeDeVoie(voie)
    if (valeur === 'deposees') {
      // Traverses désordonnées à côté de la voie, en alternance de part et d'autre.
      return posesRegulieres(courbe, s0, s1, 0.9).map((pose, i) => ({
        ...pose,
        x: pose.x + Math.cos(pose.angle + Math.PI / 2) * (i % 2 === 0 ? 3.4 : -3.4),
        y: pose.y + Math.sin(pose.angle + Math.PI / 2) * (i % 2 === 0 ? 3.4 : -3.4),
        angle: pose.angle + (bruit(i + s0) - 0.5) * 0.9,
      }))
    }
    if (valeur === 'neuves_reparties') {
      // Espacées, pas encore alignées.
      return posesRegulieres(courbe, s0, s1, 1.2).map((pose, i) => ({
        ...pose,
        angle: pose.angle + (bruit(i * 3 + s1) - 0.5) * 0.3,
      }))
    }
    return posesRegulieres(courbe, s0, s1, COTES.traverse.pas)
  }, [voie, s0, s1, valeur, couleur])

  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const altitude =
      valeur === 'deposees' ? COTES.traverse.hauteur / 2 : ALTITUDES.traverseBase + COTES.traverse.hauteur / 2
    poses.forEach((pose, i) => poserInstance(mesh, i, pose, altitude))
    mesh.instanceMatrix.needsUpdate = true
  }, [poses, valeur])

  if (!couleur || poses.length === 0) return null
  return (
    <instancedMesh
      key={`${valeur}-${poses.length}`}
      ref={ref}
      args={[undefined, undefined, poses.length]}
      frustumCulled={false}
    >
      <boxGeometry
        args={[COTES.traverse.largeurAssise, COTES.traverse.hauteur, COTES.traverse.longueur]}
      />
      <meshLambertMaterial color={couleur} />
    </instancedMesh>
  )
}

function MarquesDeCoupe({ voie, s0, s1 }: { voie: Voie; s0: number; s1: number }) {
  const poses = useMemo(() => posesRegulieres(courbeDeVoie(voie), s0, s1, 18), [voie, s0, s1])
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    poses.forEach((pose, i) =>
      poserInstance(mesh, i, pose, ALTITUDES.railBase + COTES.rail.hauteur),
    )
    mesh.instanceMatrix.needsUpdate = true
  }, [poses])
  if (poses.length === 0) return null
  return (
    <instancedMesh key={poses.length} ref={ref} args={[undefined, undefined, poses.length]} frustumCulled={false}>
      <boxGeometry args={[0.35, 0.1, 2.1]} />
      <meshLambertMaterial color={COULEUR_MARQUE_COUPE} />
    </instancedMesh>
  )
}

export function RailsTroncon({ voie, s0, s1, valeur }: { voie: Voie; s0: number; s1: number; valeur: string }) {
  const couleur = COULEURS_RAILS[valeur]
  // Rails déposés en extrémité : les profils sont posés en bordure de zone.
  const enBordure = valeur === 'deposes_en_extremite'

  const geometries = useMemo(() => {
    if (!couleur) return []
    const courbe = courbeDeVoie(voie)
    const offsets = enBordure
      ? [COTES.ballast.largeur / 2 + 1.2, COTES.ballast.largeur / 2 + 1.6]
      : [COTES.rail.demiEcartement, -COTES.rail.demiEcartement]
    const base = enBordure ? 0 : ALTITUDES.railBase
    return offsets.map((offset) =>
      geometrieDepuisMaille(
        rubanRectangulaire(courbe, s0, s1, {
          largeur: COTES.rail.largeur,
          base,
          hauteur: COTES.rail.hauteur,
          offset,
        }),
      ),
    )
  }, [voie, s0, s1, couleur, enBordure])

  if (!couleur) return null
  return (
    <>
      {geometries.map((geometrie, i) => (
        <mesh key={i} geometry={geometrie}>
          <meshLambertMaterial color={couleur} />
        </mesh>
      ))}
      {valeur === 'tronconnes' && <MarquesDeCoupe voie={voie} s0={s0} s1={s1} />}
    </>
  )
}

// Tronçon complet dans un état donné (utilisé pour la voie courante hors
// zones, et pour chaque segment d'état à l'intérieur des zones).
export function TronconVoie({
  voie,
  s0,
  s1,
  rails,
  traverses,
  ballast,
  sousCouche,
  plateforme,
}: {
  voie: Voie
  s0: number
  s1: number
  rails: string
  traverses: string
  ballast: string
  sousCouche: string
  plateforme: string
}) {
  if (s1 - s0 < 0.05) return null
  return (
    <>
      {plateforme !== 'existante' && (
        <PlateformeTroncon voie={voie} s0={s0} s1={s1} couleur={plateforme === 'decaissee' ? '#6e5b45' : '#7a684f'} />
      )}
      <SousCoucheTroncon voie={voie} s0={s0} s1={s1} valeur={sousCouche} />
      <BallastTroncon voie={voie} s0={s0} s1={s1} valeur={ballast} />
      <TraversesTroncon voie={voie} s0={s0} s1={s1} valeur={traverses} />
      <RailsTroncon voie={voie} s0={s0} s1={s1} valeur={rails} />
    </>
  )
}
