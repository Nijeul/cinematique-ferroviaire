// Fond de plan importé : reconnaissance du fichier, choix de la page d'un
// PDF, résolution du rendu. Le rendu lui-même (pdf.js, canvas) est côté
// interface ; ici, seulement les règles.

export type TypeFond = 'image' | 'pdf'

export function typeDeFond(nomFichier: string, typeMime: string): TypeFond | null {
  const nom = nomFichier.toLowerCase()
  if (typeMime === 'application/pdf' || nom.endsWith('.pdf')) return 'pdf'
  if (['image/png', 'image/jpeg'].includes(typeMime) || /\.(png|jpe?g)$/.test(nom)) return 'image'
  return null
}

// Page demandée ramenée dans le document (1 … nombre de pages). Une saisie
// vide ou fantaisiste revient à la page 1.
export function bornerPage(page: number, nombrePages: number): number {
  const max = Math.max(1, Math.floor(nombrePages))
  if (!Number.isFinite(page)) return 1
  return Math.min(max, Math.max(1, Math.round(page)))
}

// Plus grand côté de l'image rendue, en pixels : au-delà, un grand format
// (A0…) ferait exploser la mémoire du navigateur et la sauvegarde.
export const COTE_MAX_RENDU = 4096
export const ECHELLE_RENDU = 2

// Échelle de rendu d'une page de PDF (dimensions en points PDF) : deux fois
// la taille nominale pour un trait net, plafonnée pour les grands formats.
export function echelleRendu(largeurPoints: number, hauteurPoints: number): number {
  const cote = Math.max(largeurPoints, hauteurPoints)
  if (!(cote > 0)) return ECHELLE_RENDU
  return Math.min(ECHELLE_RENDU, COTE_MAX_RENDU / cote)
}
