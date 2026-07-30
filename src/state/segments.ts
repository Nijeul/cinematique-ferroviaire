import type { Couche } from '../domain/etats.ts'
import type { EtatZoneScene } from './etatScene.ts'

// Découpage d'une zone en segments homogènes pour une couche donnée, en
// tenant compte des fronts de progression. Les positions sont des fractions
// de la zone dans le sens des PK croissants : 0 = pkDebut, 1 = pkFin.
//
// C'est ici que le « front qui progresse » devient concret : à fraction f,
// la part parcourue est dans l'état d'arrivée, le reste dans l'état de
// départ, dans la direction donnée par le sens de l'opération. Plusieurs
// opérations simultanées sur la même couche se composent dans l'ordre du
// phasage.

export type SegmentCouche = {
  de: number
  a: number
  valeur: string
}

export function segmentsDeCouche(etatZone: EtatZoneScene, couche: Couche): SegmentCouche[] {
  const fronts = etatZone.fronts.filter((f) => f.couche === couche)
  const valeurBase = etatZone.couches[couche]
  if (fronts.length === 0) return [{ de: 0, a: 1, valeur: valeurBase }]

  const bornes = new Set<number>([0, 1])
  for (const front of fronts) {
    const borne = front.sens === 'pk_croissant' ? front.fraction : 1 - front.fraction
    bornes.add(Math.min(Math.max(borne, 0), 1))
  }
  const ordonnees = [...bornes].sort((a, b) => a - b)

  const valeurA = (position: number): string => {
    let valeur: string = valeurBase
    for (const front of fronts) {
      const couvert =
        front.sens === 'pk_croissant'
          ? position <= front.fraction
          : position >= 1 - front.fraction
      if (couvert) valeur = front.vers
    }
    return valeur
  }

  const segments: SegmentCouche[] = []
  for (let i = 0; i < ordonnees.length - 1; i++) {
    const de = ordonnees[i]
    const a = ordonnees[i + 1]
    if (a - de < 1e-9) continue
    const valeur = valeurA((de + a) / 2)
    const precedent = segments[segments.length - 1]
    if (precedent && precedent.valeur === valeur) precedent.a = a
    else segments.push({ de, a, valeur })
  }
  return segments
}
