import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import type { Appareil, Projet } from '../domain/projet.ts'
import { creerCourbe, type Courbe } from '../geometry/courbe.ts'
import { pose } from '../geometry/referencement.ts'
import { rubanRectangulaire } from '../geometry/ruban.ts'
import { etatAtMemoise } from '../state/etatAt.ts'
import type { EtatAppareil } from '../state/etatScene.ts'
import { useApplication } from '../ui/store.ts'
import { ALTITUDES, COTES } from './cotes.ts'
import { geometrieDepuisMaille } from './maillage.ts'
import { positionMonde } from './positionMonde.ts'

// Appareils de voie : un branchement simple est figuré par sa branche déviée
// (deux rails sur une plaque de traverses) entre la voie directe et la voie
// déviée. La dépose et la pose se font par panneaux, qui restent visibles à
// terre, en transit sur leur porteur, puis au stockage (piles du lot 7).

const COULEUR_PANNEAU = '#8a93a6'
const COULEUR_PLAQUE = '#55524c'

// Chemin rectiligne de la branche déviée : de la pointe sur la voie directe
// vers la voie déviée, du côté donné par l'orientation.
function cheminDeviee(projet: Projet, adv: Appareil): Courbe | null {
  const directe = projet.site.voies.find((v) => v.id === adv.voieDirecte)
  const deviee = projet.site.voies.find((v) => v.id === adv.voiedeviee)
  if (!directe || !deviee) return null
  const depart = pose(directe, adv.pkPointe)
  const signe = adv.orientation === 'pointe' ? 1 : -1
  const arrivee = pose(deviee, adv.pkPointe + signe * 0.03)
  if (Math.hypot(arrivee.x - depart.x, arrivee.y - depart.y) < 0.5) return null
  return creerCourbe([
    [depart.x, depart.y],
    [arrivee.x, arrivee.y],
  ])
}

function BrancheDeviee({ chemin }: { chemin: Courbe }) {
  const geometries = useMemo(() => {
    const plaque = rubanRectangulaire(chemin, 0, chemin.longueur, {
      largeur: 3.4,
      base: ALTITUDES.traverseBase,
      hauteur: COTES.traverse.hauteur,
    })
    const rails = [COTES.rail.demiEcartement, -COTES.rail.demiEcartement].map((offset) =>
      rubanRectangulaire(chemin, 0, chemin.longueur, {
        largeur: COTES.rail.largeur,
        base: ALTITUDES.railBase,
        hauteur: COTES.rail.hauteur,
        offset,
      }),
    )
    return [plaque, ...rails].map(geometrieDepuisMaille)
  }, [chemin])
  return (
    <>
      {geometries.map((geometrie, i) => (
        <mesh key={i} geometry={geometrie}>
          <meshLambertMaterial color={i === 0 ? COULEUR_PLAQUE : '#5c6670'} />
        </mesh>
      ))}
    </>
  )
}

function AppareilRendu({
  projet,
  adv,
  etat,
}: {
  projet: Projet
  adv: Appareil
  etat: EtatAppareil
}) {
  const chemin = useMemo(() => cheminDeviee(projet, adv), [projet, adv])
  const directe = projet.site.voies.find((v) => v.id === adv.voieDirecte)
  if (!directe) return null
  const pointe = pose(directe, adv.pkPointe)

  // Panneaux encore déclarés chez l'appareil : en place si l'appareil est
  // posé, déposés à côté de la voie sinon.
  const panneauxSurPlace = Object.entries(etat.panneaux).filter(([, e]) => e.chez === adv.id && !e.enTransit)
  const enPlace = etat.pose || etat.enCours !== undefined

  return (
    <group>
      {enPlace && chemin && <BrancheDeviee chemin={chemin} />}
      {!enPlace &&
        panneauxSurPlace.map(([nom], i) => {
          const ancre = pose(directe, adv.pkPointe, COTES.ballast.largeur / 2 + 2.4)
          return (
            <mesh
              key={nom}
              position={[ancre.x, 0.25 + i * 0.45, ancre.y]}
              rotation={[0, -ancre.angle + 0.05 * i, 0]}
            >
              <boxGeometry args={[11.5, 0.35, 3]} />
              <meshLambertMaterial color={COULEUR_PANNEAU} />
            </mesh>
          )
        })}
      <Text
        position={[pointe.x, 0.06, pointe.y - COTES.ballast.largeur / 2 - 5.6]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1.9}
        color={enPlace ? '#22303c' : '#8a5a2d'}
        anchorX="center"
        anchorY="middle"
      >
        {etat.pose ? adv.nom : etat.enCours ? `${adv.nom} — en cours` : `${adv.nom} — déposé`}
      </Text>
    </group>
  )
}

// Panneaux en transit : posés à plat sur leur porteur.
function PanneauxEnTransit() {
  const projet = useApplication((etat) => etat.projet)
  const t = useApplication((etat) => etat.t)
  if (!projet) return null
  const etatScene = etatAtMemoise(projet, t)

  const panneaux: { cle: string; x: number; y: number; angle: number }[] = []
  for (const [advId, appareil] of Object.entries(etatScene.appareils)) {
    for (const [nomPanneau, emplacement] of Object.entries(appareil.panneaux)) {
      if (!emplacement.enTransit) continue
      const porteur = etatScene.ressources[emplacement.enTransit.porteur]
      if (!porteur) continue
      const monde = positionMonde(projet, porteur.position)
      panneaux.push({ cle: `${advId}-${nomPanneau}`, x: monde.x, y: monde.y, angle: monde.angle })
    }
  }

  return (
    <>
      {panneaux.map((panneau) => (
        <mesh
          key={panneau.cle}
          position={[panneau.x, 3.1, panneau.y]}
          rotation={[0, -panneau.angle, 0]}
        >
          <boxGeometry args={[11.5, 0.35, 3]} />
          <meshLambertMaterial color={COULEUR_PANNEAU} />
        </mesh>
      ))}
    </>
  )
}

export function Appareils() {
  const projet = useApplication((etat) => etat.projet)
  const t = useApplication((etat) => etat.t)
  if (!projet) return null
  const etatScene = etatAtMemoise(projet, t)
  return (
    <>
      {projet.site.appareils.map((adv) => {
        const etat = etatScene.appareils[adv.id]
        if (!etat) return null
        return <AppareilRendu key={adv.id} projet={projet} adv={adv} etat={etat} />
      })}
      <PanneauxEnTransit />
    </>
  )
}
