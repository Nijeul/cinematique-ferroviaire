import type { Site, Voie } from './site.ts'

// Mise en page d'une planche : où se dessinent les voies, les zones et les
// stockages. Tout est calculé ici, en pur, pour que le SVG n'ait plus qu'à
// tracer. Nord à gauche, Sud à droite — repères non négociables.

export const MISE_EN_PAGE = {
  largeurPlanche: 1440,
  margeGauche: 110,
  largeurUtile: 1240,
  // Première bande de voie, puis interligne constant entre bandes. L'espace
  // sous chaque bande est découpé en couloirs : étiquettes de zones d'abord,
  // stockages ensuite, pour que rien ne se chevauche.
  yPremiereVoie: 132,
  interligne: 92,
  hauteurZone: 22,
  hauteurCartouche: 70,
} as const

// Conversion mètres du site → x sur la planche.
export function echelleX(site: Site): (metres: number) => number {
  const { margeGauche, largeurUtile } = MISE_EN_PAGE
  return (metres) => margeGauche + (metres / site.longueurMetres) * largeurUtile
}

export function yDeVoie(voie: Voie): number {
  return MISE_EN_PAGE.yPremiereVoie + voie.rang * MISE_EN_PAGE.interligne
}

// Couloir des stockages : sous les étiquettes de zones, au-dessus des
// étiquettes de la bande suivante.
export function ySousVoie(voie: Voie): number {
  return yDeVoie(voie) + MISE_EN_PAGE.interligne / 2 + 4
}

export function hauteurPlanche(site: Site): number {
  const rangMax = Math.max(0, ...site.voies.map((voie) => voie.rang))
  return (
    MISE_EN_PAGE.yPremiereVoie +
    rangMax * MISE_EN_PAGE.interligne +
    MISE_EN_PAGE.interligne / 2 +
    MISE_EN_PAGE.hauteurCartouche +
    30
  )
}
