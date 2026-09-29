import { formaterMetres, longueurGraduee } from '../plan/echelle.ts'
import {
  couleurTexteSur,
  etiquetteRame,
  libelleARetourner,
  positionEtiquetteRame,
  positionPastille,
  rayonPastille,
  silhouetteEngin,
  silhouetteRame,
  tailleLibelle,
  type Engin,
  type Planche,
  type Rame,
  type ReferenceEngin,
  type Silhouette,
} from '../plan/engins.ts'
import { enPoints, largeurTexteEstimee } from '../plan/dessin.ts'
import { tailleNom } from '../plan/geometrie.ts'
import { epaisseurParDefaut, type Point } from '../plan/projet.ts'
import { COULEURS } from './couleurs.ts'

// Dessin des engins et des rames d'une image de synoptique, à l'échelle : rectangle de la
// couleur de la catégorie, contour sombre fin, modèle écrit dedans quand il
// tient, pastille ronde à numéro au-dessus. Et l'échelle graphique « 0 — 50 m ».

const halo = { stroke: '#ffffff', paintOrder: 'stroke', strokeLinejoin: 'round', style: { userSelect: 'none' } } as const

// Un véhicule ou un engin : le rectangle, et le modèle écrit dedans.
function Caisse({ s, couleur, modele, id }: { s: Silhouette; couleur: string; modele: string; id: string }) {
  const taille = tailleLibelle(modele, s.longueur, s.largeur)
  const dehors = s.depassement > 0
  return (
    <g transform={`translate(${s.centre.x} ${s.centre.y}) rotate(${s.angle})`} data-engin={id} data-modele={modele}>
      <rect
        x={-s.longueur / 2}
        y={-s.largeur / 2}
        width={s.longueur}
        height={s.largeur}
        fill={couleur}
        stroke={dehors ? COULEURS.erreur : COULEURS.texte}
        strokeWidth={s.largeur * (dehors ? 0.14 : 0.08)}
        strokeDasharray={dehors ? `${s.largeur * 0.45} ${s.largeur * 0.3}` : undefined}
        data-testid="caisse"
      />
      {taille !== null && (
        <text
          transform={libelleARetourner(s.angle) ? 'rotate(180)' : undefined}
          fontSize={taille}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          fill={couleurTexteSur(couleur)}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {modele}
        </text>
      )}
    </g>
  )
}

function Pastille({ centre, rayon, couleur, texte }: { centre: Point; rayon: number; couleur: string; texte: string }) {
  const taille = rayon * (texte.length > 2 ? 0.85 : 1.15)
  return (
    <g data-testid="pastille">
      <circle cx={centre.x} cy={centre.y} r={rayon} fill={couleur} stroke={COULEURS.texte} strokeWidth={rayon * 0.14} />
      <text
        x={centre.x}
        y={centre.y}
        fontSize={taille}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        fill={couleurTexteSur(couleur)}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {texte}
      </text>
    </g>
  )
}

// Contour bleu de l'élément choisi.
function Choix({ coins, zoom }: { coins: Point[]; zoom: number }) {
  return (
    <polygon
      points={enPoints(coins)}
      fill="none"
      stroke={COULEURS.selection}
      strokeOpacity={0.5}
      strokeWidth={8 / zoom}
      strokeLinejoin="round"
    />
  )
}

export function DessinEngin(props: { projet: Planche; engin: Engin; choisi: boolean; zoom: number; apercu?: boolean }) {
  const { projet, engin, choisi, zoom } = props
  const s = silhouetteEngin(projet, engin)
  if (!s) return null
  return (
    <g opacity={props.apercu ? 0.65 : 1} data-testid={props.apercu ? 'apercu-engin' : 'engin'}>
      {choisi && <Choix coins={s.coins} zoom={zoom} />}
      <Caisse s={s} couleur={engin.couleur} modele={engin.type.modele} id={engin.id} />
      {engin.numero.trim() !== '' && (
        <Pastille centre={positionPastille(s, rayonPastille(projet))} rayon={rayonPastille(projet)} couleur={engin.couleur} texte={engin.numero.trim()} />
      )}
    </g>
  )
}

export function DessinRame(props: { projet: Planche; rame: Rame; choisie: boolean; zoom: number; apercu?: boolean }) {
  const { projet, rame, choisie, zoom } = props
  const s = silhouetteRame(projet, rame)
  if (!s) return null
  const rayon = rayonPastille(projet)
  const taille = tailleNom(epaisseurParDefaut(projet)) * 0.72
  // Étiquette au milieu de la rame, à l'extérieur de la courbe, sans
  // chevaucher de véhicule ; sous une rame droite (la pastille est au-dessus
  // de la tête).
  const texte = etiquetteRame(rame)
  const etiquette = positionEtiquetteRame(s, taille, largeurTexteEstimee(texte, taille, true))
  return (
    <g opacity={props.apercu ? 0.65 : 1} data-testid={props.apercu ? 'apercu-rame' : 'rame'} data-rame={rame.id}>
      {choisie && s.vehicules.map((v, i) => <Choix key={i} coins={v.coins} zoom={zoom} />)}
      {s.vehicules.map((v, i) => (
        <Caisse key={i} s={v} couleur={rame.vehicules[i].type.couleur} modele={rame.vehicules[i].type.modele} id={`${rame.id}-${i + 1}`} />
      ))}
      {!props.apercu && (
        <text
          x={etiquette.x}
          y={etiquette.y}
          fontSize={taille}
          fontWeight={600}
          textAnchor="middle"
          fill={s.depassement > 0 ? COULEURS.erreur : COULEURS.texte}
          strokeWidth={taille * 0.25}
          data-testid="etiquette-rame"
          {...halo}
        >
          {texte}
          {s.depassement > 0 ? ' ⚠' : ''}
        </text>
      )}
      {rame.numero.trim() !== '' && (
        <Pastille centre={positionPastille(s.vehicules[0], rayon)} rayon={rayon} couleur={rame.couleur} texte={rame.numero.trim()} />
      )}
    </g>
  )
}

// Tous les engins et rames d'une image (les rames dessous, les engins
// dessus) ; rien sans échelle ou quand le calque « Engins » est masqué.
export function DessinEnginsImage(props: {
  projet: Planche
  visible: boolean
  zoom: number
  estChoisi?: (ref: ReferenceEngin) => boolean
}) {
  const { projet, zoom } = props
  const estChoisi = props.estChoisi ?? (() => false)
  if (!props.visible || !projet.echelle) return null
  return (
    <g data-testid="calque-engins-dessin">
      {projet.rames.map((rame) => (
        <DessinRame key={rame.id} projet={projet} rame={rame} choisie={estChoisi({ genre: 'rame', id: rame.id })} zoom={zoom} />
      ))}
      {projet.engins.map((engin) => (
        <DessinEngin key={engin.id} projet={projet} engin={engin} choisi={estChoisi({ genre: 'engin', id: engin.id })} zoom={zoom} />
      ))}
    </g>
  )
}

// Échelle graphique : barre noire et blanche, « 0 » à gauche, « 50 m » à
// droite. (x, y) : coin bas de la barre, à droite ou à gauche selon `ancre`.
// Unités au choix : pixels d'écran (plan de travail) ou unités du plan
// (images d'un synoptique).
export function BarreEchelle(props: {
  x: number
  y: number
  unitesParMetre: number
  longueurMax: number
  taille: number
  ancre: 'gauche' | 'droite'
}) {
  const { unitesParMetre, longueurMax, taille } = props
  const { metres, longueur } = longueurGraduee(unitesParMetre, longueurMax)
  const h = taille * 0.5
  const x0 = props.ancre === 'droite' ? props.x - longueur : props.x
  const y = props.y
  const trait = taille * 0.09
  const marge = taille * 0.5
  return (
    <g data-testid="echelle-graphique" data-metres={metres} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <rect
        x={x0 - marge}
        y={y - h - taille * 1.45}
        width={longueur + 2 * marge}
        height={h + taille * 1.45 + marge * 0.8}
        rx={taille * 0.25}
        fill="#ffffff"
        fillOpacity={0.88}
        stroke={COULEURS.bordure}
        strokeWidth={trait}
      />
      <rect x={x0} y={y - h} width={longueur / 2} height={h} fill={COULEURS.texte} />
      <rect x={x0 + longueur / 2} y={y - h} width={longueur / 2} height={h} fill="#ffffff" />
      <rect x={x0} y={y - h} width={longueur} height={h} fill="none" stroke={COULEURS.texte} strokeWidth={trait} data-testid="barre-echelle" />
      <text x={x0} y={y - h - taille * 0.35} fontSize={taille} textAnchor="start" fill={COULEURS.texte}>
        0
      </text>
      <text x={x0 + longueur} y={y - h - taille * 0.35} fontSize={taille} fontWeight={700} textAnchor="end" fill={COULEURS.texte}>
        {formaterMetres(metres)}
      </text>
    </g>
  )
}
