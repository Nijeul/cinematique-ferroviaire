import { useMemo } from 'react'
import { Billboard, Text } from '@react-three/drei'
import type { Projet, Ressource } from '../domain/projet.ts'
import type { Pose2D } from '../geometry/courbe.ts'
import { pose as poseSurVoie } from '../geometry/referencement.ts'
import { etatAtMemoise } from '../state/etatAt.ts'
import type { EtatRessource } from '../state/etatScene.ts'
import { useApplication } from '../ui/store.ts'
import { positionMonde } from './positionMonde.ts'

// Engins en volumes simples et reconnaissables, avec pastille numérotée,
// comme sur les synoptiques. La position vient exclusivement de etatAt :
// un engin est là où une opération le met, jamais ailleurs.

function Pastille({ texte, hauteur, couleur }: { texte: string; hauteur: number; couleur: string }) {
  return (
    <Billboard position={[0, hauteur, 0]}>
      <mesh>
        <circleGeometry args={[1.6, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <circleGeometry args={[1.85, 24]} />
        <meshBasicMaterial color={couleur} />
      </mesh>
      <Text position={[0, 0, 0.02]} fontSize={1.9} color="#1c2430" anchorX="center" anchorY="middle">
        {texte}
      </Text>
    </Billboard>
  )
}

function PelleRR({ ressource, pose, mode }: { ressource: Ressource; pose: Pose2D; mode?: string }) {
  const couleur = `#${ressource.couleur ?? 'E8A33D'}`
  return (
    <group position={[pose.x, 0, pose.y]} rotation={[0, -pose.angle, 0]}>
      {/* châssis, cabine et flèche : silhouette de pelle rail-route */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[4.6, 1.2, 2.4]} />
        <meshLambertMaterial color={couleur} />
      </mesh>
      <mesh position={[-0.8, 2.25, 0]}>
        <boxGeometry args={[1.9, 1.1, 1.9]} />
        <meshLambertMaterial color={couleur} />
      </mesh>
      <mesh position={[1.9, 2.4, 0]} rotation={[0, 0, -0.7]}>
        <boxGeometry args={[3.4, 0.45, 0.45]} />
        <meshLambertMaterial color="#4d4d4d" />
      </mesh>
      {/* mode route : essieux clairs visibles */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[3.6, 0.7, mode === 'route' ? 2.6 : 1.6]} />
        <meshLambertMaterial color={mode === 'route' ? '#3a3a3a' : '#6d6d6d'} />
      </mesh>
      <Pastille texte={String(ressource.numero ?? '')} hauteur={5} couleur={couleur} />
    </group>
  )
}

function TrainTravaux({
  ressource,
  etat,
  projet,
}: {
  ressource: Ressource
  etat: EtatRessource
  projet: Projet
}) {
  const couleur = `#${ressource.couleur ?? '3E6FB0'}`
  const wagons = useMemo(() => {
    const position = etat.position
    if (position.type === 'voie') {
      const voie = projet.site.voies.find((v) => v.id === position.voie)
      if (!voie) return []
      const nombre = Math.min(Math.floor((ressource.longueur ?? 60) / 13), 14)
      const liste: Pose2D[] = []
      for (let i = 0; i < nombre; i++) {
        liste.push(poseSurVoie(voie, position.pk + i * 0.013))
      }
      return liste
    }
    // Hors voie (base arrière) : rame compacte symbolique.
    const centre = positionMonde(projet, position)
    return [0, 1, 2].map((i) => ({ x: centre.x + i * 13.5, y: centre.y, angle: 0 }))
  }, [etat.position, projet, ressource])

  if (wagons.length === 0) return null
  const tete = wagons[0]
  return (
    <group>
      {wagons.map((wagon, i) => (
        <mesh
          key={i}
          position={[wagon.x, 1.3, wagon.y]}
          rotation={[0, -wagon.angle, 0]}
        >
          <boxGeometry args={[12.4, i === 0 ? 2.6 : 1.8, 2.7]} />
          <meshLambertMaterial color={i === 0 ? '#39424d' : couleur} />
        </mesh>
      ))}
      <group position={[tete.x, 0, tete.y]}>
        <Pastille texte={ressource.nom.split('—')[0].trim()} hauteur={6.5} couleur={couleur} />
      </group>
    </group>
  )
}

function Portique({ ressource, pose }: { ressource: Ressource; pose: Pose2D }) {
  const couleur = `#${ressource.couleur ?? '7B4FA8'}`
  return (
    <group position={[pose.x, 0, pose.y]} rotation={[0, -pose.angle, 0]}>
      {[-4.5, 4.5].map((x) => (
        <group key={x}>
          <mesh position={[x, 2.2, -3]}>
            <boxGeometry args={[0.6, 4.4, 0.6]} />
            <meshLambertMaterial color={couleur} />
          </mesh>
          <mesh position={[x, 2.2, 3]}>
            <boxGeometry args={[0.6, 4.4, 0.6]} />
            <meshLambertMaterial color={couleur} />
          </mesh>
          <mesh position={[x, 4.4, 0]}>
            <boxGeometry args={[0.6, 0.5, 6.6]} />
            <meshLambertMaterial color={couleur} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 4.6, 0]}>
        <boxGeometry args={[9.6, 0.5, 0.8]} />
        <meshLambertMaterial color={couleur} />
      </mesh>
      <Pastille texte="PEM" hauteur={7} couleur={couleur} />
    </group>
  )
}

export function Engins() {
  const projet = useApplication((etat) => etat.projet)
  const t = useApplication((etat) => etat.t)
  if (!projet) return null
  const etatScene = etatAtMemoise(projet, t)

  // Répartit les engins stationnés dans un même lieu pour qu'ils ne se
  // superposent pas : rangée déterministe par ordre de déclaration.
  const rangs = new Map<string, number>()
  const decalageDe = (etat: EtatRessource): [number, number] => {
    if (etat.position.type !== 'lieu') return [0, 0]
    const rang = rangs.get(etat.position.lieu) ?? 0
    rangs.set(etat.position.lieu, rang + 1)
    return [(rang % 3) * 14 - 14, Math.floor(rang / 3) * 9 - 4]
  }

  return (
    <>
      {projet.ressources.map((ressource) => {
        const etat = etatScene.ressources[ressource.id]
        if (!etat) return null
        if (ressource.type === 'train_travaux') {
          return <TrainTravaux key={ressource.id} ressource={ressource} etat={etat} projet={projet} />
        }
        const pose = positionMonde(projet, etat.position, decalageDe(etat))
        if (ressource.type === 'portique') {
          return <Portique key={ressource.id} ressource={ressource} pose={pose} />
        }
        return (
          <PelleRR key={ressource.id} ressource={ressource} pose={pose} mode={etat.mode} />
        )
      })}
    </>
  )
}
