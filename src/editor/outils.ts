import type { Projet, Voie } from '../domain/projet.ts'
import { ETAT_INITIAL_DEFAUT } from '../domain/etats.ts'
import { projeterSurCourbe } from '../geometry/courbe.ts'
import { courbeDeVoie } from '../geometry/referencement.ts'
import { useApplication } from '../ui/store.ts'

// Outils communs de l'éditeur : modification immuable du projet, PK au clic,
// identifiants uniques, gabarit de chantier vierge.

export function modifierProjet(transformation: (projet: Projet) => void): void {
  const { projet, remplacerProjet } = useApplication.getState()
  if (!projet) return
  const copie = structuredClone(projet)
  transformation(copie)
  remplacerProjet(copie)
}

export function idUnique(prefixe: string, existants: { id: string }[]): string {
  let n = existants.length + 1
  while (existants.some((e) => e.id === `${prefixe}-${n}`)) n++
  return `${prefixe}-${n}`
}

// PK (km, arrondi au mètre) du point de la voie le plus proche du clic.
export function pkAuClic(voie: Voie, point: [number, number]): number {
  const { s } = projeterSurCourbe(courbeDeVoie(voie), point)
  return Math.round((voie.pkOrigine ?? 0) * 1000 + s) / 1000
}

export const arrondiMetre = (valeur: number): number => Math.round(valeur * 1000) / 1000

export function nouveauProjetVide(): Projet {
  return {
    meta: { chantier: 'Nouveau chantier' },
    temps: {
      t0: '2026-01-02T22:00:00',
      libelleT0: "Prise d'interception",
      dureeMinutes: 480,
      libelleFin: 'Restitution',
      pasCreneau: 30,
    },
    site: {
      voies: [
        { id: 'voie-1', nom: 'V1', polyligne: [[0, 0], [300, 0]], pkOrigine: 0 },
      ],
      appareils: [],
      zones: [],
      lieux: [
        {
          id: 'lieu-1',
          nom: 'Base arrière',
          type: 'base_arriere',
          contour: [[-60, -20], [-10, -20], [-10, 20], [-60, 20]],
        },
      ],
    },
    ressources: [],
    stocks: {},
    operations: [],
    vues: [{ id: 'generale', type: 'orthographique_inclinee', cible: 'site', angle: 35 }],
  }
}

export const ETAT_INITIAL_ZONE = ETAT_INITIAL_DEFAUT
