import type { Resultat } from './echelle.ts'
import { nouvelIdentifiant } from './edition.ts'
import { angleDe, libelleARetourner, normaliserAngle } from './engins.ts'
import { contraindre, distancePointPolyligne, tailleNom } from './geometrie.ts'
import { epaisseurParDefaut, type Calque, type Point, type Projet } from './projet.ts'
import type { Synoptique } from './synoptique.ts'
import { longueurPolyligne, decalerPolyligne, sansDoublons, sousPolyligne } from './trace.ts'

// Les flèches des images d'un synoptique, comme sur les planches du
// commanditaire : sens de travail (fine, rouge), sens d'avancement du TTX
// (grosse, bleue), cheminement d'un portique (magenta), chemin de roule
// (double trait rouge). Chaque chantier a sa liste de types de flèches,
// modifiable dans la page du chantier comme les états de la voie ; chaque
// flèche posée dans une image désigne un type de cette liste : changer la
// couleur d'un type change toutes les images qui l'utilisent.
//
// Une flèche est une ligne brisée (un clic par point), avec un libellé
// facultatif écrit le long d'elle. « Nouvelle image » recopie les flèches,
// comme les engins : il ne reste qu'à déplacer ce qui change.

export type StyleTrait = 'plein' | 'pointilles' | 'double'
// Où sont les pointes : au bout (dernier point cliqué), aux deux bouts, aucune.
export type Pointes = 'fin' | 'deux' | 'aucune'

export type TypeFleche = {
  id: string
  nom: string
  couleur: string
  // En points : 8 points font l'épaisseur d'une voie tracée par défaut.
  epaisseur: number
  trait: StyleTrait
  pointes: Pointes
}

export type Fleche = {
  id: string
  typeId: string
  points: Point[]
  // Écrit le long de la flèche ; vide : pas de libellé.
  libelle: string
}

// ——— Liste par défaut ———
//
// Seul endroit où elle est écrite. Types et couleurs relevés sur les
// synoptiques du commanditaire ; épaisseurs choisies pour qu'on les distingue
// d'un coup d'œil (fine, moyenne, épaisse).

const ROUGE = '#e0201b'
const BLEU_TTX = '#4472c4'
const MAGENTA = '#d633c7'
// Teinte d'un nouveau type ajouté par l'utilisateur, à changer ensuite.
const COULEUR_NOUVEAU_TYPE = '#1c2430'

export const TYPES_FLECHES_PAR_DEFAUT: readonly TypeFleche[] = [
  { id: 'type-fleche-1', nom: 'Sens de travail', couleur: ROUGE, epaisseur: 2, trait: 'plein', pointes: 'fin' },
  { id: 'type-fleche-2', nom: 'Sens avancement TTX', couleur: BLEU_TTX, epaisseur: 12, trait: 'plein', pointes: 'fin' },
  { id: 'type-fleche-3', nom: 'Cheminement', couleur: MAGENTA, epaisseur: 3, trait: 'plein', pointes: 'fin' },
  { id: 'type-fleche-4', nom: 'Cheminement retour', couleur: MAGENTA, epaisseur: 3, trait: 'pointilles', pointes: 'fin' },
  { id: 'type-fleche-5', nom: 'Chemin de roule', couleur: ROUGE, epaisseur: 2, trait: 'double', pointes: 'aucune' },
]

export const creerTypesFleches = (): TypeFleche[] => TYPES_FLECHES_PAR_DEFAUT.map((t) => ({ ...t }))

export const typeFlecheParId = (liste: TypeFleche[], id: string): TypeFleche | undefined => liste.find((t) => t.id === id)

export const STYLES_TRAIT: readonly StyleTrait[] = ['plein', 'pointilles', 'double']
export const POINTES: readonly Pointes[] = ['fin', 'deux', 'aucune']
export const EPAISSEUR_FLECHE_MIN = 0.5
export const EPAISSEUR_FLECHE_MAX = 30

// ——— Modification de la liste des types ———

export type ChampsTypeFleche = Partial<Omit<TypeFleche, 'id'>>

export function erreurTypeFleche(champs: ChampsTypeFleche): string | null {
  if (champs.nom !== undefined && champs.nom.trim() === '') return 'Donnez un nom au type de flèche.'
  if (champs.couleur !== undefined && !/^#[0-9a-f]{6}$/i.test(champs.couleur)) return 'Couleur invalide.'
  if (
    champs.epaisseur !== undefined &&
    !(Number.isFinite(champs.epaisseur) && champs.epaisseur >= EPAISSEUR_FLECHE_MIN && champs.epaisseur <= EPAISSEUR_FLECHE_MAX)
  ) {
    return `L'épaisseur est un nombre de points de ${EPAISSEUR_FLECHE_MIN.toLocaleString('fr-FR')} à ${EPAISSEUR_FLECHE_MAX} (une voie en fait 8).`
  }
  if (champs.trait !== undefined && !STYLES_TRAIT.includes(champs.trait)) return 'Style de trait inconnu.'
  if (champs.pointes !== undefined && !POINTES.includes(champs.pointes)) return 'Pointe inconnue.'
  return null
}

// Nouveau type, en fin de liste : trait plein moyen, pointe au bout, à régler ensuite.
export function ajouterTypeFleche(liste: TypeFleche[], nom: string): Resultat<{ liste: TypeFleche[]; id: string }> {
  const erreur = erreurTypeFleche({ nom })
  if (erreur) return { ok: false, erreur }
  const id = nouvelIdentifiant(liste, 'type-fleche')
  const type: TypeFleche = { id, nom: nom.trim(), couleur: COULEUR_NOUVEAU_TYPE, epaisseur: 3, trait: 'plein', pointes: 'fin' }
  return { ok: true, valeur: { id, liste: [...liste, type] } }
}

export function modifierTypeFleche(liste: TypeFleche[], id: string, champs: ChampsTypeFleche): Resultat<TypeFleche[]> {
  const erreur = erreurTypeFleche(champs)
  if (erreur) return { ok: false, erreur }
  const propres = champs.nom !== undefined ? { ...champs, nom: champs.nom.trim() } : champs
  return { ok: true, valeur: liste.map((t) => (t.id === id ? { ...t, ...propres } : t)) }
}

export function deplacerTypeFleche(liste: TypeFleche[], id: string, vers: -1 | 1): TypeFleche[] {
  const i = liste.findIndex((t) => t.id === id)
  const j = i + vers
  if (i < 0 || j < 0 || j >= liste.length) return liste
  const copie = [...liste]
  ;[copie[i], copie[j]] = [copie[j], copie[i]]
  return copie
}

// ——— Géométrie d'une flèche ———

// Un point d'épaisseur, en unités du plan : 8 points font l'épaisseur d'une
// voie tracée par défaut. Les flèches restent ainsi à la mesure des voies
// qu'elles accompagnent, quelle que soit la taille du plan.
export const uniteFleche = (plan: Pick<Projet, 'largeur' | 'hauteur'>): number => epaisseurParDefaut(plan) / 8

export type DimensionsFleche = {
  // Épaisseur d'un trait (unités du plan).
  trait: number
  // Double trait : distance entre les axes des deux traits ; 0 sinon.
  ecart: number
  // Largeur de ce qui est dessiné autour de l'axe : un trait, ou les deux traits.
  corps: number
  // Triangle de pointe : largeur de sa base et longueur.
  largeurPointe: number
  longueurPointe: number
}

// Proportions : une pointe fine est large de quatre à cinq fois son trait,
// une grosse flèche d'un peu plus de deux fois, comme sur les planches du
// commanditaire ; la pointe d'un double trait couvre les deux traits.
export function dimensionsFleche(type: Pick<TypeFleche, 'epaisseur' | 'trait'>, unite: number): DimensionsFleche {
  const trait = type.epaisseur * unite
  const ecart = type.trait === 'double' ? 3 * trait + 3 * unite : 0
  const corps = ecart + trait
  const largeurPointe = corps + trait + 5 * unite
  return { trait, ecart, corps, largeurPointe, longueurPointe: largeurPointe * 0.9 }
}

export type GeometrieFleche = DimensionsFleche & {
  // Lignes brisées à tracer (une, ou deux pour le double trait), raccourcies
  // sous les pointes pour que le trait ne dépasse pas de la pointe.
  traits: Point[][]
  // Pointillés : longueur d'un tiret et d'un blanc ; null pour un trait continu.
  tirets: [number, number] | null
  // Triangles des pointes (trois points chacun).
  pointes: Point[][]
}

const unitaire = (a: Point, b: Point): Point => {
  const l = Math.hypot(b.x - a.x, b.y - a.y)
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
}

// Triangle de pointe : sommet sur `bout`, dans la direction `d` (unitaire).
function triangle(bout: Point, d: Point, largeur: number, longueur: number): Point[] {
  const base = { x: bout.x - d.x * longueur, y: bout.y - d.y * longueur }
  const n = { x: -d.y, y: d.x }
  const demi = largeur / 2
  return [
    { ...bout },
    { x: base.x + n.x * demi, y: base.y + n.y * demi },
    { x: base.x - n.x * demi, y: base.y - n.y * demi },
  ]
}

// Part de la longueur de la flèche qu'une pointe peut occuper, au plus : une
// flèche très courte garde une pointe à sa mesure.
const PART_MAX_POINTE = 0.45
// Le trait s'arrête sous la pointe, aux 4/5 de sa longueur depuis le sommet.
const RECOUVREMENT = 0.8

export function geometrieFleche(points: Point[], type: Pick<TypeFleche, 'epaisseur' | 'trait' | 'pointes'>, unite: number): GeometrieFleche | null {
  const nets = sansDoublons(points)
  if (nets.length < 2) return null
  const dimensions = dimensionsFleche(type, unite)
  const longueur = longueurPolyligne(nets)
  const nombre = type.pointes === 'deux' ? 2 : type.pointes === 'fin' ? 1 : 0
  // Pointe proportionnée, écrêtée sur une flèche courte (la largeur suit).
  const reduction = nombre > 0 ? Math.min(1, (longueur * PART_MAX_POINTE) / dimensions.longueurPointe) : 1
  const largeurPointe = dimensions.largeurPointe * reduction
  const longueurPointe = dimensions.longueurPointe * reduction
  const pointes: Point[][] = []
  let debut = 0
  let fin = longueur
  if (nombre >= 1) {
    const dernier = nets[nets.length - 1]
    pointes.push(triangle(dernier, unitaire(nets[nets.length - 2], dernier), largeurPointe, longueurPointe))
    fin -= longueurPointe * RECOUVREMENT
  }
  if (nombre === 2) {
    pointes.push(triangle(nets[0], unitaire(nets[1], nets[0]), largeurPointe, longueurPointe))
    debut += longueurPointe * RECOUVREMENT
  }
  const axe = sousPolyligne(nets, debut, fin)
  const traits = type.trait === 'double' ? [decalerPolyligne(axe, dimensions.ecart / 2), decalerPolyligne(axe, -dimensions.ecart / 2)] : [axe]
  const t = dimensions.trait
  const tirets: [number, number] | null = type.trait === 'pointilles' ? [3 * t + 2 * unite, 2 * t + 2 * unite] : null
  return { ...dimensions, largeurPointe, longueurPointe, traits: traits.filter((l) => l.length >= 2), tirets, pointes }
}

// ——— Tracé ———

// Point posé pendant le tracé : avec Maj, sur l'horizontale, la verticale ou
// à 45° du point précédent, comme pour le tracé des voies.
export function pointDeTrace(trace: Point[], p: Point, maj: boolean): Point {
  return maj && trace.length > 0 ? contraindre(trace[trace.length - 1], p) : { ...p }
}

// ——— Libellé ———

// Taille du libellé : celle des numéros d'engins, lisible à côté des voies.
export const tailleLibelleFleche = (plan: Pick<Projet, 'largeur' | 'hauteur'>): number => tailleNom(epaisseurParDefaut(plan)) * 0.72

// Ligne de base du libellé : au milieu du plus long segment, le long de lui,
// du côté « au-dessus » du texte, et jamais à l'envers.
export function positionLibelle(points: Point[], largeurTotale: number, taille: number): { x: number; y: number; angle: number } | null {
  const nets = sansDoublons(points)
  if (nets.length < 2) return null
  let meilleur = 1
  for (let i = 2; i < nets.length; i++) {
    if (Math.hypot(nets[i].x - nets[i - 1].x, nets[i].y - nets[i - 1].y) > Math.hypot(nets[meilleur].x - nets[meilleur - 1].x, nets[meilleur].y - nets[meilleur - 1].y)) meilleur = i
  }
  const a = nets[meilleur - 1]
  const b = nets[meilleur]
  let angle = normaliserAngle(angleDe({ x: b.x - a.x, y: b.y - a.y }))
  if (libelleARetourner(angle)) angle = normaliserAngle(angle + 180)
  const r = (angle * Math.PI) / 180
  // « Au-dessus » du texte tourné de `angle`.
  const haut = { x: Math.sin(r), y: -Math.cos(r) }
  const ecart = largeurTotale / 2 + taille * 0.3
  return { x: (a.x + b.x) / 2 + haut.x * ecart, y: (a.y + b.y) / 2 + haut.y * ecart, angle }
}

// ——— Choix sous le pointeur ———

// Flèche sous le pointeur : la dernière posée (dessinée au-dessus) d'abord,
// si le pointeur touche son trait ou sa pointe, à la tolérance près.
export function flecheSousPointeur(fleches: Fleche[], types: TypeFleche[], unite: number, p: Point, tolerance: number): string | null {
  for (let i = fleches.length - 1; i >= 0; i--) {
    const f = fleches[i]
    const type = typeFlecheParId(types, f.typeId)
    if (!type) continue
    const { corps } = dimensionsFleche(type, unite)
    if (distancePointPolyligne(p, sansDoublons(f.points)) - corps / 2 <= tolerance) return f.id
  }
  return null
}

// ——— Flèches d'une image ———

const remplacer = (fleches: Fleche[], id: string, modifier: (f: Fleche) => Fleche): Fleche[] =>
  fleches.map((f) => (f.id === id ? modifier(f) : f))

export function ajouterFleche(fleches: Fleche[], typeId: string, points: Point[]): { fleches: Fleche[]; id: string } {
  const id = nouvelIdentifiant(fleches, 'fleche')
  return { id, fleches: [...fleches, { id, typeId, points: points.map((p) => ({ x: p.x, y: p.y })), libelle: '' }] }
}

export const modifierFleche = (fleches: Fleche[], id: string, champs: Partial<Pick<Fleche, 'typeId' | 'libelle'>>): Fleche[] =>
  remplacer(fleches, id, (f) => ({ ...f, ...champs }))

export const deplacerPointFleche = (fleches: Fleche[], id: string, indice: number, p: Point): Fleche[] =>
  remplacer(fleches, id, (f) => ({ ...f, points: f.points.map((q, i) => (i === indice ? { x: p.x, y: p.y } : q)) }))

export const deplacerFleche = (fleches: Fleche[], id: string, decalage: Point): Fleche[] =>
  remplacer(fleches, id, (f) => ({ ...f, points: f.points.map((q) => ({ x: q.x + decalage.x, y: q.y + decalage.y })) }))

export const supprimerFleche = (fleches: Fleche[], id: string): Fleche[] => fleches.filter((f) => f.id !== id)

// Modifie les flèches d'une seule image ; les autres images ne bougent pas.
export function modifierFlechesImage(s: Synoptique, index: number, transformer: (fleches: Fleche[]) => Fleche[]): Synoptique {
  const image = s.images[index]
  if (!image) return s
  const fleches = transformer(image.contenu.fleches)
  if (fleches === image.contenu.fleches) return s
  return { ...s, images: s.images.map((im, i) => (i === index ? { ...im, contenu: { ...im.contenu, fleches } } : im)) }
}

export const modifierCalqueFleches = (s: Synoptique, champs: Partial<Calque>): Synoptique => ({ ...s, calqueFleches: { ...s.calqueFleches, ...champs } })

// ——— Suppression d'un type de la liste ———

// Nombre d'images (tous synoptiques confondus) qui ont une flèche de ce type.
export const imagesAvecTypeFleche = (synoptiques: Synoptique[], typeId: string): number =>
  synoptiques.reduce((n, s) => n + s.images.filter((im) => im.contenu.fleches.some((f) => f.typeId === typeId)).length, 0)

// Les flèches de ce type sont retirées de toutes les images.
export function retirerFlechesDuType(s: Synoptique, typeId: string): Synoptique {
  if (!s.images.some((im) => im.contenu.fleches.some((f) => f.typeId === typeId))) return s
  return {
    ...s,
    images: s.images.map((im) =>
      im.contenu.fleches.some((f) => f.typeId === typeId)
        ? { ...im, contenu: { ...im.contenu, fleches: im.contenu.fleches.filter((f) => f.typeId !== typeId) } }
        : im,
    ),
  }
}
