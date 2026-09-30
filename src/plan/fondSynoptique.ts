import type { Synoptique } from './synoptique.ts'

// Opacité du fond de plan d'un synoptique, réglée depuis l'écran du
// synoptique (demande du commanditaire : « Je voudrais pouvoir modifier
// l'opacité du fond du plan depuis le synoptique »).
//
// Pas de nouveau champ : chaque image porte déjà, dans ses calques, une copie
// du calque « Fond » du plan (visible, opacité, verrouillé), faite à la
// création du synoptique ; c'est elle que le dessin, les vignettes et les
// exports utilisent. Le réglage du synoptique écrit la même opacité dans
// toutes ses images ; le plan d'origine ne change jamais.

// Opacité d'un fond sans réglage (celle d'un plan neuf).
export const OPACITE_FOND_PAR_DEFAUT = 1

// Pourcentage affiché par le curseur, borné de 0 à 100 et arrondi.
export function pourcentBorne(pourcent: number): number {
  if (!Number.isFinite(pourcent)) return Math.round(OPACITE_FOND_PAR_DEFAUT * 100)
  return Math.round(Math.min(100, Math.max(0, pourcent)))
}

// Opacité du fond telle qu'on la voit sur une image (0 à 1).
export function opaciteFond(s: Synoptique, index: number): number {
  const image = s.images[index] ?? s.images[0]
  const opacite = image?.contenu.calques.fond.opacite
  return typeof opacite === 'number' && Number.isFinite(opacite) ? Math.min(1, Math.max(0, opacite)) : OPACITE_FOND_PAR_DEFAUT
}

// En pourcentage, pour le curseur : « 60 % ».
export const pourcentOpaciteFond = (s: Synoptique, index: number): number => pourcentBorne(opaciteFond(s, index) * 100)

// Règle l'opacité du fond (en %, bornée de 0 à 100) dans toutes les images du
// synoptique. Le même synoptique si rien ne change.
export function modifierOpaciteFond(s: Synoptique, pourcent: number): Synoptique {
  const opacite = pourcentBorne(pourcent) / 100
  if (s.images.every((im) => im.contenu.calques.fond.opacite === opacite)) return s
  return {
    ...s,
    images: s.images.map((im) =>
      im.contenu.calques.fond.opacite === opacite
        ? im
        : { ...im, contenu: { ...im.contenu, calques: { ...im.contenu.calques, fond: { ...im.contenu.calques.fond, opacite } } } },
    ),
  }
}
