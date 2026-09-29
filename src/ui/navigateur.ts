import type { Projet } from '../plan/projet.ts'
import { decouper, recomposer, type Restauration } from '../plan/sauvegarde.ts'

// Ce qui touche au navigateur : sauvegarde automatique (localStorage) et
// téléchargement du fichier projet. Le stockage peut être plein ou interdit
// (navigation privée) : rien ici ne doit faire planter l'application.

const CLE_PROJET = 'cinematique-ferroviaire/projet'
const CLE_FOND = 'cinematique-ferroviaire/fond'

// Image actuellement stockée, et dernière image refusée faute de place (pour
// ne pas retenter d'écrire plusieurs mégaoctets à chaque modification).
let imageEnPlace: string | null = null
let imageRefusee: string | null = null

export function chargerSauvegarde(): Extract<Restauration, { ok: true }> | null {
  try {
    const texte = localStorage.getItem(CLE_PROJET)
    if (!texte) return null
    const image = localStorage.getItem(CLE_FOND)
    const restauration = recomposer(texte, image)
    if (!restauration.ok) return null
    imageEnPlace = image
    return restauration
  } catch {
    return null
  }
}

// 'sansFond' : les voies sont sauvées mais pas l'image, trop lourde.
export type EtatSauvegarde = 'ok' | 'sansFond' | 'impossible'

export function sauvegarder(projet: Projet): EtatSauvegarde {
  const morceaux = decouper(projet)
  try {
    localStorage.setItem(CLE_PROJET, morceaux.projet)
  } catch {
    return 'impossible'
  }
  if (morceaux.image !== imageEnPlace && morceaux.image !== imageRefusee) {
    try {
      // L'ancienne image d'abord, pour libérer sa place.
      localStorage.removeItem(CLE_FOND)
      imageEnPlace = null
      if (morceaux.image !== null) localStorage.setItem(CLE_FOND, morceaux.image)
      imageEnPlace = morceaux.image
      imageRefusee = null
    } catch {
      imageRefusee = morceaux.image
    }
  }
  return morceaux.image !== null && morceaux.image === imageRefusee ? 'sansFond' : 'ok'
}

export function telecharger(nomFichier: string, contenu: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
