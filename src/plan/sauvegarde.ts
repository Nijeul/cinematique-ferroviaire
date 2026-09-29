import { lireProjet } from './lecture.ts'
import type { Projet } from './projet.ts'

// Reprise de la sauvegarde automatique des étapes 2 et 3. Elle était rangée
// dans le navigateur en deux morceaux : le projet sans l'image, et l'image du
// fond à part (parfois absente, faute de place). À l'étape 4, elle devient le
// premier plan du « Chantier récupéré ».

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
