import { largeurTexteEstimee } from './dessin.ts'
import { nouvelIdentifiant } from './edition.ts'
import type { Rectangle } from './elements.ts'
import type { Calque, Point } from './projet.ts'
import type { Synoptique } from './synoptique.ts'

// Les commentaires d'une image de synoptique : des textes libres posés où l'on
// veut sur l'image (« RCT en place », « Enraillement sur platelage V2 »,
// « PRR en attente côté Paris »…). Ce qui n'a pas de symbole sur la planche
// (retour courant traction, platelage) y est écrit. Chaque image a les siens ;
// « Nouvelle image » les recopie, comme les engins et les flèches. Dans
// l'export PowerPoint « Textes modifiables », chaque commentaire devient une
// zone de texte PowerPoint posée exactement à sa place.

export type Commentaire = {
  id: string
  // Une ou plusieurs lignes (retours à la ligne tapés).
  texte: string
  // Coin haut gauche de son cadre, en unités du plan.
  x: number
  y: number
  // Facteur de la taille normale (1 : un peu plus petit que les étapes du PHASAGE).
  taille: number
  couleur: string
  gras: boolean
  // Cadre blanc bordé de la couleur du texte, qui le détache du plan ; sans
  // cadre, le texte a un liseré blanc.
  encadre: boolean
}

export const TAILLES_COMMENTAIRE: readonly { valeur: number; libelle: string }[] = [
  { valeur: 0.8, libelle: 'Petit' },
  { valeur: 1, libelle: 'Moyen' },
  { valeur: 1.4, libelle: 'Grand' },
  { valeur: 2, libelle: 'Très grand' },
]

export const COULEUR_COMMENTAIRE_PAR_DEFAUT = '#1c2430'
export const TEXTE_COMMENTAIRE_PAR_DEFAUT = 'Commentaire'
export const CALQUE_COMMENTAIRES_PAR_DEFAUT: Calque = { visible: true, verrouille: false }

// Ce dont dépend la taille d'un commentaire : la partie du plan montrée.
export type Cadre = Pick<Synoptique, 'cadrage' | 'largeur' | 'hauteur'>

// Taille normale du texte, en unités du plan : proportionnée à la partie du
// plan montrée (comme les textes de la planche, voir planche.ts), pour être
// lisible sur la planche quelle que soit la taille du plan.
export function tailleBaseCommentaire(s: Cadre): number {
  const carte = s.cadrage ?? { largeur: s.largeur, hauteur: s.hauteur }
  return (Math.max(carte.largeur, carte.hauteur * 1.6) / 100) * 1.25
}

const INTERLIGNE = 1.25

export type LigneCommentaire = { texte: string; x: number; y: number }

export type MiseEnPageCommentaire = {
  boite: Rectangle
  lignes: LigneCommentaire[]
  // Taille du texte, retrait intérieur et interligne, en unités du plan.
  taille: number
  retrait: number
  interligne: number
}

export const lignesDuTexte = (texte: string): string[] => texte.replace(/\r/g, '').split('\n')

// Cadre et lignes d'un commentaire (largeur estimée : sans navigateur, on ne
// mesure pas le texte ; l'estimation est un peu large, le texte tient).
export function miseEnPageCommentaire(c: Commentaire, cadre: Cadre): MiseEnPageCommentaire {
  const taille = tailleBaseCommentaire(cadre) * c.taille
  const retrait = taille * 0.35
  const interligne = taille * INTERLIGNE
  const textes = lignesDuTexte(c.texte)
  const largeur = Math.max(taille * 2, ...textes.map((t) => largeurTexteEstimee(t, taille, c.gras))) + 2 * retrait
  const hauteur = textes.length * interligne + 2 * retrait * 0.7
  return {
    boite: { x: c.x, y: c.y, largeur, hauteur },
    lignes: textes.map((texte, i) => ({ texte, x: c.x + retrait, y: c.y + retrait * 0.7 + (i + 0.78) * interligne })),
    taille,
    retrait,
    interligne,
  }
}

// ——— Dans une liste ———

const remplacer = (liste: Commentaire[], id: string, modifier: (c: Commentaire) => Commentaire): Commentaire[] =>
  liste.map((c) => (c.id === id ? modifier(c) : c))

// Nouveau commentaire, son coin haut gauche au point cliqué.
export function ajouterCommentaire(liste: Commentaire[], p: Point, texte = TEXTE_COMMENTAIRE_PAR_DEFAUT): { commentaires: Commentaire[]; id: string } {
  const id = nouvelIdentifiant(liste, 'commentaire')
  const c: Commentaire = { id, texte, x: p.x, y: p.y, taille: 1, couleur: COULEUR_COMMENTAIRE_PAR_DEFAUT, gras: true, encadre: true }
  return { id, commentaires: [...liste, c] }
}

export type ChampsCommentaire = Partial<Pick<Commentaire, 'texte' | 'taille' | 'couleur' | 'gras' | 'encadre'>>

export function erreurCommentaire(champs: ChampsCommentaire): string | null {
  if (champs.couleur !== undefined && !/^#[0-9a-f]{6}$/i.test(champs.couleur)) return 'Couleur invalide.'
  if (champs.taille !== undefined && !(Number.isFinite(champs.taille) && champs.taille >= 0.3 && champs.taille <= 5)) return 'Taille invalide.'
  return null
}

export function modifierCommentaire(liste: Commentaire[], id: string, champs: ChampsCommentaire): Commentaire[] {
  if (erreurCommentaire(champs)) return liste
  return remplacer(liste, id, (c) => ({ ...c, ...champs }))
}

// ——— Édition sur l'image ———

// Un double-clic sur un commentaire ouvre son texte à sa place, sur l'image.
// Entrée valide, Maj+Entrée va à la ligne, Échap annule ; cliquer ailleurs
// valide aussi.
export type ActionToucheEdition = 'valider' | 'aLaLigne' | 'annuler' | null

export function actionToucheEdition(touche: string, maj: boolean): ActionToucheEdition {
  if (touche === 'Escape') return 'annuler'
  if (touche === 'Enter') return maj ? 'aLaLigne' : 'valider'
  return null
}

// Le texte tapé sur l'image, validé : la même liste s'il n'a pas changé (rien
// à annuler), sinon une seule modification (un seul Ctrl+Z).
export function validerTexteCommentaire(liste: Commentaire[], id: string, texte: string): Commentaire[] {
  const c = liste.find((x) => x.id === id)
  if (!c || c.texte === texte) return liste
  return modifierCommentaire(liste, id, { texte })
}

export const deplacerCommentaire = (liste: Commentaire[], id: string, decalage: Point): Commentaire[] =>
  remplacer(liste, id, (c) => ({ ...c, x: c.x + decalage.x, y: c.y + decalage.y }))

export const supprimerCommentaire = (liste: Commentaire[], id: string): Commentaire[] => liste.filter((c) => c.id !== id)

// Commentaire sous le pointeur : le dernier posé (dessiné au-dessus) d'abord.
export function commentaireSousPointeur(liste: Commentaire[], cadre: Cadre, p: Point, tolerance: number): string | null {
  for (let i = liste.length - 1; i >= 0; i--) {
    const b = miseEnPageCommentaire(liste[i], cadre).boite
    if (p.x >= b.x - tolerance && p.x <= b.x + b.largeur + tolerance && p.y >= b.y - tolerance && p.y <= b.y + b.hauteur + tolerance) return liste[i].id
  }
  return null
}

// ——— Dans une image ———

// Modifie les commentaires d'une seule image ; les autres images ne bougent pas.
export function modifierCommentairesImage(s: Synoptique, index: number, transformer: (liste: Commentaire[]) => Commentaire[]): Synoptique {
  const image = s.images[index]
  if (!image) return s
  const commentaires = transformer(image.contenu.commentaires)
  if (commentaires === image.contenu.commentaires) return s
  return { ...s, images: s.images.map((im, i) => (i === index ? { ...im, contenu: { ...im.contenu, commentaires } } : im)) }
}

export const modifierCalqueCommentaires = (s: Synoptique, champs: Partial<Calque>): Synoptique => ({
  ...s,
  calqueCommentaires: { ...s.calqueCommentaires, ...champs },
})
