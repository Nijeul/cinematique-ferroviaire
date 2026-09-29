import { enPoints } from '../plan/dessin.ts'
import {
  dimensionsFleche,
  geometrieFleche,
  positionLibelle,
  tailleLibelleFleche,
  typeFlecheParId,
  uniteFleche,
  type Fleche,
  type GeometrieFleche,
  type TypeFleche,
} from '../plan/fleches.ts'
import type { Point } from '../plan/projet.ts'
import type { PlanImage } from '../plan/synoptique.ts'
import { COULEURS } from './couleurs.ts'

// Dessin des flèches d'une image de synoptique : trait plein, pointillé ou
// double, pointes en triangle proportionnées à l'épaisseur, libellé
// facultatif le long de la flèche. Un liseré blanc sous le trait la détache
// d'un fond chargé (photo aérienne). Et l'aperçu d'un type de flèche, pour la
// page du chantier, les panneaux et la légende.

// Largeur du liseré blanc, en points de flèche.
const LISERE = 1.6

// Une flèche calculée : liseré blanc, puis traits et pointes de sa couleur.
export function TraceFleche({ g, couleur, unite }: { g: GeometrieFleche; couleur: string; unite: number }) {
  const tirets = g.tirets ? g.tirets.join(' ') : undefined
  const lisere = LISERE * unite
  return (
    <g>
      <g stroke="#ffffff" strokeOpacity={0.85} fill="none" strokeLinejoin="miter" strokeMiterlimit={4}>
        {g.traits.map((l, i) => (
          <polyline key={i} points={enPoints(l)} strokeWidth={g.trait + lisere} strokeDasharray={tirets} />
        ))}
        {g.pointes.map((t, i) => (
          <polygon key={i} points={enPoints(t)} fill="#ffffff" fillOpacity={0.85} strokeWidth={lisere} strokeLinejoin="round" />
        ))}
      </g>
      {g.traits.map((l, i) => (
        <polyline
          key={i}
          points={enPoints(l)}
          fill="none"
          stroke={couleur}
          strokeWidth={g.trait}
          strokeLinejoin="miter"
          strokeMiterlimit={4}
          strokeDasharray={tirets}
          data-testid="trait-fleche"
        />
      ))}
      {g.pointes.map((t, i) => (
        <polygon key={i} points={enPoints(t)} fill={couleur} data-testid="pointe-fleche" />
      ))}
    </g>
  )
}

const halo = { stroke: '#ffffff', paintOrder: 'stroke', strokeLinejoin: 'round', style: { userSelect: 'none' } } as const

export function DessinFleche(props: {
  fleche: Fleche
  type: TypeFleche
  unite: number
  tailleLibelle: number
  choisie: boolean
  zoom: number
}) {
  const { fleche, type, unite, tailleLibelle, choisie, zoom } = props
  const g = geometrieFleche(fleche.points, type, unite)
  if (!g) return null
  const libelle = fleche.libelle.trim()
  const largeur = Math.max(g.corps, g.pointes.length > 0 ? g.largeurPointe : 0)
  const position = libelle ? positionLibelle(fleche.points, largeur, tailleLibelle) : null
  return (
    <g
      data-testid="fleche"
      data-fleche={fleche.id}
      data-type={type.nom}
      data-couleur={type.couleur}
      data-trait={type.trait}
    >
      {choisie && (
        <polyline
          points={enPoints(fleche.points)}
          fill="none"
          stroke={COULEURS.selection}
          strokeOpacity={0.45}
          strokeWidth={largeur + 10 / zoom}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <TraceFleche g={g} couleur={type.couleur} unite={unite} />
      {position && (
        <text
          x={position.x}
          y={position.y}
          transform={`rotate(${position.angle} ${position.x} ${position.y})`}
          fontSize={tailleLibelle}
          fontWeight={700}
          textAnchor="middle"
          fill={COULEURS.texte}
          strokeWidth={tailleLibelle * 0.25}
          data-testid="libelle-fleche"
          {...halo}
        >
          {libelle}
        </text>
      )}
    </g>
  )
}

// Toutes les flèches d'une image ; rien quand le calque « Flèches » est masqué.
export function DessinFlechesImage(props: { planche: PlanImage; types: TypeFleche[]; visible: boolean; zoom: number; choisie?: string | null }) {
  const { planche, types, zoom } = props
  if (!props.visible) return null
  const unite = uniteFleche(planche)
  const taille = tailleLibelleFleche(planche)
  return (
    <g data-testid="calque-fleches-dessin">
      {planche.fleches.map((f) => {
        const type = typeFlecheParId(types, f.typeId)
        return type ? (
          <DessinFleche key={f.id} fleche={f} type={type} unite={unite} tailleLibelle={taille} choisie={props.choisie === f.id} zoom={zoom} />
        ) : null
      })}
    </g>
  )
}

// Une flèche du type, horizontale, de gauche à droite dans le rectangle
// (x, y, largeur, hauteur), à sa vraie épaisseur `unite` si elle tient dans
// la hauteur, amincie sinon.
export function EchantillonFleche(props: { type: TypeFleche; x: number; y: number; largeur: number; hauteur: number; unite: number }) {
  const { type, x, y, largeur, hauteur } = props
  const d = dimensionsFleche(type, 1)
  const epaisseurMax = Math.max(d.corps, type.pointes === 'aucune' ? 0 : d.largeurPointe)
  const unite = Math.min(props.unite, (hauteur * 0.95) / epaisseurMax)
  const milieu = y + hauteur / 2
  const points: Point[] = [
    { x, y: milieu },
    { x: x + largeur, y: milieu },
  ]
  const g = geometrieFleche(points, type, unite)
  return g ? <TraceFleche g={g} couleur={type.couleur} unite={unite} /> : null
}

// Aperçu d'un type de flèche, pour la page du chantier et les panneaux.
export function ApercuFleche({ type, largeur = 52, hauteur = 18 }: { type: TypeFleche; largeur?: number; hauteur?: number }) {
  return (
    <svg width={largeur} height={hauteur} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true" data-testid="apercu-type-fleche">
      <EchantillonFleche type={type} x={3} y={1} largeur={largeur - 6} hauteur={hauteur - 2} unite={1.6} />
    </svg>
  )
}
