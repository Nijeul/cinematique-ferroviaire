import { useEffect, useRef, useState, type PointerEvent as EvenementPointeur } from 'react'
import { enPoints } from '../plan/dessin.ts'
import { accrocherVoie, calqueActif, elementSousPointeur, poigneesDe, poigneeSousPointeur, type Genre, type Reference } from '../plan/detection.ts'
import { deplacerPoint } from '../plan/edition.ts'
import {
  deplacerBoutAppareil,
  deplacerBoutZone,
  glisserAppareil,
  glisserCadre,
  glisserTexte,
  glisserZone,
  normaliserRectangle,
  redimensionnerCadre,
} from '../plan/elements.ts'
import { contraindre } from '../plan/geometrie.ts'
import { COULEUR_VOIE_PAR_DEFAUT, COULEUR_ZONE_PAR_DEFAUT, epaisseurParDefaut, type Point, type Projet } from '../plan/projet.ts'
import { pointAAbscisse, projeterSurPolyligne } from '../plan/trace.ts'
import { deplacer, facteurMolette, recadrer, versPlan, zoomerAutour, type Vue } from '../plan/vue.ts'
import { COULEURS } from './couleurs.ts'
import { DessinPlan, DessinZone } from './DessinPlan.tsx'
import type { Editeur } from './useEditeur.ts'

// Le plan de travail : le dessin du plan (DessinPlan), et par-dessus tout ce
// qui sert à le modifier — poignées, tracé ou pose en cours. Tolérances de
// sélection en pixels d'écran, donc identiques à tout zoom.
const TOLERANCE_ELEMENT = 6
const TOLERANCE_ACCROCHE = 12
const TOLERANCE_POIGNEE = 9
const RAYON_POIGNEE = 5.5
// En dessous de ce déplacement (pixels d'écran), un clic reste un clic.
const SEUIL_GLISSER = 3

type Glisser =
  | { genre: 'vue'; x: number; y: number }
  | { genre: 'poignee'; ref: Reference; cle: string; origine: Projet; cleHistorique: string }
  | { genre: 'corps'; ref: Reference; depart: Point; ecran: Point; origine: Projet; cleHistorique: string }
  | { genre: 'nouveauCadre'; depart: Point; ecran: Point }

let compteurGlisser = 0


export function PlanDeTravail({ editeur }: { editeur: Editeur }) {
  const { projet, outil, selection, trace, pose, espace } = editeur
  const svgRef = useRef<SVGSVGElement>(null)
  const glisser = useRef<Glisser | null>(null)
  const [taille, setTaille] = useState({ largeur: 0, hauteur: 0 })
  const [curseur, setCurseur] = useState<{ p: Point; maj: boolean } | null>(null)
  const [enDeplacement, setEnDeplacement] = useState(false)
  const [nouveauCadre, setNouveauCadre] = useState<{ a: Point; b: Point } | null>(null)

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

  const voiesVisibles = projet.calques.voies.visible
  // Poignées : seulement avec l'outil Sélection, sur un calque modifiable.
  const avecPoignees = outil === 'selection' && selection !== null && calqueActif(projet, selection.genre)
  const poignees = avecPoignees ? poigneesDe(projet, selection) : []

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
    switch (outil) {
      case 'voie':
        editeur.ajouterPointTrace(pointTrace(p, e.shiftKey))
        return
      case 'zone':
      case 'bs':
      case 'communication':
        editeur.poserSurVoie(p, TOLERANCE_ACCROCHE / vue.zoom)
        return
      case 'texte': {
        const ref = elementSousPointeur(projet, p, TOLERANCE_ELEMENT / vue.zoom)
        if (ref?.genre === 'texte') editeur.editerTexte(ref.id)
        else editeur.creerTexte(p)
        return
      }
      case 'cadre':
        glisser.current = { genre: 'nouveauCadre', depart: p, ecran }
        setNouveauCadre({ a: p, b: p })
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      case 'selection': {
        const cle = selection && poigneeSousPointeur(poignees, p, TOLERANCE_POIGNEE / vue.zoom)
        if (selection && cle) {
          if (selection.genre === 'voie') editeur.setSelection({ ...selection, point: Number(cle.slice('point-'.length)) })
          glisser.current = { genre: 'poignee', ref: selection, cle, origine: projet, cleHistorique: `glisser:${++compteurGlisser}` }
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
        const ref = elementSousPointeur(projet, p, TOLERANCE_ELEMENT / vue.zoom)
        if (!ref) {
          editeur.setSelection(null)
          return
        }
        editeur.choisir(ref.genre, ref.id)
        // Une voie se modifie par ses points ; le reste se glisse d'un bloc.
        if (ref.genre !== 'voie') {
          glisser.current = { genre: 'corps', ref, depart: p, ecran, origine: projet, cleHistorique: `glisser:${++compteurGlisser}` }
          e.currentTarget.setPointerCapture(e.pointerId)
        }
        return
      }
      default:
        return
    }
  }

  // Nouvel état du projet pendant qu'on glisse, calculé depuis l'état de
  // départ (et non par petits pas) : rien ne se perd en route, même si une
  // voie raccourcit un instant sous une zone.
  const pendantGlisser = (g: Extract<Glisser, { genre: 'poignee' | 'corps' }>, p: Point, maj: boolean): Projet => {
    const { origine, ref } = g
    const voieDe = (voieId: string) => origine.voies.find((v) => v.id === voieId)?.points ?? []
    if (g.genre === 'corps') {
      const decalage = { x: p.x - g.depart.x, y: p.y - g.depart.y }
      switch (ref.genre) {
        case 'zone': {
          const zone = origine.zones.find((z) => z.id === ref.id)
          if (!zone) return origine
          const points = voieDe(zone.voieId)
          const glisse = projeterSurPolyligne(points, p).abscisse - projeterSurPolyligne(points, g.depart).abscisse
          return glisserZone(origine, ref.id, glisse)
        }
        case 'appareil':
          return glisserAppareil(origine, ref.id, decalage)
        case 'cadre':
          return glisserCadre(origine, ref.id, decalage)
        case 'texte':
          return glisserTexte(origine, ref.id, decalage)
        default:
          return origine
      }
    }
    switch (ref.genre) {
      case 'voie': {
        const indice = Number(g.cle.slice('point-'.length))
        const voie = origine.voies.find((v) => v.id === ref.id)
        // Avec Maj, le point glissé s'aligne sur son voisin.
        const voisin = voie?.points[indice - 1] ?? voie?.points[indice + 1]
        return deplacerPoint(origine, ref.id, indice, maj && voisin ? contraindre(voisin, p) : p)
      }
      case 'zone': {
        const zone = origine.zones.find((z) => z.id === ref.id)
        if (!zone) return origine
        return deplacerBoutZone(origine, ref.id, g.cle as 'debut' | 'fin', projeterSurPolyligne(voieDe(zone.voieId), p).abscisse)
      }
      case 'appareil': {
        const appareil = origine.appareils.find((a) => a.id === ref.id)
        if (!appareil) return origine
        const bout = g.cle as 'pointe' | 'talon'
        return deplacerBoutAppareil(origine, ref.id, bout, projeterSurPolyligne(voieDe(appareil[bout].voieId), p).abscisse)
      }
      case 'cadre':
        return redimensionnerCadre(origine, ref.id, Number(g.cle.slice('coin-'.length)), p)
      default:
        return origine
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
    } else if (g.genre === 'nouveauCadre') {
      setNouveauCadre({ a: g.depart, b: p })
    } else {
      if (g.genre === 'corps' && Math.hypot(ecran.x - g.ecran.x, ecran.y - g.ecran.y) < SEUIL_GLISSER) return
      if (g.genre === 'corps') setEnDeplacement(true)
      const suivant = pendantGlisser(g, p, e.shiftKey)
      editeur.modifier(() => suivant, g.cleHistorique)
    }
  }

  const surRelache = (e: EvenementPointeur<SVGSVGElement>) => {
    const g = glisser.current
    if (g && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (g?.genre === 'nouveauCadre') {
      const ecran = pointEcran(e)
      if (Math.abs(ecran.x - g.ecran.x) >= 6 && Math.abs(ecran.y - g.ecran.y) >= 6) {
        editeur.creerCadre(g.depart, versPlan(vue, ecran))
      } else {
        editeur.setMessage({ genre: 'info', texte: "Glissez pour tracer le cadre : appuyez à un coin, relâchez au coin opposé." })
      }
      setNouveauCadre(null)
    }
    glisser.current = null
    setEnDeplacement(false)
  }

  const curseurCss = enDeplacement
    ? 'grabbing'
    : outil === 'main' || espace
      ? 'grab'
      : outil === 'texte'
        ? 'text'
        : outil === 'selection'
          ? 'default'
          : 'crosshair'

  const epaisseurTrace = epaisseurParDefaut(projet)
  const fantome = trace && trace.length > 0 && curseur ? pointTrace(curseur.p, curseur.maj) : null
  const pointsTrace = trace ? enPoints(trace) : ''
  const voiesParId = new Map(projet.voies.map((v) => [v.id, v]))
  const estChoisi = (genre: Genre, id: string) => selection?.genre === genre && selection.id === id

  // Pose en cours (zone, BS, communication) : où le pointeur s'accrocherait.
  const tolerance = TOLERANCE_ACCROCHE / vue.zoom
  const accroche =
    curseur && voiesVisibles && (outil === 'zone' || outil === 'bs' || outil === 'communication')
      ? outil === 'zone' && pose
        ? accrocherVoie(projet.voies.filter((v) => v.id === pose.voieId), curseur.p, tolerance)
        : accrocherVoie(projet.voies, curseur.p, tolerance, pose?.voieId)
      : null
  const voiePose = pose ? voiesParId.get(pose.voieId) : undefined
  const pointPose = voiePose && pose ? pointAAbscisse(voiePose.points, pose.abscisse).point : null
  const rectangleEnCours = nouveauCadre ? normaliserRectangle(nouveauCadre.a, nouveauCadre.b) : null

  return (
    <svg
      ref={svgRef}
      style={{ display: 'block', width: '100%', height: '100%', cursor: curseurCss, touchAction: 'none' }}
      onPointerDown={surAppui}
      onPointerMove={surDeplacement}
      onPointerUp={surRelache}
      onPointerCancel={surRelache}
      onPointerLeave={() => setCurseur(null)}
      onDoubleClick={() => outil === 'voie' && editeur.terminer(4 / vue.zoom)}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="plan-de-travail"
    >
      <rect width="100%" height="100%" fill={COULEURS.autourDuPlan} />
      <g transform={`translate(${vue.dx} ${vue.dy}) scale(${vue.zoom})`}>
        <DessinPlan projet={projet} zoom={vue.zoom} estChoisi={estChoisi} />

        {/* Poignées de l'élément choisi. */}
        {poignees.map(({ cle, point }) => (
          <circle
            key={cle}
            cx={point.x}
            cy={point.y}
            r={RAYON_POIGNEE / vue.zoom}
            fill={selection?.genre === 'voie' && cle === `point-${selection.point}` ? COULEURS.selection : '#ffffff'}
            stroke={COULEURS.selection}
            strokeWidth={1.8 / vue.zoom}
            style={{ cursor: 'move' }}
            data-poignee={cle}
          />
        ))}

        {/* Zone en cours : la bande telle qu'elle sera. */}
        {pose?.outil === 'zone' && voiePose && accroche && (
          <DessinZone
            voie={voiePose}
            zone={{ id: '', nom: '', couleur: COULEUR_ZONE_PAR_DEFAUT, voieId: voiePose.id, debut: pose.abscisse, fin: accroche.abscisse }}
            cote="dessus"
            choisie={false}
            zoom={vue.zoom}
            apercu
          />
        )}
        {/* BS ou communication en cours : le biais qui suit le pointeur. */}
        {pose && pose.outil !== 'zone' && pointPose && curseur && (
          <line
            x1={pointPose.x}
            y1={pointPose.y}
            x2={(accroche?.point ?? curseur.p).x}
            y2={(accroche?.point ?? curseur.p).y}
            stroke={COULEURS.selection}
            strokeWidth={2 / vue.zoom}
            strokeDasharray={`${8 / vue.zoom} ${5 / vue.zoom}`}
          />
        )}
        {pointPose && (
          <circle cx={pointPose.x} cy={pointPose.y} r={RAYON_POIGNEE / vue.zoom} fill={COULEURS.selection} stroke="#ffffff" strokeWidth={1.5 / vue.zoom} />
        )}
        {/* Point d'accroche sous le pointeur. */}
        {accroche && (
          <circle
            cx={accroche.point.x}
            cy={accroche.point.y}
            r={RAYON_POIGNEE / vue.zoom}
            fill="#ffffff"
            stroke={COULEURS.selection}
            strokeWidth={2 / vue.zoom}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Cadre en cours de tracé. */}
        {rectangleEnCours && (
          <rect
            x={rectangleEnCours.x}
            y={rectangleEnCours.y}
            width={rectangleEnCours.largeur}
            height={rectangleEnCours.hauteur}
            fill={COULEURS.selection}
            fillOpacity={0.08}
            stroke={COULEURS.selection}
            strokeWidth={1.5 / vue.zoom}
            strokeDasharray={`${6 / vue.zoom} ${4 / vue.zoom}`}
          />
        )}

        {/* Tracé de voie en cours : la voie telle qu'elle sera, et le segment qui suit la souris. */}
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
