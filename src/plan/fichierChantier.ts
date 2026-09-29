import type { Chantier, PlanDuChantier } from './chantier.ts'
import type { Rectangle } from './elements.ts'
import { creerCatalogue } from './catalogue.ts'
import { lireCatalogue, lireCorpsProjet, lireProjet, type ResultatLecture } from './lecture.ts'
import { FORMAT_FICHIER } from './projet.ts'
import { contenuDe, type ImageSynoptique, type Synoptique } from './synoptique.ts'
import { lireInstant } from './temps.ts'

// Fichier d'un chantier entier — plans, synoptiques, fonds et catalogue
// d'engins compris — pour le transmettre ou le mettre à l'abri. Versionné et
// vérifié à la lecture ; les erreurs sont en français, prêtes à afficher.
//
// Version 1 (étape 4) : sans catalogue ni échelle. Elle s'ouvre toujours : le
// chantier reçoit le catalogue par défaut, ses plans restent sans échelle.

export const FORMAT_CHANTIER = 'cinematique-ferroviaire/chantier'
export const VERSION_CHANTIER = 2
const EXTENSION_CHANTIER = '.chantier.json'

export function serialiserChantier(c: Chantier): string {
  return JSON.stringify({ format: FORMAT_CHANTIER, version: VERSION_CHANTIER, ...c })
}

export function nomFichierChantier(nom: string): string {
  const propre = nom.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
  return (propre || 'chantier') + EXTENSION_CHANTIER
}

export type LectureChantier = { ok: true; chantier: Chantier } | { ok: false; erreurs: string[] }

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

function lirePlan(brut: unknown, i: number, erreurs: string[]): PlanDuChantier | null {
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
  return { id: brut.id as string, projet: lu.projet }
}

function lireCadrage(brut: unknown, largeur: number, hauteur: number): Rectangle | null | undefined {
  if (brut === null) return null
  if (!estObjet(brut) || !estNombre(brut.x) || !estNombre(brut.y) || !estNombre(brut.largeur) || !estNombre(brut.hauteur)) return undefined
  const { x, y, largeur: l, hauteur: h } = brut
  if (l <= 0 || h <= 0 || x < 0 || y < 0 || x + l > largeur + 1e-6 || y + h > hauteur + 1e-6) return undefined
  return { x, y, largeur: l, hauteur: h }
}

function lireSynoptique(brut: unknown, i: number, erreurs: string[]): Synoptique | null {
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
    images.push({ id: im.id as string, debut: im.debut, fin: im.fin, contenu: contenuDe(lu.projet) })
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
  const plans = plansBruts.map((p: unknown, i: number) => lirePlan(p, i, erreurs))
  const synoptiques = synoptiquesBruts.map((s: unknown, i: number) => lireSynoptique(s, i, erreurs))
  const catalogue = brut.catalogue === undefined ? creerCatalogue() : lireCatalogue(brut.catalogue, erreurs)
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
    },
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
