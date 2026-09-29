import type { Site } from '../plan/site.ts'
import { echelleX, hauteurPlanche, MISE_EN_PAGE, yDeVoie, ySousVoie } from '../plan/reperes.ts'

// La planche : le site vu à plat, dans le style des synoptiques — bandes de
// voies horizontales, zones nommées, appareils, stockages, Nord à gauche.
// Étape 1 : fond de plan statique, sans états ni temps.

const COULEURS = {
  fond: '#ffffff',
  voie: '#454f59',
  nomVoie: '#232b33',
  zoneFond: '#d9e4f0',
  zoneBord: '#33506b',
  stockageFond: '#eef2e6',
  stockageBord: '#7a8a63',
  ouvrageFond: '#efe9da',
  ouvrageBord: '#a89a78',
  texte: '#1c2430',
  discret: '#5a646e',
}

export function Planche({ site }: { site: Site }) {
  const x = echelleX(site)
  const hauteur = hauteurPlanche(site)
  const voiesParId = new Map(site.voies.map((voie) => [voie.id, voie]))
  const yHaut = MISE_EN_PAGE.yPremiereVoie - 26
  const yBas = hauteur - MISE_EN_PAGE.hauteurCartouche - 16
  const yCartouche = hauteur - MISE_EN_PAGE.hauteurCartouche

  // Alternance haut/bas des étiquettes de zones, voie par voie, pour éviter
  // les chevauchements entre zones adjacentes.
  const indexSurVoie = new Map<string, number>()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${MISE_EN_PAGE.largeurPlanche} ${hauteur}`}
      role="img"
      aria-label={`Plan du site : ${site.nom}`}
      style={{ display: 'block', width: '100%', background: COULEURS.fond }}
    >
      <text x={MISE_EN_PAGE.margeGauche} y={52} fontSize={26} fontWeight={700} fill={COULEURS.texte}>
        {site.nom}
      </text>
      <text x={MISE_EN_PAGE.margeGauche} y={86} fontSize={16} fill={COULEURS.discret}>
        ◀ Nord
      </text>
      <text
        x={MISE_EN_PAGE.margeGauche + MISE_EN_PAGE.largeurUtile}
        y={86}
        fontSize={16}
        fill={COULEURS.discret}
        textAnchor="end"
      >
        Sud ▶
      </text>

      {/* Ouvrages : bande verticale traversant les voies (le pont). */}
      {site.lieux
        .filter((lieu) => lieu.type === 'ouvrage')
        .map((lieu) => (
          <g key={lieu.id}>
            <rect
              x={x(lieu.de)}
              y={yHaut}
              width={x(lieu.a) - x(lieu.de)}
              height={yBas - yHaut}
              fill={COULEURS.ouvrageFond}
              stroke={COULEURS.ouvrageBord}
              strokeDasharray="6 4"
            />
            <text
              x={(x(lieu.de) + x(lieu.a)) / 2}
              y={yHaut - 8}
              fontSize={13}
              textAnchor="middle"
              fill={COULEURS.discret}
            >
              {lieu.nom}
            </text>
          </g>
        ))}

      {/* Voies : deux filets horizontaux, nom à gauche de la bande. */}
      {site.voies.map((voie) => {
        const y = yDeVoie(voie)
        return (
          <g key={voie.id}>
            <line x1={x(voie.de)} y1={y - 3} x2={x(voie.a)} y2={y - 3} stroke={COULEURS.voie} strokeWidth={2.5} />
            <line x1={x(voie.de)} y1={y + 3} x2={x(voie.a)} y2={y + 3} stroke={COULEURS.voie} strokeWidth={2.5} />
            <text
              x={x(voie.de) - 12}
              y={y + 5}
              fontSize={15}
              fontWeight={700}
              textAnchor="end"
              fill={COULEURS.nomVoie}
            >
              {voie.nom}
            </text>
          </g>
        )
      })}

      {/* Appareils de voie : biais reliant la voie directe à la voie déviée. */}
      {site.appareils.map((adv) => {
        const directe = voiesParId.get(adv.voieDirecte)
        const deviee = voiesParId.get(adv.voieDeviee)
        if (!directe || !deviee) return null
        const x0 = x(adv.position)
        const y0 = yDeVoie(directe)
        const y1 = yDeVoie(deviee)
        return (
          <g key={adv.id}>
            <line x1={x0} y1={y0} x2={x0 + 26} y2={y1} stroke={COULEURS.voie} strokeWidth={2.5} />
            <text
              x={x0 + 13}
              y={(y0 + y1) / 2 + (y1 > y0 ? 16 : -10)}
              fontSize={12.5}
              fontWeight={700}
              textAnchor="middle"
              fill={COULEURS.nomVoie}
            >
              {adv.nom}
            </text>
          </g>
        )
      })}

      {/* Zones : rectangle sur la bande de voie, étiquette alternée haut/bas. */}
      {site.zones.map((zone) => {
        const voie = voiesParId.get(zone.voie)
        if (!voie) return null
        const y = yDeVoie(voie)
        const indice = indexSurVoie.get(zone.voie) ?? 0
        indexSurVoie.set(zone.voie, indice + 1)
        const enHaut = indice % 2 === 0
        const demi = MISE_EN_PAGE.hauteurZone / 2
        return (
          <g key={zone.id}>
            <rect
              x={x(zone.de)}
              y={y - demi}
              width={x(zone.a) - x(zone.de)}
              height={MISE_EN_PAGE.hauteurZone}
              fill={COULEURS.zoneFond}
              stroke={COULEURS.zoneBord}
            />
            <text
              x={(x(zone.de) + x(zone.a)) / 2}
              y={enHaut ? y - demi - 6 : y + demi + 15}
              fontSize={12.5}
              textAnchor="middle"
              fill={COULEURS.texte}
            >
              {zone.nom}
            </text>
          </g>
        )
      })}

      {/* Stockages : cartouche en pointillés entre deux bandes de voies. */}
      {site.lieux
        .filter((lieu) => lieu.type === 'stockage')
        .map((lieu) => {
          const voie = lieu.sous !== undefined ? voiesParId.get(lieu.sous) : undefined
          if (!voie) return null
          const yCentre = ySousVoie(voie)
          return (
            <g key={lieu.id}>
              <rect
                x={x(lieu.de)}
                y={yCentre - 13}
                width={x(lieu.a) - x(lieu.de)}
                height={26}
                rx={4}
                fill={COULEURS.stockageFond}
                stroke={COULEURS.stockageBord}
                strokeDasharray="5 3"
              />
              <text
                x={(x(lieu.de) + x(lieu.a)) / 2}
                y={yCentre + 4}
                fontSize={11.5}
                textAnchor="middle"
                fill={COULEURS.texte}
              >
                {lieu.nom}
              </text>
            </g>
          )
        })}

      {/* Renvois hors plan (zone Nord, base arrière Sud…). */}
      {site.horsPlan.map((renvoi) => {
        const aGauche = renvoi.cote === 'gauche'
        const yMilieu = (yHaut + yBas) / 2
        return (
          <text
            key={`${renvoi.cote}-${renvoi.nom}`}
            x={aGauche ? 14 : MISE_EN_PAGE.largeurPlanche - 14}
            y={yMilieu}
            fontSize={13}
            fontWeight={600}
            fill={COULEURS.discret}
            textAnchor="middle"
            transform={`rotate(${aGauche ? -90 : 90} ${aGauche ? 14 : MISE_EN_PAGE.largeurPlanche - 14} ${yMilieu})`}
          >
            {aGauche ? `◀ ${renvoi.nom}` : `${renvoi.nom} ▶`}
          </text>
        )
      })}

      {/* Cartouche. */}
      <g>
        <rect
          x={MISE_EN_PAGE.margeGauche}
          y={yCartouche}
          width={560}
          height={48}
          fill="#f5f7f9"
          stroke="#b9c0c8"
        />
        <text x={MISE_EN_PAGE.margeGauche + 12} y={yCartouche + 20} fontSize={13} fontWeight={700} fill={COULEURS.texte}>
          {site.nom}
        </text>
        <text x={MISE_EN_PAGE.margeGauche + 12} y={yCartouche + 38} fontSize={12} fill={COULEURS.discret}>
          Fond de plan — étape 1, à valider · échelle horizontale : {site.longueurMetres} m
        </text>
      </g>
    </svg>
  )
}
