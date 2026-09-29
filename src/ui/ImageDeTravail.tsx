import { useEffect, useRef, useState, type PointerEvent as EvenementPointeur } from 'react'
import { accrocherVoie, poigneeSousPointeur, zoneSousPointeur } from '../plan/detection.ts'
import {
  ajouterEngin,
  ajouterRame,
  angleVers,
  enginSousPointeur,
  glisserEnginLibre,
  placerEnginSurVoie,
  placerRame,
  poigneesEngin,
  tournerEngin,
  vehiculesDeGroupes,
  type PositionEngin,
  type ReferenceEngin,
} from '../plan/engins.ts'
import {
  deplacerFleche,
  deplacerPointFleche,
  flecheSousPointeur,
  geometrieFleche,
  pointDeTrace,
  uniteFleche,
  type Fleche,
} from '../plan/fleches.ts'
import { contraindre } from '../plan/geometrie.ts'
import { enPoints } from '../plan/dessin.ts'
import type { Point } from '../plan/projet.ts'
import { miseEnPage } from '../plan/planche.ts'
import type { PlanImage } from '../plan/synoptique.ts'
import { projeterSurPolyligne } from '../plan/trace.ts'
import { ajusterSurRectangle, deplacer, facteurMolette, versPlan, zoomerAutour, type Vue } from '../plan/vue.ts'
import { COULEURS } from './couleurs.ts'
import { DessinEngin, DessinRame } from './DessinEngins.tsx'
import { TraceFleche } from './DessinFleches.tsx'
import { DessinPlanche } from './Planche.tsx'
import type { EditeurImage } from './useEditeurImage.ts'

// L'image courante d'un synoptique, qu'on modifie, mise en page comme une
// planche (bandeau, créneau, encart PHASAGE) : le plan figé, limité au
// cadrage, ses zones selon leur état — un clic choisit une zone, pour changer
// son état dans le panneau — et par-dessus ses engins et ses rames, qu'on
// pose, choisit et glisse, et ses flèches, qu'on trace point par point, dont
// on glisse les points ou toute la flèche. Molette : zoom ; Main, Espace ou
// clic molette : déplacer la vue.
// Tolérances en pixels d'écran, donc identiques à tout zoom.
const TOLERANCE_ELEMENT = 6
const TOLERANCE_ACCROCHE = 12
const TOLERANCE_POIGNEE = 9
const RAYON_POIGNEE = 5.5
const SEUIL_GLISSER = 3
const MARGE_ECRAN = 24

type Glisser =
  | { genre: 'vue'; x: number; y: number }
  | { genre: 'rotation'; ref: ReferenceEngin; origine: PlanImage; cle: string }
  | { genre: 'corps'; ref: ReferenceEngin; depart: Point; ecran: Point; origine: PlanImage; cle: string }
  | { genre: 'fleche'; id: string; depart: Point; ecran: Point; origine: Fleche[]; cle: string }
  | { genre: 'pointFleche'; id: string; indice: number; origine: Fleche[]; cle: string }

let compteurGlisser = 0

const dansRectangle = (r: { x: number; y: number; largeur: number; hauteur: number }, p: Point): boolean =>
  p.x >= r.x && p.x <= r.x + r.largeur && p.y >= r.y && p.y <= r.y + r.hauteur

export function ImageDeTravail({ editeur }: { editeur: EditeurImage }) {
  const { synoptique: s, planche, outil, selection, espace, calque, setVue } = editeur
  const svgRef = useRef<SVGSVGElement>(null)
  const glisser = useRef<Glisser | null>(null)
  const [taille, setTaille] = useState({ largeur: 0, hauteur: 0 })
  const [curseur, setCurseur] = useState<Point | null>(null)
  const [curseurMaj, setCurseurMaj] = useState(false)
  const [enDeplacement, setEnDeplacement] = useState(false)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observateur = new ResizeObserver(([e]) => setTaille({ largeur: e.contentRect.width, hauteur: e.contentRect.height }))
    observateur.observe(svg)
    return () => observateur.disconnect()
  }, [])

  const page = miseEnPage(s, editeur.index, editeur.listes)
  const cadre = page.carte
  // Vue « null » = ajustée sur toute la planche (plan, bandeau, créneau, phasage).
  const vue: Vue = editeur.vue ?? ajusterSurRectangle(page.planche, taille, MARGE_ECRAN)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const surMolette = (e: WheelEvent) => {
      e.preventDefault()
      const r = svg.getBoundingClientRect()
      setVue(zoomerAutour(vue, { x: e.clientX - r.left, y: e.clientY - r.top }, facteurMolette(e.deltaY)))
    }
    svg.addEventListener('wheel', surMolette, { passive: false })
    return () => svg.removeEventListener('wheel', surMolette)
  }, [vue, setVue])

  const pointEcran = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // Les engins et les flèches se choisissent si leur calque est visible et non verrouillé.
  const actif = calque.visible && !calque.verrouille
  const flechesActives = editeur.calqueFleches.visible && !editeur.calqueFleches.verrouille
  const poignees = outil === 'selection' && selection && actif ? poigneesEngin(planche, selection) : []
  const fleche = editeur.fleche
  const poigneesFleche = outil === 'selection' && fleche && flechesActives ? fleche.points.map((point, i) => ({ cle: `point-${i}`, point })) : []
  const unite = uniteFleche(planche)

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
    if (outil === 'fleche') {
      if (!dansRectangle(cadre, p)) {
        editeur.setMessage({ genre: 'erreur', texte: "Cliquez dans le cadre de l'image : ce qui est tracé en dehors ne se verrait pas." })
        return
      }
      editeur.ajouterPointTrace(p, e.shiftKey)
      return
    }
    if (outil === 'engin' || outil === 'rame') {
      if (!dansRectangle(cadre, p)) {
        editeur.setMessage({ genre: 'erreur', texte: "Cliquez dans le cadre de l'image : ce qui est posé en dehors ne se verrait pas." })
        return
      }
      if (outil === 'engin') editeur.poserEngin(p, TOLERANCE_ACCROCHE / vue.zoom)
      else editeur.poserRame(p, TOLERANCE_ACCROCHE / vue.zoom)
      return
    }
    if (outil !== 'selection') return
    if (selection && poigneeSousPointeur(poignees, p, TOLERANCE_POIGNEE / vue.zoom)) {
      glisser.current = { genre: 'rotation', ref: selection, origine: planche, cle: `glisser:${++compteurGlisser}` }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    // Un point de la flèche choisie, puis une flèche (dessinées au-dessus des engins).
    const poigneeFleche = fleche ? poigneeSousPointeur(poigneesFleche, p, TOLERANCE_POIGNEE / vue.zoom) : null
    if (fleche && poigneeFleche) {
      const indice = Number(poigneeFleche.replace('point-', ''))
      glisser.current = { genre: 'pointFleche', id: fleche.id, indice, origine: planche.fleches, cle: `glisser:${++compteurGlisser}` }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    const idFleche = flechesActives ? flecheSousPointeur(planche.fleches, editeur.typesFleches, unite, p, TOLERANCE_ELEMENT / vue.zoom) : null
    if (idFleche) {
      editeur.choisirFleche(idFleche)
      glisser.current = { genre: 'fleche', id: idFleche, depart: p, ecran, origine: planche.fleches, cle: `glisser:${++compteurGlisser}` }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    const ref = actif ? enginSousPointeur(planche, p, TOLERANCE_ELEMENT / vue.zoom) : null
    if (!ref) {
      // Pas d'engin : une zone de travaux, pour changer son état (elle ne se glisse pas).
      const zone = planche.calques.zones.visible && dansRectangle(cadre, p) ? zoneSousPointeur(planche, p, TOLERANCE_ELEMENT / vue.zoom) : null
      if (zone) editeur.choisirZone(zone)
      else editeur.toutDeselectionner()
      return
    }
    editeur.choisir(ref)
    glisser.current = { genre: 'corps', ref, depart: p, ecran, origine: planche, cle: `glisser:${++compteurGlisser}` }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  // Nouvel état pendant qu'on glisse, calculé depuis l'état de départ : un
  // engin sur voie et une rame glissent le long de leur voie, un engin libre
  // se déplace ; la poignée ronde tourne un engin libre (Maj : pas de 15°).
  const pendantGlisser = (g: Extract<Glisser, { genre: 'rotation' | 'corps' }>, p: Point, maj: boolean): PlanImage => {
    const { origine, ref } = g
    const voieDe = (voieId: string) => origine.voies.find((v) => v.id === voieId)?.points ?? []
    if (g.genre === 'rotation') {
      const engin = origine.engins.find((x) => x.id === ref.id)
      if (engin?.position.genre !== 'libre') return origine
      return tournerEngin(origine, ref.id, angleVers(engin.position, p, maj ? 15 : 0))
    }
    if (ref.genre === 'engin') {
      const engin = origine.engins.find((x) => x.id === ref.id)
      if (!engin) return origine
      if (engin.position.genre !== 'voie') return glisserEnginLibre(origine, ref.id, { x: p.x - g.depart.x, y: p.y - g.depart.y })
      const points = voieDe(engin.position.voieId)
      const glisse = projeterSurPolyligne(points, p).abscisse - projeterSurPolyligne(points, g.depart).abscisse
      return placerEnginSurVoie(origine, ref.id, engin.position.abscisse + glisse)
    }
    const rame = origine.rames.find((r) => r.id === ref.id)
    if (!rame) return origine
    const points = voieDe(rame.voieId)
    const glisse = projeterSurPolyligne(points, p).abscisse - projeterSurPolyligne(points, g.depart).abscisse
    return placerRame(origine, ref.id, rame.abscisse + glisse)
  }

  const surDeplacement = (e: EvenementPointeur<SVGSVGElement>) => {
    const ecran = pointEcran(e)
    const p = versPlan(vue, ecran)
    setCurseur(p)
    setCurseurMaj(e.shiftKey)
    const g = glisser.current
    if (!g) return
    if (g.genre === 'vue') {
      setVue(deplacer(vue, ecran.x - g.x, ecran.y - g.y))
      glisser.current = { genre: 'vue', x: ecran.x, y: ecran.y }
      return
    }
    if ((g.genre === 'corps' || g.genre === 'fleche') && Math.hypot(ecran.x - g.ecran.x, ecran.y - g.ecran.y) < SEUIL_GLISSER) return
    setEnDeplacement(true)
    if (g.genre === 'fleche') {
      const decalage = { x: p.x - g.depart.x, y: p.y - g.depart.y }
      editeur.modifierFleches(() => deplacerFleche(g.origine, g.id, decalage), g.cle)
      return
    }
    if (g.genre === 'pointFleche') {
      // Maj : le point reste à l'horizontale, à la verticale ou à 45° de son voisin.
      const points = g.origine.find((f) => f.id === g.id)?.points ?? []
      const voisin = points[g.indice - 1] ?? points[g.indice + 1]
      const cible = e.shiftKey && voisin ? contraindre(voisin, p) : p
      editeur.modifierFleches(() => deplacerPointFleche(g.origine, g.id, g.indice, cible), g.cle)
      return
    }
    const suivante = pendantGlisser(g, p, e.shiftKey)
    editeur.modifier(() => suivante, g.cle)
  }

  const surRelache = (e: EvenementPointeur<SVGSVGElement>) => {
    if (glisser.current && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    glisser.current = null
    setEnDeplacement(false)
  }

  const curseurCss = enDeplacement ? 'grabbing' : outil === 'main' || espace ? 'grab' : outil === 'selection' ? 'default' : 'crosshair'

  // Flèche en cours de tracé : telle qu'elle sera, jusqu'au pointeur (Maj : contrainte).
  const trace = editeur.trace
  const typeTrace = editeur.typeFleche
  const traceFleche = (() => {
    if (outil !== 'fleche' || !typeTrace) return null
    const points = trace && curseur ? [...trace, pointDeTrace(trace, curseur, curseurMaj)] : trace
    const g = points ? geometrieFleche(points, typeTrace, unite) : null
    return (
      <g style={{ pointerEvents: 'none' }} data-testid="trace-fleche">
        {g && (
          <g opacity={0.75}>
            <TraceFleche g={g} couleur={typeTrace.couleur} unite={unite} />
          </g>
        )}
        {trace && (
          <polyline
            points={enPoints(trace)}
            fill="none"
            stroke={COULEURS.selection}
            strokeWidth={1 / vue.zoom}
            strokeDasharray={`${5 / vue.zoom} ${4 / vue.zoom}`}
          />
        )}
        {trace?.map((q, i) => (
          <rect
            key={i}
            x={q.x - 3.5 / vue.zoom}
            y={q.y - 3.5 / vue.zoom}
            width={7 / vue.zoom}
            height={7 / vue.zoom}
            fill="#ffffff"
            stroke={COULEURS.selection}
            strokeWidth={1.6 / vue.zoom}
          />
        ))}
      </g>
    )
  })()

  // Pose en cours : où le pointeur s'accrocherait, et l'aperçu de ce qui serait posé.
  const tolerance = TOLERANCE_ACCROCHE / vue.zoom
  const posant = (outil === 'engin' || outil === 'rame') && s.echelle !== null
  const accroche = curseur && posant && planche.calques.voies.visible ? accrocherVoie(planche.voies, curseur, tolerance) : null
  const apercu = (() => {
    if (!curseur || !posant || enDeplacement || !dansRectangle(cadre, curseur)) return null
    if (outil === 'engin' && editeur.typeChoisi) {
      const position: PositionEngin = accroche
        ? { genre: 'voie', voieId: accroche.voieId, abscisse: accroche.abscisse }
        : { genre: 'libre', x: curseur.x, y: curseur.y, angle: 0 }
      const { planche: avec, id } = ajouterEngin(planche, editeur.typeChoisi, position)
      return <DessinEngin projet={avec} engin={avec.engins.find((x) => x.id === id)!} choisi={false} zoom={vue.zoom} apercu />
    }
    const vehicules = vehiculesDeGroupes(editeur.composition)
    if (outil === 'rame' && accroche && vehicules.length > 0) {
      const { planche: avec, id } = ajouterRame(planche, vehicules, accroche.voieId, accroche.abscisse)
      return <DessinRame projet={avec} rame={avec.rames.find((r) => r.id === id)!} choisie={false} zoom={vue.zoom} apercu />
    }
    return null
  })()
  const estChoisi = (ref: ReferenceEngin) => selection?.genre === ref.genre && selection.id === ref.id

  return (
    <svg
      ref={svgRef}
      style={{ display: 'block', width: '100%', height: '100%', cursor: curseurCss, touchAction: 'none' }}
      onPointerDown={surAppui}
      onPointerMove={surDeplacement}
      onPointerUp={surRelache}
      onPointerCancel={surRelache}
      onPointerLeave={() => setCurseur(null)}
      onDoubleClick={() => outil === 'fleche' && editeur.terminerFleche(4 / vue.zoom)}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="image-synoptique"
    >
      <rect width="100%" height="100%" fill={COULEURS.autourDuPlan} />
      {taille.largeur > 0 && (
        <g transform={`translate(${vue.dx} ${vue.dy}) scale(${vue.zoom})`}>
          <DessinPlanche
            synoptique={s}
            index={editeur.index}
            listes={editeur.listes}
            zoom={vue.zoom}
            estChoisi={estChoisi}
            zoneChoisie={editeur.zone?.id ?? null}
            flecheChoisie={fleche?.id ?? null}
            surLaCarte={
              <>
                {apercu && <g style={{ pointerEvents: 'none' }}>{apercu}</g>}
                {traceFleche}
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
              </>
            }
          />
          {poigneesFleche.map(({ cle, point }) => (
            <circle
              key={cle}
              cx={point.x}
              cy={point.y}
              r={RAYON_POIGNEE / vue.zoom}
              fill="#ffffff"
              stroke={COULEURS.selection}
              strokeWidth={1.8 / vue.zoom}
              style={{ cursor: 'move' }}
              data-poignee={`fleche-${cle}`}
            />
          ))}
          {poignees.map(({ cle, point }) => (
            <circle
              key={cle}
              cx={point.x}
              cy={point.y}
              r={RAYON_POIGNEE / vue.zoom}
              fill="#ffffff"
              stroke={COULEURS.selection}
              strokeWidth={1.8 / vue.zoom}
              style={{ cursor: 'move' }}
              data-poignee={cle}
            />
          ))}
        </g>
      )}
    </svg>
  )
}
