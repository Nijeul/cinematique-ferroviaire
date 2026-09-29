import { lireProjet } from './lecture.ts'
import { serialiserProjet, type Projet } from './projet.ts'

// Sauvegarde automatique dans le navigateur, en deux morceaux : le projet
// sans l'image (léger, réécrit à chaque modification) et l'image du fond
// (lourde, réécrite seulement quand le fond change). Si l'image dépasse la
// place disponible, les voies sont quand même sauvées.

export type Morceaux = { projet: string; image: string | null }

export function decouper(projet: Projet): Morceaux {
  const sansImage = projet.fond ? { ...projet, fond: { ...projet.fond, image: '' } } : projet
  return { projet: serialiserProjet(sansImage), image: projet.fond?.image || null }
}

export type Restauration =
  | { ok: true; projet: Projet; fondManquant: boolean }
  | { ok: false; erreurs: string[] }

export function recomposer(texteProjet: string, image: string | null): Restauration {
  const lu = lireProjet(texteProjet)
  if (!lu.ok) return lu
  const { projet } = lu
  if (!projet.fond) return { ok: true, projet, fondManquant: false }
  if (image && image.startsWith('data:image/')) {
    return { ok: true, projet: { ...projet, fond: { ...projet.fond, image } }, fondManquant: false }
  }
  return { ok: true, projet: { ...projet, fond: { ...projet.fond, image: '' } }, fondManquant: true }
}
