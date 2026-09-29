import type { Synoptique } from './synoptique.ts'

// Le cartouche de la page de garde d'un synoptique exporté (PowerPoint ou
// PDF), comme sur les documents du commanditaire : émetteur, type de
// document, indice, date, établi par, validé par, approuvé par, modification.
// Il se remplit dans les propriétés du synoptique, s'enregistre avec lui et
// voyage avec l'export du chantier. Tous les champs sont du texte libre (la
// date comprise : « 25/08/2026 », « août 2026 »…).

export type Cartouche = {
  emetteur: string
  typeDocument: string
  indice: string
  date: string
  etabliPar: string
  validePar: string
  approuvePar: string
  modification: string
}

export type ChampCartouche = keyof Cartouche

export const TYPE_DOCUMENT_PAR_DEFAUT = 'Synoptique'

// Un cartouche neuf : tout est vide, sauf le type de document.
export const creerCartouche = (): Cartouche => ({
  emetteur: '',
  typeDocument: TYPE_DOCUMENT_PAR_DEFAUT,
  indice: '',
  date: '',
  etabliPar: '',
  validePar: '',
  approuvePar: '',
  modification: '',
})

// Les champs dans l'ordre du tableau de la page de garde, avec leur libellé
// et leur part de la largeur du tableau (la modification, plus longue, a la
// plus grande colonne).
export const CHAMPS_CARTOUCHE: readonly { champ: ChampCartouche; libelle: string; poids: number }[] = [
  { champ: 'emetteur', libelle: 'Émetteur', poids: 1.3 },
  { champ: 'typeDocument', libelle: 'Type de document', poids: 1.6 },
  { champ: 'indice', libelle: 'Indice', poids: 0.8 },
  { champ: 'date', libelle: 'Date', poids: 1.1 },
  { champ: 'etabliPar', libelle: 'Établi par', poids: 1.3 },
  { champ: 'validePar', libelle: 'Validé par', poids: 1.3 },
  { champ: 'approuvePar', libelle: 'Approuvé par', poids: 1.3 },
  { champ: 'modification', libelle: 'Modification', poids: 3 },
]

// Cartouche relu d'un fichier ou d'un chantier gardé dans le navigateur :
// chaque champ absent ou illisible est vide (le type de document reprend sa
// valeur par défaut). Les synoptiques d'avant l'étape 8 n'en ont pas.
export function lireCartouche(brut: unknown): Cartouche {
  const c = typeof brut === 'object' && brut !== null && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {}
  const cartouche = creerCartouche()
  for (const { champ } of CHAMPS_CARTOUCHE) {
    if (typeof c[champ] === 'string') cartouche[champ] = c[champ]
  }
  return cartouche
}

export const cartoucheVide = (c: Cartouche): boolean =>
  CHAMPS_CARTOUCHE.every(({ champ }) => champ === 'typeDocument' || c[champ].trim() === '')

// Résumé d'une ligne pour la fenêtre d'export : « Indice B · 25/08/2026 ·
// établi par J. Martin », ou « à remplir ».
export function resumeCartouche(c: Cartouche): string {
  if (cartoucheVide(c)) return 'à remplir'
  const parties = [
    c.indice.trim() && `indice ${c.indice.trim()}`,
    c.date.trim(),
    c.etabliPar.trim() && `établi par ${c.etabliPar.trim()}`,
  ].filter((p) => p !== '')
  return parties.length > 0 ? parties.join(' · ') : 'rempli en partie'
}

export function modifierCartouche(s: Synoptique, champs: Partial<Cartouche>): Synoptique {
  return { ...s, cartouche: { ...s.cartouche, ...champs } }
}
