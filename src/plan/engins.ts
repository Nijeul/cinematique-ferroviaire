import { dimensionsDe, type DimensionsEngin, type TypeEngin } from './catalogue.ts'
import { dansPolygone, type Poignee } from './detection.ts'
import { formaterMetres, metresVersPlan, planVersMetres } from './echelle.ts'
import { nomParDefaut, nouvelIdentifiant } from './edition.ts'
import { normaleHaut, tailleNom } from './geometrie.ts'
import { epaisseurParDefaut, type Echelle, type Point, type Projet, type Voie } from './projet.ts'
import { bornerAbscisse, longueurPolyligne, pointAAbscisse, projeterSurPolyligne } from './trace.ts'

// Engins et rames à l'échelle, posés dans une image de synoptique (jamais sur
// le plan, qui reste « juste un plan ») : la longueur dessinée est exactement
// la longueur réelle (en mètres) convertie par l'échelle du synoptique. La
// largeur aussi, mais jamais plus fine que la voie dessinée, sinon l'engin
// disparaîtrait sous le trait. Sur une voie, un engin suit le tracé (courbes
// comprises) ; hors voie, il est libre et tourne. Une rame est une suite de
// véhicules bout à bout sur une voie, chacun à sa propre abscisse.

// Où est un engin : sur une voie (abscisse de son milieu, il suit la voie) ou
// libre (milieu et angle en degrés, sens des aiguilles d'une montre,
// 0 = horizontal).
export type PositionEngin =
  | { genre: 'voie'; voieId: string; abscisse: number }
  | { genre: 'libre'; x: number; y: number; angle: number }

export type Engin = {
  id: string
  // Type du catalogue dont il vient, et copie de ses dimensions.
  typeId: string
  type: DimensionsEngin
  couleur: string
  // Numéro ou court libellé affiché dans une pastille (« 3 », « P4 ») ; vide :
  // pas de pastille.
  numero: string
  // Écrite après son nom dans la légende de l'image (« déblais ») ; facultative.
  description: string
  position: PositionEngin
}

export type Vehicule = { typeId: string; type: DimensionsEngin }

// Rame : des véhicules bout à bout sur une voie. `abscisse` est le milieu de
// la rame ; `sens` = 1 si la tête (premier véhicule) est du côté des abscisses
// croissantes de la voie, -1 sinon.
export type Rame = {
  id: string
  nom: string
  numero: string
  // Écrite après son nom dans la légende de l'image (« déblais + sous-couche
  // ballast ») ; facultative.
  description: string
  // Couleur de la pastille ; chaque véhicule garde la couleur de sa catégorie.
  couleur: string
  voieId: string
  abscisse: number
  sens: 1 | -1
  vehicules: Vehicule[]
}

export type EnginsEtRames = { engins: Engin[]; rames: Rame[] }

// Ce sur quoi l'on pose des engins : une image de synoptique vue comme un plan
// (ses voies, son échelle, sa taille, ses extrémités) avec ses engins et ses
// rames. Les fonctions de pose renvoient une planche du même type que celle
// reçue.
export type Planche = Pick<Projet, 'voies' | 'echelle' | 'largeur' | 'hauteur' | 'extremites'> & EnginsEtRames

type PlanEngins = Pick<Projet, 'voies' | 'echelle' | 'largeur' | 'hauteur'>

// Engin ou rame choisi dans une image.
export type ReferenceEngin = { genre: 'engin' | 'rame'; id: string }

const remplacer = <T extends { id: string }>(liste: T[], id: string, modifier: (e: T) => T): T[] =>
  liste.map((e) => (e.id === id ? modifier(e) : e))

// ——— Géométrie le long d'une voie ———

// Point à une abscisse, prolongé au-delà des bouts de la voie dans la
// direction de son premier ou de son dernier segment : un engin qui dépasse
// garde ainsi sa vraie longueur.
export function pointEtendu(points: Point[], abscisse: number): Point {
  const longueur = longueurPolyligne(points)
  const borne = Math.min(longueur, Math.max(0, abscisse))
  const { point, direction } = pointAAbscisse(points, borne)
  const auDela = abscisse - borne
  return { x: point.x + direction.x * auDela, y: point.y + direction.y * auDela }
}

export type Pose = { centre: Point; direction: Point }

// Objet de longueur donnée dont le milieu est à l'abscisse `s` : milieu sur la
// voie, orienté selon la corde entre ses deux bouts (la tangente locale, sans
// à-coup sur un coude du tracé).
export function poseSurVoie(points: Point[], s: number, longueur: number): Pose {
  const centre = pointEtendu(points, s)
  const a = pointEtendu(points, s - longueur / 2)
  const b = pointEtendu(points, s + longueur / 2)
  const norme = Math.hypot(b.x - a.x, b.y - a.y)
  const direction = norme > 1e-9 ? { x: (b.x - a.x) / norme, y: (b.y - a.y) / norme } : pointAAbscisse(points, s).direction
  return { centre, direction }
}

// Les quatre coins d'un rectangle centré, orienté selon `direction` (unitaire).
export function coinsRectangle(centre: Point, direction: Point, longueur: number, largeur: number): Point[] {
  const u = direction
  const n = { x: -u.y, y: u.x }
  const l = longueur / 2
  const w = largeur / 2
  return [
    { x: centre.x - u.x * l - n.x * w, y: centre.y - u.y * l - n.y * w },
    { x: centre.x + u.x * l - n.x * w, y: centre.y + u.y * l - n.y * w },
    { x: centre.x + u.x * l + n.x * w, y: centre.y + u.y * l + n.y * w },
    { x: centre.x - u.x * l + n.x * w, y: centre.y - u.y * l + n.y * w },
  ]
}

export const angleDe = (d: Point): number => (Math.atan2(d.y, d.x) * 180) / Math.PI
export const directionDe = (angle: number): Point => ({ x: Math.cos((angle * Math.PI) / 180), y: Math.sin((angle * Math.PI) / 180) })

// Angle ramené entre 0 (compris) et 360 degrés.
export function normaliserAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0
  const a = ((angle % 360) + 360) % 360
  return Math.abs(a - 360) < 1e-9 ? 0 : a
}

// Largeur visible : l'épaisseur de la voie dessinée, un peu plus, au minimum.
export const FACTEUR_LARGEUR_MIN = 1.3
export const largeurVisible = (largeurAEchelle: number, epaisseurVoie: number): number =>
  Math.max(largeurAEchelle, epaisseurVoie * FACTEUR_LARGEUR_MIN)

// ——— Silhouettes : ce qu'on dessine ———

export type Silhouette = Pose & {
  // Unités du plan : longueur exacte à l'échelle, largeur visible.
  longueur: number
  largeur: number
  coins: Point[]
  angle: number
  // Mètres au-delà des bouts de la voie (0 : l'engin est entièrement dessus).
  depassement: number
}

function silhouette(pose: Pose, longueur: number, largeur: number, depassement: number): Silhouette {
  return {
    ...pose,
    longueur,
    largeur,
    coins: coinsRectangle(pose.centre, pose.direction, longueur, largeur),
    angle: angleDe(pose.direction),
    depassement,
  }
}

// Longueur (unités du plan) qui sort de la voie, pour un objet de l'abscisse
// `debut` à `fin`.
const horsVoie = (debut: number, fin: number, longueurVoie: number): number =>
  Math.max(0, -debut) + Math.max(0, fin - longueurVoie)

const MARGE = 1e-6

export function silhouetteEngin(projet: PlanEngins, engin: Engin): Silhouette | null {
  const echelle = projet.echelle
  if (!echelle) return null
  const longueur = metresVersPlan(echelle, engin.type.longueur)
  const largeur = metresVersPlan(echelle, engin.type.largeur)
  const position = engin.position
  if (position.genre === 'libre') {
    const pose = { centre: { x: position.x, y: position.y }, direction: directionDe(position.angle) }
    return silhouette(pose, longueur, largeurVisible(largeur, epaisseurParDefaut(projet)), 0)
  }
  const voie = projet.voies.find((v) => v.id === position.voieId)
  if (!voie) return null
  const s = position.abscisse
  const dehors = horsVoie(s - longueur / 2, s + longueur / 2, longueurPolyligne(voie.points))
  return silhouetteSurTrace(voie.points, s, longueur, largeurVisible(largeur, voie.epaisseur), dehors > MARGE ? planVersMetres(echelle, dehors) : 0)
}

// Silhouette d'un objet de longueur donnée posé sur n'importe quel tracé (une
// voie, ou l'itinéraire d'un engin qui passe d'une voie à l'autre par un
// appareil), son milieu à l'abscisse `s` du tracé.
export function silhouetteSurTrace(points: Point[], s: number, longueur: number, largeur: number, depassement = 0): Silhouette {
  return silhouette(poseSurVoie(points, s, longueur), longueur, largeur, depassement)
}

// Longueur totale d'une rame, en mètres (somme des longueurs des véhicules).
export const longueurRame = (vehicules: Vehicule[]): number => vehicules.reduce((somme, v) => somme + v.type.longueur, 0)

export type SilhouetteRame = {
  vehicules: Silhouette[]
  // Mètres : longueur totale, et ce qui sort de la voie.
  longueur: number
  depassement: number
  // Milieu de la rame (pour son étiquette).
  milieu: Pose
}

// Abscisse du milieu de chaque véhicule (unités du plan), de la tête à la
// queue.
export function abscissesVehicules(rame: Pick<Rame, 'abscisse' | 'sens' | 'vehicules'>, pixelsParMetre: number): number[] {
  const total = longueurRame(rame.vehicules) * pixelsParMetre
  const tete = rame.abscisse + (rame.sens * total) / 2
  let cumul = 0
  return rame.vehicules.map((v) => {
    const l = v.type.longueur * pixelsParMetre
    const milieu = tete - rame.sens * (cumul + l / 2)
    cumul += l
    return milieu
  })
}

export function silhouetteRame(projet: PlanEngins, rame: Rame): SilhouetteRame | null {
  const echelle = projet.echelle
  const voie = projet.voies.find((v) => v.id === rame.voieId)
  if (!echelle || !voie || rame.vehicules.length === 0) return null
  const longueurVoie = longueurPolyligne(voie.points)
  const longueur = longueurRame(rame.vehicules)
  const total = metresVersPlan(echelle, longueur)
  const dehors = horsVoie(rame.abscisse - total / 2, rame.abscisse + total / 2, longueurVoie)
  return {
    ...silhouetteRameSurTrace(voie.points, rame, echelle, voie.epaisseur, (s, l) => {
      const d = horsVoie(s - l / 2, s + l / 2, longueurVoie)
      return d > MARGE ? planVersMetres(echelle, d) : 0
    }),
    depassement: dehors > MARGE ? planVersMetres(echelle, dehors) : 0,
    milieu: poseSurVoie(voie.points, rame.abscisse, Math.min(total, longueurVoie)),
  }
}

// Les véhicules d'une rame posés sur n'importe quel tracé (voie ou
// itinéraire), le milieu de la rame à l'abscisse `rame.abscisse` du tracé,
// la tête du côté `rame.sens`. `depassement` : mètres hors voie d'un
// véhicule (milieu, longueur), 0 par défaut.
export function silhouetteRameSurTrace(
  points: Point[],
  rame: Pick<Rame, 'abscisse' | 'sens' | 'vehicules'>,
  echelle: Echelle,
  epaisseurVoie: number,
  depassement: (s: number, longueur: number) => number = () => 0,
): SilhouetteRame {
  const abscisses = abscissesVehicules(rame, echelle.pixelsParMetre)
  const vehicules = rame.vehicules.map((v, i) => {
    const l = metresVersPlan(echelle, v.type.longueur)
    return silhouetteSurTrace(points, abscisses[i], l, largeurVisible(metresVersPlan(echelle, v.type.largeur), epaisseurVoie), depassement(abscisses[i], l))
  })
  const longueur = longueurRame(rame.vehicules)
  return { vehicules, longueur, depassement: 0, milieu: poseSurVoie(points, rame.abscisse, metresVersPlan(echelle, longueur)) }
}

// ——— Textes ———

// « BB 61000 + 10 × R39 »
export function texteComposition(vehicules: Vehicule[]): string {
  return groupesDeVehicules(vehicules)
    .map((g) => (g.nombre > 1 ? `${g.nombre} × ${g.type.modele}` : g.type.modele))
    .join(' + ')
}

// « Rame 1 — 213,5 m »
export const etiquetteRame = (rame: Rame): string => `${rame.nom} — ${formaterMetres(longueurRame(rame.vehicules))}`

// « La rame dépasse l'extrémité de la voie « V2 » de 12,4 m. »
export function avertissementDepassement(quoi: string, voie: Pick<Voie, 'nom'> | undefined, depassement: number): string | null {
  if (!(depassement > 0)) return null
  return `${quoi} dépasse l'extrémité de la voie « ${voie?.nom ?? '?'} » de ${formaterMetres(depassement)} : déplacez-la ou raccourcissez-la.`
}

// Côté de la tête d'une rame d'après les extrémités du plan (« Nord »…) ;
// null pour une rame verticale.
export function coteTete(projet: PlanEngins & Pick<Projet, 'extremites'>, rame: Rame): string | null {
  const s = silhouetteRame(projet, rame)
  if (!s) return null
  // La direction du milieu va vers les abscisses croissantes ; la tête est du côté `sens`.
  const dx = rame.sens * s.milieu.direction.x
  if (Math.abs(dx) < 1e-6) return null
  return dx < 0 ? projet.extremites.gauche : projet.extremites.droite
}

// ——— Composition d'une rame ———

// Véhicules identiques qui se suivent, regroupés : « 10 × R39 ».
export type Groupe = { typeId: string; type: DimensionsEngin; nombre: number }

const memeType = (a: Vehicule, b: Vehicule): boolean => a.typeId === b.typeId && JSON.stringify(a.type) === JSON.stringify(b.type)

export function groupesDeVehicules(vehicules: Vehicule[]): Groupe[] {
  const groupes: Groupe[] = []
  for (const v of vehicules) {
    const dernier = groupes[groupes.length - 1]
    if (dernier && memeType({ typeId: dernier.typeId, type: dernier.type }, v)) dernier.nombre++
    else groupes.push({ typeId: v.typeId, type: { ...v.type }, nombre: 1 })
  }
  return groupes
}

export const NOMBRE_MAX_GROUPE = 99

export function vehiculesDeGroupes(groupes: Groupe[]): Vehicule[] {
  return groupes.flatMap((g) =>
    Array.from({ length: Math.min(NOMBRE_MAX_GROUPE, Math.max(0, Math.floor(g.nombre))) }, () => ({ typeId: g.typeId, type: { ...g.type } })),
  )
}

export const groupeDe = (type: TypeEngin, nombre = 1): Groupe => ({ typeId: type.id, type: dimensionsDe(type), nombre })

// Ajout, retrait, déplacement d'un groupe, nombre de véhicules d'un groupe.
export function ajouterGroupe(groupes: Groupe[], groupe: Groupe): Groupe[] {
  const dernier = groupes[groupes.length - 1]
  if (dernier && dernier.typeId === groupe.typeId && JSON.stringify(dernier.type) === JSON.stringify(groupe.type)) {
    return [...groupes.slice(0, -1), { ...dernier, nombre: Math.min(NOMBRE_MAX_GROUPE, dernier.nombre + groupe.nombre) }]
  }
  return [...groupes, groupe]
}

export const retirerGroupe = (groupes: Groupe[], i: number): Groupe[] => groupes.filter((_, j) => j !== i)

export function deplacerGroupe(groupes: Groupe[], i: number, vers: -1 | 1): Groupe[] {
  const j = i + vers
  if (j < 0 || j >= groupes.length) return groupes
  const copie = [...groupes]
  ;[copie[i], copie[j]] = [copie[j], copie[i]]
  return copie
}

export function changerNombre(groupes: Groupe[], i: number, nombre: number): Groupe[] {
  if (!Number.isFinite(nombre)) return groupes
  const n = Math.min(NOMBRE_MAX_GROUPE, Math.max(1, Math.round(nombre)))
  return groupes.map((g, j) => (j === i ? { ...g, nombre: n } : g))
}

// ——— Création et modification ———

const pointsDe = (projet: PlanEngins, voieId: string): Point[] => projet.voies.find((v) => v.id === voieId)?.points ?? []

// `dejaPris` : les engins et rames des autres images du synoptique. Un nouvel
// engin ne reprend jamais l'identifiant d'un autre engin du synoptique :
// l'animation d'une image à la suivante reconnaît un engin à son identifiant.
export function ajouterEngin<P extends Planche>(
  projet: P,
  type: TypeEngin,
  position: PositionEngin,
  dejaPris: { id: string }[] = [],
): { planche: P; id: string } {
  const id = nouvelIdentifiant([...projet.engins, ...dejaPris], 'engin')
  const placee: PositionEngin =
    position.genre === 'voie'
      ? { ...position, abscisse: bornerAbscisse(pointsDe(projet, position.voieId), position.abscisse) }
      : { ...position, angle: normaliserAngle(position.angle) }
  const engin: Engin = { id, typeId: type.id, type: dimensionsDe(type), couleur: type.couleur, numero: '', description: '', position: placee }
  return { id, planche: { ...projet, engins: [...projet.engins, engin] } }
}

export function modifierEngin<P extends Planche>(projet: P, id: string, champs: Partial<Pick<Engin, 'couleur' | 'numero' | 'description'>>): P {
  return { ...projet, engins: remplacer(projet.engins, id, (e) => ({ ...e, ...champs })) }
}

// Engin sur une voie : nouvelle abscisse de son milieu, ramenée sur la voie.
export function placerEnginSurVoie<P extends Planche>(projet: P, id: string, abscisse: number): P {
  return {
    ...projet,
    engins: remplacer(projet.engins, id, (e) =>
      e.position.genre === 'voie'
        ? { ...e, position: { ...e.position, abscisse: bornerAbscisse(pointsDe(projet, e.position.voieId), abscisse) } }
        : e,
    ),
  }
}

// ——— Changer de voie ———
//
// Un engin passe d'une voie à une autre (la pelle RR qui passe de V2 sur V1),
// ou quitte la voie (déraillement : il devient libre, sur la route ou en
// base arrière) et y revient (enraillement). Il garde tout le reste : son
// type, son numéro, sa couleur, sa description, son identifiant (et donc sa
// place dans la légende). Il se pose au point de la nouvelle voie le plus
// proche de l'endroit où il était.

// Milieu et direction actuels d'un engin, qu'il soit sur une voie ou libre.
function poseActuelle(projet: PlanEngins, engin: Engin): Pose | null {
  if (engin.position.genre === 'libre') return { centre: { x: engin.position.x, y: engin.position.y }, direction: directionDe(engin.position.angle) }
  const voie = projet.voies.find((v) => v.id === (engin.position as { voieId: string }).voieId)
  if (!voie) return null
  const longueur = projet.echelle ? metresVersPlan(projet.echelle, engin.type.longueur) : 0
  return poseSurVoie(voie.points, engin.position.abscisse, longueur)
}

// `voieId` : la voie d'arrivée ; null : hors voie, à l'endroit où il était,
// dans le sens de la voie qu'il quitte.
export function changerVoieEngin<P extends Planche>(projet: P, id: string, voieId: string | null): P {
  const engin = projet.engins.find((e) => e.id === id)
  if (!engin) return projet
  if (voieId === null && engin.position.genre === 'libre') return projet
  if (voieId !== null && engin.position.genre === 'voie' && engin.position.voieId === voieId) return projet
  const pose = poseActuelle(projet, engin)
  const voie = voieId === null ? null : projet.voies.find((v) => v.id === voieId)
  if (!pose || (voieId !== null && !voie)) return projet
  const position: PositionEngin = voie
    ? { genre: 'voie', voieId: voie.id, abscisse: projeterSurPolyligne(voie.points, pose.centre).abscisse }
    : { genre: 'libre', x: pose.centre.x, y: pose.centre.y, angle: normaliserAngle(angleDe(pose.direction)) }
  return { ...projet, engins: remplacer(projet.engins, id, (e) => ({ ...e, position })) }
}

// Une rame passe sur une autre voie : même composition, même sens vu sur le
// plan (la tête reste du même côté), au plus près de là où elle était.
export function changerVoieRame<P extends Planche>(projet: P, id: string, voieId: string): P {
  const rame = projet.rames.find((r) => r.id === id)
  const depart = rame && projet.voies.find((v) => v.id === rame.voieId)
  const arrivee = projet.voies.find((v) => v.id === voieId)
  if (!rame || !depart || !arrivee || rame.voieId === voieId) return projet
  const avant = pointAAbscisse(depart.points, bornerAbscisse(depart.points, rame.abscisse))
  const abscisse = projeterSurPolyligne(arrivee.points, avant.point).abscisse
  const apres = pointAAbscisse(arrivee.points, abscisse)
  // Sens de la tête vu sur le plan : il ne change pas, même si la nouvelle
  // voie a été tracée dans l'autre sens.
  const memeSens = avant.direction.x * apres.direction.x + avant.direction.y * apres.direction.y >= 0
  const sens: 1 | -1 = memeSens ? rame.sens : rame.sens === 1 ? -1 : 1
  return { ...projet, rames: remplacer(projet.rames, id, (r) => ({ ...r, voieId, abscisse, sens })) }
}

// Rectangle qui contient tous les véhicules d'une rame (unités du plan).
export function empriseRame(projet: PlanEngins, rame: Rame): { x: number; y: number; largeur: number; hauteur: number } | null {
  const s = silhouetteRame(projet, rame)
  if (!s) return null
  const coins = s.vehicules.flatMap((v) => v.coins)
  const xs = coins.map((c) => c.x)
  const ys = coins.map((c) => c.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, largeur: Math.max(...xs) - x, hauteur: Math.max(...ys) - y }
}

// Engin libre : déplacement et rotation.
export function glisserEnginLibre<P extends Planche>(projet: P, id: string, decalage: Point): P {
  return {
    ...projet,
    engins: remplacer(projet.engins, id, (e) =>
      e.position.genre === 'libre' ? { ...e, position: { ...e.position, x: e.position.x + decalage.x, y: e.position.y + decalage.y } } : e,
    ),
  }
}

export function tournerEngin<P extends Planche>(projet: P, id: string, angle: number): P {
  return {
    ...projet,
    engins: remplacer(projet.engins, id, (e) =>
      e.position.genre === 'libre' ? { ...e, position: { ...e.position, angle: normaliserAngle(angle) } } : e,
    ),
  }
}

// Angle pour que l'engin pointe vers `p` depuis son milieu ; avec `pas`, arrondi
// (15° avec Maj).
export function angleVers(centre: Point, p: Point, pas = 0): number {
  const angle = angleDe({ x: p.x - centre.x, y: p.y - centre.y })
  return normaliserAngle(pas > 0 ? Math.round(angle / pas) * pas : angle)
}

// Nouvelle rame, centrée sur l'abscisse cliquée ; la tête du côté gauche du
// plan (Nord par défaut).
export function ajouterRame<P extends Planche>(
  projet: P,
  vehicules: Vehicule[],
  voieId: string,
  abscisse: number,
  dejaPris: { id: string }[] = [],
): { planche: P; id: string } {
  const id = nouvelIdentifiant([...projet.rames, ...dejaPris], 'rame')
  const points = pointsDe(projet, voieId)
  const s = bornerAbscisse(points, abscisse)
  const rame: Rame = {
    id,
    nom: nomParDefaut(projet.rames, 'Rame'),
    numero: '',
    description: '',
    couleur: vehicules[0]?.type.couleur ?? '#9aa4ae',
    voieId,
    abscisse: s,
    sens: pointAAbscisse(points, s).direction.x > 0 ? -1 : 1,
    vehicules: vehicules.map((v) => ({ typeId: v.typeId, type: { ...v.type } })),
  }
  return { id, planche: { ...projet, rames: [...projet.rames, rame] } }
}

export function modifierRame<P extends Planche>(projet: P, id: string, champs: Partial<Pick<Rame, 'nom' | 'numero' | 'couleur' | 'description'>>): P {
  return { ...projet, rames: remplacer(projet.rames, id, (r) => ({ ...r, ...champs })) }
}

export function placerRame<P extends Planche>(projet: P, id: string, abscisse: number): P {
  return {
    ...projet,
    rames: remplacer(projet.rames, id, (r) => ({ ...r, abscisse: bornerAbscisse(pointsDe(projet, r.voieId), abscisse) })),
  }
}

// La rame garde sa place ; la tête passe à l'autre bout.
export function inverserRame<P extends Planche>(projet: P, id: string): P {
  return { ...projet, rames: remplacer(projet.rames, id, (r) => ({ ...r, sens: r.sens === 1 ? -1 : 1 })) }
}

// Nouvelle composition d'une rame (au moins un véhicule), à la même place.
export function composerRame<P extends Planche>(projet: P, id: string, vehicules: Vehicule[]): P {
  if (vehicules.length === 0) return projet
  return { ...projet, rames: remplacer(projet.rames, id, (r) => ({ ...r, vehicules: vehicules.map((v) => ({ ...v, type: { ...v.type } })) })) }
}

// ——— Pastille et libellé ———

// Rayon de la pastille à numéro : lisible, proportionné aux noms de voies.
export const rayonPastille = (projet: Pick<Projet, 'largeur' | 'hauteur'>): number => tailleNom(epaisseurParDefaut(projet)) * 0.72

// Pastille au-dessus de l'engin (ou du véhicule de tête d'une rame).
export function positionPastille(s: Pick<Silhouette, 'centre' | 'direction' | 'largeur'>, rayon: number): Point {
  const haut = normaleHaut(s.direction)
  const ecart = s.largeur / 2 + rayon * 1.3
  return { x: s.centre.x + haut.x * ecart, y: s.centre.y + haut.y * ecart }
}

// Texte sombre sur une couleur claire, blanc sur une couleur foncée.
export function couleurTexteSur(couleur: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(couleur)
  if (!m) return '#1c2430'
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.22 ? '#1c2430' : '#ffffff'
}

// Libellé du modèle dans le rectangle : sa taille de police, ou null s'il ne
// tient pas (engin trop court à cette échelle).
export function tailleLibelle(modele: string, longueur: number, largeur: number): number | null {
  const n = Math.max(1, modele.length)
  const taille = Math.min(largeur * 0.62, (longueur * 0.9) / (n * 0.64))
  return taille >= largeur * 0.38 ? taille : null
}

// Un libellé tourné de cet angle se lirait à l'envers : on le retourne.
export function libelleARetourner(angle: number): boolean {
  const a = normaliserAngle(angle)
  return a > 90 + 1e-6 && a < 270 - 1e-6
}

// Côté de l'étiquette d'une rame : à l'extérieur de la courbe, pour ne pas
// chevaucher les véhicules (en dessous sur une voie droite, la pastille étant
// au-dessus).
export function coteEtiquetteRame(s: SilhouetteRame): 'dessus' | 'dessous' {
  const premier = s.vehicules[0].centre
  const dernier = s.vehicules[s.vehicules.length - 1].centre
  const corde = { x: (premier.x + dernier.x) / 2, y: (premier.y + dernier.y) / 2 }
  const haut = normaleHaut(s.milieu.direction)
  const fleche = (s.milieu.centre.x - corde.x) * haut.x + (s.milieu.centre.y - corde.y) * haut.y
  return fleche > s.vehicules[0].largeur * 0.5 ? 'dessus' : 'dessous'
}

// Ligne de base de l'étiquette d'une rame (texte horizontal, centré en x) :
// au milieu de la rame, du côté extérieur de la courbe, et au-delà de tout
// véhicule qui passerait sous le texte — sur une rame qui passe le sommet
// d'une courbe, l'étiquette ne chevauche ainsi aucun wagon.
export function positionEtiquetteRame(s: SilhouetteRame, taille: number, largeurTexte: number): Point {
  const x = s.milieu.centre.x
  const marge = taille * 0.3
  const demi = largeurTexte / 2 + marge
  const coins = s.vehicules.flatMap((v) => v.coins).filter((c) => Math.abs(c.x - x) <= demi)
  const ys = coins.length > 0 ? coins.map((c) => c.y) : [s.milieu.centre.y]
  return coteEtiquetteRame(s) === 'dessus'
    ? { x, y: Math.min(...ys) - marge - taille * 0.2 }
    : { x, y: Math.max(...ys) + marge + taille * 0.8 }
}

// ——— Choix sous le pointeur, poignée, suppression ———

// Engin ou rame sous le pointeur : le dernier posé (dessiné au-dessus) d'abord.
export function enginSousPointeur(projet: Planche, p: Point, tolerance: number): ReferenceEngin | null {
  for (let i = projet.rames.length - 1; i >= 0; i--) {
    const s = silhouetteRame(projet, projet.rames[i])
    if (s?.vehicules.some((v) => dansPolygone(v.coins, p, tolerance))) return { genre: 'rame', id: projet.rames[i].id }
  }
  for (let i = projet.engins.length - 1; i >= 0; i--) {
    const s = silhouetteEngin(projet, projet.engins[i])
    if (s && dansPolygone(s.coins, p, tolerance)) return { genre: 'engin', id: projet.engins[i].id }
  }
  return null
}

export const existeEngin = (projet: EnginsEtRames, ref: ReferenceEngin): boolean =>
  (ref.genre === 'engin' ? projet.engins : projet.rames).some((e) => e.id === ref.id)

// Poignée ronde de rotation d'un engin hors voie, au bout de l'engin (un engin
// sur voie ou une rame se glissent d'un bloc, sans poignée).
export function poigneesEngin(projet: Planche, ref: ReferenceEngin): Poignee[] {
  if (ref.genre !== 'engin') return []
  const engin = projet.engins.find((e) => e.id === ref.id)
  const s = engin?.position.genre === 'libre' ? silhouetteEngin(projet, engin) : null
  if (!s) return []
  const ecart = s.longueur / 2 + s.largeur * 1.2
  return [{ cle: 'rotation', point: { x: s.centre.x + s.direction.x * ecart, y: s.centre.y + s.direction.y * ecart } }]
}

export function supprimerEngin<P extends Planche>(projet: P, ref: ReferenceEngin): P {
  return ref.genre === 'engin'
    ? { ...projet, engins: projet.engins.filter((e) => e.id !== ref.id) }
    : { ...projet, rames: projet.rames.filter((r) => r.id !== ref.id) }
}
