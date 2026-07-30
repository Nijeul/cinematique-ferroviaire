import { useApplication } from '../ui/store.ts'

// Plan de saisie : en mode tracé, chaque clic sur le sol ajoute un point
// (coordonnées du site en mètres). Les points en cours sont matérialisés.
export function PlanSaisie() {
  const outilTrace = useApplication((etat) => etat.outilTrace)
  const pointsSaisie = useApplication((etat) => etat.pointsSaisie)
  const ajouterPointSaisie = useApplication((etat) => etat.ajouterPointSaisie)
  if (outilTrace === 'aucun') return null

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
        onPointerDown={(evenement) => {
          evenement.stopPropagation()
          ajouterPointSaisie([
            Math.round(evenement.point.x * 10) / 10,
            Math.round(evenement.point.z * 10) / 10,
          ])
        }}
      >
        <planeGeometry args={[8000, 8000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {pointsSaisie.map(([x, y], i) => (
        <mesh key={i} position={[x, 0.6, y]}>
          <sphereGeometry args={[0.9, 12, 12]} />
          <meshBasicMaterial color="#c2262b" />
        </mesh>
      ))}
    </>
  )
}
