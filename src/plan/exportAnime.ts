import { instantsIntermediaires, transition, type ImageIntermediaire, type TransitionImages } from './animation.ts'
import { largeurTexteEstimee } from './dessin.ts'
import type { Rectangle } from './elements.ts'
import {
  etiquetteRame,
  libelleARetourner,
  normaliserAngle,
  positionEtiquetteRame,
  positionPastille,
  rayonPastille,
  type Silhouette,
} from './engins.ts'
import type { EtatVoie } from './etatsVoie.ts'
import { versPage } from './export.ts'
import { tailleNom } from './geometrie.ts'
import { enginsAffiches } from './numerosEngins.ts'
import { epaisseurParDefaut, type Point } from './projet.ts'
import { rectangleAffiche, type Synoptique } from './synoptique.ts'

// Le PowerPoint animé : la suite des diapositives (une principale par image,
// et entre deux images des diapositives intermédiaires qui s'enchaînent
// seules), la transition de chacune, et les objets séparés (caisses des
// engins et des véhicules, pastilles, étiquettes de rame) que la Morphose de
// PowerPoint fait glisser d'une diapositive à la suivante parce qu'ils
// portent le même nom « !!… ». Tout se calcule ici, sans navigateur ;
// l'écriture du fichier est dans src/export/.

// ——— Réglages ———

export type ModeAnimation = 'aucune' | 'clic' | 'auto'

// Durée du mouvement d'une image à la suivante et pause sur chaque image
// (mode automatique), en secondes.
export type OptionsAnimation = { mode: ModeAnimation; duree: number; pause: number }

export const DUREE_ANIMATION = { min: 0.5, max: 20 } as const
export const PAUSE_ANIMATION = { min: 0, max: 600 } as const

const virgule = (v: number) => String(v).replace('.', ',')

export function verifierAnimation(o: OptionsAnimation): string[] {
  if (o.mode === 'aucune') return []
  const erreurs: string[] = []
  if (!Number.isFinite(o.duree) || o.duree < DUREE_ANIMATION.min || o.duree > DUREE_ANIMATION.max)
    erreurs.push(`La durée du mouvement va de ${virgule(DUREE_ANIMATION.min)} à ${DUREE_ANIMATION.max} secondes.`)
  if (o.mode === 'auto' && (!Number.isFinite(o.pause) || o.pause < PAUSE_ANIMATION.min || o.pause > PAUSE_ANIMATION.max))
    erreurs.push(`La pause sur chaque image va de ${PAUSE_ANIMATION.min} à ${PAUSE_ANIMATION.max} secondes.`)
  return erreurs
}

// L'animation n'a d'effet que s'il y a au moins deux images à exporter.
export const animationActive = (o: OptionsAnimation, nombreImages: number): boolean => o.mode !== 'aucune' && nombreImages > 1

// ——— Suite des diapositives ———

// Comment on quitte une diapositive : au clic, seule après une pause, ou
// aussitôt la transition jouée (intermédiaires).
export type Depart = { genre: 'clic' } | { genre: 'auto'; apresMs: number } | { genre: 'enchainer' }

// Transition d'entrée sur la diapositive (Morphose et sa durée ; null : pas
// de transition) et départ.
export type TransitionDiapositive = { morphoseMs: number | null; depart: Depart }

export type EtapeSuite = {
  genre: 'principale' | 'intermediaire'
  // Image dont la diapositive montre le décor (A pour une intermédiaire).
  image: number
  // La transition en cours, de l'image `depuis` à l'image `vers`, à
  // l'instant t (0 < t < 1 pour une intermédiaire, 1 à l'arrivée), et
  // l'instant de la diapositive précédente. Première image : depuis = vers.
  depuis: number
  vers: number
  t: number
  tPrecedent: number
  transition: TransitionDiapositive
}

// Écart toléré entre le trajet et la ligne droite de la Morphose : la
// moitié de l'épaisseur des voies.
export const toleranceCorde = (s: Pick<Synoptique, 'largeur' | 'hauteur'>): number => epaisseurParDefaut(s) * 0.5

const DUREE_MIN_MS = 50
const enMs = (secondes: number) => Math.max(DUREE_MIN_MS, Math.round(secondes * 1000))

// Les transitions de la suite, calculées une fois par paire d'images.
export function transitionsDeLaSuite(s: Synoptique, indices: number[], liste: EtatVoie[]): Map<string, TransitionImages> {
  const transitions = new Map<string, TransitionImages>()
  for (let k = 1; k < indices.length; k++) transitions.set(`${indices[k - 1]}>${indices[k]}`, transition(s, indices[k - 1], indices[k], liste))
  return transitions
}

export function suiteDiapositives(
  s: Synoptique,
  indices: number[],
  liste: EtatVoie[],
  options: OptionsAnimation,
  transitions = transitionsDeLaSuite(s, animationActive(options, indices.length) ? indices : [], liste),
): EtapeSuite[] {
  const actif = animationActive(options, indices.length)
  const departPrincipal: Depart = actif && options.mode === 'auto' ? { genre: 'auto', apresMs: Math.round(options.pause * 1000) } : { genre: 'clic' }
  const carte = rectangleAffiche(s)
  const tolerance = toleranceCorde(s)
  const suite: EtapeSuite[] = []
  indices.forEach((image, k) => {
    if (k === 0 || !actif) {
      suite.push({ genre: 'principale', image, depuis: image, vers: image, t: 0, tPrecedent: 0, transition: { morphoseMs: null, depart: departPrincipal } })
      return
    }
    const depuis = indices[k - 1]
    const tr = transitions.get(`${depuis}>${image}`) ?? transition(s, depuis, image, liste)
    let precedent = 0
    for (const t of instantsIntermediaires(tr, carte, tolerance)) {
      suite.push({
        genre: 'intermediaire',
        image: depuis,
        depuis,
        vers: image,
        t,
        tPrecedent: precedent,
        transition: { morphoseMs: enMs(options.duree * (t - precedent)), depart: { genre: 'enchainer' } },
      })
      precedent = t
    }
    suite.push({
      genre: 'principale',
      image,
      depuis,
      vers: image,
      t: 1,
      tPrecedent: precedent,
      transition: { morphoseMs: enMs(options.duree * (1 - precedent)), depart: departPrincipal },
    })
  })
  return suite
}

// ——— Objets séparés ———

// Ce qu'un objet montre, rendu en petite image transparente (une fois par
// apparence différente) : la caisse d'un engin ou d'un véhicule (son modèle
// écrit dedans), une pastille à numéro, l'étiquette d'une rame.
export type Sprite =
  | { genre: 'caisse'; couleur: string; modele: string; longueur: number; largeur: number; horsVoie: boolean }
  | { genre: 'pastille'; couleur: string; texte: string; rayon: number }
  | { genre: 'etiquette'; texte: string; taille: number; alerte: boolean }

// Un objet posé sur une diapositive : sa clé (la même d'une diapositive à
// l'autre), son apparence, son milieu, son angle (degrés, sens des aiguilles
// d'une montre) et la taille de son image (unités du plan). `bascule` : il
// change d'un coup à mi-chemin de la transition (fondu).
export type ObjetAnime = {
  cle: string
  sprite: Sprite
  // Clé de l'image rendue (apparence et taille), et de l'apparence seule :
  // un engin qui passe sur une voie plus épaisse s'élargit en glissant,
  // seul un changement d'apparence le fait passer en fondu.
  cleSprite: string
  apparence: string
  centre: Point
  angle: number
  largeur: number
  hauteur: number
  bascule: boolean
}

const arrondir = (v: number) => Math.round(v * 1000) / 1000
export const cleDuSprite = (sprite: Sprite): string =>
  JSON.stringify(sprite, (_, v: unknown) => (typeof v === 'number' ? arrondir(v) : v))
const apparenceDe = (sprite: Sprite): string => JSON.stringify(sprite, (_, v: unknown) => (typeof v === 'number' ? undefined : v))
const cles = (sprite: Sprite) => ({ cleSprite: cleDuSprite(sprite), apparence: apparenceDe(sprite) })

// Marge autour d'une caisse (son contour déborde du rectangle).
const MARGE_CAISSE = 0.1

// La caisse est rendue avec son libellé tête en bas, et tournée de l'angle
// du libellé plus 180° : un engin presque horizontal a ainsi un angle proche
// de 180°, loin du passage de 360° à 0° que la Morphose ferait tourner d'un
// tour entier. Le libellé reste lisible (retourné comme à l'écran).
export function angleCaisse(angle: number): number {
  const libelle = libelleARetourner(angle) ? angle + 180 : angle
  return normaliserAngle(libelle + 180)
}

function caisse(cle: string, s: Silhouette, couleur: string, modele: string, bascule: boolean): ObjetAnime {
  const sprite: Sprite = { genre: 'caisse', couleur, modele, longueur: s.longueur, largeur: s.largeur, horsVoie: s.depassement > 0 }
  const marge = s.largeur * MARGE_CAISSE
  return {
    cle,
    sprite,
    ...cles(sprite),
    centre: s.centre,
    angle: angleCaisse(s.angle),
    largeur: s.longueur + 2 * marge,
    hauteur: s.largeur + 2 * marge,
    bascule,
  }
}

function pastille(cle: string, centre: Point, rayon: number, couleur: string, texte: string, bascule: boolean): ObjetAnime {
  const sprite: Sprite = { genre: 'pastille', couleur, texte, rayon }
  const cote = rayon * 2.3
  return { cle, sprite, ...cles(sprite), centre, angle: 0, largeur: cote, hauteur: cote, bascule }
}

// Étiquette d'une rame : texte horizontal, centré en x sur sa ligne de base.
// L'image la contient avec son liseré blanc ; la ligne de base est à 0,3 ×
// la taille sous le milieu de l'image (voir rendrePlanche).
export const BASE_ETIQUETTE = 0.3

function etiquette(cle: string, base: Point, texte: string, taille: number, alerte: boolean, bascule: boolean): ObjetAnime {
  const sprite: Sprite = { genre: 'etiquette', texte, taille, alerte }
  return {
    cle,
    sprite,
    ...cles(sprite),
    centre: { x: base.x, y: base.y - BASE_ETIQUETTE * taille },
    angle: 0,
    largeur: largeurTexteEstimee(texte, taille, true) * 1.15 + taille,
    hauteur: taille * 1.7,
    bascule,
  }
}

// Les objets d'une image (principale ou intermédiaire), dans l'ordre de
// l'écran : les rames (véhicules, étiquette, pastille), puis les engins
// (caisse, pastille). Aucun si le calque « Engins » est masqué ; pas de
// pastille si les numéros ne sont pas affichés.
export function objetsDuContenu(s: Synoptique, image: ImageIntermediaire): ObjetAnime[] {
  if (!s.calqueEngins.visible || !s.echelle) return []
  const rayon = rayonPastille(s)
  const tailleEtiquette = tailleNom(epaisseurParDefaut(s)) * 0.72
  const numeros = enginsAffiches(s, { engins: image.engins.map((e) => e.engin), rames: image.rames.map((r) => r.rame) })
  const objets: ObjetAnime[] = []
  image.rames.forEach(({ cle, silhouette: sil, bascule }, i) => {
    const rame = numeros.rames[i]
    if (sil.vehicules.length === 0) return
    sil.vehicules.forEach((v, j) => objets.push(caisse(`${cle}-${j + 1}`, v, rame.vehicules[j].type.couleur, rame.vehicules[j].type.modele, bascule)))
    const texte = etiquetteRame(rame)
    const base = positionEtiquetteRame(sil, tailleEtiquette, largeurTexteEstimee(texte, tailleEtiquette, true))
    const alerte = sil.depassement > 0
    objets.push(etiquette(`${cle}-etiquette`, base, alerte ? `${texte} ⚠` : texte, tailleEtiquette, alerte, bascule))
    if (rame.numero.trim() !== '')
      objets.push(pastille(`${cle}-pastille`, positionPastille(sil.vehicules[0], rayon), rayon, rame.couleur, rame.numero.trim(), bascule))
  })
  image.engins.forEach(({ cle, silhouette: sil, bascule }, i) => {
    const engin = numeros.engins[i]
    objets.push(caisse(cle, sil, engin.couleur, engin.type.modele, bascule))
    if (engin.numero.trim() !== '') objets.push(pastille(`${cle}-pastille`, positionPastille(sil, rayon), rayon, engin.couleur, engin.numero.trim(), bascule))
  })
  return objets
}

// ——— Scènes : chaque diapositive avec son image et ses objets ———

export type ObjetScene = ObjetAnime & {
  // L'objet change d'un coup depuis la diapositive précédente : il ne doit
  // pas glisser mais apparaître en fondu (nom différent).
  rupture: boolean
}

export type Scene = { etape: EtapeSuite; image: ImageIntermediaire; objets: ObjetScene[] }

export function scenesDeLaSuite(s: Synoptique, suite: EtapeSuite[], liste: EtatVoie[], transitions: Map<string, TransitionImages>): Scene[] {
  return suite.map((etape) => {
    const tr = etape.depuis === etape.vers ? null : (transitions.get(`${etape.depuis}>${etape.vers}`) ?? transition(s, etape.depuis, etape.vers, liste))
    const image = tr ? tr.en(etape.t) : transition(s, etape.image, etape.image, liste).en(0)
    const franchit = (etape.t >= 0.5) !== (etape.tPrecedent >= 0.5)
    return { etape, image, objets: objetsDuContenu(s, image).map((o) => ({ ...o, rupture: o.bascule && franchit })) }
  })
}

// ——— Noms des objets ———

// Les noms « !!<clé> » des objets de chaque diapositive : le même nom d'une
// diapositive à la suivante fait glisser l'objet (Morphose). À chaque
// discontinuité (bascule, autre apparence, angle qui saute de plus de 90°),
// un suffixe « ~n » change le nom : l'objet passe en fondu au lieu de
// tourner ou de se déformer de travers. Noms uniques sur chaque diapositive.
export function nommerObjets(scenes: { objets: ObjetScene[] }[]): string[][] {
  const vus = new Map<string, { n: number; apparence: string; angle: number; diapo: number }>()
  return scenes.map((scene, j) => {
    const pris = new Set<string>()
    return scene.objets.map((o) => {
      const precedent = vus.get(o.cle)
      const angle = normaliserAngle(o.angle)
      let n = precedent?.n ?? 0
      if (precedent && precedent.diapo === j - 1 && (o.rupture || precedent.apparence !== o.apparence || Math.abs(angle - precedent.angle) > 90)) n++
      vus.set(o.cle, { n, apparence: o.apparence, angle, diapo: j })
      const base = `!!${o.cle}${n > 0 ? `~${n}` : ''}`
      let nom = base
      for (let k = 2; pris.has(nom); k++) nom = `${base}#${k}`
      pris.add(nom)
      return nom
    })
  })
}

// ——— Place sur la diapositive ———

export type PoseEnPouces = { x: number; y: number; largeur: number; hauteur: number; rotation: number }

// Où poser l'image d'un objet sur la diapositive (pouces), la planche
// entière occupant `cible` ; rotation ramenée dans [0, 360).
export function poseEnPouces(o: Pick<ObjetAnime, 'centre' | 'angle' | 'largeur' | 'hauteur'>, planche: Rectangle, cible: Rectangle): PoseEnPouces {
  const r = versPage({ x: o.centre.x - o.largeur / 2, y: o.centre.y - o.hauteur / 2, largeur: o.largeur, hauteur: o.hauteur }, planche, cible)
  return { x: r.x, y: r.y, largeur: r.largeur, hauteur: r.hauteur, rotation: normaliserAngle(o.angle) }
}

// Clé du rendu du dessous d'une diapositive : le décor de l'image et l'état
// de ses zones (seul ce qui change sur les intermédiaires).
export const cleDessous = (etape: EtapeSuite, image: ImageIntermediaire): string => `${etape.image}|${JSON.stringify(image.contenu.etatsZones)}`

export const NOTE_INTERMEDIAIRE = 'Diapositive de transition générée — ne pas modifier.'
