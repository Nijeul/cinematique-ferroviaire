import { useId, type ReactNode } from 'react'
import { couleurTexteSur, type ReferenceEngin } from '../plan/engins.ts'
import { uniteFleche } from '../plan/fleches.ts'
import type { ListesChantier } from '../plan/legende.ts'
import { miseEnPage, type EntreePlacee, type LigneMixte, type LigneTexte } from '../plan/planche.ts'
import { projetDeImage, type Synoptique } from '../plan/synoptique.ts'
import { COULEURS } from './couleurs.ts'
import { BarreEchelle, DessinEnginsImage } from './DessinEngins.tsx'
import { MotifBallast } from './DessinEtats.tsx'
import { DessinFlechesImage, EchantillonFleche } from './DessinFleches.tsx'
import { DessinPlan } from './DessinPlan.tsx'

// Une image de synoptique dessinée comme une planche du commanditaire : le
// plan figé limité au cadrage, avec ses zones selon leur état et ses engins ;
// au-dessus, le bandeau de titre (fond bleu clair) et le créneau horaire
// (fond gris clair, bord rouge) ; au-dessous à gauche, l'encart PHASAGE, et à
// droite la LÉGENDE, dans le même style. Les flèches sont posées sur le plan,
// au-dessus des engins.
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

// ——— Légende ———

const CONTOUR_ECHANTILLON = '#3a3d40'
const OPACITE_VOILE = 0.6

// Texte d'une ligne de légende : le nom en gras, la suite en maigre.
function TexteMixte({ l, couleur }: { l: LigneMixte; couleur: string }) {
  const gras = l.texte.slice(0, l.grasJusqua)
  const maigre = l.texte.slice(l.grasJusqua)
  return (
    <text x={l.x} y={l.y} fontSize={l.taille} fill={couleur} fontFamily={POLICE_PLANCHE} style={{ userSelect: 'none', whiteSpace: 'pre' }}>
      {gras && <tspan fontWeight={700}>{gras}</tspan>}
      {maigre && <tspan fontWeight={400}>{maigre}</tspan>}
    </text>
  )
}

// Pastille à numéro, comme au-dessus des engins sur le plan.
function PastilleLegende({ x, y, r, couleur, texte }: { x: number; y: number; r: number; couleur: string; texte: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={couleur} stroke={COULEURS.texte} strokeWidth={r * 0.14} />
      <text
        x={x}
        y={y}
        fontSize={r * (texte.length > 2 ? 0.85 : 1.15)}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        fill={couleurTexteSur(couleur)}
        fontFamily={POLICE_PLANCHE}
        style={{ userSelect: 'none' }}
      >
        {texte}
      </text>
    </g>
  )
}

// L'échantillon d'une ligne, dans son rectangle : l'engin (pastille et
// caisse), les véhicules de la rame, la bande de l'état, la flèche.
function Echantillon({ p, motif, unite }: { p: EntreePlacee; motif: string; unite: number }) {
  const { entree: e, echantillon: r } = p
  const milieu = r.y + r.hauteur / 2
  const trait = r.hauteur * 0.08
  if (e.genre === 'engin' || e.genre === 'rame') {
    const rayon = r.hauteur * 0.52
    const avecPastille = e.numero !== ''
    const x0 = avecPastille ? r.x + 2 * rayon + r.hauteur * 0.2 : r.x
    const h = r.hauteur * 0.62
    const couleurs = e.genre === 'engin' ? [e.couleur] : e.couleurs
    const ecart = r.hauteur * 0.12
    const l = (r.x + r.largeur - x0 - ecart * (couleurs.length - 1)) / couleurs.length
    return (
      <g data-testid="echantillon-engin">
        {couleurs.map((c, i) => (
          <rect key={i} x={x0 + i * (l + ecart)} y={milieu - h / 2} width={l} height={h} fill={c} stroke={COULEURS.texte} strokeWidth={trait} />
        ))}
        {avecPastille && (
          <PastilleLegende x={r.x + rayon} y={milieu} r={rayon} couleur={e.genre === 'engin' ? e.couleur : e.couleurPastille} texte={e.numero} />
        )}
      </g>
    )
  }
  if (e.genre === 'etat') {
    const b = { x: r.x, y: r.y, width: r.largeur, height: r.hauteur }
    return (
      <g data-testid="echantillon-etat">
        {e.etat.rendu === 'aplat' && <rect {...b} fill={e.etat.couleur} stroke={CONTOUR_ECHANTILLON} strokeWidth={trait} />}
        {e.etat.rendu === 'ballast' && (
          <>
            <rect {...b} fill={`url(#${motif})`} />
            {e.etat.voile && <rect {...b} fill={e.etat.couleur} fillOpacity={OPACITE_VOILE} />}
            <rect {...b} fill="none" stroke={CONTOUR_ECHANTILLON} strokeWidth={trait} />
          </>
        )}
      </g>
    )
  }
  return (
    <g data-testid="echantillon-fleche">
      <EchantillonFleche type={e.type} x={r.x} y={r.y} largeur={r.largeur} hauteur={r.hauteur} unite={unite} />
    </g>
  )
}

export function DessinPlanche(props: {
  synoptique: Synoptique
  index: number
  listes: ListesChantier
  zoom: number
  estChoisi?: (ref: ReferenceEngin) => boolean
  zoneChoisie?: string | null
  flecheChoisie?: string | null
  // Dessiné sur le plan, dans le cadrage (aperçu de pose, point d'accroche).
  surLaCarte?: ReactNode
}) {
  const { synoptique: s, index, zoom } = props
  const idClip = useId()
  const image = s.images[index]
  const motif = `${idClip}-ballast-legende`
  const planche = projetDeImage(s, image)
  const page = miseEnPage(s, index, props.listes)
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
          etats={{ liste: props.listes.etatsVoie, parZone: image.contenu.etatsZones }}
          estChoisi={(genre, id) => genre === 'zone' && id === props.zoneChoisie}
          engins={
            <>
              <DessinEnginsImage projet={planche} visible={s.calqueEngins.visible} zoom={zoom} estChoisi={props.estChoisi} />
              <DessinFlechesImage
                planche={planche}
                types={props.listes.typesFleches}
                visible={s.calqueFleches.visible}
                zoom={zoom}
                choisie={props.flecheChoisie}
              />
            </>
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

      {page.legende && (
        <g data-testid="legende">
          {page.legende.entrees.some((p) => p.entree.genre === 'etat' && p.entree.etat.rendu === 'ballast') && (
            <defs>
              <MotifBallast id={motif} taille={page.legende.entrees[0].echantillon.hauteur * 0.9} />
            </defs>
          )}
          <rect
            x={page.legende.boite.x}
            y={page.legende.boite.y}
            width={page.legende.boite.largeur}
            height={page.legende.boite.hauteur}
            fill={COULEURS_PLANCHE.fondPhasage}
          />
          <rect
            x={page.legende.entete.x}
            y={page.legende.entete.y}
            width={page.legende.entete.largeur}
            height={page.legende.entete.hauteur}
            fill={COULEURS_PLANCHE.entetePhasage}
          />
          <Lignes lignes={[page.legende.titre]} ancre="middle" couleur="#ffffff" />
          {page.legende.entrees.map((p) => (
            <g key={p.entree.cle} data-testid="ligne-legende" data-cle={p.entree.cle} data-genre={p.entree.genre}>
              <Echantillon p={p} motif={motif} unite={uniteFleche(planche)} />
              {p.lignes.map((l, i) => (
                <TexteMixte key={i} l={l} couleur={COULEURS_PLANCHE.textePhasage} />
              ))}
            </g>
          ))}
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
