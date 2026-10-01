import type { Rectangle } from './elements.ts'
import {
  silhouetteEngin,
  silhouetteRame,
  silhouetteRameSurTrace,
  silhouetteSurTrace,
  longueurRame,
  type Engin,
  type EnginsEtRames,
  type Rame,
  type Silhouette,
  type SilhouetteRame,
} from './engins.ts'
import { metresVersPlan } from './echelle.ts'
import type { EtatVoie } from './etatsVoie.ts'
import type { CoteDepart, EtatZone, EtatsZones } from './etatsZones.ts'
import { itineraire, margeRebroussement, surItineraire, type Itineraire } from './itineraire.ts'
import type { Point, Projet } from './projet.ts'
import { projetDeImage, type ContenuImage, type Synoptique } from './synoptique.ts'
import { projeterSurPolyligne } from './trace.ts'

// Ce qui se passe entre deux images d'un synoptique, pour l'animation du
// PowerPoint exporté : à chaque instant t (0 = image A, 1 = image B), où est
// chaque engin et chaque rame, et dans quel état est chaque zone.
//
// - Un engin (ou une rame) se reconnaît d'une image à l'autre à son
//   identifiant et à son type (à la suite des types de ses véhicules) ;
//   sinon il disparaît et un autre apparaît, à mi-chemin.
// - Sur la même voie, il roule le long de la voie (courbes comprises) ; hors
//   voie, il glisse et tourne au plus court.
// - D'une voie à l'autre, il suit l'itinéraire à travers les appareils
//   (itineraire.ts), à vitesse constante, rebroussements compris.
// - Sans itinéraire possible, ou pour un enraillement ou un déraillement
//   (passage entre une voie et une position libre), il « bascule » à
//   mi-chemin : dans le PowerPoint, un fondu.
// - Une zone qui change d'état avance comme un front.
// Le décor (flèches, commentaires, hachures, coupes, textes) reste celui de
// l'image A jusqu'à l'arrivée sur B.

type PlanAnime = Pick<Projet, 'voies' | 'appareils' | 'echelle' | 'largeur' | 'hauteur'>

// ——— Appariement ———

// Empreinte courte d'un texte (FNV-1a), pour une clé stable.
export function empreinte(texte: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

// Clé d'un engin ou d'une rame : la même d'une image à l'autre s'ils sont
// appariés, différente sinon (même identifiant mais autre type).
export const cleEngin = (e: Pick<Engin, 'id' | 'typeId'>): string => `engin-${e.id}-${e.typeId}`
export const cleRame = (r: Pick<Rame, 'id' | 'vehicules'>): string => `rame-${r.id}-${empreinte(r.vehicules.map((v) => v.typeId).join(','))}`

export type Appariement<T> = { paires: [T, T][]; disparus: T[]; apparus: T[] }

function apparierListe<T>(a: T[], b: T[], cle: (x: T) => string): Appariement<T> {
  const parCle = new Map(b.map((x) => [cle(x), x]))
  const paires: [T, T][] = []
  const disparus: T[] = []
  for (const x of a) {
    const y = parCle.get(cle(x))
    if (y) {
      paires.push([x, y])
      parCle.delete(cle(x))
    } else disparus.push(x)
  }
  return { paires, disparus, apparus: [...parCle.values()] }
}

export function apparier(a: EnginsEtRames, b: EnginsEtRames): { engins: Appariement<Engin>; rames: Appariement<Rame> } {
  return { engins: apparierListe(a.engins, b.engins, cleEngin), rames: apparierListe(a.rames, b.rames, cleRame) }
}

// ——— Mouvement d'un engin ou d'une rame ———

export type GenreMouvement = 'immobile' | 'voie' | 'libre' | 'itineraire' | 'bascule'

// `en(t)` : la silhouette à l'instant t (exactement A à 0, exactement B à 1).
// `imposes` : les instants où il passe sur un appareil ou rebrousse.
export type Mouvement<S> = { genre: GenreMouvement; itineraire: Itineraire | null; en: (t: number) => S; imposes?: number[] }

// Instants où le milieu de l'objet passe sur un appareil ou rebrousse.
function instantsImposes(it: Itineraire): number[] {
  if (!(it.longueur > 0)) return []
  return [...it.passages, ...it.rebroussements].map((u) => u / it.longueur).filter((t) => t > 0 && t < 1)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Angle de a vers b par le plus court chemin (350° → 10° passe par 0°).
export function angleIntermediaire(a: number, b: number, t: number): number {
  const ecart = ((((b - a) % 360) + 540) % 360) - 180
  return a + ecart * t
}

const bascule = <S>(a: S, b: S): Mouvement<S> => ({ genre: 'bascule', itineraire: null, en: (t) => (t < 0.5 ? a : b) })
const bornes = <S>(a: S, b: S, milieu: (t: number) => S) => (t: number) => (t <= 0 ? a : t >= 1 ? b : milieu(t))

export function mouvementEngin(planA: PlanAnime, planB: PlanAnime, eA: Engin, eB: Engin): Mouvement<Silhouette> | null {
  const sA = silhouetteEngin(planA, eA)
  const sB = silhouetteEngin(planB, eB)
  if (!sA || !sB) return null
  const pA = eA.position
  const pB = eB.position
  if (pA.genre === 'voie' && pB.genre === 'voie' && pA.voieId === pB.voieId) {
    if (pA.abscisse === pB.abscisse) return { genre: 'immobile', itineraire: null, en: bornes(sA, sB, () => sA) }
    const milieu = (t: number) => silhouetteEngin(planA, { ...eA, position: { ...pA, abscisse: lerp(pA.abscisse, pB.abscisse, t) } })!
    return { genre: 'voie', itineraire: null, en: bornes(sA, sB, milieu) }
  }
  if (pA.genre === 'libre' && pB.genre === 'libre') {
    if (pA.x === pB.x && pA.y === pB.y && pA.angle === pB.angle) return { genre: 'immobile', itineraire: null, en: bornes(sA, sB, () => sA) }
    const milieu = (t: number) =>
      silhouetteEngin(planA, {
        ...eA,
        position: { genre: 'libre', x: lerp(pA.x, pB.x, t), y: lerp(pA.y, pB.y, t), angle: angleIntermediaire(pA.angle, pB.angle, t) },
      })!
    return { genre: 'libre', itineraire: null, en: bornes(sA, sB, milieu) }
  }
  if (pA.genre === 'voie' && pB.genre === 'voie' && planA.echelle) {
    const it = itineraire(planA, pA, pB, sA.longueur, margeRebroussement(planA.echelle.pixelsParMetre))
    if (!it) return bascule(sA, sB)
    const milieu = (t: number) => {
      const { troncon, abscisse } = surItineraire(it, t * it.longueur)
      return silhouetteSurTrace(troncon.points, abscisse, sA.longueur, sA.largeur)
    }
    return { genre: 'itineraire', itineraire: it, en: bornes(sA, sB, milieu), imposes: instantsImposes(it) }
  }
  // Enraillement, déraillement : fondu.
  return bascule(sA, sB)
}

export function mouvementRame(planA: PlanAnime, planB: PlanAnime, rA: Rame, rB: Rame): Mouvement<SilhouetteRame> | null {
  const sA = silhouetteRame(planA, rA)
  const sB = silhouetteRame(planB, rB)
  const echelle = planA.echelle
  if (!sA || !sB || !echelle) return null
  if (rA.voieId === rB.voieId) {
    if (rA.sens !== rB.sens) return bascule(sA, sB)
    if (rA.abscisse === rB.abscisse) return { genre: 'immobile', itineraire: null, en: bornes(sA, sB, () => sA) }
    return { genre: 'voie', itineraire: null, en: bornes(sA, sB, (t) => silhouetteRame(planA, { ...rA, abscisse: lerp(rA.abscisse, rB.abscisse, t) })!) }
  }
  const total = metresVersPlan(echelle, longueurRame(rA.vehicules))
  const it = itineraire(planA, { voieId: rA.voieId, abscisse: rA.abscisse }, { voieId: rB.voieId, abscisse: rB.abscisse }, total, margeRebroussement(echelle.pixelsParMetre))
  if (!it) return bascule(sA, sB)
  // Sens de la tête par rapport au sens de marche : il s'inverse à chaque
  // rebroussement (la rame repart dans l'autre sens, sa tête reste la même).
  const sensInitial = (rA.sens * it.sensDepart) as 1 | -1
  const signe = (rang: number) => (rang % 2 === 0 ? 1 : -1)
  const sensFinal = sensInitial * signe(it.troncons.length - 1) * it.sensArrivee
  // La tête n'arriverait pas du côté voulu sur l'image B : fondu.
  if (sensFinal !== rB.sens) return bascule(sA, sB)
  const voie = planA.voies.find((v) => v.id === rA.voieId)!
  const milieu = (t: number) => {
    const { troncon, abscisse, rang } = surItineraire(it, t * it.longueur)
    const sens = (sensInitial * signe(rang)) as 1 | -1
    return silhouetteRameSurTrace(troncon.points, { abscisse, sens, vehicules: rA.vehicules }, echelle, voie.epaisseur)
  }
  return { genre: 'itineraire', itineraire: it, en: bornes(sA, sB, milieu), imposes: instantsImposes(it) }
}

// ——— États des zones ———

const oppose = (c: CoteDepart): CoteDepart => (c === 'gauche' ? 'droite' : 'gauche')

// État d'une zone à l'instant t. Si seuls deux états sont en jeu, l'un
// avance sur l'autre comme un front : le pourcentage fait est interpolé,
// depuis le côté d'un avancement saisi dans A ou B, sinon depuis la gauche
// (Nord / Paris). Trois états différents (ou deux avancements de sens
// opposés) : la zone bascule à mi-chemin. Exactement A à 0, B à 1.
export function interpolerEtatZone(eA: EtatZone | undefined, eB: EtatZone | undefined, t: number, liste: EtatVoie[]): EtatZone | undefined {
  if (t <= 0) return eA
  if (t >= 1) return eB
  const premier = liste[0]?.id ?? ''
  const a = eA ?? { etat: premier, avancement: null }
  const b = eB ?? { etat: premier, avancement: null }
  const basculer = () => (t < 0.5 ? eA : eB)
  const etats = new Set([a.etat, b.etat, a.avancement?.reste, b.avancement?.reste].filter((x): x is string => x !== undefined))
  if (etats.size !== 2) return basculer()
  // L'état qui avance (Y) sur l'autre (X).
  const [y, x] = b.avancement ? [b.etat, b.avancement.reste] : a.avancement ? [a.etat, a.avancement.reste] : [b.etat, a.etat]
  if (x === y) return basculer()
  const part = (e: EtatZone): { f: number; depuis: CoteDepart | null } => {
    if (!e.avancement) return { f: e.etat === y ? 100 : 0, depuis: null }
    return e.etat === y
      ? { f: e.avancement.pourcentage, depuis: e.avancement.depuis }
      : { f: 100 - e.avancement.pourcentage, depuis: oppose(e.avancement.depuis) }
  }
  const pa = part(a)
  const pb = part(b)
  if (pa.depuis && pb.depuis && pa.depuis !== pb.depuis) return basculer()
  return { etat: y, avancement: { pourcentage: lerp(pa.f, pb.f, t), depuis: pa.depuis ?? pb.depuis ?? 'gauche', reste: x } }
}

// Longueur (unités du plan) que parcourt le front d'une zone de A à B ; 0
// si elle ne change pas ou si elle bascule.
function courseDuFront(longueurZone: number, eA: EtatZone | undefined, eB: EtatZone | undefined, liste: EtatVoie[]): number {
  const milieu = interpolerEtatZone(eA, eB, 0.5, liste)
  if (!milieu?.avancement || milieu === eA || milieu === eB) return 0
  const a = interpolerEtatZone(eA, eB, 1e-9, liste)!.avancement!.pourcentage
  const b = interpolerEtatZone(eA, eB, 1 - 1e-9, liste)!.avancement!.pourcentage
  return (Math.abs(b - a) / 100) * longueurZone
}

// ——— Une transition entre deux images ———

export type EnginAnime = { cle: string; engin: Engin; silhouette: Silhouette; bascule: boolean }
export type RameAnimee = { cle: string; rame: Rame; silhouette: SilhouetteRame; bascule: boolean }

// L'image à l'instant t : le décor (contenu de A, de B à t=1, avec l'état des
// zones à cet instant ; sans engins ni rames) et les engins et rames, avec
// leur silhouette. `bascule` : l'objet change d'un coup à mi-chemin (fondu).
export type ImageIntermediaire = { contenu: ContenuImage; engins: EnginAnime[]; rames: RameAnimee[] }

type Suivi<D, S> = { cle: string; a: D | null; b: D | null; mouvement: Mouvement<S> | null; seul: S | null }

export type TransitionImages = {
  en: (t: number) => ImageIntermediaire
  // Ce qui bouge le long d'une courbe possible (pour le nombre
  // d'intermédiaires), les instants imposés (passage sur un appareil,
  // rebroussement) et la plus longue course d'un front de zone.
  mouvements: Mouvement<Silhouette | SilhouetteRame>[]
  imposes: number[]
  parAppareil: boolean
  courseFront: number
}

export function transition(s: Synoptique, iA: number, iB: number, liste: EtatVoie[]): TransitionImages {
  const A = s.images[iA]
  const B = s.images[iB]
  const planA = projetDeImage(s, A)
  const planB = projetDeImage(s, B)
  const paires = apparier(A.contenu, B.contenu)

  const suivre = <D, S>(
    p: Appariement<D>,
    cle: (d: D) => string,
    mouvement: (a: D, b: D) => Mouvement<S> | null,
    seul: (plan: PlanAnime, d: D) => S | null,
  ): Suivi<D, S>[] => [
    ...p.paires.map(([a, b]): Suivi<D, S> => {
      const m = mouvement(a, b)
      // Sans silhouette d'un côté (voie disparue) : il disparaît ou apparaît.
      if (m) return { cle: cle(a), a, b, mouvement: m, seul: null }
      const sa = seul(planA, a)
      return sa ? { cle: cle(a), a, b: null, mouvement: null, seul: sa } : { cle: cle(b), a: null, b, mouvement: null, seul: seul(planB, b) }
    }),
    ...p.disparus.map((a): Suivi<D, S> => ({ cle: cle(a), a, b: null, mouvement: null, seul: seul(planA, a) })),
    ...p.apparus.map((b): Suivi<D, S> => ({ cle: cle(b), a: null, b, mouvement: null, seul: seul(planB, b) })),
  ]
  const engins = suivre(paires.engins, cleEngin, (a, b) => mouvementEngin(planA, planB, a, b), silhouetteEngin)
  const rames = suivre(paires.rames, cleRame, (a, b) => mouvementRame(planA, planB, a, b), silhouetteRame)

  // À l'instant t : un objet apparié est là où son mouvement le met ; un
  // objet seul est là jusqu'à mi-chemin (disparu) ou à partir de mi-chemin
  // (apparu).
  const placer = <D, S>(liste: Suivi<D, S>[], t: number) =>
    liste.flatMap((x) => {
      const donnees = (x.a && (t < 0.5 || !x.b) ? x.a : x.b)!
      if (x.mouvement) return [{ cle: x.cle, donnees, silhouette: x.mouvement.en(t), bascule: x.mouvement.genre === 'bascule' }]
      const present = x.a ? t < 0.5 : t >= 0.5
      return present && x.seul ? [{ cle: x.cle, donnees, silhouette: x.seul, bascule: false }] : []
    })

  const zones = planA.zones
  const en = (t: number): ImageIntermediaire => {
    const decor = t >= 1 ? B.contenu : A.contenu
    const etatsZones: EtatsZones = {}
    for (const id of new Set([...Object.keys(A.contenu.etatsZones), ...Object.keys(B.contenu.etatsZones)])) {
      const e = interpolerEtatZone(A.contenu.etatsZones[id], B.contenu.etatsZones[id], t, liste)
      if (e) etatsZones[id] = e
    }
    return {
      contenu: { ...decor, etatsZones: t <= 0 ? A.contenu.etatsZones : t >= 1 ? B.contenu.etatsZones : etatsZones, engins: [], rames: [] },
      engins: placer(engins, t).map(({ cle, donnees, silhouette, bascule }) => ({ cle, engin: donnees, silhouette, bascule })),
      rames: placer(rames, t).map(({ cle, donnees, silhouette, bascule }) => ({ cle, rame: donnees, silhouette, bascule })),
    }
  }

  const tous: (Mouvement<Silhouette | SilhouetteRame> | null)[] = [...engins.map((x) => x.mouvement), ...rames.map((x) => x.mouvement)]
  const mouvements = tous.filter(
    (m): m is Mouvement<Silhouette | SilhouetteRame> => m !== null && m.genre !== 'bascule' && m.genre !== 'immobile',
  )
  const itineraires = mouvements.map((m) => m.itineraire).filter((it): it is Itineraire => it !== null && it.longueur > 0)
  const imposes = mouvements.flatMap((m) => m.imposes ?? [])
  const courseFront = Math.max(
    0,
    ...zones.map((z) => courseDuFront(Math.abs(z.fin - z.debut), A.contenu.etatsZones[z.id], B.contenu.etatsZones[z.id], liste)),
  )
  return { en, mouvements, imposes, parAppareil: itineraires.some((it) => it.passages.length > 0), courseFront }
}

// L'image intermédiaire à l'instant t entre les images iA et iB : décor de
// A (de B à t=1), états des zones, engins et rames interpolés.
export const contenuIntermediaire = (s: Synoptique, iA: number, iB: number, t: number, liste: EtatVoie[]): ImageIntermediaire =>
  transition(s, iA, iB, liste).en(t)

// ——— Nombre de diapositives intermédiaires ———

// La Morphose de PowerPoint déplace chaque objet en ligne droite d'une
// diapositive à la suivante : des diapositives intermédiaires découpent un
// trajet courbe pour qu'il reste sur la voie, et font avancer un front de
// zone par étapes.
export const PLAFOND_INTERMEDIAIRES = 6
export const PLAFOND_PAR_APPAREIL = 12
const ECART_MIN = 0.02
const ECART_IMPOSE = 0.004

// Points suivis d'une silhouette : le milieu d'un engin, celui de chaque
// véhicule d'une rame.
function pointsSuivis(sil: Silhouette | SilhouetteRame): Point[] {
  return 'centre' in sil ? [sil.centre] : sil.vehicules.map((v) => v.centre)
}

const ECHANTILLONS = 12

// Plus grand écart entre le trajet réel et la corde que tracerait la
// Morphose d'un instant au suivant, et l'instant où il se produit.
function pireEcart(mouvements: Mouvement<Silhouette | SilhouetteRame>[], instants: number[]): { ecart: number; t: number } {
  const bornesT = [0, ...instants, 1]
  let pire = { ecart: 0, t: 0.5 }
  for (const m of mouvements) {
    for (let k = 1; k < bornesT.length; k++) {
      const t0 = bornesT[k - 1]
      const t1 = bornesT[k]
      const p0 = pointsSuivis(m.en(t0))
      const p1 = pointsSuivis(m.en(t1))
      for (let j = 1; j < ECHANTILLONS; j++) {
        const t = lerp(t0, t1, j / ECHANTILLONS)
        pointsSuivis(m.en(t)).forEach((q, i) => {
          if (!p0[i] || !p1[i]) return
          const ecart = projeterSurPolyligne([p0[i], p1[i]], q).distance
          if (ecart > pire.ecart) pire = { ecart, t }
        })
      }
    }
  }
  return pire
}

export const ecartALaCorde = (mouvements: Mouvement<Silhouette | SilhouetteRame>[], instants: number[]): number =>
  pireEcart(mouvements, instants).ecart

const uniformes = (n: number) => Array.from({ length: n }, (_, k) => (k + 1) / (n + 1))

// Les instants imposés (sauf s'ils se confondent presque), puis les autres
// qui ne tombent pas trop près d'un instant déjà gardé.
function fusionner(imposes: number[], autres: number[]): number[] {
  const tous = [...imposes].filter((t) => t > ECART_IMPOSE && t < 1 - ECART_IMPOSE).sort((a, b) => a - b)
  const garde: number[] = []
  for (const t of tous) if (garde.every((g) => Math.abs(g - t) >= ECART_IMPOSE)) garde.push(t)
  for (const t of autres) if (garde.every((g) => Math.abs(g - t) >= ECART_MIN)) garde.push(t)
  return garde.sort((a, b) => a - b)
}

// Les instants (strictement entre 0 et 1) des diapositives intermédiaires :
// aucun si rien ne bouge en courbe et si aucune zone n'avance ; sinon les
// passages sur les appareils et les rebroussements, de 2 à 6 étapes
// régulières pour un front de zone selon sa course, puis, tant que l'écart à
// la corde dépasse `tolerance` (unités du plan), un instant de plus là où il
// est le plus grand. Au plus 6, ou 12 quand un itinéraire passe par un
// appareil.
export function instantsIntermediaires(tr: TransitionImages, carte: Rectangle, tolerance: number): number[] {
  const plafond = tr.parAppareil ? PLAFOND_PAR_APPAREIL : PLAFOND_INTERMEDIAIRES
  const pas = carte.largeur / 25
  const pourZone = tr.courseFront > 0 ? Math.min(6, Math.max(2, Math.round(tr.courseFront / pas))) : 0
  let instants = fusionner(tr.imposes, uniformes(pourZone))
  if (instants.length > plafond) instants = instants.filter((_, i) => i % Math.ceil(instants.length / plafond) === 0)
  while (instants.length < plafond) {
    const pire = pireEcart(tr.mouvements, instants)
    if (pire.ecart <= tolerance) break
    const suivants = fusionner([...instants, pire.t], [])
    if (suivants.length === instants.length) break
    instants = suivants
  }
  return instants
}

export const nombreIntermediaires = (tr: TransitionImages, carte: Rectangle, tolerance: number): number =>
  instantsIntermediaires(tr, carte, tolerance).length
