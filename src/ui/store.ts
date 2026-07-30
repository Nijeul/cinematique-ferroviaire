import { create } from 'zustand'
import { chargerProjet, verifierReferences } from '../domain/chargement.ts'
import type { Projet } from '../domain/projet.ts'
import type { Ancrage } from '../geometry/ancrage.ts'
import contenuOcp1Sud from '../../fixtures/ocp1-sud.cinef?raw'

export type OrthophotoChargee = {
  image: string
  largeurPx: number
  hauteurPx: number
  ancrages: [Ancrage, Ancrage]
}

// État applicatif : le projet chargé et l'instant courant du curseur.
// Le jeu de données de référence est chargé au démarrage ; l'utilisateur
// pourra ouvrir un autre fichier .cinef.

type EtatApplication = {
  projet: Projet | null
  erreurs: string[]
  nomFichier: string
  t: number
  orthophoto: OrthophotoChargee | null
  lecture: boolean
  // Vitesse de lecture : minutes de chantier par seconde réelle.
  vitesse: number
  // 'libre' (souris) ou l'id d'une vue du fichier .cinef.
  vueActive: string
  // Édition : avertissements de cohérence pendant la saisie, et outil de
  // tracé à la souris avec ses points en cours.
  editionOuverte: boolean
  avertissements: string[]
  outilTrace: 'aucun' | 'voie' | 'lieu' | 'zone' | 'appareil'
  pointsSaisie: [number, number][]
  fixerT: (t: number) => void
  chargerTexte: (texte: string, nomFichier: string) => void
  fixerOrthophoto: (orthophoto: OrthophotoChargee | null) => void
  basculerLecture: () => void
  fixerVitesse: (vitesse: number) => void
  avancer: (deltaSecondes: number) => void
  fixerVue: (vueActive: string) => void
  basculerEdition: () => void
  remplacerProjet: (projet: Projet) => void
  choisirOutil: (outil: EtatApplication['outilTrace']) => void
  ajouterPointSaisie: (point: [number, number]) => void
  viderSaisie: () => void
}

const chargementInitial = chargerProjet(contenuOcp1Sud)

export const useApplication = create<EtatApplication>((set) => ({
  projet: chargementInitial.ok ? chargementInitial.projet : null,
  erreurs: chargementInitial.ok ? [] : chargementInitial.erreurs,
  nomFichier: 'ocp1-sud.cinef',
  t: 0,
  orthophoto: null,
  lecture: false,
  vitesse: 60,
  vueActive: 'libre',
  fixerT: (t) => set({ t, lecture: false }),
  fixerOrthophoto: (orthophoto) => set({ orthophoto }),
  basculerLecture: () =>
    set((etat) => {
      // Relancer depuis la fin repart du début.
      const duree = etat.projet?.temps.dureeMinutes ?? 0
      if (!etat.lecture && etat.t >= duree) return { lecture: true, t: 0 }
      return { lecture: !etat.lecture }
    }),
  fixerVitesse: (vitesse) => set({ vitesse }),
  fixerVue: (vueActive) => set({ vueActive }),
  editionOuverte: false,
  avertissements: [],
  outilTrace: 'aucun',
  pointsSaisie: [],
  basculerEdition: () =>
    set((etat) => ({ editionOuverte: !etat.editionOuverte, outilTrace: 'aucun', pointsSaisie: [] })),
  remplacerProjet: (projet) => set({ projet, avertissements: verifierReferences(projet) }),
  choisirOutil: (outilTrace) => set({ outilTrace, pointsSaisie: [] }),
  ajouterPointSaisie: (point) =>
    set((etat) => ({ pointsSaisie: [...etat.pointsSaisie, point] })),
  viderSaisie: () => set({ outilTrace: 'aucun', pointsSaisie: [] }),
  avancer: (deltaSecondes) =>
    set((etat) => {
      if (!etat.lecture || !etat.projet) return {}
      const duree = etat.projet.temps.dureeMinutes
      const suivant = etat.t + deltaSecondes * etat.vitesse
      if (suivant >= duree) return { t: duree, lecture: false }
      return { t: suivant }
    }),
  chargerTexte: (texte, nomFichier) => {
    const resultat = chargerProjet(texte)
    if (resultat.ok) set({ projet: resultat.projet, erreurs: [], nomFichier, t: 0 })
    else set({ erreurs: resultat.erreurs })
  },
}))
