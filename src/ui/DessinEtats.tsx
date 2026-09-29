import { useId } from 'react'
import { enPoints, etiquetteZone, largeurBandeZone, tailleEtiquetteZone, type Cote } from '../plan/dessin.ts'
import { FOND_BALLAST, motifBallast, TEINTES_CAILLOUX, type EtatVoie } from '../plan/etatsVoie.ts'
import { decouperZone, traitDuFront, type EtatZoneResolu } from '../plan/etatsZones.ts'
import { COULEUR_ZONE_PAR_DEFAUT, type Voie, type Zone } from '../plan/projet.ts'
import { bandeAutour, sousPolyligne } from '../plan/trace.ts'
import { COULEURS } from './couleurs.ts'

// Dessin des zones de travaux d'une image selon leur état : couleur propre
// de la zone (avant travaux), aplat de couleur, ou texture de gravier gris
// (avec un voile de couleur pour la voie neuve). Une zone en partie avancée
// est coupée le long de la voie, courbes comprises, et un trait marque le
// front. Et le petit aperçu d'un état, pour les listes et la palette.

const CAILLOUX = motifBallast()
const CONTOUR_ETAT = '#3a3d40'
const OPACITE_VOILE = 0.6

const halo = { stroke: '#ffffff', paintOrder: 'stroke', strokeLinejoin: 'round', style: { userSelect: 'none' } } as const

// Le motif de gravier, en tuiles carrées de côté `taille` (unités du dessin).
export function MotifBallast({ id, taille }: { id: string; taille: number }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={taille} height={taille}>
      <rect width={taille} height={taille} fill={FOND_BALLAST} />
      {CAILLOUX.map((c, i) => (
        <ellipse
          key={i}
          cx={c.x * taille}
          cy={c.y * taille}
          rx={c.rx * taille}
          ry={c.ry * taille}
          transform={`rotate(${c.angle} ${c.x * taille} ${c.y * taille})`}
          fill={TEINTES_CAILLOUX[c.teinte]}
        />
      ))}
    </pattern>
  )
}

// Une portion de bande dans un état donné.
function Portion(props: { contour: string; etat: EtatVoie; zone: Zone; epaisseur: number; zoom: number; motif: string }) {
  const { contour, etat, zone, epaisseur, zoom, motif } = props
  const trait = Math.max(0.8 / zoom, epaisseur * 0.1)
  if (etat.rendu === 'zone') {
    return (
      <polygon
        points={contour}
        fill={zone.couleur}
        fillOpacity={0.3}
        stroke={zone.couleur}
        strokeWidth={Math.max(1 / zoom, epaisseur * 0.16)}
        strokeLinejoin="miter"
        data-rendu="zone"
      />
    )
  }
  if (etat.rendu === 'aplat') {
    return <polygon points={contour} fill={etat.couleur} stroke={CONTOUR_ETAT} strokeWidth={trait} strokeLinejoin="miter" data-rendu="aplat" />
  }
  return (
    <g data-rendu="ballast">
      <polygon points={contour} fill={`url(#${motif})`} />
      {etat.voile && <polygon points={contour} fill={etat.couleur} fillOpacity={OPACITE_VOILE} />}
      <polygon points={contour} fill="none" stroke={CONTOUR_ETAT} strokeWidth={trait} strokeLinejoin="miter" />
    </g>
  )
}

export function ZoneSelonEtat(props: { voie: Voie; zone: Zone; cote: Cote; etat: EtatZoneResolu; choisie: boolean; zoom: number }) {
  const { voie, zone, cote, etat, choisie, zoom } = props
  const motif = `${useId()}-ballast`
  const demi = largeurBandeZone(voie) / 2
  const bande = (debut: number, fin: number) => enPoints(bandeAutour(sousPolyligne(voie.points, debut, fin), demi))
  const entiere = bande(zone.debut, zone.fin)
  if (entiere === '') return null
  const decoupe = etat.avancement ? decouperZone(voie, zone, etat.avancement) : null
  const portions: { debut: number; fin: number; etat: EtatVoie }[] = decoupe
    ? [
        ...(decoupe.reste && etat.avancement ? [{ ...decoupe.reste, etat: etat.avancement.reste }] : []),
        ...(decoupe.fait ? [{ ...decoupe.fait, etat: etat.etat }] : []),
      ]
    : [{ debut: zone.debut, fin: zone.fin, etat: etat.etat }]
  const front = decoupe?.front != null ? traitDuFront(voie, decoupe.front, demi) : null
  const etiquette = etiquetteZone(voie, zone, cote)
  const taille = tailleEtiquetteZone(voie)
  const avecTexture = portions.some((p) => p.etat.rendu === 'ballast')
  return (
    <g data-zone={zone.id} data-etat={etat.etat.nom} data-avancement={etat.avancement ? etat.avancement.pourcentage : undefined}>
      {avecTexture && (
        <defs>
          <MotifBallast id={motif} taille={demi * 2.2} />
        </defs>
      )}
      {choisie && (
        <polygon points={entiere} fill="none" stroke={COULEURS.selection} strokeOpacity={0.55} strokeWidth={10 / zoom} strokeLinejoin="round" />
      )}
      {portions.map((p, i) => (
        <Portion key={i} contour={bande(p.debut, p.fin)} etat={p.etat} zone={zone} epaisseur={voie.epaisseur} zoom={zoom} motif={motif} />
      ))}
      {front && (
        <line
          x1={front[0].x}
          y1={front[0].y}
          x2={front[1].x}
          y2={front[1].y}
          stroke={COULEURS.texte}
          strokeWidth={Math.max(1.6 / zoom, voie.epaisseur * 0.28)}
          strokeLinecap="round"
          data-testid="front-avancement"
        />
      )}
      <text
        x={etiquette.x}
        y={etiquette.y}
        fontSize={taille}
        fontWeight={600}
        textAnchor={etiquette.ancre}
        fill={COULEURS.texte}
        strokeWidth={taille * 0.25}
        {...halo}
      >
        {zone.nom}
      </text>
    </g>
  )
}

// Aperçu d'un état : une petite bande dans son rendu (pour la liste du
// chantier et la palette de l'image). `couleurZone` : la couleur propre de la
// zone concernée, pour l'état Avant travaux.
export function ApercuEtat({ etat, couleurZone = COULEUR_ZONE_PAR_DEFAUT, largeur = 36, hauteur = 16 }: { etat: EtatVoie; couleurZone?: string; largeur?: number; hauteur?: number }) {
  const motif = `${useId()}-apercu`
  const r = { x: 1, y: 1, width: largeur - 2, height: hauteur - 2 }
  return (
    <svg width={largeur} height={hauteur} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true" data-testid="apercu-etat">
      {etat.rendu === 'ballast' && (
        <defs>
          <MotifBallast id={motif} taille={hauteur * 0.9} />
        </defs>
      )}
      {etat.rendu === 'zone' && <rect {...r} fill={couleurZone} fillOpacity={0.3} stroke={couleurZone} strokeWidth={1.5} />}
      {etat.rendu === 'aplat' && <rect {...r} fill={etat.couleur} stroke={CONTOUR_ETAT} strokeWidth={1} />}
      {etat.rendu === 'ballast' && (
        <>
          <rect {...r} fill={`url(#${motif})`} />
          {etat.voile && <rect {...r} fill={etat.couleur} fillOpacity={OPACITE_VOILE} />}
          <rect {...r} fill="none" stroke={CONTOUR_ETAT} strokeWidth={1} />
        </>
      )}
    </svg>
  )
}
