import type { Route } from './adresse.ts'

// Plantage d'un écran : ce que la barrière d'erreur propose et le détail
// technique à transmettre. Plus jamais de page blanche : un message en
// français, un chemin de retour, et le texte exact de l'erreur.

export const MESSAGE_ERREUR_ECRAN = 'Une erreur est survenue sur cet écran. Vos chantiers sont conservés dans ce navigateur.'

// Même écran = même chantier, même plan ou même synoptique (le numéro de
// l'image n'en fait pas un autre) : la barrière ne se referme qu'en changeant
// d'écran.
export function cleEcran(route: Route): string {
  switch (route.ecran) {
    case 'accueil':
      return 'accueil'
    case 'chantier':
      return `chantier:${route.chantierId}`
    case 'plan':
      return `plan:${route.chantierId}:${route.planId}`
    case 'synoptique':
      return `synoptique:${route.chantierId}:${route.synoptiqueId}`
  }
}

// Où revenir : la page du chantier (sauf depuis l'accueil, qui n'en a pas) et
// l'accueil.
export function retoursApresErreur(route: Route): { chantier: Route | null; accueil: Route } {
  return {
    chantier: route.ecran === 'accueil' ? null : { ecran: 'chantier', chantierId: route.chantierId },
    accueil: { ecran: 'accueil' },
  }
}

export type Plantage = {
  // Nom et message de l'erreur, pile d'appels, composants traversés.
  nom: string
  message: string
  pile: string | null
  pileComposants: string | null
  adresse: string
  navigateur: string
  // Date ISO.
  quand: string
}

// Ce que l'erreur lancée contient, quelle qu'elle soit (une erreur peut être
// n'importe quelle valeur en JavaScript).
export function decrireErreur(erreur: unknown): Pick<Plantage, 'nom' | 'message' | 'pile'> {
  if (erreur instanceof Error) return { nom: erreur.name, message: erreur.message, pile: erreur.stack ?? null }
  let message: string
  try {
    message = typeof erreur === 'string' ? erreur : JSON.stringify(erreur) ?? String(erreur)
  } catch {
    message = String(erreur)
  }
  return { nom: 'Erreur', message, pile: null }
}

// Le texte à copier et à transmettre tel quel.
export function detailTechnique(p: Plantage): string {
  const lignes = [
    `${p.nom} : ${p.message}`,
    `Écran : ${p.adresse || '#/'}`,
    `Date : ${p.quand}`,
    `Navigateur : ${p.navigateur}`,
  ]
  if (p.pile) lignes.push('', 'Pile :', p.pile.trim())
  if (p.pileComposants) lignes.push('', 'Composants :', p.pileComposants.trim())
  return lignes.join('\n')
}
