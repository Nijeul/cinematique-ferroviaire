import { create } from 'zustand'
import { chargerProjet } from '../domain/chargement.ts'
import type { Projet } from '../domain/projet.ts'
import contenuOcp1Sud from '../../fixtures/ocp1-sud.cinef?raw'

// État applicatif : le projet chargé et l'instant courant du curseur.
// Le jeu de données de référence est chargé au démarrage ; l'utilisateur
// pourra ouvrir un autre fichier .cinef.

type EtatApplication = {
  projet: Projet | null
  erreurs: string[]
  nomFichier: string
  t: number
  fixerT: (t: number) => void
  chargerTexte: (texte: string, nomFichier: string) => void
}

const chargementInitial = chargerProjet(contenuOcp1Sud)

export const useApplication = create<EtatApplication>((set) => ({
  projet: chargementInitial.ok ? chargementInitial.projet : null,
  erreurs: chargementInitial.ok ? [] : chargementInitial.erreurs,
  nomFichier: 'ocp1-sud.cinef',
  t: 0,
  fixerT: (t) => set({ t }),
  chargerTexte: (texte, nomFichier) => {
    const resultat = chargerProjet(texte)
    if (resultat.ok) set({ projet: resultat.projet, erreurs: [], nomFichier, t: 0 })
    else set({ erreurs: resultat.erreurs })
  },
}))
