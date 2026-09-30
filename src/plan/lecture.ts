import {
  CALQUES_ELEMENTS,
  creerProjet,
  EPAISSEUR_MAX,
  EPAISSEUR_MIN,
  FORMAT_FICHIER,
  TAILLE_TEXTE_MAX,
  TAILLE_TEXTE_MIN,
  VERSION_FICHIER,
  type Ancrage,
  type Appareil,
  type Cadre,
  type Echelle,
  type Fond,
  type Point,
  type Projet,
  type Texte,
  type Voie,
  type Zone,
} from './projet.ts'
import type { DimensionsEngin, TypeEngin } from './catalogue.ts'
import type { Engin, EnginsEtRames, Rame, Vehicule } from './engins.ts'
import type { EtatVoie, RenduEtat } from './etatsVoie.ts'
import { EPAISSEUR_FLECHE_MAX, EPAISSEUR_FLECHE_MIN, POINTES, STYLES_TRAIT, type Fleche, type Pointes, type StyleTrait, type TypeFleche } from './fleches.ts'
import { longueurPolyligne } from './trace.ts'
import type { Commentaire } from './commentaires.ts'
import { erreurPasCoupes, type Coupes } from './coupes.ts'
import type { EtatExploitation, ExploitationVoies } from './exploitation.ts'

// Lecture et vérification d'un projet enregistré. Les erreurs sont en
// français, prêtes à afficher ; aucune exception ne sort d'ici.
//
// Les fichiers des étapes précédentes s'ouvrent toujours : les listes
// absentes sont vides, les extrémités prennent leurs noms par défaut (Nord à
// gauche, Sud à droite), et un plan sans échelle (étapes 2 à 4) reste sans
// échelle.
//
// Un plan ne contient aucun engin : ceux d'un plan enregistré avant la
// correction de l'étape 5 sont retirés à la lecture, et comptés pour le dire
// une fois à l'utilisateur. Les engins et les rames se lisent dans les images
// des synoptiques (lireEnginsEtRames).

// Engins et rames trouvés dans un plan, et retirés.
export type EnginsRetires = { engins: number; rames: number }

export type ResultatLecture = { ok: true; projet: Projet; retires: EnginsRetires } | { ok: false; erreurs: string[] }

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// « Les engins ne se posent plus sur le plan mais dans les synoptiques :
// 3 engins et 1 rame retirés du plan « Phase 1 ». » ; null si rien n'a été
// retiré.
export function avisEnginsRetires(nomPlan: string, r: EnginsRetires): string | null {
  if (r.engins + r.rames === 0) return null
  const quoi = [r.engins > 0 && pluriel(r.engins, 'engin'), r.rames > 0 && pluriel(r.rames, 'rame')].filter(Boolean).join(' et ')
  const retire = r.engins + r.rames > 1 ? 'retirés' : r.engins === 1 ? 'retiré' : 'retirée'
  return `Les engins ne se posent plus sur le plan mais dans les synoptiques : ${quoi} ${retire} du plan « ${nomPlan} ».`
}

// Ce qu'un plan enregistré contient encore d'engins et de rames.
export function compterEnginsDuPlan(brut: unknown): EnginsRetires {
  const longueur = (v: unknown) => (Array.isArray(v) ? v.length : 0)
  return estObjet(brut) ? { engins: longueur(brut.engins), rames: longueur(brut.rames) } : { engins: 0, rames: 0 }
}

type Brut = Record<string, unknown>

const estObjet = (v: unknown): v is Brut => typeof v === 'object' && v !== null && !Array.isArray(v)
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const estPositif = (v: unknown): v is number => estNombre(v) && v > 0
const estCouleur = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

// Une abscisse peut dépasser la longueur de la voie d'un rien, à cause des
// arrondis de calcul.
const MARGE_ABSCISSE = 1e-6

// Lit une liste d'éléments : chacun est vérifié par `lire`, qui ajoute ses
// erreurs et renvoie l'élément s'il est valide. Identifiants uniques exigés.
function lireListe<T>(
  brut: unknown,
  intitule: string,
  erreurs: string[],
  lire: (e: Brut, libelle: string) => T | null,
): T[] {
  if (brut === undefined) return []
  if (!Array.isArray(brut)) {
    erreurs.push(`La liste « ${intitule} » est illisible.`)
    return []
  }
  const ids = new Set<string>()
  const resultat: T[] = []
  brut.forEach((e: unknown, i: number) => {
    const nom = estObjet(e) ? (typeof e.nom === 'string' ? e.nom : typeof e.texte === 'string' ? e.texte : '') : ''
    const libelle = `${intitule} n°${i + 1}${nom ? ` (« ${nom} »)` : ''}`
    if (!estObjet(e)) {
      erreurs.push(`${libelle} : description illisible.`)
      return
    }
    const avant = erreurs.length
    if (typeof e.id !== 'string' || e.id === '') erreurs.push(`${libelle} : identifiant manquant.`)
    else if (ids.has(e.id)) erreurs.push(`${libelle} : identifiant « ${e.id} » en double.`)
    else ids.add(e.id)
    const lu = lire(e, libelle)
    if (lu !== null && erreurs.length === avant) resultat.push(lu)
  })
  return resultat
}

function verifierCouleur(v: unknown, libelle: string, erreurs: string[]): void {
  if (!estCouleur(v)) erreurs.push(`${libelle} : la couleur « ${String(v)} » n'est pas valide (format #rrggbb attendu).`)
}

function lireVoie(v: Brut, libelle: string, erreurs: string[]): Voie | null {
  const avant = erreurs.length
  if (typeof v.nom !== 'string') erreurs.push(`${libelle} : nom manquant.`)
  verifierCouleur(v.couleur, libelle, erreurs)
  if (!estNombre(v.epaisseur) || v.epaisseur < EPAISSEUR_MIN || v.epaisseur > EPAISSEUR_MAX) {
    erreurs.push(`${libelle} : l'épaisseur doit être comprise entre ${EPAISSEUR_MIN} et ${EPAISSEUR_MAX}.`)
  }
  const points = Array.isArray(v.points) ? v.points : null
  if (!points || points.length < 2) {
    erreurs.push(`${libelle} : il faut au moins deux points.`)
  } else if (!points.every((p: unknown) => estObjet(p) && estNombre(p.x) && estNombre(p.y))) {
    erreurs.push(`${libelle} : un point n'a pas de coordonnées x et y valides.`)
  }
  if (erreurs.length > avant) return null
  return {
    id: v.id as string,
    nom: v.nom as string,
    couleur: (v.couleur as string).toLowerCase(),
    epaisseur: v.epaisseur as number,
    points: (points as Point[]).map((p) => ({ x: p.x, y: p.y })),
  }
}

// Vérifie qu'une abscisse est bien sur la voie désignée.
function verifierSurVoie(
  voieId: unknown,
  abscisses: [string, unknown][],
  voies: Map<string, Voie>,
  libelle: string,
  erreurs: string[],
): void {
  if (typeof voieId !== 'string' || voieId === '') {
    erreurs.push(`${libelle} : la voie n'est pas indiquée.`)
    return
  }
  const voie = voies.get(voieId)
  if (!voie) {
    erreurs.push(`${libelle} : la voie « ${voieId} » n'existe pas.`)
    return
  }
  const longueur = longueurPolyligne(voie.points)
  for (const [quoi, s] of abscisses) {
    if (!estNombre(s)) erreurs.push(`${libelle} : ${quoi} n'est pas un nombre.`)
    else if (s < -MARGE_ABSCISSE || s > longueur + MARGE_ABSCISSE) {
      erreurs.push(`${libelle} : ${quoi} (${Math.round(s)}) est hors de la voie « ${voie.nom} » (longueur ${Math.round(longueur)}).`)
    }
  }
}

function lireZone(z: Brut, libelle: string, erreurs: string[], voies: Map<string, Voie>): Zone | null {
  const avant = erreurs.length
  if (typeof z.nom !== 'string') erreurs.push(`${libelle} : nom manquant.`)
  verifierCouleur(z.couleur, libelle, erreurs)
  verifierSurVoie(z.voieId, [['le début', z.debut], ['la fin', z.fin]], voies, libelle, erreurs)
  if (erreurs.length > avant) return null
  if ((z.debut as number) > (z.fin as number)) {
    erreurs.push(`${libelle} : le début est après la fin.`)
    return null
  }
  return {
    id: z.id as string,
    nom: z.nom as string,
    couleur: (z.couleur as string).toLowerCase(),
    voieId: z.voieId as string,
    debut: z.debut as number,
    fin: z.fin as number,
  }
}

function lireAncrage(a: unknown, quoi: string, libelle: string, erreurs: string[], voies: Map<string, Voie>): Ancrage | null {
  if (!estObjet(a)) {
    erreurs.push(`${libelle} : ${quoi} est absent.`)
    return null
  }
  const avant = erreurs.length
  verifierSurVoie(a.voieId, [[quoi, a.abscisse]], voies, libelle, erreurs)
  return erreurs.length > avant ? null : { voieId: a.voieId as string, abscisse: a.abscisse as number }
}

function lireAppareil(a: Brut, libelle: string, erreurs: string[], voies: Map<string, Voie>): Appareil | null {
  const avant = erreurs.length
  if (typeof a.nom !== 'string') erreurs.push(`${libelle} : nom manquant.`)
  const pointe = lireAncrage(a.pointe, 'la pointe', libelle, erreurs, voies)
  const talon = lireAncrage(a.talon, 'le talon', libelle, erreurs, voies)
  if (pointe && talon && pointe.voieId === talon.voieId) {
    erreurs.push(`${libelle} : la pointe et le talon sont sur la même voie.`)
  }
  const communication = a.communication ?? null
  if (communication !== null && (typeof communication !== 'string' || communication === '')) {
    erreurs.push(`${libelle} : identifiant de communication illisible.`)
  }
  if (erreurs.length > avant || !pointe || !talon) return null
  return { id: a.id as string, nom: a.nom as string, pointe, talon, communication: communication as string | null }
}

// Une communication = exactement deux BS talon contre talon.
function verifierCommunications(appareils: Appareil[], erreurs: string[]): void {
  const groupes = new Map<string, Appareil[]>()
  for (const a of appareils) {
    if (a.communication) groupes.set(a.communication, [...(groupes.get(a.communication) ?? []), a])
  }
  for (const [id, groupe] of groupes) {
    if (groupe.length !== 2) {
      erreurs.push(`Communication « ${id} » : elle doit réunir exactement deux BS (${groupe.length} trouvé(s)).`)
      continue
    }
    const [a, b] = groupe
    const memeBout = (x: Ancrage, y: Ancrage) => x.voieId === y.voieId && Math.abs(x.abscisse - y.abscisse) <= MARGE_ABSCISSE
    if (!memeBout(a.pointe, b.talon) || !memeBout(a.talon, b.pointe)) {
      erreurs.push(`Communication « ${id} » : les BS « ${a.nom} » et « ${b.nom} » ne sont pas talon contre talon.`)
    }
  }
}

function lireCadre(c: Brut, libelle: string, erreurs: string[]): Cadre | null {
  const avant = erreurs.length
  if (typeof c.nom !== 'string') erreurs.push(`${libelle} : nom manquant.`)
  verifierCouleur(c.couleur, libelle, erreurs)
  if (!estNombre(c.x) || !estNombre(c.y)) erreurs.push(`${libelle} : position (x, y) invalide.`)
  if (!estPositif(c.largeur) || !estPositif(c.hauteur)) erreurs.push(`${libelle} : largeur et hauteur doivent être positives.`)
  if (erreurs.length > avant) return null
  return {
    id: c.id as string,
    nom: c.nom as string,
    couleur: (c.couleur as string).toLowerCase(),
    x: c.x as number,
    y: c.y as number,
    largeur: c.largeur as number,
    hauteur: c.hauteur as number,
    pointille: c.pointille !== false,
    rempli: c.rempli !== false,
  }
}

function lireTexte(t: Brut, libelle: string, erreurs: string[]): Texte | null {
  const avant = erreurs.length
  if (typeof t.texte !== 'string') erreurs.push(`${libelle} : texte manquant.`)
  verifierCouleur(t.couleur, libelle, erreurs)
  if (!estNombre(t.x) || !estNombre(t.y)) erreurs.push(`${libelle} : position (x, y) invalide.`)
  if (!estNombre(t.taille) || t.taille < TAILLE_TEXTE_MIN || t.taille > TAILLE_TEXTE_MAX) {
    erreurs.push(`${libelle} : la taille doit être comprise entre ${TAILLE_TEXTE_MIN} et ${TAILLE_TEXTE_MAX}.`)
  }
  if (erreurs.length > avant) return null
  return {
    id: t.id as string,
    texte: t.texte as string,
    x: t.x as number,
    y: t.y as number,
    taille: t.taille as number,
    couleur: (t.couleur as string).toLowerCase(),
    gras: t.gras === true,
  }
}

// Dimensions d'un type d'engin (catalogue, engin posé, véhicule d'une rame).
function lireDimensions(d: unknown, libelle: string, erreurs: string[]): DimensionsEngin | null {
  if (!estObjet(d)) {
    erreurs.push(`${libelle} : type d'engin illisible.`)
    return null
  }
  const avant = erreurs.length
  if (typeof d.categorie !== 'string') erreurs.push(`${libelle} : catégorie manquante.`)
  if (typeof d.modele !== 'string') erreurs.push(`${libelle} : modèle manquant.`)
  if (!estPositif(d.longueur)) erreurs.push(`${libelle} : la longueur doit être un nombre de mètres positif.`)
  if (!estPositif(d.largeur)) erreurs.push(`${libelle} : la largeur doit être un nombre de mètres positive.`)
  verifierCouleur(d.couleur, libelle, erreurs)
  if (erreurs.length > avant) return null
  return {
    categorie: d.categorie as string,
    modele: d.modele as string,
    longueur: d.longueur as number,
    largeur: d.largeur as number,
    couleur: (d.couleur as string).toLowerCase(),
  }
}

// Un type du catalogue d'un chantier.
export function lireTypeEngin(t: Brut, libelle: string, erreurs: string[]): TypeEngin | null {
  const dimensions = lireDimensions(t, libelle, erreurs)
  return dimensions && { id: t.id as string, ...dimensions }
}

export function lireCatalogue(brut: unknown, erreurs: string[]): TypeEngin[] {
  return lireListe(brut, "Type d'engin", erreurs, (t, libelle) => lireTypeEngin(t, libelle, erreurs))
}

const RENDUS: readonly RenduEtat[] = ['zone', 'aplat', 'ballast']

// La liste des états de la voie d'un chantier : le premier (Avant travaux)
// garde la couleur propre de chaque zone, et lui seul.
export function lireEtatsVoie(brut: unknown, erreurs: string[]): EtatVoie[] {
  const avant = erreurs.length
  const liste = lireListe(brut, 'État de la voie', erreurs, (e, libelle): EtatVoie | null => {
    const debut = erreurs.length
    if (typeof e.nom !== 'string' || e.nom.trim() === '') erreurs.push(`${libelle} : nom manquant.`)
    if (!RENDUS.includes(e.rendu as RenduEtat)) erreurs.push(`${libelle} : rendu illisible (zone, aplat ou ballast attendu).`)
    verifierCouleur(e.couleur, libelle, erreurs)
    if (erreurs.length > debut) return null
    return { id: e.id as string, nom: e.nom as string, rendu: e.rendu as RenduEtat, couleur: (e.couleur as string).toLowerCase(), voile: e.voile === true }
  })
  if (erreurs.length > avant) return liste
  if (liste.length === 0) erreurs.push('La liste des états de la voie est vide : il faut au moins l’état « Avant travaux ».')
  else if (liste[0].rendu !== 'zone') erreurs.push(`Le premier état de la voie (« ${liste[0].nom} ») doit garder la couleur propre des zones.`)
  else if (liste.slice(1).some((e) => e.rendu === 'zone')) erreurs.push('Seul le premier état de la voie garde la couleur propre des zones.')
  return liste
}

// La liste des types de flèches d'un chantier.
export function lireTypesFleches(brut: unknown, erreurs: string[]): TypeFleche[] {
  return lireListe(brut, 'Type de flèche', erreurs, (t, libelle): TypeFleche | null => {
    const debut = erreurs.length
    if (typeof t.nom !== 'string' || t.nom.trim() === '') erreurs.push(`${libelle} : nom manquant.`)
    verifierCouleur(t.couleur, libelle, erreurs)
    if (!estNombre(t.epaisseur) || t.epaisseur < EPAISSEUR_FLECHE_MIN || t.epaisseur > EPAISSEUR_FLECHE_MAX) {
      erreurs.push(`${libelle} : épaisseur illisible (de ${EPAISSEUR_FLECHE_MIN} à ${EPAISSEUR_FLECHE_MAX} points).`)
    }
    if (!STYLES_TRAIT.includes(t.trait as StyleTrait)) erreurs.push(`${libelle} : trait illisible (plein, pointilles ou double attendu).`)
    if (!POINTES.includes(t.pointes as Pointes)) erreurs.push(`${libelle} : pointe illisible (fin, deux ou aucune attendu).`)
    if (erreurs.length > debut) return null
    return {
      id: t.id as string,
      nom: t.nom as string,
      couleur: (t.couleur as string).toLowerCase(),
      epaisseur: t.epaisseur as number,
      trait: t.trait as StyleTrait,
      pointes: t.pointes as Pointes,
    }
  })
}

// Les flèches d'une image : chacune désigne un type de la liste du chantier
// et a au moins deux points.
export function lireFleches(brut: unknown, types: Set<string>, erreurs: string[]): Fleche[] {
  return lireListe(brut, 'Flèche', erreurs, (f, libelle): Fleche | null => {
    const debut = erreurs.length
    if (typeof f.typeId !== 'string' || !types.has(f.typeId)) erreurs.push(`${libelle} : type inconnu dans la liste des flèches du chantier.`)
    const points = Array.isArray(f.points) ? f.points : []
    if (points.length < 2 || !points.every((p: unknown) => estObjet(p) && estNombre(p.x) && estNombre(p.y))) {
      erreurs.push(`${libelle} : il faut au moins deux points (x, y) lisibles.`)
    }
    if (f.libelle !== undefined && typeof f.libelle !== 'string') erreurs.push(`${libelle} : libellé illisible.`)
    if (erreurs.length > debut) return null
    return {
      id: f.id as string,
      typeId: f.typeId as string,
      points: (points as Point[]).map((p) => ({ x: p.x, y: p.y })),
      libelle: typeof f.libelle === 'string' ? f.libelle : '',
    }
  })
}

// La liste des états d'exploitation des voies d'un chantier.
export function lireEtatsExploitation(brut: unknown, erreurs: string[]): EtatExploitation[] {
  return lireListe(brut, "État d'exploitation", erreurs, (e, libelle): EtatExploitation | null => {
    const debut = erreurs.length
    if (typeof e.nom !== 'string' || e.nom.trim() === '') erreurs.push(`${libelle} : nom manquant.`)
    verifierCouleur(e.couleur, libelle, erreurs)
    if (erreurs.length > debut) return null
    return { id: e.id as string, nom: e.nom as string, couleur: (e.couleur as string).toLowerCase() }
  })
}

// L'état d'exploitation des voies d'une image : chaque voie doit exister dans
// l'image, et son état dans la liste du chantier.
export function lireExploitation(brut: unknown, voies: Voie[], etats: Set<string>, erreurs: string[]): ExploitationVoies {
  if (brut === undefined) return {}
  if (!estObjet(brut)) {
    erreurs.push("L'état d'exploitation des voies est illisible.")
    return {}
  }
  const resultat: ExploitationVoies = {}
  for (const [voieId, etat] of Object.entries(brut)) {
    const voie = voies.find((v) => v.id === voieId)
    if (!voie) erreurs.push(`Exploitation : la voie « ${voieId} » n'existe pas dans l'image.`)
    else if (typeof etat !== 'string' || !etats.has(etat)) erreurs.push(`Exploitation de la voie « ${voie.nom} » : état inconnu dans la liste du chantier.`)
    else resultat[voieId] = etat
  }
  return resultat
}

// Les commentaires d'une image.
export function lireCommentaires(brut: unknown, erreurs: string[]): Commentaire[] {
  return lireListe(brut, 'Commentaire', erreurs, (c, libelle): Commentaire | null => {
    const debut = erreurs.length
    if (typeof c.texte !== 'string') erreurs.push(`${libelle} : texte manquant.`)
    if (!estNombre(c.x) || !estNombre(c.y)) erreurs.push(`${libelle} : position (x, y) illisible.`)
    if (!estNombre(c.taille) || c.taille < 0.3 || c.taille > 5) erreurs.push(`${libelle} : taille illisible.`)
    verifierCouleur(c.couleur, libelle, erreurs)
    if (erreurs.length > debut) return null
    return {
      id: c.id as string,
      texte: c.texte as string,
      x: c.x as number,
      y: c.y as number,
      taille: c.taille as number,
      couleur: (c.couleur as string).toLowerCase(),
      gras: c.gras !== false,
      encadre: c.encadre !== false,
    }
  })
}

// Les coupes de tronçonnage d'une image : chaque zone doit exister dans l'image.
export function lireCoupes(brut: unknown, zones: Zone[], erreurs: string[]): Coupes {
  if (brut === undefined) return {}
  if (!estObjet(brut)) {
    erreurs.push('Les coupes de tronçonnage sont illisibles.')
    return {}
  }
  const resultat: Coupes = {}
  for (const [zoneId, pas] of Object.entries(brut)) {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) erreurs.push(`Coupes : la zone « ${zoneId} » n'existe pas dans l'image.`)
    else if (!estNombre(pas) || erreurPasCoupes(pas)) erreurs.push(`Coupes de la zone « ${zone.nom} » : écart illisible.`)
    else resultat[zoneId] = pas
  }
  return resultat
}

const libelleEngin = (e: Brut, libelle: string): string =>
  estObjet(e.type) && typeof e.type.modele === 'string' ? libelle.replace(/^Engin n°\d+/, (m) => `${m} (« ${(e.type as Brut).modele} »)`) : libelle

function lireEngin(e: Brut, libelleBrut: string, erreurs: string[], voies: Map<string, Voie>): Engin | null {
  const libelle = libelleEngin(e, libelleBrut)
  const avant = erreurs.length
  if (typeof e.typeId !== 'string') erreurs.push(`${libelle} : type du catalogue manquant.`)
  const type = lireDimensions(e.type, libelle, erreurs)
  verifierCouleur(e.couleur, libelle, erreurs)
  const numero = typeof e.numero === 'string' ? e.numero : ''
  if (e.description !== undefined && typeof e.description !== 'string') erreurs.push(`${libelle} : description illisible.`)
  const p = e.position
  let position: Engin['position'] | null = null
  if (estObjet(p) && p.genre === 'voie') {
    verifierSurVoie(p.voieId, [["l'abscisse", p.abscisse]], voies, libelle, erreurs)
    position = { genre: 'voie', voieId: p.voieId as string, abscisse: p.abscisse as number }
  } else if (estObjet(p) && p.genre === 'libre') {
    if (!estNombre(p.x) || !estNombre(p.y) || !estNombre(p.angle)) erreurs.push(`${libelle} : position (x, y, angle) invalide.`)
    position = { genre: 'libre', x: p.x as number, y: p.y as number, angle: p.angle as number }
  } else {
    erreurs.push(`${libelle} : position illisible (sur une voie ou libre).`)
  }
  if (erreurs.length > avant || !type || !position) return null
  return {
    id: e.id as string,
    typeId: e.typeId as string,
    type,
    couleur: (e.couleur as string).toLowerCase(),
    numero,
    description: typeof e.description === 'string' ? e.description : '',
    position,
  }
}

function lireRame(r: Brut, libelle: string, erreurs: string[], voies: Map<string, Voie>): Rame | null {
  const avant = erreurs.length
  if (typeof r.nom !== 'string') erreurs.push(`${libelle} : nom manquant.`)
  verifierCouleur(r.couleur, libelle, erreurs)
  verifierSurVoie(r.voieId, [["l'abscisse", r.abscisse]], voies, libelle, erreurs)
  if (r.sens !== 1 && r.sens !== -1) erreurs.push(`${libelle} : sens illisible (1 ou -1 attendu).`)
  if (r.description !== undefined && typeof r.description !== 'string') erreurs.push(`${libelle} : description illisible.`)
  const brutes = Array.isArray(r.vehicules) ? r.vehicules : []
  if (brutes.length === 0) erreurs.push(`${libelle} : une rame doit avoir au moins un véhicule.`)
  const vehicules: Vehicule[] = []
  brutes.forEach((v: unknown, i: number) => {
    const quel = `${libelle}, véhicule ${i + 1}`
    if (!estObjet(v) || typeof v.typeId !== 'string') {
      erreurs.push(`${quel} : type du catalogue manquant.`)
      return
    }
    const type = lireDimensions(v.type, quel, erreurs)
    if (type) vehicules.push({ typeId: v.typeId, type })
  })
  if (erreurs.length > avant) return null
  return {
    id: r.id as string,
    nom: r.nom as string,
    numero: typeof r.numero === 'string' ? r.numero : '',
    description: typeof r.description === 'string' ? r.description : '',
    couleur: (r.couleur as string).toLowerCase(),
    voieId: r.voieId as string,
    abscisse: r.abscisse as number,
    sens: r.sens as 1 | -1,
    vehicules,
  }
}

// Engins et rames d'une image de synoptique, posés sur ses voies ; il faut une
// échelle pour qu'ils aient une taille.
export function lireEnginsEtRames(brut: unknown, voies: Voie[], echelle: Echelle | null, erreurs: string[]): EnginsEtRames {
  const b = estObjet(brut) ? brut : {}
  const parId = new Map(voies.map((v) => [v.id, v]))
  const engins = lireListe(b.engins, 'Engin', erreurs, (e, libelle) => lireEngin(e, libelle, erreurs, parId))
  const rames = lireListe(b.rames, 'Rame', erreurs, (r, libelle) => lireRame(r, libelle, erreurs, parId))
  if (!echelle && engins.length + rames.length > 0) {
    erreurs.push("Des engins sont posés mais l'échelle manque : leur taille ne peut pas être calculée.")
  }
  return { engins, rames }
}

function lireEchelle(brut: unknown, erreurs: string[]): Echelle | null {
  if (brut === null || brut === undefined) return null
  if (!estObjet(brut) || !estPositif(brut.pixelsParMetre)) {
    erreurs.push("L'échelle du plan est illisible (nombre de pixels par mètre positif attendu).")
    return null
  }
  return { pixelsParMetre: brut.pixelsParMetre }
}

export function lireProjet(texte: string): ResultatLecture {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return { ok: false, erreurs: ["Le fichier n'est pas lisible : ce n'est pas un projet enregistré par l'application."] }
  }
  if (!estObjet(brut)) {
    return { ok: false, erreurs: ['Le fichier ne contient pas de projet.'] }
  }
  if (brut.format !== FORMAT_FICHIER) {
    const ancien = 'site' in brut || 'phasage' in brut
    return {
      ok: false,
      erreurs: [
        ancien
          ? "Ce fichier vient de l'ancienne version 3D (format .cinef) : il ne s'ouvre plus dans cette version."
          : "Ce fichier n'est pas un projet de l'application (marque de format absente).",
      ],
    }
  }
  if (!estNombre(brut.version) || brut.version > VERSION_FICHIER) {
    return {
      ok: false,
      erreurs: ["Ce projet a été enregistré par une version plus récente de l'application : mettez la page à jour."],
    }
  }
  return lireCorpsProjet(brut)
}

// Le contenu d'un plan, sans l'en-tête du fichier (marque et version) : sert
// aussi pour les plans et les images rangés dans un fichier de chantier. Les
// engins et rames éventuels ne sont pas lus (voir `retires`).
export function lireCorpsProjet(brut: unknown): ResultatLecture {
  if (!estObjet(brut)) return { ok: false, erreurs: ['Le plan est illisible.'] }
  const erreurs: string[] = []
  const defaut = creerProjet()

  const nom = typeof brut.nom === 'string' ? brut.nom : defaut.nom
  if (!estPositif(brut.largeur) || !estPositif(brut.hauteur)) {
    erreurs.push('La taille du plan (largeur et hauteur) doit être un nombre positif.')
  }

  let fond: Fond | null = null
  if (brut.fond !== null && brut.fond !== undefined) {
    const f = brut.fond
    if (
      !estObjet(f) ||
      typeof f.image !== 'string' ||
      (f.image !== '' && !f.image.startsWith('data:image/')) ||
      !estPositif(f.largeur) ||
      !estPositif(f.hauteur)
    ) {
      erreurs.push('Le fond de plan est illisible (image ou dimensions manquantes).')
    } else {
      fond = {
        image: f.image,
        largeur: f.largeur,
        hauteur: f.hauteur,
        nomFichier: typeof f.nomFichier === 'string' ? f.nomFichier : 'fond',
        page: estPositif(f.page) ? Math.round(f.page) : null,
        nombrePages: estPositif(f.nombrePages) ? Math.round(f.nombrePages) : null,
      }
    }
  }

  const extremites = { ...defaut.extremites }
  if (estObjet(brut.extremites)) {
    if (typeof brut.extremites.gauche === 'string') extremites.gauche = brut.extremites.gauche
    if (typeof brut.extremites.droite === 'string') extremites.droite = brut.extremites.droite
  }

  const calques = defaut.calques
  if (estObjet(brut.calques)) {
    const cf = brut.calques.fond
    if (estObjet(cf)) {
      if (typeof cf.visible === 'boolean') calques.fond.visible = cf.visible
      if (typeof cf.verrouille === 'boolean') calques.fond.verrouille = cf.verrouille
      if (cf.opacite !== undefined) {
        if (estNombre(cf.opacite) && cf.opacite >= 0 && cf.opacite <= 1) calques.fond.opacite = cf.opacite
        else erreurs.push("L'opacité du fond doit être comprise entre 0 et 1.")
      }
    }
    for (const nomCalque of CALQUES_ELEMENTS) {
      const c = brut.calques[nomCalque]
      if (!estObjet(c)) continue
      if (typeof c.visible === 'boolean') calques[nomCalque].visible = c.visible
      if (typeof c.verrouille === 'boolean') calques[nomCalque].verrouille = c.verrouille
    }
  }

  if (!Array.isArray(brut.voies)) erreurs.push('La liste des voies est absente.')
  const voies = lireListe(Array.isArray(brut.voies) ? brut.voies : [], 'Voie', erreurs, (v, libelle) => lireVoie(v, libelle, erreurs))
  const parId = new Map(voies.map((v) => [v.id, v]))
  const zones = lireListe(brut.zones, 'Zone', erreurs, (z, libelle) => lireZone(z, libelle, erreurs, parId))
  const appareils = lireListe(brut.appareils, 'Appareil', erreurs, (a, libelle) => lireAppareil(a, libelle, erreurs, parId))
  verifierCommunications(appareils, erreurs)
  const cadres = lireListe(brut.cadres, 'Cadre', erreurs, (c, libelle) => lireCadre(c, libelle, erreurs))
  const textes = lireListe(brut.textes, 'Texte', erreurs, (t, libelle) => lireTexte(t, libelle, erreurs))
  const echelle = lireEchelle(brut.echelle, erreurs)

  if (erreurs.length > 0) return { ok: false, erreurs }
  return {
    ok: true,
    projet: {
      nom,
      largeur: brut.largeur as number,
      hauteur: brut.hauteur as number,
      fond,
      echelle,
      extremites,
      calques,
      cadres,
      voies,
      zones,
      appareils,
      textes,
    },
    retires: compterEnginsDuPlan(brut),
  }
}
