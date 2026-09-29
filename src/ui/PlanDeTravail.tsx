import { useEffect, useRef, useState, type PointerEvent as EvenementPointeur } from 'react'
import { deplacerPoint } from '../plan/edition.ts'
import { contraindre, pointSousPointeur, positionNom, tailleNom, voieSousPointeur } from '../plan/geometrie.ts'
import { COULEUR_VOIE_PAR_DEFAUT, epaisseurParDefaut, type Point, type Voie } from '../plan/projet.ts'
import { deplacer, facteurMolette, recadrer, versPlan, zoomerAutour, type Vue } from '../plan/vue.ts'
import { COULEURS } from './couleurs.ts'
import type { Editeur } from './useEditeur.ts'

// Le plan de travail : le fond dessous, les voies au calque par-dessus.
// Tolérances de sélection en pixels d'écran, donc identiques à tout zoom.
const TOLERANCE_VOIE = 6
const TOLERANCE_POIGNEE = 9
const RAYON_POIGNEE = 5.5

type Glisser =
  | { genre: 'vue'; x: number; y: number }
  | { genre: 'point'; voieId: string; indice: number; cle: string }

let compteurGlisser = 0

// Une voie dans le style de l'aperçu : deux filets (trait épais de la couleur
// de la voie, trait blanc plus fin par-dessus), nom en gras au départ.
function TraceVoie({ voie, choisie, zoom }: { voie: Voie; choisie: boolean; zoom: number }) {
  const points = voie.points.map((p) => `${p.x},${p.y}`).join(' ')
  const nom = positionNom(voie)
  const taille = tailleNom(voie.epaisseur)
  return (
    <g>
      {choisie && (
        <polyline
          points={points}
          fill="none"
          stroke={COULEURS.selection}
          strokeOpacity={0.3}
          strokeWidth={voie.epaisseur + 14 / zoom}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <polyline points={points} fill="none" stroke={voie.couleur} strokeWidth={voie.epaisseur} strokeLinejoin="miter" />
      <polyline points={points} fill="none" stroke="#ffffff" strokeWidth={voie.epaisseur * 0.4} strokeLinejoin="miter" />
      <text
        x={nom.x}
        y={nom.y}
        fontSize={taille}
        fontWeight={700}
        textAnchor={nom.ancre}
        fill={COULEURS.nomVoie}
        stroke="#ffffff"
        strokeWidth={taille * 0.28}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ userSelect: 'none' }}
      >
        {voie.nom}
      </text>
    </g>
  )
}

export function PlanDeTravail({ editeur }: { editeur: Editeur }) {
  const { projet, outil, selection, trace, espace } = editeur
  const svgRef = useRef<SVGSVGElement>(null)
  const glisser = useRef<Glisser | null>(null)
  const [taille, setTaille] = useState({ largeur: 0, hauteur: 0 })
  const [curseur, setCurseur] = useState<{ p: Point; maj: boolean } | null>(null)
  const [enDeplacement, setEnDeplacement] = useState(false)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observateur = new ResizeObserver(([entree]) => {
      setTaille({ largeur: entree.contentRect.width, hauteur: entree.contentRect.height })
    })
    observateur.observe(svg)
    return () => observateur.disconnect()
  }, [])

  // Vue « null » = recadrée automatiquement sur tout le plan.
  const vue: Vue = editeur.vue ?? recadrer(projet, taille)
  const { setVue } = editeur

  // Zoom à la molette, centré sur le curseur. Écouteur non passif pour
  // empêcher la page de défiler.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const surMolette = (e: WheelEvent) => {
      e.preventDefault()
      const cadre = svg.getBoundingClientRect()
      setVue(zoomerAutour(vue, { x: e.clientX - cadre.left, y: e.clientY - cadre.top }, facteurMolette(e.deltaY)))
    }
    svg.addEventListener('wheel', surMolette, { passive: false })
    return () => svg.removeEventListener('wheel', surMolette)
  }, [vue, setVue])

  const pointEcran = (e: { clientX: number; clientY: number }): Point => {
    const cadre = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - cadre.left, y: e.clientY - cadre.top }
  }

  const voieChoisie = selection ? projet.voies.find((v) => v.id === selection.voieId) : undefined
  const voiesActives = projet.calques.voies.visible

  // Point posé pendant le tracé : contraint à 0/45/90° avec Maj.
  const pointTrace = (p: Point, maj: boolean): Point =>
    maj && trace && trace.length > 0 ? contraindre(trace[trace.length - 1], p) : p

  const surAppui = (e: EvenementPointeur<SVGSVGElement>) => {
    const ecran = pointEcran(e)
    const p = versPlan(vue, ecran)
    if (e.button === 1 || (e.button === 0 && (outil === 'main' || espace))) {
      e.preventDefault()
      glisser.current = { genre: 'vue', x: ecran.x, y: ecran.y }
      setEnDeplacement(true)
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return
    if (outil === 'tracer') {
      editeur.ajouterPointTrace(pointTrace(p, e.shiftKey))
      return
    }
    if (outil === 'selection' && voiesActives) {
      if (voieChoisie) {
        const indice = pointSousPointeur(voieChoisie.points, p, TOLERANCE_POIGNEE / vue.zoom)
        if (indice !== null) {
          editeur.setSelection({ voieId: voieChoisie.id, point: indice })
          glisser.current = { genre: 'point', voieId: voieChoisie.id, indice, cle: `glisser:${++compteurGlisser}` }
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
      }
      const id = voieSousPointeur(projet.voies, p, TOLERANCE_VOIE / vue.zoom)
      editeur.setSelection(id ? { voieId: id, point: null } : null)
    }
  }

  const surDeplacement = (e: EvenementPointeur<SVGSVGElement>) => {
    const ecran = pointEcran(e)
    const p = versPlan(vue, ecran)
    setCurseur({ p, maj: e.shiftKey })
    const g = glisser.current
    if (!g) return
    if (g.genre === 'vue') {
      setVue(deplacer(vue, ecran.x - g.x, ecran.y - g.y))
      glisser.current = { genre: 'vue', x: ecran.x, y: ecran.y }
    } else {
      const voie = projet.voies.find((v) => v.id === g.voieId)
      if (!voie) return
      // Avec Maj, le point glissé s'aligne sur son voisin.
      const voisin = voie.points[g.indice - 1] ?? voie.points[g.indice + 1]
      const cible = e.shiftKey && voisin ? contraindre(voisin, p) : p
      editeur.modifier((pr) => deplacerPoint(pr, g.voieId, g.indice, cible), g.cle)
    }
  }

  const surRelache = (e: EvenementPointeur<SVGSVGElement>) => {
    if (glisser.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    glisser.current = null
    setEnDeplacement(false)
  }

  const curseurCss =
    enDeplacement ? 'grabbing' : outil === 'main' || espace ? 'grab' : outil === 'tracer' ? 'crosshair' : 'default'

  const fond = projet.fond
  const calqueFond = projet.calques.fond
  const epaisseurTrace = epaisseurParDefaut(projet)
  const fantome = trace && trace.length > 0 && curseur ? pointTrace(curseur.p, curseur.maj) : null
  const pointsTrace = trace?.map((p) => `${p.x},${p.y}`).join(' ') ?? ''

  return (
    <svg
      ref={svgRef}
      style={{ display: 'block', width: '100%', height: '100%', cursor: curseurCss, touchAction: 'none' }}
      onPointerDown={surAppui}
      onPointerMove={surDeplacement}
      onPointerUp={surRelache}
      onPointerCancel={surRelache}
      onPointerLeave={() => setCurseur(null)}
      onDoubleClick={() => outil === 'tracer' && editeur.terminer(4 / vue.zoom)}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="plan-de-travail"
    >
      <rect width="100%" height="100%" fill={COULEURS.autourDuPlan} />
      <g transform={`translate(${vue.dx} ${vue.dy}) scale(${vue.zoom})`}>
        {/* La feuille : blanche, bordée, à la taille du fond. */}
        <rect
          x={0}
          y={0}
          width={projet.largeur}
          height={projet.hauteur}
          fill="#ffffff"
          stroke={COULEURS.bordFeuille}
          strokeWidth={1 / vue.zoom}
        />
        {fond && calqueFond.visible && fond.image && (
          <image
            href={fond.image}
            x={0}
            y={0}
            width={fond.largeur}
            height={fond.hauteur}
            opacity={calqueFond.opacite}
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {fond && !fond.image && (
          <text
            x={projet.largeur / 2}
            y={projet.hauteur / 2}
            fontSize={16 / vue.zoom}
            textAnchor="middle"
            fill={COULEURS.discret}
          >
            Fond « {fond.nomFichier} » à réimporter
          </text>
        )}

        {voiesActives &&
          projet.voies.map((voie) => (
            <TraceVoie key={voie.id} voie={voie} choisie={voie.id === selection?.voieId} zoom={vue.zoom} />
          ))}

        {/* Poignées de la voie choisie, pour déplacer ses points. */}
        {voiesActives &&
          outil === 'selection' &&
          voieChoisie?.points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={RAYON_POIGNEE / vue.zoom}
              fill={selection?.point === i ? COULEURS.selection : '#ffffff'}
              stroke={COULEURS.selection}
              strokeWidth={1.8 / vue.zoom}
              style={{ cursor: 'move' }}
            />
          ))}

        {/* Tracé en cours : la voie telle qu'elle sera, et le segment qui suit la souris. */}
        {trace && trace.length > 1 && (
          <g opacity={0.75}>
            <polyline points={pointsTrace} fill="none" stroke={COULEUR_VOIE_PAR_DEFAUT} strokeWidth={epaisseurTrace} />
            <polyline points={pointsTrace} fill="none" stroke="#ffffff" strokeWidth={epaisseurTrace * 0.4} />
          </g>
        )}
        {trace && fantome && (
          <line
            x1={trace[trace.length - 1].x}
            y1={trace[trace.length - 1].y}
            x2={fantome.x}
            y2={fantome.y}
            stroke={COULEURS.selection}
            strokeWidth={2 / vue.zoom}
            strokeDasharray={`${8 / vue.zoom} ${5 / vue.zoom}`}
          />
        )}
        {trace?.map((p, i) => (
          <rect
            key={i}
            x={p.x - 4 / vue.zoom}
            y={p.y - 4 / vue.zoom}
            width={8 / vue.zoom}
            height={8 / vue.zoom}
            fill="#ffffff"
            stroke={COULEURS.selection}
            strokeWidth={1.8 / vue.zoom}
          />
        ))}
      </g>
    </svg>
  )
}
