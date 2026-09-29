// Le projet : un fond de plan (image ou page de PDF) et les voies tracées
// dessus au calque. Coordonnées en pixels de l'image de fond, origine en haut
// à gauche. Ni React ni DOM ici : tout est testable sans navigateur.

export type Point = { x: number; y: number }

export type Voie = {
  id: string
  nom: string
  // Couleur du trait, au format #rrggbb.
  couleur: string
  // Épaisseur totale de la bande (deux filets et l'espace entre eux), en
  // pixels du plan.
  epaisseur: number
  points: Point[]
}

export type Fond = {
  // Image en data URL. Vide quand le fond n'a pas pu être restauré de la
  // sauvegarde automatique (trop lourd) : il faut alors le réimporter.
  image: string
  largeur: number
  hauteur: number
  nomFichier: string
  // Pour un PDF : page affichée (à partir de 1) et nombre de pages.
  page: number | null
  nombrePages: number | null
}

export type CalqueFond = { visible: boolean; opacite: number; verrouille: boolean }
export type CalqueVoies = { visible: boolean }

export type Projet = {
  nom: string
  // Taille du plan de travail : celle du fond, ou la toile par défaut.
  largeur: number
  hauteur: number
  fond: Fond | null
  calques: { fond: CalqueFond; voies: CalqueVoies }
  voies: Voie[]
}

// Marque et version du fichier enregistré, pour reconnaître nos projets.
export const FORMAT_FICHIER = 'cinematique-ferroviaire/projet'
export const VERSION_FICHIER = 2
export const EXTENSION_FICHIER = '.cinematique.json'

export const TOILE_PAR_DEFAUT = { largeur: 1600, hauteur: 900 } as const
export const COULEUR_VOIE_PAR_DEFAUT = '#454f59'
export const EPAISSEUR_MIN = 1
export const EPAISSEUR_MAX = 200

export function creerProjet(nom = 'Nouveau projet'): Projet {
  return {
    nom,
    largeur: TOILE_PAR_DEFAUT.largeur,
    hauteur: TOILE_PAR_DEFAUT.hauteur,
    fond: null,
    calques: {
      fond: { visible: true, opacite: 1, verrouille: false },
      voies: { visible: true },
    },
    voies: [],
  }
}

// Épaisseur proposée pour une nouvelle voie : proportionnelle à la taille du
// plan, pour qu'elle reste lisible sur un grand PDF comme sur la toile vide.
export function epaisseurParDefaut(projet: Pick<Projet, 'largeur' | 'hauteur'>): number {
  return Math.max(4, Math.round(Math.max(projet.largeur, projet.hauteur) / 180))
}

export function serialiserProjet(projet: Projet): string {
  return JSON.stringify({ format: FORMAT_FICHIER, version: VERSION_FICHIER, ...projet }, null, 2)
}

// Nom du fichier à télécharger : le nom du projet, sans les caractères
// interdits par Windows.
export function nomDeFichier(nomProjet: string): string {
  const propre = nomProjet.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
  return (propre || 'projet') + EXTENSION_FICHIER
}

export type ResultatLecture = { ok: true; projet: Projet } | { ok: false; erreurs: string[] }

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const estPositif = (v: unknown): v is number => estNombre(v) && v > 0
const estCouleur = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

// Lit et vérifie un projet enregistré. Les erreurs sont en français, prêtes
// à afficher ; aucune exception ne sort d'ici.
export function lireProjet(texte: string): ResultatLecture {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return { ok: false, erreurs: ["Le fichier n'est pas lisible : ce n'est pas un projet enregistré par l'application."] }
  }
  if (!estObjet(brut)) {
    return { ok: false, erreurs: ["Le fichier ne contient pas de projet."] }
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
    const cv = brut.calques.voies
    if (estObjet(cv) && typeof cv.visible === 'boolean') calques.voies.visible = cv.visible
  }

  const voies: Voie[] = []
  if (!Array.isArray(brut.voies)) {
    erreurs.push('La liste des voies est absente.')
  } else {
    const ids = new Set<string>()
    brut.voies.forEach((v: unknown, i: number) => {
      const libelle = estObjet(v) && typeof v.nom === 'string' && v.nom ? `Voie n°${i + 1} (« ${v.nom} »)` : `Voie n°${i + 1}`
      if (!estObjet(v)) {
        erreurs.push(`${libelle} : description illisible.`)
        return
      }
      const avant = erreurs.length
      if (typeof v.id !== 'string' || v.id === '') erreurs.push(`${libelle} : identifiant manquant.`)
      else if (ids.has(v.id)) erreurs.push(`${libelle} : identifiant « ${v.id} » en double.`)
      else ids.add(v.id)
      if (typeof v.nom !== 'string') erreurs.push(`${libelle} : nom manquant.`)
      if (!estCouleur(v.couleur)) {
        erreurs.push(`${libelle} : la couleur « ${String(v.couleur)} » n'est pas valide (format #rrggbb attendu).`)
      }
      if (!estNombre(v.epaisseur) || v.epaisseur < EPAISSEUR_MIN || v.epaisseur > EPAISSEUR_MAX) {
        erreurs.push(`${libelle} : l'épaisseur doit être comprise entre ${EPAISSEUR_MIN} et ${EPAISSEUR_MAX}.`)
      }
      const points = Array.isArray(v.points) ? v.points : null
      if (!points || points.length < 2) {
        erreurs.push(`${libelle} : il faut au moins deux points.`)
      } else if (!points.every((p: unknown) => estObjet(p) && estNombre(p.x) && estNombre(p.y))) {
        erreurs.push(`${libelle} : un point n'a pas de coordonnées x et y valides.`)
      }
      if (erreurs.length === avant) {
        voies.push({
          id: v.id as string,
          nom: v.nom as string,
          couleur: (v.couleur as string).toLowerCase(),
          epaisseur: v.epaisseur as number,
          points: (points as Point[]).map((p) => ({ x: p.x, y: p.y })),
        })
      }
    })
  }

  if (erreurs.length > 0) return { ok: false, erreurs }
  return {
    ok: true,
    projet: { nom, largeur: brut.largeur as number, hauteur: brut.hauteur as number, fond, calques, voies },
  }
}
