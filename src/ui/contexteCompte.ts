import { createContext } from 'react'

// Le compte connecté, affiché à droite de la barre du haut de chaque écran
// (absent quand on travaille dans ce navigateur seulement).
export type Compte = { email: string; deconnecter: () => void }

export const ContexteCompte = createContext<Compte | null>(null)
