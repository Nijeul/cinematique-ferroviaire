import { distance } from './geometrie.ts'
import type { Echelle, Point } from './projet.ts'

// L'échelle du plan : combien d'unités du plan (pixels du fond) font un mètre
// réel. Elle se cale en deux clics sur deux points dont on connaît l'écart
// (deux poteaux, deux PK…) puis la distance en mètres ; sans fond, on donne la
// longueur réelle représentée par la largeur de la toile. Les engins gardent
// leurs dimensions en mètres : recaler l'échelle change leur taille dessinée.

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreur: string }

// Longueur proposée pour la largeur de la toile sans fond.
export const LARGEUR_TOILE_PAR_DEFAUT_M = 400

// En dessous de cet écart (unités du plan), deux clics sont le même point.
const ECART_MIN = 1

const MESSAGE_DISTANCE = 'Tapez la distance réelle en mètres : un nombre plus grand que zéro.'

// Nombre tapé à la française (« 14,5 ») ou à l'anglaise (« 14.5 ») ; null si
// ce n'est pas un nombre.
export function lireNombre(texte: string): number | null {
  const propre = texte.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(propre)) return null
  const n = Number(propre)
  return Number.isFinite(n) ? n : null
}

const distanceValide = (metres: number): boolean => Number.isFinite(metres) && metres > 0

// Échelle d'après deux points du plan et leur écart réel.
export function echelleParDeuxPoints(a: Point, b: Point, metres: number): Resultat<Echelle> {
  if (distance(a, b) < ECART_MIN) {
    return { ok: false, erreur: 'Les deux points sont confondus : cliquez deux repères bien distincts, le plus éloignés possible.' }
  }
  if (!distanceValide(metres)) return { ok: false, erreur: MESSAGE_DISTANCE }
  return { ok: true, valeur: { pixelsParMetre: distance(a, b) / metres } }
}

// Échelle d'après la longueur réelle représentée par toute la largeur du plan.
export function echelleParLargeur(largeurPlan: number, metres: number): Resultat<Echelle> {
  if (!distanceValide(metres)) return { ok: false, erreur: MESSAGE_DISTANCE }
  return { ok: true, valeur: { pixelsParMetre: largeurPlan / metres } }
}

export const metresVersPlan = (echelle: Echelle, metres: number): number => metres * echelle.pixelsParMetre
export const planVersMetres = (echelle: Echelle, unites: number): number => unites / echelle.pixelsParMetre

// « 213,5 », « 15,64 », « 1250 » : deux décimales au plus, virgule
// française ; pour un champ de saisie.
export function formaterNombre(n: number): string {
  const arrondi = Math.round(n * 100) / 100
  return arrondi.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')
}

// « 213,5 m », « 19,9 m », « 15,64 m », « 1 250 m » (espace fine entre les
// milliers).
export function formaterMetres(metres: number): string {
  const [entier, decimales] = formaterNombre(metres).split(',')
  const milliers = entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  return `${milliers}${decimales ? `,${decimales}` : ''} m`
}

// Longueur ronde de l'échelle graphique : la plus grande parmi 1, 2, 5, 10,
// 20, 50… mètres dont la barre ne dépasse pas `longueurMax` (dans les mêmes
// unités que `unitesParMetre` : pixels d'écran ou unités du plan).
export function longueurGraduee(unitesParMetre: number, longueurMax: number): { metres: number; longueur: number } {
  const brut = longueurMax / unitesParMetre
  if (!(brut > 0) || !Number.isFinite(brut)) return { metres: 1, longueur: unitesParMetre }
  const puissance = 10 ** Math.floor(Math.log10(brut))
  const metres = [5, 2, 1].map((f) => f * puissance).find((m) => m <= brut * (1 + 1e-9)) ?? puissance
  return { metres, longueur: metres * unitesParMetre }
}

// Libellé court d'une échelle : « 1 m = 4 px du plan · la largeur du plan fait 400 m ».
export function descriptionEchelle(echelle: Echelle, largeurPlan: number): string {
  const px = Math.round(echelle.pixelsParMetre * 100) / 100
  return `1 m = ${String(px).replace('.', ',')} px du plan · la largeur du plan fait ${formaterMetres(planVersMetres(echelle, largeurPlan))}`
}
