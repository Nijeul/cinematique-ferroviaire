import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import type { Voie, Zone } from '../domain/projet.ts'
import { abscisseSurVoie, pose } from '../geometry/referencement.ts'
import { etatAtMemoise } from '../state/etatAt.ts'
import type { EtatZoneScene } from '../state/etatScene.ts'
import { segmentsDeCouche } from '../state/segments.ts'
import { useApplication } from '../ui/store.ts'
import { COTES } from './cotes.ts'
import { COULEURS_GEOMETRIE } from './couleurs.ts'
import {
  BallastTroncon,
  PlateformeTroncon,
  RailsTroncon,
  SousCoucheTroncon,
  TraversesTroncon,
} from './Troncons.tsx'

// Rendu des zones : chaque couche est découpée en segments d'état par
// segmentsDeCouche (fronts compris) et rendue par les briques de Troncons.
// Déplacer le curseur change l'aspect des zones — c'est le critère du lot.

export function Zones() {
  const projet = useApplication((etat) => etat.projet)
  const t = useApplication((etat) => etat.t)
  const etatScene = useMemo(() => (projet ? etatAtMemoise(projet, t) : null), [projet, t])
  if (!projet || !etatScene) return null
  const voies = new Map(projet.site.voies.map((v) => [v.id, v]))
  return (
    <>
      {projet.site.zones.map((zone) => {
        const voie = voies.get(zone.voie)
        const etatZone = etatScene.zones[zone.id]
        if (!voie || !etatZone) return null
        return <ZoneRendue key={zone.id} zone={zone} voie={voie} etatZone={etatZone} />
      })}
    </>
  )
}

function ZoneRendue({ zone, voie, etatZone }: { zone: Zone; voie: Voie; etatZone: EtatZoneScene }) {
  const s0 = abscisseSurVoie(voie, zone.pkDebut)
  const s1 = abscisseSurVoie(voie, zone.pkFin)
  const versAbscisse = (fraction: number) => s0 + fraction * (s1 - s0)

  return (
    <>
      {segmentsDeCouche(etatZone, 'plateforme').map(
        (segment) =>
          segment.valeur !== 'existante' && (
            <PlateformeTroncon
              key={`p-${segment.de}-${segment.valeur}`}
              voie={voie}
              s0={versAbscisse(segment.de)}
              s1={versAbscisse(segment.a)}
              couleur={segment.valeur === 'decaissee' ? '#6e5b45' : '#7a684f'}
            />
          ),
      )}
      {segmentsDeCouche(etatZone, 'sousCouche').map((segment) => (
        <SousCoucheTroncon
          key={`s-${segment.de}-${segment.valeur}`}
          voie={voie}
          s0={versAbscisse(segment.de)}
          s1={versAbscisse(segment.a)}
          valeur={segment.valeur}
        />
      ))}
      {segmentsDeCouche(etatZone, 'ballast').map((segment) => (
        <BallastTroncon
          key={`b-${segment.de}-${segment.valeur}`}
          voie={voie}
          s0={versAbscisse(segment.de)}
          s1={versAbscisse(segment.a)}
          valeur={segment.valeur}
        />
      ))}
      {segmentsDeCouche(etatZone, 'traverses').map((segment) => (
        <TraversesTroncon
          key={`t-${segment.de}-${segment.valeur}`}
          voie={voie}
          s0={versAbscisse(segment.de)}
          s1={versAbscisse(segment.a)}
          valeur={segment.valeur}
        />
      ))}
      {segmentsDeCouche(etatZone, 'rails').map((segment) => (
        <RailsTroncon
          key={`r-${segment.de}-${segment.valeur}`}
          voie={voie}
          s0={versAbscisse(segment.de)}
          s1={versAbscisse(segment.a)}
          valeur={segment.valeur}
        />
      ))}
      <EtiquetteZone zone={zone} voie={voie} />
      <PastilleGeometrie zone={zone} voie={voie} etatZone={etatZone} />
    </>
  )
}

// Une zone affiche en permanence son nom et sa longueur, comme sur les
// synoptiques.
function EtiquetteZone({ zone, voie }: { zone: Zone; voie: Voie }) {
  const milieu = (zone.pkDebut + zone.pkFin) / 2
  const ancre = pose(voie, milieu, -(COTES.ballast.largeur / 2 + 3.2))
  return (
    <Text
      position={[ancre.x, 0.06, ancre.y]}
      rotation={[-Math.PI / 2, 0, -ancre.angle]}
      fontSize={2}
      color="#22303c"
      anchorX="center"
      anchorY="middle"
    >
      {`${zone.nom} · ${zone.longueur} m`}
    </Text>
  )
}

// La géométrie n'a pas de rendu propre : une pastille d'état au droit de la
// zone, affichée dès que la géométrie diffère de l'état initial.
function PastilleGeometrie({
  zone,
  voie,
  etatZone,
}: {
  zone: Zone
  voie: Voie
  etatZone: EtatZoneScene
}) {
  const valeur = etatZone.couches.geometrie
  const frontActif = etatZone.fronts.find((f) => f.couche === 'geometrie')
  const affichee = frontActif ? frontActif.vers : valeur
  if (!frontActif && valeur === zone.etatInitial.geometrie) return null
  const couleur = COULEURS_GEOMETRIE[affichee]
  if (!couleur) return null
  const ancre = pose(voie, (zone.pkDebut + zone.pkFin) / 2, COTES.ballast.largeur / 2 + 2)
  return (
    <mesh position={[ancre.x, 0.6, ancre.y]}>
      <cylinderGeometry args={[1.1, 1.1, 0.25, 24]} />
      <meshLambertMaterial color={couleur} />
    </mesh>
  )
}
