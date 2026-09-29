import { useId, type ReactNode } from 'react'
import type { ReferenceEngin } from '../plan/engins.ts'
import type { EtatVoie } from '../plan/etatsVoie.ts'
import { miseEnPage, type LigneTexte } from '../plan/planche.ts'
import { projetDeImage, type Synoptique } from '../plan/synoptique.ts'
import { COULEURS } from './couleurs.ts'
import { BarreEchelle, DessinEnginsImage } from './DessinEngins.tsx'
import { DessinPlan } from './DessinPlan.tsx'

// Une image de synoptique dessinée comme une planche du commanditaire : le
// plan figé limité au cadrage, avec ses zones selon leur état et ses engins ;
// au-dessus, le bandeau de titre (fond bleu clair) et le créneau horaire
// (fond gris clair, bord rouge) ; au-dessous à gauche, l'encart PHASAGE.
// Sert à l'image qu'on modifie et aux vignettes. Coordonnées en pixels du
// plan ; `zoom` garde constants à l'écran les repères de sélection.

// Couleurs relevées sur les planches du commanditaire.
const COULEURS_PLANCHE = {
  fondBandeau: '#e4eff9',
  bordBandeau: '#1f4e8c',
  fondCreneau: '#efefef',
  bordCreneau: '#e0201b',
  entetePhasage: '#76726f',
  fondPhasage: '#ececec',
  textePhasage: '#3c3c3c',
} as const

const POLICE_PLANCHE = 'system-ui, -apple-system, "Segoe UI", Verdana, sans-serif'

function Lignes({ lignes, ancre, couleur }: { lignes: LigneTexte[]; ancre: 'start' | 'middle'; couleur: string }) {
  return (
    <>
      {lignes.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          fontSize={l.taille}
          fontWeight={l.gras ? 700 : 400}
          textAnchor={ancre}
          fill={couleur}
          fontFamily={POLICE_PLANCHE}
          style={{ userSelect: 'none', whiteSpace: 'pre' }}
        >
          {l.texte}
        </text>
      ))}
    </>
  )
}

export function DessinPlanche(props: {
  synoptique: Synoptique
  index: number
  etatsVoie: EtatVoie[]
  zoom: number
  estChoisi?: (ref: ReferenceEngin) => boolean
  zoneChoisie?: string | null
  // Dessiné sur le plan, dans le cadrage (aperçu de pose, point d'accroche).
  surLaCarte?: ReactNode
}) {
  const { synoptique: s, index, zoom } = props
  const idClip = useId()
  const image = s.images[index]
  const planche = projetDeImage(s, image)
  const page = miseEnPage(s, index)
  const { carte } = page
  const trait = Math.max(1 / zoom, carte.largeur / 700)
  return (
    <g data-testid="planche">
      <rect x={page.planche.x} y={page.planche.y} width={page.planche.largeur} height={page.planche.hauteur} fill="#ffffff" />
      <clipPath id={idClip}>
        <rect x={carte.x} y={carte.y} width={carte.largeur} height={carte.hauteur} />
      </clipPath>
      <g clipPath={`url(#${idClip})`}>
        <rect x={carte.x} y={carte.y} width={carte.largeur} height={carte.hauteur} fill="#ffffff" />
        <DessinPlan
          projet={planche}
          zoom={zoom}
          affiche={carte}
          etats={{ liste: props.etatsVoie, parZone: image.contenu.etatsZones }}
          estChoisi={(genre, id) => genre === 'zone' && id === props.zoneChoisie}
          engins={
            <DessinEnginsImage
              projet={planche}
              visible={s.calqueEngins.visible}
              zoom={zoom}
              estChoisi={props.estChoisi}
            />
          }
        />
        {/* Échelle graphique de la planche, en bas à droite du plan. */}
        {s.echelle && (
          <BarreEchelle
            x={carte.x + carte.largeur - carte.largeur * 0.015}
            y={carte.y + carte.hauteur - carte.largeur * 0.015}
            unitesParMetre={s.echelle.pixelsParMetre}
            longueurMax={carte.largeur * 0.2}
            taille={carte.largeur / 90}
            ancre="droite"
          />
        )}
        {props.surLaCarte}
      </g>
      <rect x={carte.x} y={carte.y} width={carte.largeur} height={carte.hauteur} fill="none" stroke={COULEURS.bordFeuille} strokeWidth={1 / zoom} />

      {page.bandeau && (
        <g data-testid="bandeau-titre">
          <rect
            x={page.bandeau.boite.x}
            y={page.bandeau.boite.y}
            width={page.bandeau.boite.largeur}
            height={page.bandeau.boite.hauteur}
            fill={COULEURS_PLANCHE.fondBandeau}
            stroke={COULEURS_PLANCHE.bordBandeau}
            strokeWidth={trait * 2.2}
          />
          <Lignes lignes={page.bandeau.lignes} ancre="middle" couleur={COULEURS.texte} />
        </g>
      )}

      <g data-testid="creneau">
        <rect
          x={page.creneau.boite.x}
          y={page.creneau.boite.y}
          width={page.creneau.boite.largeur}
          height={page.creneau.boite.hauteur}
          fill={COULEURS_PLANCHE.fondCreneau}
          stroke={COULEURS_PLANCHE.bordCreneau}
          strokeWidth={trait * 2.6}
        />
        <Lignes lignes={page.creneau.lignes} ancre="middle" couleur={COULEURS.texte} />
      </g>

      {page.phasage && (
        <g data-testid="encart-phasage">
          <rect
            x={page.phasage.boite.x}
            y={page.phasage.boite.y}
            width={page.phasage.boite.largeur}
            height={page.phasage.boite.hauteur}
            fill={COULEURS_PLANCHE.fondPhasage}
          />
          <rect
            x={page.phasage.entete.x}
            y={page.phasage.entete.y}
            width={page.phasage.entete.largeur}
            height={page.phasage.entete.hauteur}
            fill={COULEURS_PLANCHE.entetePhasage}
          />
          <Lignes lignes={[page.phasage.titre]} ancre="middle" couleur="#ffffff" />
          <Lignes lignes={page.phasage.lignes} ancre="start" couleur={COULEURS_PLANCHE.textePhasage} />
        </g>
      )}

      <rect
        x={page.planche.x}
        y={page.planche.y}
        width={page.planche.largeur}
        height={page.planche.hauteur}
        fill="none"
        stroke={COULEURS.bordFeuille}
        strokeWidth={1 / zoom}
      />
    </g>
  )
}
