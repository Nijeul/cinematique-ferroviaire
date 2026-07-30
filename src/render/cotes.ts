// Cotes du rendu de voie, en mètres. Volontairement lisibles plutôt que
// strictement réalistes : la couleur et la silhouette portent l'information.

export const COTES = {
  ballast: { largeur: 4.2, hauteur: 0.35 },
  traverse: { longueur: 2.4, largeurAssise: 0.24, hauteur: 0.16, pas: 0.6 },
  rail: { demiEcartement: 0.75, largeur: 0.15, hauteur: 0.18 },
} as const

export const ALTITUDES = {
  solZones: 0.02,
  ballastBase: 0,
  traverseBase: COTES.ballast.hauteur,
  railBase: COTES.ballast.hauteur + COTES.traverse.hauteur,
} as const
