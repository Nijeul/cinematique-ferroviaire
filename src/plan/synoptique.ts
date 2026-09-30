import { creerCartouche, type Cartouche } from './cartouche.ts'
import { nouvelIdentifiant } from './edition.ts'
import type { Rectangle } from './elements.ts'
import { CALQUE_COMMENTAIRES_PAR_DEFAUT, type Commentaire } from './commentaires.ts'
import type { Coupes } from './coupes.ts'
import type { Resultat } from './echelle.ts'
import type { EnginsEtRames } from './engins.ts'
import type { EtatsZones } from './etatsZones.ts'
import { CALQUE_EXPLOITATION_PAR_DEFAUT, type ExploitationVoies } from './exploitation.ts'
import type { Fleche } from './fleches.ts'
import type { Calque, Echelle, Fond, Point, Projet } from './projet.ts'
import { ecrireInstant, formaterHoraire, formaterPlage, lireInstant, minutesDepuisT0 } from './temps.ts'

// Un synoptique : une copie figée d'un plan, cadrée sur une partie du plan,
// et une suite d'images qu'on feuillette comme un PowerPoint.
//
// Copie figée : à la création, le plan est copié entièrement, échelle
// comprise. Le fond (image lourde) et l'échelle sont gardés une seule fois,
// au niveau du synoptique ; chaque image porte sa propre copie des éléments
// (voies, zones, appareils…) et ses propres engins et rames : on pose ou on
// déplace un engin sur une image sans toucher les autres. « Nouvelle image »
// duplique l'image courante, engins compris : c'est ainsi qu'on fait avancer
// les engins d'une image à l'autre.
//
// Chaque image porte aussi l'état de chaque zone de travaux et ses flèches
// (recopiés par « Nouvelle image », comme les engins), l'état d'exploitation
// de ses voies, ses commentaires et les coupes de tronçonnage de ses zones
// (recopiés eux aussi), sa légende (calculée
// d'après ce qu'elle montre, voir legende.ts), et ce qui s'affiche autour du plan
// comme sur les planches du commanditaire : son créneau horaire (en haut à
// droite, avec un titre facultatif) et son encart PHASAGE (en bas à gauche,
// propre à chaque image : il n'est pas recopié). Le bandeau de titre, en
// haut, est le même pour toutes les images du synoptique.
//
// Temps : T0 est la date et l'heure du début du synoptique ; la fin et les
// horaires des images sont en minutes depuis T0. Les horaires des images sont
// indicatifs (décision du commanditaire) : deux images peuvent se chevaucher
// ou laisser un trou.

// Ce qui est dessiné sur une image : tout le plan sauf le fond et l'échelle,
// gardés une fois au niveau du synoptique, les engins et rames de l'image,
// l'état de ses zones, ses flèches, l'état d'exploitation de ses voies, ses
// commentaires et ses coupes de tronçonnage.
export type Annotations = { exploitation: ExploitationVoies; commentaires: Commentaire[]; coupes: Coupes }

export type ContenuImage = Pick<Projet, 'extremites' | 'calques' | 'cadres' | 'voies' | 'zones' | 'appareils' | 'textes'> &
  EnginsEtRames & { etatsZones: EtatsZones; fleches: Fleche[] } & Annotations

// Une étape de l'encart PHASAGE : « 3 – Dépose des rails… ». Le libellé peut
// tenir sur plusieurs lignes.
export type EtapePhasage = { numero: number; libelle: string }

// Heures affichées dans le créneau : la plage (début – fin), le début seul
// (« Sa 20h00 »), ou aucune (le titre seul, « Phase avant travaux »).
export type HeuresCreneau = 'plage' | 'debut' | 'aucune'

export type ImageSynoptique = {
  id: string
  debut: number
  fin: number
  // Titre du créneau (« Phase avant travaux ») ; vide : les heures seules.
  titre: string
  heures: HeuresCreneau
  phasage: EtapePhasage[]
  // Lignes de la légende masquées sur cette image (par leur clé, voir
  // legende.ts) ; les autres s'affichent.
  legendeMasquee: string[]
  contenu: ContenuImage
}

export type Synoptique = {
  id: string
  nom: string
  // Le plan dont il est la copie, et quand la copie a été faite (date ISO).
  origine: { planId: string; nomPlan: string; copieLe: string }
  t0: string
  fin: number
  // Partie du plan affichée, en pixels du plan ; null : tout le plan.
  cadrage: Rectangle | null
  largeur: number
  hauteur: number
  fond: Fond | null
  // Copiée du plan à la création, figée comme le reste ; calée dans le
  // synoptique lui-même s'il n'en a pas (synoptiques de l'étape 4, plan sans
  // échelle).
  echelle: Echelle | null
  // Calques « Engins », « Flèches », « Exploitation » (hachures des voies) et
  // « Commentaires » : visibles, verrouillés. Les mêmes pour toutes les images.
  calqueEngins: Calque
  calqueFleches: Calque
  calqueExploitation: Calque
  calqueCommentaires: Calque
  // Légende de chaque image, en bas à droite (cochée par défaut).
  afficherLegende: boolean
  // Bandeau de titre, en haut de chaque image (une ou plusieurs lignes) ;
  // vide : pas de bandeau.
  bandeau: string
  // Cartouche de la page de garde des exports (PowerPoint, PDF).
  cartouche: Cartouche
  images: ImageSynoptique[]
}

// Une image vue comme un plan : le fond et l'échelle du synoptique, les
// éléments de l'image, ses engins, ses rames, l'état de ses zones, ses
// flèches, l'état d'exploitation de ses voies, ses commentaires et ses coupes.
export type PlanImage = Projet & EnginsEtRames & { etatsZones: EtatsZones; fleches: Fleche[] } & Annotations

export const annotationsVides = (): Annotations => ({ exploitation: {}, commentaires: [], coupes: {} })

const copie = <T>(valeur: T): T => structuredClone(valeur)

// Contenu d'une image tiré d'un plan (qui n'a ni engins ni flèches, et dont
// toutes les zones sont avant travaux) ; `enginsEtRames`, `etatsZones`,
// `fleches` et `annotations` servent à la relecture d'un synoptique enregistré.
export function contenuDe(
  projet: Projet,
  enginsEtRames: EnginsEtRames = { engins: [], rames: [] },
  etatsZones: EtatsZones = {},
  fleches: Fleche[] = [],
  annotations: Annotations = annotationsVides(),
): ContenuImage {
  const { extremites, calques, cadres, voies, zones, appareils, textes } = projet
  return copie({ extremites, calques, cadres, voies, zones, appareils, textes, ...enginsEtRames, etatsZones, fleches, ...annotations })
}

// Une image neuve : créneau sans titre (les heures, début et fin), encart
// PHASAGE vide, toute la légende affichée.
const nouvelleImageVide = (id: string, debut: number, fin: number, contenu: ContenuImage, legendeMasquee: string[] = []): ImageSynoptique => ({
  id,
  debut,
  fin,
  titre: '',
  heures: 'plage',
  phasage: [],
  legendeMasquee,
  contenu,
})

// Le plan tel qu'il apparaît sur une image : le fond et l'échelle du
// synoptique, les éléments, engins et rames de l'image.
export function projetDeImage(s: Synoptique, image: ImageSynoptique): PlanImage {
  return { nom: s.nom, largeur: s.largeur, hauteur: s.hauteur, fond: s.fond, echelle: s.echelle, ...image.contenu }
}

export const CALQUE_ENGINS_PAR_DEFAUT: Calque = { visible: true, verrouille: false }
export const CALQUE_FLECHES_PAR_DEFAUT: Calque = { visible: true, verrouille: false }

// ——— Cadrage ———

// En dessous de cette taille (pixels du plan), un rectangle glissé est un
// clic maladroit, pas un cadrage.
export const CADRAGE_MIN = 20

// Rectangle glissé entre deux points, dans n'importe quel sens, ramené dans
// les limites du plan. Null s'il est trop petit.
export function normaliserCadrage(a: Point, b: Point, plan: { largeur: number; hauteur: number }): Rectangle | null {
  const borne = (v: number, max: number) => Math.min(max, Math.max(0, v))
  const x1 = borne(Math.min(a.x, b.x), plan.largeur)
  const x2 = borne(Math.max(a.x, b.x), plan.largeur)
  const y1 = borne(Math.min(a.y, b.y), plan.hauteur)
  const y2 = borne(Math.max(a.y, b.y), plan.hauteur)
  if (x2 - x1 < CADRAGE_MIN || y2 - y1 < CADRAGE_MIN) return null
  return { x: x1, y: y1, largeur: x2 - x1, hauteur: y2 - y1 }
}

// Partie du plan à montrer : le cadrage, ou tout le plan.
export const rectangleAffiche = (s: Pick<Synoptique, 'cadrage' | 'largeur' | 'hauteur'>): Rectangle =>
  s.cadrage ?? { x: 0, y: 0, largeur: s.largeur, hauteur: s.hauteur }

// Le cadrage agrandi juste ce qu'il faut pour contenir `r` (une rame…), avec
// une marge, dans les limites du plan. Le même cadrage s'il le contient déjà.
export function cadrageIncluant(s: Pick<Synoptique, 'cadrage' | 'largeur' | 'hauteur'>, r: Rectangle, marge: number): Rectangle | null {
  const actuel = rectangleAffiche(s)
  const contient =
    r.x >= actuel.x && r.y >= actuel.y && r.x + r.largeur <= actuel.x + actuel.largeur && r.y + r.hauteur <= actuel.y + actuel.hauteur
  if (contient) return s.cadrage
  const x1 = Math.max(0, Math.min(actuel.x, r.x - marge))
  const y1 = Math.max(0, Math.min(actuel.y, r.y - marge))
  const x2 = Math.min(s.largeur, Math.max(actuel.x + actuel.largeur, r.x + r.largeur + marge))
  const y2 = Math.min(s.hauteur, Math.max(actuel.y + actuel.hauteur, r.y + r.hauteur + marge))
  if (x1 <= 0 && y1 <= 0 && x2 >= s.largeur && y2 >= s.hauteur) return null
  return { x: x1, y: y1, largeur: x2 - x1, hauteur: y2 - y1 }
}

// Part d'un rectangle qui sort du cadrage : vrai s'il n'y est pas entièrement.
export function horsCadrage(s: Pick<Synoptique, 'cadrage' | 'largeur' | 'hauteur'>, r: Rectangle): boolean {
  const c = rectangleAffiche(s)
  const e = 1e-6
  return r.x < c.x - e || r.y < c.y - e || r.x + r.largeur > c.x + c.largeur + e || r.y + r.hauteur > c.y + c.hauteur + e
}

// ——— Création ———

export type Demande = { nom: string; debut: string; fin: string; cadrage: Rectangle | null }
export type DemandeValide = { nom: string; t0: string; fin: number; cadrage: Rectangle | null }

// Vérifie le formulaire « Nouveau synoptique » ; messages prêts à afficher.
export function verifierDemande(d: Demande): { ok: true; valeur: DemandeValide } | { ok: false; erreurs: string[] } {
  const erreurs: string[] = []
  const nom = d.nom.trim()
  if (nom === '') erreurs.push('Donnez un nom au synoptique.')
  const debut = lireInstant(d.debut)
  const fin = lireInstant(d.fin)
  if (debut === null) erreurs.push("L'heure de début est incomplète : indiquez la date et l'heure.")
  if (fin === null) erreurs.push("L'heure de fin est incomplète : indiquez la date et l'heure.")
  if (debut !== null && fin !== null && fin <= debut) erreurs.push("L'heure de fin doit être après l'heure de début.")
  if (erreurs.length > 0 || debut === null || fin === null) return { ok: false, erreurs }
  return { ok: true, valeur: { nom, t0: ecrireInstant(debut), fin: fin - debut, cadrage: d.cadrage } }
}

// Nouveau synoptique : copie figée du plan, une première image qui couvre
// tout le synoptique.
export function creerSynoptique(
  id: string,
  demande: DemandeValide,
  plan: { id: string; projet: Projet },
  maintenant: string,
): Synoptique {
  const { projet } = plan
  return {
    id,
    nom: demande.nom,
    origine: { planId: plan.id, nomPlan: projet.nom, copieLe: maintenant },
    t0: demande.t0,
    fin: demande.fin,
    cadrage: demande.cadrage ? { ...demande.cadrage } : null,
    largeur: projet.largeur,
    hauteur: projet.hauteur,
    fond: projet.fond ? { ...projet.fond } : null,
    echelle: projet.echelle ? { ...projet.echelle } : null,
    calqueEngins: { ...CALQUE_ENGINS_PAR_DEFAUT },
    calqueFleches: { ...CALQUE_FLECHES_PAR_DEFAUT },
    calqueExploitation: { ...CALQUE_EXPLOITATION_PAR_DEFAUT },
    calqueCommentaires: { ...CALQUE_COMMENTAIRES_PAR_DEFAUT },
    afficherLegende: true,
    bandeau: '',
    cartouche: creerCartouche(),
    images: [nouvelleImageVide('image-1', 0, demande.fin, contenuDe(projet))],
  }
}

// ——— Engins d'une image ———

// Modifie les engins et les rames d'une seule image : `transformer` reçoit
// l'image vue comme un plan et renvoie la version modifiée. Seuls ses engins
// et ses rames sont repris ; le reste de l'image (copie figée du plan) et les
// autres images ne bougent pas.
export function modifierImage(s: Synoptique, index: number, transformer: (image: PlanImage) => PlanImage): Synoptique {
  const image = s.images[index]
  if (!image) return s
  const avant = projetDeImage(s, image)
  const apres = transformer(avant)
  if (apres === avant || (apres.engins === image.contenu.engins && apres.rames === image.contenu.rames)) return s
  const contenu = { ...image.contenu, engins: apres.engins, rames: apres.rames }
  return { ...s, images: s.images.map((im, i) => (i === index ? { ...im, contenu } : im)) }
}

export function modifierCalqueEngins(s: Synoptique, champs: Partial<Calque>): Synoptique {
  return { ...s, calqueEngins: { ...s.calqueEngins, ...champs } }
}

// Échelle calée dans le synoptique lui-même (il n'en avait pas) : c'est une
// copie indépendante, le plan d'origine ne change pas.
export function calerEchelleSynoptique(s: Synoptique, echelle: Echelle): Synoptique {
  return { ...s, echelle: { ...echelle } }
}

// ——— Images ———

// Nouvelle image : copie de l'image courante, engins, rames, états des zones,
// flèches, état d'exploitation des voies, commentaires et coupes compris (ainsi que les lignes masquées de sa légende), insérée
// juste après. Son encart PHASAGE est vide (chaque
// créneau a ses propres étapes, comme sur les planches du commanditaire) et
// son créneau n'a pas de titre. Elle commence à la fin de la courante et dure autant,
// sans dépasser la fin du synoptique. S'il ne reste pas de place, elle reprend les horaires de la
// courante, et un message invite à les ajuster.
export function nouvelleImage(s: Synoptique, index: number): { synoptique: Synoptique; index: number; message: string | null } {
  const courante = s.images[index]
  let debut = courante.fin
  let fin = Math.min(courante.fin + (courante.fin - courante.debut), s.fin)
  let message: string | null = null
  if (fin <= debut) {
    debut = courante.debut
    fin = courante.fin
    message = `L'image ${index + 1} va jusqu'à la fin du synoptique : la nouvelle image reprend ses horaires. Ajustez-les à droite.`
  }
  const image = nouvelleImageVide(nouvelIdentifiant(s.images, 'image'), debut, fin, copie(courante.contenu), [...courante.legendeMasquee])
  const images = [...s.images.slice(0, index + 1), image, ...s.images.slice(index + 1)]
  return { synoptique: { ...s, images }, index: index + 1, message }
}

export function supprimerImage(s: Synoptique, index: number): Resultat<Synoptique> {
  if (s.images.length <= 1) {
    return { ok: false, erreur: "C'est la seule image du synoptique : elle ne peut pas être supprimée." }
  }
  return { ok: true, valeur: { ...s, images: s.images.filter((_, i) => i !== index) } }
}

// Horaires d'une image : dans les bornes du synoptique, fin après début.
// Chevauchements et trous entre images sont permis : les horaires sont
// indicatifs.
export function erreurHoraires(s: Pick<Synoptique, 't0' | 'fin'>, debut: number, fin: number): string | null {
  if (fin <= debut) return "La fin de l'image doit être après son début."
  if (debut < 0) return `L'image ne peut pas commencer avant le début du synoptique (${formaterHoraire(s.t0, 0)}).`
  if (fin > s.fin) return `L'image ne peut pas finir après la fin du synoptique (${formaterHoraire(s.t0, s.fin)}).`
  return null
}

export function modifierHorairesImage(
  s: Synoptique,
  index: number,
  horaires: { debut?: number; fin?: number },
): Resultat<Synoptique> {
  const image = s.images[index]
  const debut = horaires.debut ?? image.debut
  const fin = horaires.fin ?? image.fin
  const erreur = erreurHoraires(s, debut, fin)
  if (erreur) return { ok: false, erreur }
  return { ok: true, valeur: { ...s, images: s.images.map((im, i) => (i === index ? { ...im, debut, fin } : im)) } }
}

// ——— Propriétés du synoptique ———

// Nouveau début : T0 change, et chaque image garde son heure réelle. Refusé
// si une image se retrouverait avant le début.
export function modifierDebut(s: Synoptique, instant: string): Resultat<Synoptique> {
  const decalage = minutesDepuisT0(s.t0, instant)
  if (decalage === null) return { ok: false, erreur: "L'heure de début est incomplète : indiquez la date et l'heure." }
  const fin = s.fin - decalage
  if (fin <= 0) return { ok: false, erreur: "Le début du synoptique doit être avant sa fin." }
  const avant = s.images.findIndex((im) => im.debut - decalage < 0)
  if (avant >= 0) {
    const im = s.images[avant]
    return {
      ok: false,
      erreur: `L'image ${avant + 1} (${formaterPlage(s.t0, im.debut, im.fin)}) commencerait avant ce nouveau début : modifiez-la d'abord.`,
    }
  }
  return {
    ok: true,
    valeur: {
      ...s,
      t0: ecrireInstant(lireInstant(instant)!),
      fin,
      images: s.images.map((im) => ({ ...im, debut: im.debut - decalage, fin: im.fin - decalage })),
    },
  }
}

// Nouvelle fin : refusée si une image finirait après.
export function modifierFin(s: Synoptique, instant: string): Resultat<Synoptique> {
  const fin = minutesDepuisT0(s.t0, instant)
  if (fin === null) return { ok: false, erreur: "L'heure de fin est incomplète : indiquez la date et l'heure." }
  if (fin <= 0) return { ok: false, erreur: "La fin du synoptique doit être après son début." }
  const apres = s.images.findIndex((im) => im.fin > fin)
  if (apres >= 0) {
    const im = s.images[apres]
    return {
      ok: false,
      erreur: `L'image ${apres + 1} (${formaterPlage(s.t0, im.debut, im.fin)}) finirait après cette nouvelle fin : modifiez-la d'abord.`,
    }
  }
  return { ok: true, valeur: { ...s, fin } }
}
