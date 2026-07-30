import { create } from 'zustand'
import { chargerProjet } from '../domain/chargement.ts'
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
  fixerT: (t: number) => void
  chargerTexte: (texte: string, nomFichier: string) => void
  fixerOrthophoto: (orthophoto: OrthophotoChargee | null) => void
}

const chargementInitial = chargerProjet(contenuOcp1Sud)

export const useApplication = create<EtatApplication>((set) => ({
  projet: chargementInitial.ok ? chargementInitial.projet : null,
  erreurs: chargementInitial.ok ? [] : chargementInitial.erreurs,
  nomFichier: 'ocp1-sud.cinef',
  t: 0,
  orthophoto: null,
  fixerT: (t) => set({ t }),
  fixerOrthophoto: (orthophoto) => set({ orthophoto }),
  chargerTexte: (texte, nomFichier) => {
    const resultat = chargerProjet(texte)
    if (resultat.ok) set({ projet: resultat.projet, erreurs: [], nomFichier, t: 0 })
    else set({ erreurs: resultat.erreurs })
  },
}))
