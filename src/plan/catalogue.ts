import type { Resultat } from './echelle.ts'
import { nouvelIdentifiant } from './edition.ts'
import type { DimensionsEngin, TypeEngin } from './projet.ts'

// Le catalogue d'engins d'un chantier : les types qu'on pose sur les plans
// (catégorie, modèle, longueur et largeur en mètres, couleur de la
// catégorie). Chaque chantier a le sien, modifiable dans la page du chantier.

// ——— Liste par défaut ———
//
// Matériel générique fourni par le commanditaire (catégorie, modèle,
// longueur en mètres), avec la couleur de chaque catégorie dans son tableau.
// C'est le seul endroit où cette liste est écrite.
//
// - Largeur des engins ferroviaires : non fournie, 3,0 m par défaut
//   (question ouverte, modifiable type par type).
// - Pelle RR : dimensions d'une Caterpillar 323 vue de dessus en
//   configuration de transport (flèche repliée), environ 9,5 m × 3,2 m.
//   Valeurs à confirmer par le commanditaire.

export const LARGEUR_PAR_DEFAUT_M = 3

export const COULEURS_CATEGORIES = {
  Loco: '#66ff99',
  Ballastière: '#ff9933',
  Bigrue: '#ccccff',
  BML: '#ff9999',
  Stabilisateur: '#3399ff',
  Wagon: '#ff9933',
  'Pelle RR': '#e8a33d',
} as const

type Categorie = keyof typeof COULEURS_CATEGORIES

const TABLEAU: [Categorie, string, number][] = [
  ['Loco', 'BB 61000', 14.5],
  ['Loco', 'V211', 12.3],
  ['Ballastière', 'D12', 14],
  ['Ballastière', 'Ex 100', 15.64],
  ['Ballastière', 'C12', 9.64],
  ['Bigrue', 'Type DGS82BG', 32.6],
  ['Bigrue', 'Socofer', 19.9],
  ['BML', 'Type 08-32U', 31],
  ['BML', 'Type 08 GV', 31.5],
  ['BML', 'Type 108-32 U', 32.8],
  ['Stabilisateur', 'Type DGS82', 32.8],
  ['Wagon', 'R39', 19.9],
]

const PELLE_RR: DimensionsEngin = {
  categorie: 'Pelle RR',
  modele: 'CAT 323',
  longueur: 9.5,
  largeur: 3.2,
  couleur: COULEURS_CATEGORIES['Pelle RR'],
}

export const CATALOGUE_PAR_DEFAUT: readonly TypeEngin[] = [
  ...TABLEAU.map(([categorie, modele, longueur], i) => ({
    id: `type-${i + 1}`,
    categorie,
    modele,
    longueur,
    largeur: LARGEUR_PAR_DEFAUT_M,
    couleur: COULEURS_CATEGORIES[categorie],
  })),
  { id: `type-${TABLEAU.length + 1}`, ...PELLE_RR },
]

export const creerCatalogue = (): TypeEngin[] => CATALOGUE_PAR_DEFAUT.map((t) => ({ ...t }))

// ——— Lecture du catalogue ———

// Types regroupés par catégorie, dans l'ordre de première apparition.
export function parCategorie(catalogue: TypeEngin[]): { categorie: string; types: TypeEngin[] }[] {
  const groupes: { categorie: string; types: TypeEngin[] }[] = []
  for (const type of catalogue) {
    const groupe = groupes.find((g) => g.categorie === type.categorie)
    if (groupe) groupe.types.push(type)
    else groupes.push({ categorie: type.categorie, types: [type] })
  }
  return groupes
}

export const dimensionsDe = (type: TypeEngin): DimensionsEngin => ({
  categorie: type.categorie,
  modele: type.modele,
  longueur: type.longueur,
  largeur: type.largeur,
  couleur: type.couleur,
})

// ——— Modification ———

export type ChampsType = Partial<DimensionsEngin>

// Refus d'une valeur impossible, avec un message prêt à afficher.
export function erreurType(champs: ChampsType): string | null {
  if (champs.modele !== undefined && champs.modele.trim() === '') return 'Donnez un nom de modèle.'
  if (champs.categorie !== undefined && champs.categorie.trim() === '') return 'Donnez une catégorie.'
  if (champs.longueur !== undefined && !(champs.longueur > 0 && Number.isFinite(champs.longueur))) {
    return 'La longueur doit être un nombre de mètres plus grand que zéro.'
  }
  if (champs.largeur !== undefined && !(champs.largeur > 0 && Number.isFinite(champs.largeur))) {
    return 'La largeur doit être un nombre de mètres plus grand que zéro.'
  }
  return null
}

// Couleur proposée pour un nouveau type : celle de sa catégorie si elle
// existe déjà dans le catalogue, un gris neutre sinon.
export const COULEUR_NOUVELLE_CATEGORIE = '#9aa4ae'
export const couleurDeCategorie = (catalogue: TypeEngin[], categorie: string): string =>
  catalogue.find((t) => t.categorie.trim().toLowerCase() === categorie.trim().toLowerCase())?.couleur ?? COULEUR_NOUVELLE_CATEGORIE

// Nouveau type, avec les dimensions saisies par l'utilisateur (aucune valeur
// inventée) ; refusé avec un message si une valeur est impossible.
export function ajouterType(catalogue: TypeEngin[], dimensions: DimensionsEngin): Resultat<{ catalogue: TypeEngin[]; id: string }> {
  const erreur = erreurType(dimensions)
  if (erreur) return { ok: false, erreur }
  const id = nouvelIdentifiant(catalogue, 'type')
  const type: TypeEngin = { id, ...dimensions, categorie: dimensions.categorie.trim(), modele: dimensions.modele.trim() }
  return { ok: true, valeur: { id, catalogue: [...catalogue, type] } }
}

export function modifierType(catalogue: TypeEngin[], id: string, champs: ChampsType): Resultat<TypeEngin[]> {
  const erreur = erreurType(champs)
  if (erreur) return { ok: false, erreur }
  return { ok: true, valeur: catalogue.map((t) => (t.id === id ? { ...t, ...champs } : t)) }
}

export const supprimerType = (catalogue: TypeEngin[], id: string): TypeEngin[] => catalogue.filter((t) => t.id !== id)
