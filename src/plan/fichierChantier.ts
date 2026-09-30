import type { Chantier, PlanDuChantier } from './chantier.ts'
import type { Rectangle } from './elements.ts'
import { lireCartouche } from './cartouche.ts'
import { creerCatalogue } from './catalogue.ts'
import { creerEtatsVoie, type EtatVoie } from './etatsVoie.ts'
import type { EtatsZones } from './etatsZones.ts'
import { CALQUE_COMMENTAIRES_PAR_DEFAUT } from './commentaires.ts'
import { CALQUE_EXPLOITATION_PAR_DEFAUT, creerEtatsExploitation, type EtatExploitation } from './exploitation.ts'
import { creerTypesFleches, type TypeFleche } from './fleches.ts'
import {
  avisEnginsRetires,
  lireCatalogue,
  lireCommentaires,
  lireCorpsProjet,
  lireCoupes,
  lireEnginsEtRames,
  lireEtatsExploitation,
  lireEtatsVoie,
  lireExploitation,
  lireFleches,
  lireProjet,
  lireTypesFleches,
  type ResultatLecture,
} from './lecture.ts'
import { FORMAT_FICHIER, type Calque, type Zone } from './projet.ts'
import {
  CALQUE_ENGINS_PAR_DEFAUT,
  CALQUE_FLECHES_PAR_DEFAUT,
  contenuDe,
  type EtapePhasage,
  type HeuresCreneau,
  type ImageSynoptique,
  type Synoptique,
} from './synoptique.ts'
import { lireInstant } from './temps.ts'

// Fichier d'un chantier entier — plans, synoptiques, fonds et catalogue
// d'engins compris — pour le transmettre ou le mettre à l'abri. Versionné et
// vérifié à la lecture ; les erreurs sont en français, prêtes à afficher.
//
// Version 1 (étape 4) : sans catalogue ni échelle. Elle s'ouvre toujours : le
// chantier reçoit le catalogue par défaut, ses plans restent sans échelle.
// Version 2 (étape 5) : échelle des plans et des synoptiques, catalogue, et
// engins et rames dans les images des synoptiques. Un plan exporté avant la
// correction de l'étape 5 pouvait porter des engins : ils en sont retirés à
// la lecture, avec un avis (`avis`) à montrer une fois.
// Version 3 (étape 6) : états de la voie du chantier ; dans chaque image,
// état de chaque zone, créneau (titre, heures affichées) et encart PHASAGE ;
// bandeau de titre de chaque synoptique. Une version 2 s'ouvre toujours :
// liste d'états par défaut, zones avant travaux, ni titre ni étapes.
// Version 4 (étape 7) : types de flèches du chantier ; flèches de chaque
// image et lignes masquées de sa légende ; description des engins et des
// rames ; calque « Flèches » et case « Afficher la légende » de chaque
// synoptique. Une version 3 s'ouvre toujours : types de flèches par défaut,
// images sans flèches, légende affichée en entier.
// Version 5 (étape 8) : cartouche de chaque synoptique (page de garde des
// exports). Une version 4 s'ouvre toujours : cartouches vides.
// Version 6 (étape 10) : états d'exploitation des voies du chantier ; dans
// chaque image, état d'exploitation de ses voies, commentaires et coupes de
// tronçonnage ; calques « Exploitation » et « Commentaires » de chaque
// synoptique. Une version 5 s'ouvre toujours : liste d'états d'exploitation
// par défaut, images sans hachures, sans commentaires, sans coupes. Une
// version plus ancienne de l'application refuse d'ouvrir une version 6
// (« version plus récente ») : elle ne peut donc pas l'abîmer.

export const FORMAT_CHANTIER = 'cinematique-ferroviaire/chantier'
export const VERSION_CHANTIER = 6
const EXTENSION_CHANTIER = '.chantier.json'

export function serialiserChantier(c: Chantier): string {
  return JSON.stringify({ format: FORMAT_CHANTIER, version: VERSION_CHANTIER, ...c })
}

export function nomFichierChantier(nom: string): string {
  const propre = nom.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
  return (propre || 'chantier') + EXTENSION_CHANTIER
}

export type LectureChantier = { ok: true; chantier: Chantier; avis: string[] } | { ok: false; erreurs: string[] }

type Brut = Record<string, unknown>
const estObjet = (v: unknown): v is Brut => typeof v === 'object' && v !== null && !Array.isArray(v)
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const estTexte = (v: unknown): v is string => typeof v === 'string' && v !== ''

// Identifiants présents et uniques dans une liste.
function verifierIdentifiants(liste: unknown[], libelle: (i: number) => string, erreurs: string[]): void {
  const vus = new Set<string>()
  liste.forEach((e, i) => {
    const id = estObjet(e) ? e.id : undefined
    if (!estTexte(id)) erreurs.push(`${libelle(i)} : identifiant manquant.`)
    else if (vus.has(id)) erreurs.push(`${libelle(i)} : identifiant « ${id} » en double.`)
    else vus.add(id)
  })
}

function lirePlan(brut: unknown, i: number, erreurs: string[], avis: string[]): PlanDuChantier | null {
  const nom = estObjet(brut) && estObjet(brut.projet) && typeof brut.projet.nom === 'string' ? ` (« ${brut.projet.nom} »)` : ''
  const libelle = `Plan n°${i + 1}${nom}`
  if (!estObjet(brut)) {
    erreurs.push(`${libelle} : description illisible.`)
    return null
  }
  const lu = lireCorpsProjet(brut.projet)
  if (!lu.ok) {
    erreurs.push(...lu.erreurs.map((e) => `${libelle} : ${e}`))
    return null
  }
  const retire = avisEnginsRetires(lu.projet.nom, lu.retires)
  if (retire) avis.push(retire)
  return { id: brut.id as string, projet: lu.projet }
}

function lireCalque(brut: unknown, defaut: Calque): Calque {
  const c = typeof brut === 'object' && brut !== null ? (brut as Brut) : {}
  return {
    visible: typeof c.visible === 'boolean' ? c.visible : defaut.visible,
    verrouille: typeof c.verrouille === 'boolean' ? c.verrouille : defaut.verrouille,
  }
}

function lireLegendeMasquee(brut: unknown, quelle: string, erreurs: string[]): string[] {
  if (brut === undefined) return []
  if (!Array.isArray(brut) || !brut.every((c) => typeof c === 'string')) {
    erreurs.push(`${quelle} : les lignes masquées de la légende sont illisibles.`)
    return []
  }
  return [...brut]
}

function lireCadrage(brut: unknown, largeur: number, hauteur: number): Rectangle | null | undefined {
  if (brut === null) return null
  if (!estObjet(brut) || !estNombre(brut.x) || !estNombre(brut.y) || !estNombre(brut.largeur) || !estNombre(brut.hauteur)) return undefined
  const { x, y, largeur: l, hauteur: h } = brut
  if (l <= 0 || h <= 0 || x < 0 || y < 0 || x + l > largeur + 1e-6 || y + h > hauteur + 1e-6) return undefined
  return { x, y, largeur: l, hauteur: h }
}

const HEURES: readonly HeuresCreneau[] = ['plage', 'debut', 'aucune']

function lirePhasage(brut: unknown, quelle: string, erreurs: string[]): EtapePhasage[] {
  if (brut === undefined) return []
  if (!Array.isArray(brut)) {
    erreurs.push(`${quelle} : l'encart PHASAGE est illisible.`)
    return []
  }
  const etapes: EtapePhasage[] = []
  brut.forEach((e: unknown, k: number) => {
    if (!estObjet(e) || !estNombre(e.numero) || !Number.isInteger(e.numero) || typeof e.libelle !== 'string') {
      erreurs.push(`${quelle}, étape ${k + 1} du phasage : numéro ou libellé illisible.`)
      return
    }
    etapes.push({ numero: e.numero, libelle: e.libelle })
  })
  return etapes
}

// État de chaque zone d'une image : la zone doit exister dans l'image, et ses
// états dans la liste du chantier.
function lireEtatsZones(brut: unknown, zones: Zone[], etats: Set<string>, quelle: string, erreurs: string[]): EtatsZones {
  if (brut === undefined) return {}
  if (!estObjet(brut)) {
    erreurs.push(`${quelle} : les états des zones sont illisibles.`)
    return {}
  }
  const resultat: EtatsZones = {}
  for (const [zoneId, e] of Object.entries(brut)) {
    const zone = zones.find((z) => z.id === zoneId)
    const libelle = `${quelle}, zone ${zone ? `« ${zone.nom} »` : `« ${zoneId} »`}`
    if (!zone) {
      erreurs.push(`${libelle} : cette zone n'existe pas dans l'image.`)
      continue
    }
    if (!estObjet(e) || typeof e.etat !== 'string' || !etats.has(e.etat)) {
      erreurs.push(`${libelle} : état inconnu dans la liste des états de la voie.`)
      continue
    }
    const a = e.avancement
    if (a === null || a === undefined) {
      resultat[zoneId] = { etat: e.etat, avancement: null }
      continue
    }
    if (
      !estObjet(a) ||
      !estNombre(a.pourcentage) ||
      a.pourcentage < 0 ||
      a.pourcentage > 100 ||
      (a.depuis !== 'gauche' && a.depuis !== 'droite') ||
      typeof a.reste !== 'string' ||
      !etats.has(a.reste)
    ) {
      erreurs.push(`${libelle} : avancement illisible (pourcentage de 0 à 100, côté gauche ou droite, état du reste).`)
      continue
    }
    resultat[zoneId] = { etat: e.etat, avancement: { pourcentage: a.pourcentage, depuis: a.depuis, reste: a.reste } }
  }
  return resultat
}

function lireSynoptique(
  brut: unknown,
  i: number,
  erreurs: string[],
  etatsVoie: EtatVoie[],
  typesFleches: TypeFleche[],
  etatsExploitation: EtatExploitation[],
): Synoptique | null {
  const nom = estObjet(brut) && typeof brut.nom === 'string' ? ` (« ${brut.nom} »)` : ''
  const libelle = `Synoptique n°${i + 1}${nom}`
  if (!estObjet(brut)) {
    erreurs.push(`${libelle} : description illisible.`)
    return null
  }
  const avant = erreurs.length
  if (typeof brut.nom !== 'string') erreurs.push(`${libelle} : nom manquant.`)
  const o = brut.origine
  if (!estObjet(o) || typeof o.planId !== 'string' || typeof o.nomPlan !== 'string' || typeof o.copieLe !== 'string') {
    erreurs.push(`${libelle} : plan d'origine illisible.`)
  }
  if (typeof brut.t0 !== 'string' || lireInstant(brut.t0) === null) erreurs.push(`${libelle} : heure de début illisible.`)
  if (!estNombre(brut.fin) || brut.fin <= 0) erreurs.push(`${libelle} : la fin doit être après le début.`)
  // Le fond, l'échelle et la taille se vérifient comme ceux d'un plan.
  const plan = lireCorpsProjet({ nom: '', largeur: brut.largeur, hauteur: brut.hauteur, fond: brut.fond, echelle: brut.echelle, voies: [] })
  if (!plan.ok) erreurs.push(...plan.erreurs.map((e) => `${libelle} : ${e}`))
  if (erreurs.length > avant || !plan.ok) return null

  const { largeur, hauteur, fond, echelle } = plan.projet
  const cadrage = lireCadrage(brut.cadrage ?? null, largeur, hauteur)
  if (cadrage === undefined) erreurs.push(`${libelle} : le cadrage sort du plan ou est illisible.`)

  const fin = brut.fin as number
  const brutes = Array.isArray(brut.images) ? brut.images : []
  if (brutes.length === 0) erreurs.push(`${libelle} : il faut au moins une image.`)
  verifierIdentifiants(brutes, (j) => `${libelle}, image ${j + 1}`, erreurs)
  const images: ImageSynoptique[] = []
  brutes.forEach((im: unknown, j: number) => {
    const quelle = `${libelle}, image ${j + 1}`
    if (!estObjet(im)) return
    if (!estNombre(im.debut) || !estNombre(im.fin)) {
      erreurs.push(`${quelle} : horaires illisibles.`)
      return
    }
    if (im.fin <= im.debut) erreurs.push(`${quelle} : la fin est avant le début.`)
    if (im.debut < 0 || im.fin > fin) erreurs.push(`${quelle} : horaires en dehors du synoptique.`)
    const contenu = estObjet(im.contenu) ? im.contenu : {}
    const lu = lireCorpsProjet({ ...contenu, nom: '', largeur, hauteur, fond: null, echelle })
    if (!lu.ok) {
      erreurs.push(...lu.erreurs.map((e) => `${quelle} : ${e}`))
      return
    }
    const erreursEngins: string[] = []
    const engins = lireEnginsEtRames(contenu, lu.projet.voies, echelle, erreursEngins)
    if (erreursEngins.length > 0) {
      erreurs.push(...erreursEngins.map((e) => `${quelle} : ${e}`))
      return
    }
    const avantImage = erreurs.length
    const etatsZones = lireEtatsZones(contenu.etatsZones, lu.projet.zones, new Set(etatsVoie.map((e) => e.id)), quelle, erreurs)
    const phasage = lirePhasage(im.phasage, quelle, erreurs)
    const erreursFleches: string[] = []
    const fleches = lireFleches(contenu.fleches, new Set(typesFleches.map((t) => t.id)), erreursFleches)
    erreurs.push(...erreursFleches.map((e) => `${quelle} : ${e}`))
    const legendeMasquee = lireLegendeMasquee(im.legendeMasquee, quelle, erreurs)
    const erreursAnnotations: string[] = []
    const exploitation = lireExploitation(contenu.exploitation, lu.projet.voies, new Set(etatsExploitation.map((e) => e.id)), erreursAnnotations)
    const commentaires = lireCommentaires(contenu.commentaires, erreursAnnotations)
    const coupes = lireCoupes(contenu.coupes, lu.projet.zones, erreursAnnotations)
    erreurs.push(...erreursAnnotations.map((e) => `${quelle} : ${e}`))
    if (im.titre !== undefined && typeof im.titre !== 'string') erreurs.push(`${quelle} : titre du créneau illisible.`)
    if (im.heures !== undefined && !HEURES.includes(im.heures as HeuresCreneau)) erreurs.push(`${quelle} : heures du créneau illisibles.`)
    if (erreurs.length > avantImage) return
    images.push({
      id: im.id as string,
      debut: im.debut,
      fin: im.fin,
      titre: typeof im.titre === 'string' ? im.titre : '',
      heures: (im.heures as HeuresCreneau | undefined) ?? 'plage',
      phasage,
      legendeMasquee,
      contenu: contenuDe(lu.projet, engins, etatsZones, fleches, { exploitation, commentaires, coupes }),
    })
  })
  if (erreurs.length > avant || cadrage === undefined) return null
  return {
    id: brut.id as string,
    nom: brut.nom as string,
    origine: { ...(o as Synoptique['origine']) },
    t0: brut.t0 as string,
    fin,
    cadrage,
    largeur,
    hauteur,
    fond,
    echelle,
    calqueEngins: lireCalque(brut.calqueEngins, CALQUE_ENGINS_PAR_DEFAUT),
    calqueFleches: lireCalque(brut.calqueFleches, CALQUE_FLECHES_PAR_DEFAUT),
    calqueExploitation: lireCalque(brut.calqueExploitation, CALQUE_EXPLOITATION_PAR_DEFAUT),
    calqueCommentaires: lireCalque(brut.calqueCommentaires, CALQUE_COMMENTAIRES_PAR_DEFAUT),
    afficherLegende: typeof brut.afficherLegende === 'boolean' ? brut.afficherLegende : true,
    bandeau: typeof brut.bandeau === 'string' ? brut.bandeau : '',
    cartouche: lireCartouche(brut.cartouche),
    images,
  }
}

export function lireChantier(texte: string): LectureChantier {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return { ok: false, erreurs: ["Le fichier n'est pas lisible : ce n'est pas un chantier exporté par l'application."] }
  }
  if (!estObjet(brut)) return { ok: false, erreurs: ['Le fichier ne contient pas de chantier.'] }
  if (brut.format === FORMAT_FICHIER) {
    return { ok: false, erreurs: ["Ce fichier est un plan seul, pas un chantier : utilisez « Importer un plan »."] }
  }
  if (brut.format !== FORMAT_CHANTIER) {
    return { ok: false, erreurs: ["Ce fichier n'est pas un chantier de l'application (marque de format absente)."] }
  }
  if (!estNombre(brut.version) || brut.version > VERSION_CHANTIER) {
    return { ok: false, erreurs: ["Ce chantier a été exporté par une version plus récente de l'application : mettez la page à jour."] }
  }
  const erreurs: string[] = []
  if (!estTexte(brut.id)) erreurs.push('Identifiant du chantier manquant.')
  if (typeof brut.nom !== 'string') erreurs.push('Nom du chantier manquant.')
  const plansBruts = Array.isArray(brut.plans) ? brut.plans : []
  const synoptiquesBruts = Array.isArray(brut.synoptiques) ? brut.synoptiques : []
  if (!Array.isArray(brut.plans)) erreurs.push('La liste des plans est absente.')
  if (!Array.isArray(brut.synoptiques)) erreurs.push('La liste des synoptiques est absente.')
  verifierIdentifiants(plansBruts, (i) => `Plan n°${i + 1}`, erreurs)
  verifierIdentifiants(synoptiquesBruts, (i) => `Synoptique n°${i + 1}`, erreurs)
  const avis: string[] = []
  const plans = plansBruts.map((p: unknown, i: number) => lirePlan(p, i, erreurs, avis))
  const catalogue = brut.catalogue === undefined ? creerCatalogue() : lireCatalogue(brut.catalogue, erreurs)
  const etatsVoie = brut.etatsVoie === undefined ? creerEtatsVoie() : lireEtatsVoie(brut.etatsVoie, erreurs)
  const typesFleches = brut.typesFleches === undefined ? creerTypesFleches() : lireTypesFleches(brut.typesFleches, erreurs)
  const etatsExploitation =
    brut.etatsExploitation === undefined ? creerEtatsExploitation() : lireEtatsExploitation(brut.etatsExploitation, erreurs)
  const synoptiques = synoptiquesBruts.map((s: unknown, i: number) => lireSynoptique(s, i, erreurs, etatsVoie, typesFleches, etatsExploitation))
  if (erreurs.length > 0) return { ok: false, erreurs }
  return {
    ok: true,
    chantier: {
      id: brut.id as string,
      nom: brut.nom as string,
      modifieLe: typeof brut.modifieLe === 'string' ? brut.modifieLe : new Date(0).toISOString(),
      plans: plans as PlanDuChantier[],
      synoptiques: synoptiques as Synoptique[],
      catalogue,
      etatsVoie,
      typesFleches,
      etatsExploitation,
    },
    avis,
  }
}

// Fichier choisi avec « Importer un plan » : un plan des étapes 2 et 3. Un
// chantier est reconnu et renvoyé vers le bon bouton.
export function lirePlanImporte(texte: string): ResultatLecture {
  try {
    const brut: unknown = JSON.parse(texte)
    if (estObjet(brut) && brut.format === FORMAT_CHANTIER) {
      return { ok: false, erreurs: ["Ce fichier est un chantier entier, pas un plan : utilisez « Importer un chantier »."] }
    }
  } catch {
    // lireProjet donne le message.
  }
  return lireProjet(texte)
}
