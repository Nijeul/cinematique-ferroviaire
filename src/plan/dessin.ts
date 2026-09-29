import type { Rectangle } from './elements.ts'
import { tailleNom } from './geometrie.ts'
import { epaisseurParDefaut, type Appareil, type Point, type Projet, type Voie, type Zone } from './projet.ts'
import { pointAAbscisse } from './trace.ts'

// Ce qu'il faut calculer pour dessiner zones, appareils et extrémités : la
// largeur des bandes, la place des étiquettes, le triangle de pointe, le sens
// d'un BS. Proportions reprises de l'aperçu validé à l'étape 1.

// Zone : bande de 22 px pour une voie de 8,5 px sur l'aperçu.
export const largeurBandeZone = (voie: Pick<Voie, 'epaisseur'>): number => voie.epaisseur * 2.4
export const tailleEtiquetteZone = (voie: Pick<Voie, 'epaisseur'>): number => Math.round(tailleNom(voie.epaisseur) * 0.8)
export const tailleNomAppareil = (epaisseur: number): number => Math.round(tailleNom(epaisseur) * 0.85)

// Largeur approximative d'un texte (sans navigateur, on ne peut pas mesurer) :
// assez juste pour éviter les chevauchements et choisir au clic.
export const largeurTexteEstimee = (texte: string, taille: number, gras = false): number =>
  Math.max(1, texte.length) * taille * (gras ? 0.64 : 0.6)

// Liste de points au format attendu par <polyline points="…"> en SVG.
export const enPoints = (points: Point[]): string => points.map((p) => `${p.x},${p.y}`).join(' ')

export type Cote = 'dessus' | 'dessous'

// Étiquettes des zones d'une même voie : au-dessus, sauf si elle chevaucherait
// l'étiquette précédente — elle passe alors dessous (alternance de l'aperçu).
export function cotesEtiquettesZones(projet: Pick<Projet, 'voies' | 'zones'>): Map<string, Cote> {
  const cotes = new Map<string, Cote>()
  for (const voie of projet.voies) {
    const taille = tailleEtiquetteZone(voie)
    const zones = projet.zones
      .filter((z) => z.voieId === voie.id)
      .sort((a, b) => a.debut + a.fin - (b.debut + b.fin))
    const finOccupee: Record<Cote, number> = { dessus: -Infinity, dessous: -Infinity }
    for (const zone of zones) {
      const milieu = (zone.debut + zone.fin) / 2
      const demi = largeurTexteEstimee(zone.nom, taille) / 2
      const ecart = taille * 0.5
      const cote: Cote =
        milieu - demi >= finOccupee.dessus + ecart
          ? 'dessus'
          : milieu - demi >= finOccupee.dessous + ecart
            ? 'dessous'
            : finOccupee.dessus <= finOccupee.dessous
              ? 'dessus'
              : 'dessous'
      finOccupee[cote] = milieu + demi
      cotes.set(zone.id, cote)
    }
  }
  return cotes
}

export type Etiquette = { x: number; y: number; ancre: 'start' | 'middle' | 'end' }

// Place une étiquette horizontale à côté d'un point, dans la direction `n`
// (unitaire), à la distance `ecart` : le texte ne déborde pas vers le point.
function etiquetteVers(p: Point, n: Point, ecart: number, taille: number): Etiquette {
  const x = p.x + n.x * ecart
  const y = p.y + n.y * ecart
  if (Math.abs(n.y) > 0.7) return { x, y: n.y < 0 ? y - taille * 0.1 : y + taille * 0.75, ancre: 'middle' }
  return { x, y: y + taille * 0.35, ancre: n.x < 0 ? 'end' : 'start' }
}

// Normale « vers le haut » d'une direction (vers la gauche si la direction
// est verticale).
function normaleHaut(d: Point): Point {
  const n = { x: d.y, y: -d.x }
  if (Math.abs(n.y) > 1e-9) return n.y < 0 ? n : { x: -n.x, y: -n.y }
  return n.x < 0 ? n : { x: -n.x, y: -n.y }
}

export function etiquetteZone(voie: Voie, zone: Zone, cote: Cote): Etiquette {
  const { point, direction } = pointAAbscisse(voie.points, (zone.debut + zone.fin) / 2)
  const haut = normaleHaut(direction)
  const n = cote === 'dessus' ? haut : { x: -haut.x, y: -haut.y }
  const taille = tailleEtiquetteZone(voie)
  return etiquetteVers(point, n, largeurBandeZone(voie) / 2 + taille * 0.3, taille)
}

// ——— Appareils ———

export type BoutsAppareil = { pointe: Point; talon: Point; epaisseur: number }

// Position sur le plan de la pointe et du talon ; épaisseur du biais = celle
// de la plus fine des deux voies.
export function boutsAppareil(projet: Pick<Projet, 'voies'>, appareil: Appareil): BoutsAppareil | null {
  const directe = projet.voies.find((v) => v.id === appareil.pointe.voieId)
  const deviee = projet.voies.find((v) => v.id === appareil.talon.voieId)
  if (!directe || !deviee) return null
  return {
    pointe: pointAAbscisse(directe.points, appareil.pointe.abscisse).point,
    talon: pointAAbscisse(deviee.points, appareil.talon.abscisse).point,
    epaisseur: Math.min(directe.epaisseur, deviee.epaisseur),
  }
}

// Sens d'un BS sur le plan : la pointe est-elle à gauche ou à droite du
// talon ? (null pour un biais vertical, sans sens gauche/droite.)
export function sensAppareil(pointe: Point, talon: Point): 'gauche' | 'droite' | null {
  const dx = talon.x - pointe.x
  if (Math.abs(dx) < 1e-6) return null
  return dx > 0 ? 'gauche' : 'droite'
}

// Libellé « pointe côté Paris » d'après les noms des extrémités du plan.
export function libelleSens(projet: Pick<Projet, 'voies' | 'extremites'>, appareil: Appareil): string {
  const bouts = boutsAppareil(projet, appareil)
  const sens = bouts && sensAppareil(bouts.pointe, bouts.talon)
  if (!sens) return 'biais vertical : pas de côté gauche ou droit'
  return `pointe côté ${projet.extremites[sens] || (sens === 'gauche' ? 'gauche' : 'droit')}`
}

// Petit triangle plein à la pointe, pointé vers le talon, posé sur le biais
// juste après la voie directe.
export function triangleDePointe(pointe: Point, talon: Point, epaisseur: number): Point[] {
  const longueur = Math.hypot(talon.x - pointe.x, talon.y - pointe.y)
  if (longueur === 0) return []
  const u = { x: (talon.x - pointe.x) / longueur, y: (talon.y - pointe.y) / longueur }
  const n = { x: -u.y, y: u.x }
  const depart = Math.min(epaisseur * 0.6, longueur * 0.2)
  const bout = Math.min(depart + epaisseur * 2.6, longueur * 0.5)
  const demiBase = epaisseur
  const base = { x: pointe.x + u.x * depart, y: pointe.y + u.y * depart }
  return [
    { x: base.x + n.x * demiBase, y: base.y + n.y * demiBase },
    { x: pointe.x + u.x * bout, y: pointe.y + u.y * bout },
    { x: base.x - n.x * demiBase, y: base.y - n.y * demiBase },
  ]
}

// Nom d'un appareil : en gras, à droite du biais (au-dessus s'il est presque
// horizontal), à la fraction `t` du biais depuis `depart`.
export function etiquetteAppareil(depart: Point, arrivee: Point, epaisseur: number, t = 0.5): Etiquette {
  const longueur = Math.hypot(arrivee.x - depart.x, arrivee.y - depart.y) || 1
  const u = { x: (arrivee.x - depart.x) / longueur, y: (arrivee.y - depart.y) / longueur }
  let n = { x: -u.y, y: u.x }
  if (Math.abs(n.x) < 0.35) n = n.y < 0 ? n : { x: -n.x, y: -n.y }
  else if (n.x < 0) n = { x: -n.x, y: -n.y }
  const p = { x: depart.x + (arrivee.x - depart.x) * t, y: depart.y + (arrivee.y - depart.y) * t }
  const taille = tailleNomAppareil(epaisseur)
  return etiquetteVers(p, n, epaisseur * 0.9 + taille * 0.25, taille)
}

// ——— Extrémités du plan ———

// Emprise de ce qui est dessiné (voies et cadres) ; la feuille entière s'il
// n'y a rien.
export function emprise(projet: Pick<Projet, 'voies' | 'cadres' | 'largeur' | 'hauteur'>): Rectangle {
  const xs: number[] = []
  const ys: number[] = []
  for (const voie of projet.voies) {
    for (const p of voie.points) {
      xs.push(p.x)
      ys.push(p.y)
    }
  }
  for (const c of projet.cadres) {
    xs.push(c.x, c.x + c.largeur)
    ys.push(c.y, c.y + c.hauteur)
  }
  if (xs.length === 0) return { x: 0, y: 0, largeur: projet.largeur, hauteur: projet.hauteur }
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, largeur: Math.max(...xs) - x, hauteur: Math.max(...ys) - y }
}

// « ◀ Paris » en haut à gauche de l'emprise, « Poitiers ▶ » en haut à droite,
// sans sortir de la feuille.
export function positionsExtremites(projet: Pick<Projet, 'voies' | 'cadres' | 'largeur' | 'hauteur'>): {
  taille: number
  gauche: Point
  droite: Point
} {
  const taille = tailleNom(epaisseurParDefaut(projet))
  const e = emprise(projet)
  const y = Math.max(taille * 1.2, e.y - taille * 1.8)
  return { taille, gauche: { x: Math.max(0, e.x), y }, droite: { x: Math.min(projet.largeur, e.x + e.largeur), y } }
}
