import { recomposer, type Restauration } from '../plan/sauvegarde.ts'

// Ce qui touche au navigateur hors des chantiers : la sauvegarde automatique
// des étapes 2 et 3 (localStorage), lue une seule fois pour être reprise, et
// le téléchargement d'un fichier (chantier, plan, export PowerPoint ou PDF).
// Rien ici ne doit faire planter l'application.

const CLE_PROJET = 'cinematique-ferroviaire/projet'
const CLE_FOND = 'cinematique-ferroviaire/fond'

export function lireAncienneSauvegarde(): Extract<Restauration, { ok: true }> | null {
  try {
    const texte = localStorage.getItem(CLE_PROJET)
    if (!texte) return null
    const restauration = recomposer(texte, localStorage.getItem(CLE_FOND))
    return restauration.ok ? restauration : null
  } catch {
    return null
  }
}

// Une fois le plan rangé dans le « Chantier récupéré », l'ancienne sauvegarde
// est effacée : elle ne serait plus à jour, et elle occupe de la place.
export function oublierAncienneSauvegarde(): void {
  try {
    localStorage.removeItem(CLE_PROJET)
    localStorage.removeItem(CLE_FOND)
  } catch {
    // Stockage interdit : rien à effacer.
  }
}

// Enregistre un fichier dans les téléchargements : un texte JSON (chantier,
// plan) ou un fichier déjà construit (PowerPoint, PDF).
export function telecharger(nomFichier: string, contenu: string | Blob): void {
  const url = URL.createObjectURL(typeof contenu === 'string' ? new Blob([contenu], { type: 'application/json' }) : contenu)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Lit un fichier texte choisi par l'utilisateur ; null s'il est illisible.
export async function lireFichierTexte(fichier: File): Promise<string | null> {
  try {
    return await fichier.text()
  } catch {
    return null
  }
}
