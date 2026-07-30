import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { etatAtMemoise } from '../state/etatAt.ts'
import { useApplication } from '../ui/store.ts'
import { centreDeLieu } from './positionMonde.ts'
import { poserInstance } from './maillage.ts'

// Stocks : chaque lieu affiche des piles qui grandissent ou diminuent avec
// les flux. La quantité vient de etatAt ; rien n'est animé à la main.

const COULEURS_MATIERE: Record<string, string> = {
  traverses_anciennes: '#6f655a',
  traverses_neuves: '#e2dccd',
  rails: '#5c6670',
  ballast: '#8d8d89',
  sous_couche: '#c99a4b',
  panneau_adv: '#8a93a6',
}

// Pile de bottes de traverses : une botte ≈ 8 traverses, rangées par couches.
function PileTraverses({ quantite, x, y, couleur }: { quantite: number; x: number; y: number; couleur: string }) {
  const bottes = Math.min(Math.ceil(quantite / 8), 48)
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < bottes; i++) {
      const couche = Math.floor(i / 6)
      const rang = i % 6
      poserInstance(
        mesh,
        i,
        { x: x + (rang - 2.5) * 1.1, y: y + (couche % 2) * 0.2, angle: couche % 2 === 0 ? 0 : 0.06 },
        0.2 + couche * 0.42,
      )
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [bottes, x, y])
  if (bottes === 0) return null
  return (
    <instancedMesh key={bottes} ref={ref} args={[undefined, undefined, bottes]} frustumCulled={false}>
      <boxGeometry args={[1, 0.4, 2.6]} />
      <meshLambertMaterial color={couleur} />
    </instancedMesh>
  )
}

function Tas({ quantite, x, y, couleur }: { quantite: number; x: number; y: number; couleur: string }) {
  const hauteur = Math.min(0.8 + quantite * 0.35, 3.5)
  const rayon = Math.min(2.2 + quantite * 0.5, 6)
  return (
    <mesh position={[x, hauteur / 2, y]}>
      <coneGeometry args={[rayon, hauteur, 20]} />
      <meshLambertMaterial color={couleur} />
    </mesh>
  )
}

function PilePanneaux({ quantite, x, y }: { quantite: number; x: number; y: number }) {
  const nombre = Math.min(Math.round(quantite), 14)
  if (nombre <= 0) return null
  return (
    <group>
      {Array.from({ length: nombre }, (_, i) => (
        <mesh key={i} position={[x + (i % 2) * 0.4, 0.3 + i * 0.5, y]} rotation={[0, (i % 3) * 0.05, 0]}>
          <boxGeometry args={[12.5, 0.4, 3]} />
          <meshLambertMaterial color={COULEURS_MATIERE.panneau_adv} />
        </mesh>
      ))}
    </group>
  )
}

export function Stocks() {
  const projet = useApplication((etat) => etat.projet)
  const t = useApplication((etat) => etat.t)
  if (!projet) return null
  const etatScene = etatAtMemoise(projet, t)

  return (
    <>
      {Object.entries(etatScene.stocks).map(([lieuId, stock]) => {
        const [cx, cy] = centreDeLieu(projet, lieuId)
        return stock.contenus.map((contenu, indice) => {
          if (contenu.quantite < 0.5) return null
          const x = cx + indice * 9 - (stock.contenus.length - 1) * 4.5
          const cle = `${lieuId}-${contenu.quoi}`
          if (contenu.quoi === 'panneau_adv') {
            return <PilePanneaux key={cle} quantite={contenu.quantite} x={x} y={cy} />
          }
          if (contenu.quoi === 'ballast' || contenu.quoi === 'sous_couche') {
            return (
              <Tas key={cle} quantite={contenu.quantite} x={x} y={cy} couleur={COULEURS_MATIERE[contenu.quoi]} />
            )
          }
          return (
            <PileTraverses
              key={cle}
              quantite={contenu.quantite}
              x={x}
              y={cy}
              couleur={COULEURS_MATIERE[contenu.quoi] ?? '#7a6f5f'}
            />
          )
        })
      })}
    </>
  )
}
