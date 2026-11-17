import { largeurTexteEstimee, positionsExtremites } from './dessin.ts'
import { longueurGraduee } from './echelle.ts'
import type { Rectangle } from './elements.ts'
import type { Projet } from './projet.ts'
import type { Synoptique } from './synoptique.ts'

// Coin de l'échelle graphique « 0 — 100 m » d'une planche (demande du
// commanditaire : en bas à droite, elle tombe parfois sur les voies). Il
// choisit le coin pour chaque synoptique, pour toutes ses images : image de
// travail, planche, vignettes et exports. La barre reste toujours dans le
// cadre du plan : le bandeau de titre et le créneau sont au-dessus du plan,
// l'encart PHASAGE et la LÉGENDE au-dessous, elle ne les touche donc jamais.
// En haut, elle passe sous les repères « ◀ Nord » et « Sud ▶ » au lieu de les
// cacher.
// Par défaut (et pour les synoptiques enregistrés sans ce réglage), en bas à
// droite, comme avant.

export type CoinEchelle = 'bas-droite' | 'bas-gauche' | 'haut-droite' | 'haut-gauche'

export const COIN_ECHELLE_PAR_DEFAUT: CoinEchelle = 'bas-droite'

// Les quatre coins, dans l'ordre du choix proposé à l'écran.
export const COINS_ECHELLE: { coin: CoinEchelle; libelle: string }[] = [
  { coin: 'bas-droite', libelle: 'En bas à droite' },
  { coin: 'bas-gauche', libelle: 'En bas à gauche' },
  { coin: 'haut-droite', libelle: 'En haut à droite' },
  { coin: 'haut-gauche', libelle: 'En haut à gauche' },
]

export const estCoinEchelle = (v: unknown): v is CoinEchelle => COINS_ECHELLE.some((c) => c.coin === v)

// Valeur lue dans un fichier ou dans un chantier gardé : absente ou
// illisible, le coin par défaut (rien ne change sur la planche).
export const lireCoinEchelle = (brut: unknown): CoinEchelle => (estCoinEchelle(brut) ? brut : COIN_ECHELLE_PAR_DEFAUT)

// Le même synoptique si rien ne change (ou si le coin n'en est pas un).
export function modifierCoinEchelle(s: Synoptique, coin: CoinEchelle): Synoptique {
  return s.coinEchelle === coin || !estCoinEchelle(coin) ? s : { ...s, coinEchelle: coin }
}

// ——— Géométrie de la barre ———

// Une barre d'échelle posée : (x, y) est le bas de la barre, à son bout gauche
// (`ancre` gauche) ou droit (`ancre` droite) ; `taille` est celle des
// chiffres et `longueur` la longueur dessinée de la barre.
export type BarrePosee = { x: number; y: number; ancre: 'gauche' | 'droite'; taille: number; longueur: number }

// Cadre blanc derrière la barre et ses chiffres (« 0 » et « 100 m » au-dessus
// de la barre). Le même calcul sert au dessin.
export function cadreBarreEchelle(b: BarrePosee): Rectangle {
  const { taille, longueur } = b
  const h = taille * 0.5
  const marge = taille * 0.5
  const x0 = b.ancre === 'droite' ? b.x - longueur : b.x
  return { x: x0 - marge, y: b.y - h - taille * 1.45, largeur: longueur + 2 * marge, hauteur: h + taille * 1.45 + marge * 0.8 }
}

// `metres` : la longueur ronde représentée (« 100 m ») ; `cadre` : le cadre
// blanc, toujours dans le plan.
export type PlacementEchelle = BarrePosee & { longueurMax: number; metres: number; cadre: Rectangle }

const touche = (a: Rectangle, b: Rectangle): boolean =>
  a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur

// Place des repères « ◀ Nord » et « Sud ▶ » dessinés en haut du plan (voir
// positionsExtremites), que l'échelle ne doit pas cacher. Largeur estimée,
// plutôt large.
export function reperesExtremites(
  projet: Pick<Projet, 'voies' | 'cadres' | 'largeur' | 'hauteur' | 'extremites'>,
  affiche: Rectangle,
): Rectangle[] {
  const { taille, gauche, droite } = positionsExtremites(projet, affiche)
  const boite = (p: { x: number; y: number }, texte: string, ancre: 'gauche' | 'droite'): Rectangle => {
    const largeur = largeurTexteEstimee(texte, taille, true)
    return { x: ancre === 'droite' ? p.x - largeur : p.x, y: p.y - taille * 0.95, largeur, hauteur: taille * 1.2 }
  }
  return [boite(gauche, `◀ ${projet.extremites.gauche}`, 'gauche'), boite(droite, `${projet.extremites.droite} ▶`, 'droite')]
}

// Place l'échelle dans le coin choisi du plan (`carte`, le cadrage du
// synoptique). Tailles proportionnelles à la largeur du plan, comme avant :
// chiffres de 1/90 de la largeur, barre d'au plus 20 % de la largeur. En bas
// à droite, la place est exactement celle d'avant ; les autres coins gardent
// les mêmes écarts au bord, en symétrie. Si le cadre touche un des repères
// `aEviter` (« ◀ Nord », « Sud ▶ »), il s'en écarte en s'éloignant du bord :
// dessous en haut, dessus en bas, sans sortir du plan.
export function placerEchelle(carte: Rectangle, unitesParMetre: number, coin: CoinEchelle, aEviter: Rectangle[] = []): PlacementEchelle {
  const taille = carte.largeur / 90
  const longueurMax = carte.largeur * 0.2
  const retrait = carte.largeur * 0.015
  const { metres, longueur } = longueurGraduee(unitesParMetre, longueurMax)
  const droite = coin === 'bas-droite' || coin === 'haut-droite'
  const bas = coin === 'bas-droite' || coin === 'bas-gauche'
  const ancre = droite ? 'droite' : 'gauche'
  const x = droite ? carte.x + carte.largeur - retrait : carte.x + retrait
  // Écart entre le bas du cadre blanc et le bas du plan ; en haut, le même
  // écart entre le haut du cadre et le haut du plan.
  const relatif = cadreBarreEchelle({ x, y: 0, ancre, taille, longueur })
  const ecart = retrait - (relatif.y + relatif.hauteur)
  let haut = bas ? carte.y + carte.hauteur - retrait + relatif.y : carte.y + ecart
  for (let i = 0; i < aEviter.length; i++) {
    const cadre = { ...relatif, y: haut }
    const genants = aEviter.filter((r) => touche(cadre, r))
    if (genants.length === 0) break
    haut = bas
      ? Math.min(...genants.map((r) => r.y)) - ecart - relatif.hauteur
      : Math.max(...genants.map((r) => r.y + r.hauteur)) + ecart
  }
  haut = Math.min(Math.max(haut, carte.y), carte.y + carte.hauteur - relatif.hauteur)
  const posee: BarrePosee = { x, y: haut - relatif.y, ancre, taille, longueur }
  return { ...posee, longueurMax, metres, cadre: cadreBarreEchelle(posee) }
}
