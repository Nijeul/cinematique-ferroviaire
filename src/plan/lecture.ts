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
  type Fond,
  type Point,
  type Projet,
  type Texte,
  type Voie,
  type Zone,
} from './projet.ts'
import { longueurPolyligne } from './trace.ts'

// Lecture et vérification d'un projet enregistré. Les erreurs sont en
// français, prêtes à afficher ; aucune exception ne sort d'ici.
//
// Les fichiers de l'étape 2 (version 2 : fond et voies seulement) s'ouvrent
// toujours : les listes absentes sont vides, les extrémités prennent leurs
// noms par défaut (Nord à gauche, Sud à droite).

export type ResultatLecture = { ok: true; projet: Projet } | { ok: false; erreurs: string[] }

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
// aussi pour les plans et les images rangés dans un fichier de chantier.
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

  if (erreurs.length > 0) return { ok: false, erreurs }
  return {
    ok: true,
    projet: {
      nom,
      largeur: brut.largeur as number,
      hauteur: brut.hauteur as number,
      fond,
      extremites,
      calques,
      cadres,
      voies,
      zones,
      appareils,
      textes,
    },
  }
}
