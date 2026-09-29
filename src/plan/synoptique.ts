import { nouvelIdentifiant } from './edition.ts'
import type { Rectangle } from './elements.ts'
import type { Resultat } from './echelle.ts'
import type { EnginsEtRames } from './engins.ts'
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
// Temps : T0 est la date et l'heure du début du synoptique ; la fin et les
// horaires des images sont en minutes depuis T0.

// Ce qui est dessiné sur une image : tout le plan sauf le fond et l'échelle,
// gardés une fois au niveau du synoptique, et les engins et rames de l'image.
export type ContenuImage = Pick<Projet, 'extremites' | 'calques' | 'cadres' | 'voies' | 'zones' | 'appareils' | 'textes'> & EnginsEtRames

export type ImageSynoptique = { id: string; debut: number; fin: number; contenu: ContenuImage }

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
  // Calque « Engins » : visible, verrouillé. Le même pour toutes les images.
  calqueEngins: Calque
  images: ImageSynoptique[]
}

// Une image vue comme un plan : le fond et l'échelle du synoptique, les
// éléments de l'image, ses engins et ses rames.
export type PlanImage = Projet & EnginsEtRames

const copie = <T>(valeur: T): T => structuredClone(valeur)

// Contenu d'une image tiré d'un plan (qui n'a pas d'engins) ; `enginsEtRames`
// sert à la relecture d'un synoptique enregistré.
export function contenuDe(projet: Projet, enginsEtRames: EnginsEtRames = { engins: [], rames: [] }): ContenuImage {
  const { extremites, calques, cadres, voies, zones, appareils, textes } = projet
  return copie({ extremites, calques, cadres, voies, zones, appareils, textes, ...enginsEtRames })
}

// Le plan tel qu'il apparaît sur une image : le fond et l'échelle du
// synoptique, les éléments, engins et rames de l'image.
export function projetDeImage(s: Synoptique, image: ImageSynoptique): PlanImage {
  return { nom: s.nom, largeur: s.largeur, hauteur: s.hauteur, fond: s.fond, echelle: s.echelle, ...image.contenu }
}

export const CALQUE_ENGINS_PAR_DEFAUT: Calque = { visible: true, verrouille: false }

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
    images: [{ id: 'image-1', debut: 0, fin: demande.fin, contenu: contenuDe(projet) }],
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

// Nouvelle image : copie de l'image courante, engins et rames compris,
// insérée juste après. Elle commence à la fin de la courante et dure autant,
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
  const image: ImageSynoptique = { id: nouvelIdentifiant(s.images, 'image'), debut, fin, contenu: copie(courante.contenu) }
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

// Avertissements discrets, sans blocage : deux images qui se suivent et se
// chevauchent, ou qui laissent un trou entre elles.
export function avertissementsImages(s: Synoptique): string[] {
  const avertissements: string[] = []
  for (let i = 1; i < s.images.length; i++) {
    const a = s.images[i - 1]
    const b = s.images[i]
    if (b.debut < a.fin) {
      avertissements.push(`Les images ${i} et ${i + 1} se chevauchent (${formaterPlage(s.t0, b.debut, Math.min(a.fin, b.fin))}).`)
    } else if (b.debut > a.fin) {
      avertissements.push(`Trou entre les images ${i} et ${i + 1} : rien de ${formaterPlage(s.t0, a.fin, b.debut)}.`)
    }
  }
  return avertissements
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
