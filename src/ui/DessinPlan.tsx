import {
  boutsAppareil,
  cotesEtiquettesZones,
  enPoints,
  etiquetteAppareil,
  etiquetteZone,
  largeurBandeZone,
  positionsExtremites,
  tailleEtiquetteZone,
  tailleNomAppareil,
  triangleDePointe,
  type Cote,
} from '../plan/dessin.ts'
import { boiteTexte, type Genre } from '../plan/detection.ts'
import type { Rectangle } from '../plan/elements.ts'
import { positionNom, tailleNom } from '../plan/geometrie.ts'
import {
  COULEUR_VOIE_PAR_DEFAUT,
  epaisseurParDefaut,
  type Appareil,
  type Cadre,
  type Projet,
  type Texte,
  type Voie,
  type Zone,
} from '../plan/projet.ts'
import { bandeAutour, sousPolyligne } from '../plan/trace.ts'
import { COULEURS } from './couleurs.ts'

// Le dessin d'un plan, sans interaction : la feuille et le fond, puis au
// calque, du dessous vers le dessus : cadres, voies, zones, appareils, textes.
// Sert au plan de travail, aux images d'un synoptique et à leurs vignettes.
// Coordonnées en pixels du plan ; `zoom` règle l'épaisseur des repères de
// sélection, constants à l'écran.

const halo = { stroke: '#ffffff', paintOrder: 'stroke', strokeLinejoin: 'round', style: { userSelect: 'none' } } as const

// Une voie dans le style de l'aperçu : deux filets (trait épais de la couleur
// de la voie, trait blanc plus fin par-dessus), nom en gras au départ.
function TraceVoie({ voie, choisie, zoom }: { voie: Voie; choisie: boolean; zoom: number }) {
  const points = enPoints(voie.points)
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
        strokeWidth={taille * 0.28}
        {...halo}
      >
        {voie.nom}
      </text>
    </g>
  )
}

// Zone : bande colorée semi-transparente qui épouse la portion de voie,
// bordée de sa couleur, nom au-dessus ou au-dessous.
export function DessinZone(props: { voie: Voie; zone: Zone; cote: Cote; choisie: boolean; zoom: number; apercu?: boolean }) {
  const { voie, zone, cote, choisie, zoom, apercu } = props
  const contour = bandeAutour(sousPolyligne(voie.points, zone.debut, zone.fin), largeurBandeZone(voie) / 2)
  if (contour.length === 0) return null
  const etiquette = etiquetteZone(voie, zone, cote)
  const taille = tailleEtiquetteZone(voie)
  return (
    <g opacity={apercu ? 0.7 : 1}>
      {choisie && (
        <polygon
          points={enPoints(contour)}
          fill="none"
          stroke={COULEURS.selection}
          strokeOpacity={0.45}
          strokeWidth={10 / zoom}
          strokeLinejoin="round"
        />
      )}
      <polygon
        points={enPoints(contour)}
        fill={zone.couleur}
        fillOpacity={0.3}
        stroke={zone.couleur}
        strokeWidth={Math.max(1 / zoom, voie.epaisseur * 0.16)}
        strokeLinejoin="miter"
      />
      {!apercu && (
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
      )}
    </g>
  )
}

// Appareil : biais en double filet de la pointe au talon, triangle plein à
// la pointe, nom en gras. Une communication (deux BS talon contre talon) se
// dessine en un seul biais, avec un triangle à chaque pointe.
function DessinAppareil(props: { projet: Projet; appareil: Appareil; jumeau?: Appareil; choisi: boolean; zoom: number }) {
  const { projet, appareil, jumeau, choisi, zoom } = props
  const bouts = boutsAppareil(projet, appareil)
  if (!bouts) return null
  const { pointe, talon, epaisseur } = bouts
  const taille = tailleNomAppareil(epaisseur)
  const noms = jumeau
    ? [
        { nom: appareil.nom, pos: etiquetteAppareil(pointe, talon, epaisseur, 0.2) },
        { nom: jumeau.nom, pos: etiquetteAppareil(pointe, talon, epaisseur, 0.8) },
      ]
    : [{ nom: appareil.nom, pos: etiquetteAppareil(pointe, talon, epaisseur) }]
  const triangles = [triangleDePointe(pointe, talon, epaisseur)]
  if (jumeau) triangles.push(triangleDePointe(talon, pointe, epaisseur))
  return (
    <g>
      {choisi && (
        <line
          x1={pointe.x}
          y1={pointe.y}
          x2={talon.x}
          y2={talon.y}
          stroke={COULEURS.selection}
          strokeOpacity={0.3}
          strokeWidth={epaisseur + 14 / zoom}
          strokeLinecap="round"
        />
      )}
      <line x1={pointe.x} y1={pointe.y} x2={talon.x} y2={talon.y} stroke={COULEUR_VOIE_PAR_DEFAUT} strokeWidth={epaisseur * 0.8} />
      <line x1={pointe.x} y1={pointe.y} x2={talon.x} y2={talon.y} stroke="#ffffff" strokeWidth={epaisseur * 0.32} />
      {triangles.map((t, i) => (
        <polygon key={i} points={enPoints(t)} fill={COULEURS.nomVoie} stroke="#ffffff" strokeWidth={epaisseur * 0.12} />
      ))}
      {noms.map(({ nom, pos }, i) => (
        <text
          key={i}
          x={pos.x}
          y={pos.y}
          fontSize={taille}
          fontWeight={700}
          textAnchor={pos.ancre}
          fill={COULEURS.nomVoie}
          strokeWidth={taille * 0.28}
          {...halo}
        >
          {nom}
        </text>
      ))}
    </g>
  )
}

// Cadre : rectangle en pointillés ou plein, remplissage léger, nom centré.
function DessinCadre(props: { cadre: Cadre; choisi: boolean; zoom: number; trait: number; tailleNom: number }) {
  const { cadre, choisi, zoom, trait } = props
  // Nom à la taille des noms de zones, réduit s'il ne tient pas dans le cadre.
  const taille = Math.min(props.tailleNom, cadre.hauteur * 0.45, (cadre.largeur * 0.9) / (Math.max(1, cadre.nom.length) * 0.6))
  return (
    <g>
      {choisi && (
        <rect
          x={cadre.x}
          y={cadre.y}
          width={cadre.largeur}
          height={cadre.hauteur}
          fill="none"
          stroke={COULEURS.selection}
          strokeOpacity={0.45}
          strokeWidth={8 / zoom}
        />
      )}
      <rect
        x={cadre.x}
        y={cadre.y}
        width={cadre.largeur}
        height={cadre.hauteur}
        rx={trait * 2}
        fill={cadre.couleur}
        fillOpacity={cadre.rempli ? 0.14 : 0}
        stroke={cadre.couleur}
        strokeWidth={trait}
        strokeDasharray={cadre.pointille ? `${trait * 3.5} ${trait * 2.2}` : undefined}
      />
      <text
        x={cadre.x + cadre.largeur / 2}
        y={cadre.y + cadre.hauteur / 2 + taille * 0.35}
        fontSize={taille}
        textAnchor="middle"
        fill={COULEURS.texte}
        strokeWidth={taille * 0.2}
        {...halo}
      >
        {cadre.nom}
      </text>
    </g>
  )
}

function DessinTexte({ texte, choisi, zoom }: { texte: Texte; choisi: boolean; zoom: number }) {
  const boite = boiteTexte(texte)
  return (
    <g>
      {choisi && (
        <rect
          x={boite.x - 4 / zoom}
          y={boite.y - 3 / zoom}
          width={boite.largeur + 8 / zoom}
          height={boite.hauteur + 6 / zoom}
          fill="none"
          stroke={COULEURS.selection}
          strokeWidth={1.5 / zoom}
          strokeDasharray={`${4 / zoom} ${3 / zoom}`}
        />
      )}
      <text
        x={texte.x}
        y={texte.y}
        fontSize={texte.taille}
        fontWeight={texte.gras ? 700 : 400}
        fill={texte.couleur}
        strokeWidth={texte.taille * 0.22}
        {...halo}
      >
        {texte.texte}
      </text>
    </g>
  )
}

// `affiche` : la partie montrée (le cadrage d'un synoptique), pour y garder les
// repères d'extrémités ; toute la feuille par défaut.
export function DessinPlan(props: { projet: Projet; zoom: number; affiche?: Rectangle; estChoisi?: (genre: Genre, id: string) => boolean }) {
  const { projet } = props
  // Même nom que dans le plan de travail : les tailles « / vue.zoom » restent constantes à l'écran.
  const vue = { zoom: props.zoom }
  const estChoisi = props.estChoisi ?? (() => false)
  const fond = projet.fond
  const calques = projet.calques
  const voiesVisibles = calques.voies.visible
  const epaisseurTrace = epaisseurParDefaut(projet)
  const cotes = cotesEtiquettesZones(projet)
  const voiesParId = new Map(projet.voies.map((v) => [v.id, v]))
  const extremites = positionsExtremites(projet, props.affiche)
  // Appareils : une communication se dessine une fois, depuis son premier BS.
  const dejaDessinees = new Set<string>()
  return (
    <>
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
      {fond && calques.fond.visible && fond.image && (
        <image
          href={fond.image}
          x={0}
          y={0}
          width={fond.largeur}
          height={fond.hauteur}
          opacity={calques.fond.opacite}
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

      {/* Extrémités du plan : Nord à gauche, Sud à droite (ou leurs noms). */}
      <g fill={COULEURS.discret} fontSize={extremites.taille} fontWeight={600} style={{ userSelect: 'none' }} data-testid="extremites">
        <text x={extremites.gauche.x} y={extremites.gauche.y} textAnchor="start">
          ◀ {projet.extremites.gauche}
        </text>
        <text x={extremites.droite.x} y={extremites.droite.y} textAnchor="end">
          {projet.extremites.droite} ▶
        </text>
      </g>

      {calques.cadres.visible &&
        projet.cadres.map((cadre) => (
          <DessinCadre
            key={cadre.id}
            cadre={cadre}
            choisi={estChoisi('cadre', cadre.id)}
            zoom={vue.zoom}
            trait={Math.max(1, epaisseurTrace * 0.22)}
            tailleNom={tailleEtiquetteZone({ epaisseur: epaisseurTrace })}
          />
        ))}

      {voiesVisibles &&
        projet.voies.map((voie) => (
          <TraceVoie key={voie.id} voie={voie} choisie={estChoisi('voie', voie.id)} zoom={vue.zoom} />
        ))}

      {calques.zones.visible &&
        projet.zones.map((zone) => {
          const voie = voiesParId.get(zone.voieId)
          return voie ? (
            <DessinZone
              key={zone.id}
              voie={voie}
              zone={zone}
              cote={cotes.get(zone.id) ?? 'dessus'}
              choisie={estChoisi('zone', zone.id)}
              zoom={vue.zoom}
            />
          ) : null
        })}

      {calques.appareils.visible &&
        projet.appareils.map((appareil) => {
          if (appareil.communication) {
            if (dejaDessinees.has(appareil.communication)) return null
            dejaDessinees.add(appareil.communication)
          }
          const jumeau = appareil.communication
            ? projet.appareils.find((a) => a.communication === appareil.communication && a.id !== appareil.id)
            : undefined
          return (
            <DessinAppareil
              key={appareil.id}
              projet={projet}
              appareil={appareil}
              jumeau={jumeau}
              choisi={estChoisi('appareil', appareil.id) || (jumeau !== undefined && estChoisi('appareil', jumeau.id))}
              zoom={vue.zoom}
            />
          )
        })}

      {calques.textes.visible &&
        projet.textes.map((texte) => (
          <DessinTexte key={texte.id} texte={texte} choisi={estChoisi('texte', texte.id)} zoom={vue.zoom} />
        ))}
    </>
  )
}
