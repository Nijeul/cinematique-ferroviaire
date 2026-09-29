import { useEffect, useRef, useState, type PointerEvent as EvenementPointeur } from 'react'
import {
  descriptionEchelle,
  echelleParDeuxPoints,
  echelleParLargeur,
  formaterNombre,
  LARGEUR_TOILE_PAR_DEFAUT_M,
  lireNombre,
  planVersMetres,
} from '../plan/echelle.ts'
import type { Echelle, Point, Projet } from '../plan/projet.ts'
import { deplacer, facteurMolette, recadrer, versPlan, zoomerAutour, type Vue } from '../plan/vue.ts'
import { COULEURS } from './couleurs.ts'
import { DessinPlan } from './DessinPlan.tsx'
import { styleChamp, styleDiscret } from './styles.ts'

// Calage de l'échelle d'un plan. Deux façons :
// - deux clics sur le plan, sur deux repères dont on connaît l'écart réel
//   (deux poteaux, deux PK…), puis cet écart en mètres ;
// - sans fond, ou faute de repères : la longueur réelle représentée par la
//   largeur du plan.
// La molette zoome pour cliquer précisément ; glisser déplace la vue.
// `changer` reçoit l'échelle calculée, ou null tant qu'elle n'est pas valable.

type Mode = 'points' | 'largeur'

const SEUIL_GLISSER = 4


export function CalageEchelle(props: { projet: Projet; changer: (echelle: Echelle | null) => void; hauteur?: number }) {
  const { projet, changer } = props
  const actuelle = projet.echelle
  const [mode, setMode] = useState<Mode>(projet.fond ? 'points' : 'largeur')
  const [points, setPoints] = useState<Point[]>([])
  const [distance, setDistance] = useState('')
  const [largeur, setLargeur] = useState(() =>
    actuelle ? formaterNombre(planVersMetres(actuelle, projet.largeur)) : String(LARGEUR_TOILE_PAR_DEFAUT_M),
  )
  const [vue, setVue] = useState<Vue | null>(null)
  const [taille, setTaille] = useState({ largeur: 0, hauteur: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const appui = useRef<{ ecran: Point; dernier: Point; glisse: boolean } | null>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observateur = new ResizeObserver(([e]) => setTaille({ largeur: e.contentRect.width, hauteur: e.contentRect.height }))
    observateur.observe(svg)
    return () => observateur.disconnect()
  }, [])

  const vueCourante = vue ?? recadrer(projet, taille, 12)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const surMolette = (e: WheelEvent) => {
      e.preventDefault()
      const cadre = svg.getBoundingClientRect()
      setVue(zoomerAutour(vueCourante, { x: e.clientX - cadre.left, y: e.clientY - cadre.top }, facteurMolette(e.deltaY)))
    }
    svg.addEventListener('wheel', surMolette, { passive: false })
    return () => svg.removeEventListener('wheel', surMolette)
  }, [vueCourante])

  // Résultat du calage, recalculé à chaque saisie.
  const metres = lireNombre(mode === 'points' ? distance : largeur)
  const pret = mode === 'largeur' || points.length === 2
  const saisie = (mode === 'points' ? distance : largeur).trim() !== ''
  const resultat = !pret
    ? null
    : mode === 'points'
      ? saisie
        ? echelleParDeuxPoints(points[0], points[1], metres ?? NaN)
        : null
      : echelleParLargeur(projet.largeur, metres ?? NaN)
  const echelle = resultat?.ok ? resultat.valeur : null

  const rappel = useRef(changer)
  useEffect(() => {
    rappel.current = changer
  })
  const cle = echelle ? echelle.pixelsParMetre : null
  useEffect(() => {
    rappel.current(cle === null ? null : { pixelsParMetre: cle })
  }, [cle])

  const ecranDe = (e: { clientX: number; clientY: number }): Point => {
    const cadre = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - cadre.left, y: e.clientY - cadre.top }
  }

  const surAppui = (e: EvenementPointeur<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const ecran = ecranDe(e)
    appui.current = { ecran, dernier: ecran, glisse: e.button === 1 }
  }
  const surDeplacement = (e: EvenementPointeur<SVGSVGElement>) => {
    const a = appui.current
    if (!a) return
    const ecran = ecranDe(e)
    if (!a.glisse && Math.hypot(ecran.x - a.ecran.x, ecran.y - a.ecran.y) < SEUIL_GLISSER) return
    a.glisse = true
    setVue(deplacer(vueCourante, ecran.x - a.dernier.x, ecran.y - a.dernier.y))
    a.dernier = ecran
  }
  const surRelache = (e: EvenementPointeur<SVGSVGElement>) => {
    const a = appui.current
    appui.current = null
    if (!a || a.glisse || mode !== 'points') return
    const p = versPlan(vueCourante, ecranDe(e))
    setPoints((pts) => (pts.length >= 2 ? [p] : [...pts, p]))
  }

  const z = vueCourante.zoom
  const consigne =
    mode === 'largeur'
      ? 'La largeur du plan est indiquée ci-dessous.'
      : points.length === 0
        ? 'Cliquez le premier repère (un poteau, un PK…). Molette : zoom · glisser : déplacer la vue.'
        : points.length === 1
          ? 'Cliquez le second repère, le plus loin possible du premier.'
          : 'Tapez la distance réelle entre les deux repères. Un nouveau clic recommence.'

  return (
    <div data-testid="calage-echelle">
      <div role="radiogroup" aria-label="Façon de caler l'échelle" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, margin: '0 0 6px' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="radio" name="mode-echelle" checked={mode === 'points'} onChange={() => setMode('points')} />
          Deux repères sur le plan
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="radio" name="mode-echelle" checked={mode === 'largeur'} onChange={() => setMode('largeur')} />
          Largeur réelle du plan
        </label>
      </div>
      <svg
        ref={svgRef}
        data-testid="toile-calage"
        style={{
          display: 'block',
          width: '100%',
          height: props.hauteur ?? 420,
          background: COULEURS.autourDuPlan,
          borderRadius: 6,
          cursor: mode === 'points' ? 'crosshair' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerDown={surAppui}
        onPointerMove={surDeplacement}
        onPointerUp={surRelache}
        onPointerCancel={() => (appui.current = null)}
      >
        <g transform={`translate(${vueCourante.dx} ${vueCourante.dy}) scale(${z})`}>
          <DessinPlan projet={projet} zoom={z} />
          {mode === 'points' && points.length === 2 && (
            <line
              x1={points[0].x}
              y1={points[0].y}
              x2={points[1].x}
              y2={points[1].y}
              stroke={COULEURS.selection}
              strokeWidth={2.5 / z}
              strokeDasharray={`${8 / z} ${5 / z}`}
            />
          )}
          {mode === 'points' &&
            points.map((p, i) => (
              <g key={i} data-testid="repere-echelle">
                <circle cx={p.x} cy={p.y} r={7 / z} fill="none" stroke={COULEURS.selection} strokeWidth={2 / z} />
                <line x1={p.x - 12 / z} y1={p.y} x2={p.x + 12 / z} y2={p.y} stroke={COULEURS.selection} strokeWidth={1.5 / z} />
                <line x1={p.x} y1={p.y - 12 / z} x2={p.x} y2={p.y + 12 / z} stroke={COULEURS.selection} strokeWidth={1.5 / z} />
                <text x={p.x + 10 / z} y={p.y - 10 / z} fontSize={14 / z} fontWeight={700} fill={COULEURS.selection} stroke="#ffffff" strokeWidth={3 / z} paintOrder="stroke">
                  {i + 1}
                </text>
              </g>
            ))}
        </g>
      </svg>
      <p style={styleDiscret} data-testid="consigne-calage">
        {consigne}
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0 4px' }}>
        {mode === 'points' ? (
          <>
            <span>Distance réelle entre les repères 1 et 2</span>
            <input
              type="text"
              inputMode="decimal"
              value={distance}
              aria-label="Distance réelle en mètres"
              placeholder="ex. 100"
              disabled={points.length < 2}
              style={{ ...styleChamp, width: 90, textAlign: 'right' }}
              onChange={(e) => setDistance(e.target.value)}
            />
          </>
        ) : (
          <>
            <span>Longueur réelle représentée par la largeur du plan</span>
            <input
              type="text"
              inputMode="decimal"
              value={largeur}
              aria-label="Largeur réelle du plan en mètres"
              style={{ ...styleChamp, width: 90, textAlign: 'right' }}
              onChange={(e) => setLargeur(e.target.value)}
            />
          </>
        )}
        <span>m</span>
      </label>
      {resultat && !resultat.ok && (
        <p role="alert" style={{ ...styleDiscret, color: COULEURS.erreur }}>
          {resultat.erreur}
        </p>
      )}
      <p style={{ ...styleDiscret, color: echelle ? COULEURS.texte : COULEURS.discret }} data-testid="resultat-calage">
        {echelle ? (
          <>
            <strong>Échelle : </strong>
            {descriptionEchelle(echelle, projet.largeur)}
          </>
        ) : actuelle ? (
          <>Échelle actuelle : {descriptionEchelle(actuelle, projet.largeur)}</>
        ) : (
          'Échelle pas encore calée.'
        )}
      </p>
    </div>
  )
}
