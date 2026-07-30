import type { Couche, EtatZone } from '../domain/etats.ts'

// État complet du chantier à un instant t, renvoyé par etatAt().
// Tout le rendu en découle : aucun de ces types ne connaît React ni Three.

export type Sens = 'pk_croissant' | 'pk_decroissant'

// Front de progression d'une opération linéaire en cours : à `fraction`,
// la part écoulée de la zone est dans l'état `vers`, le reste dans `de`,
// dans la direction donnée par `sens`.
export type Front = {
  couche: Couche
  de: string
  vers: string
  sens: Sens
  fraction: number
  operation: string
}

export type EtatZoneScene = {
  couches: EtatZone
  fronts: Front[]
}

// Position sur voie : jamais de XYZ, c'est pose() (geometry/) qui convertit.
export type PositionVoie = { type: 'voie'; voie: string; pk: number; offset?: number }
export type PositionLieu = { type: 'lieu'; lieu: string }
export type PositionTransit = {
  type: 'transit'
  de: PositionVoie | PositionLieu
  vers: PositionVoie | PositionLieu
  fraction: number
}
export type Position = PositionVoie | PositionLieu | PositionTransit

// Où se trouve un panneau d'appareil : chez son appareil (en place), dans un
// lieu, ou porté par un engin pendant un acheminement.
export type EmplacementPanneau = {
  chez: string
  enTransit?: { porteur: string; fraction: number; vers: string }
}

export type EtatAppareil = {
  pose: boolean
  // Dépose ou pose en cours : avancement de l'opération correspondante.
  enCours?: { verbe: 'deposer_adv' | 'poser_adv'; fraction: number; operation: string }
  panneaux: Record<string, EmplacementPanneau>
}

export type Contenu = { quoi: string; quantite: number }

export type EtatRessource = {
  position: Position
  mode?: 'rail' | 'route'
  charge: Contenu[]
}

export type EtatScene = {
  zones: Record<string, EtatZoneScene>
  appareils: Record<string, EtatAppareil>
  ressources: Record<string, EtatRessource>
  stocks: Record<string, { contenus: Contenu[] }>
  operations: string[]
}
