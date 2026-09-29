import { useEffect, useRef, useState, type PointerEvent as EvenementPointeur } from 'react'
import type { Rectangle } from '../plan/elements.ts'
import type { Point, Projet } from '../plan/projet.ts'
import { normaliserCadrage } from '../plan/synoptique.ts'
import { recadrer, versPlan } from '../plan/vue.ts'
import { COULEURS } from './couleurs.ts'
import { DessinPlan } from './DessinPlan.tsx'
import { styleDiscret } from './styles.ts'

// Choix du cadrage d'un synoptique : le plan en petit, on glisse un rectangle
// dessus pour ne garder que ce secteur. « Tout le plan » par défaut.

export function ChoixCadrage(props: { projet: Projet; cadrage: Rectangle | null; changer: (cadrage: Rectangle | null) => void }) {
  const { projet, cadrage, changer } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const [taille, setTaille] = useState({ largeur: 0, hauteur: 0 })
  const [depart, setDepart] = useState<Point | null>(null)
  const [courant, setCourant] = useState<Point | null>(null)
  const [partieDemandee, setPartieDemandee] = useState(false)
  const [tropPetit, setTropPetit] = useState(false)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observateur = new ResizeObserver(([entree]) => setTaille({ largeur: entree.contentRect.width, hauteur: entree.contentRect.height }))
    observateur.observe(svg)
    return () => observateur.disconnect()
  }, [])

  const vue = recadrer(projet, taille, 10)
  const pointPlan = (e: EvenementPointeur<SVGSVGElement>): Point => {
    const cadre = e.currentTarget.getBoundingClientRect()
    return versPlan(vue, { x: e.clientX - cadre.left, y: e.clientY - cadre.top })
  }

  const enCours = depart && courant ? normaliserCadrage(depart, courant, projet) : null
  const affiche = enCours ?? cadrage
  const partie = cadrage !== null || partieDemandee

  return (
    <div>
      <div role="radiogroup" aria-label="Cadrage" style={{ display: 'flex', gap: 18, fontSize: 13, margin: '0 0 6px' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="radio"
            name="cadrage"
            checked={!partie}
            onChange={() => {
              setPartieDemandee(false)
              changer(null)
            }}
          />
          Tout le plan
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="radio" name="cadrage" checked={partie} onChange={() => setPartieDemandee(true)} />
          Une partie du plan
        </label>
      </div>
      <svg
        ref={svgRef}
        data-testid="choix-cadrage"
        style={{
          display: 'block',
          width: '100%',
          height: 340,
          background: COULEURS.autourDuPlan,
          borderRadius: 6,
          cursor: 'crosshair',
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          const p = pointPlan(e)
          setDepart(p)
          setCourant(p)
          setTropPetit(false)
        }}
        onPointerMove={(e) => {
          if (depart) setCourant(pointPlan(e))
        }}
        onPointerUp={(e) => {
          if (!depart) return
          const rectangle = normaliserCadrage(depart, pointPlan(e), projet)
          setDepart(null)
          setCourant(null)
          if (rectangle) {
            setPartieDemandee(true)
            changer(rectangle)
          } else {
            setTropPetit(true)
          }
        }}
      >
        <g transform={`translate(${vue.dx} ${vue.dy}) scale(${vue.zoom})`}>
          <DessinPlan projet={projet} zoom={vue.zoom} />
          {affiche && (
            <>
              {/* Ce qui sera hors du synoptique est assombri. */}
              <path
                d={`M0 0H${projet.largeur}V${projet.hauteur}H0Z M${affiche.x} ${affiche.y}v${affiche.hauteur}h${affiche.largeur}v${-affiche.hauteur}Z`}
                fill="rgba(28, 36, 48, 0.32)"
                fillRule="evenodd"
              />
              <rect
                x={affiche.x}
                y={affiche.y}
                width={affiche.largeur}
                height={affiche.hauteur}
                fill="none"
                stroke={COULEURS.selection}
                strokeWidth={2.5 / vue.zoom}
                strokeDasharray={enCours ? `${6 / vue.zoom} ${4 / vue.zoom}` : undefined}
                data-testid="cadre-cadrage"
              />
            </>
          )}
        </g>
      </svg>
      <p style={{ ...styleDiscret, color: tropPetit ? COULEURS.erreur : COULEURS.discret }}>
        {tropPetit
          ? 'Rectangle trop petit : appuyez à un coin du secteur et relâchez au coin opposé.'
          : cadrage
            ? 'Seul le secteur encadré sera affiché. Glissez à nouveau pour le changer.'
            : partie
              ? 'Glissez un rectangle sur le plan : appuyez à un coin du secteur, relâchez au coin opposé.'
              : 'Tout le plan sera affiché. Pour un secteur seulement, glissez un rectangle sur le plan.'}
      </p>
    </div>
  )
}
