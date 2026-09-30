import type { Chantier } from './chantier.ts'
import { lireChantier, serialiserChantier, type LectureChantier } from './fichierChantier.ts'
import type { Fond } from './projet.ts'

// Les images de fond en ligne : elles sont lourdes (plusieurs Mo), on ne les
// met donc pas dans la base avec le reste du chantier. Chaque image — fond
// d'un plan ou copie figée d'un synoptique — devient un fichier du stockage
// privé « fonds », rangé sous `<id du chantier>/<empreinte>.<extension>` ;
// dans le chantier enregistré en ligne, l'image est remplacée par une
// référence (empreinte du contenu et chemin du fichier). L'empreinte (calculée
// par l'appelant, SHA-256 du texte de l'image) dit si l'image a changé : une
// image déjà en ligne ne se renvoie pas, et une même image utilisée par un
// plan et ses synoptiques ne s'envoie qu'une fois.

export type RefFond = { empreinte: string; chemin: string }

// Un fichier à mettre en ligne : sa référence et l'image (data URL).
export type FichierFond = RefFond & { image: string }

// Le chantier tel qu'il est rangé dans la base : le JSON du fichier de
// chantier (format et version compris), fonds remplacés par leur référence.
export type DonneesEnLigne = Record<string, unknown>

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]*)$/i

// Type d'une image en data URL (« image/png »), null si ce n'est pas une
// image encodée en base64.
export const typeDataUrl = (image: string): string | null => DATA_URL.exec(image)?.[1].toLowerCase() ?? null

// Contenu binaire d'une image en data URL, pour l'envoyer en fichier.
export function decoderDataUrl(image: string): { type: string; octets: Uint8Array } | null {
  const m = DATA_URL.exec(image)
  if (!m) return null
  let binaire: string
  try {
    binaire = atob(m[2])
  } catch {
    return null
  }
  const octets = new Uint8Array(binaire.length)
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i)
  return { type: m[1].toLowerCase(), octets }
}

// L'inverse : un fichier téléchargé redevient la même data URL, au caractère
// près (donc la même empreinte : il ne sera pas renvoyé).
export function encoderDataUrl(type: string, octets: Uint8Array): string {
  let binaire = ''
  const TRANCHE = 0x8000
  for (let i = 0; i < octets.length; i += TRANCHE) binaire += String.fromCharCode(...octets.subarray(i, i + TRANCHE))
  return `data:${type};base64,${btoa(binaire)}`
}

export const cheminFond = (chantierId: string, empreinte: string, type: string): string =>
  `${chantierId}/${empreinte}.${EXTENSIONS[type] ?? 'img'}`

// Type d'image d'après l'extension du chemin (pour relire un fichier).
export function typeDuChemin(chemin: string): string {
  const extension = chemin.slice(chemin.lastIndexOf('.') + 1).toLowerCase()
  return Object.entries(EXTENSIONS).find(([, e]) => e === extension)?.[0] ?? 'image/png'
}

const fondsDuChantier = (c: Chantier): (Fond | null)[] => [...c.plans.map((p) => p.projet.fond), ...c.synoptiques.map((s) => s.fond)]

// Les images du chantier, chacune une seule fois (pour calculer leurs empreintes).
export const imagesDuChantier = (c: Chantier): string[] => [
  ...new Set(fondsDuChantier(c).flatMap((f) => (f && typeDataUrl(f.image) ? [f.image] : []))),
]

// Le chantier prêt pour la base, et les fichiers de ses fonds. `empreintes` :
// l'empreinte de chaque image. Une image sans empreinte, ou qui n'est pas une
// image en base64, reste dans le chantier (cas qui ne se produit pas avec les
// fonds importés par l'application).
export function extraireFonds(c: Chantier, empreintes: ReadonlyMap<string, string>): { donnees: DonneesEnLigne; fichiers: FichierFond[] } {
  const fichiers = new Map<string, FichierFond>()
  const convertir = (f: Fond | null): Fond | null => {
    if (!f) return null
    const empreinte = empreintes.get(f.image)
    const type = typeDataUrl(f.image)
    if (!empreinte || !type) return f
    const chemin = cheminFond(c.id, empreinte, type)
    fichiers.set(chemin, { empreinte, chemin, image: f.image })
    return { ...f, image: '', enLigne: { empreinte, chemin } } as Fond
  }
  const allege: Chantier = {
    ...c,
    plans: c.plans.map((p) => ({ ...p, projet: { ...p.projet, fond: convertir(p.projet.fond) } })),
    synoptiques: c.synoptiques.map((s) => ({ ...s, fond: convertir(s.fond) })),
  }
  return { donnees: JSON.parse(serialiserChantier(allege)) as DonneesEnLigne, fichiers: [...fichiers.values()] }
}

type Brut = Record<string, unknown>
const estObjet = (v: unknown): v is Brut => typeof v === 'object' && v !== null && !Array.isArray(v)

// Les fonds (objets) d'un chantier en JSON : ceux des plans et des synoptiques.
function fondsBruts(donnees: unknown): Brut[] {
  if (!estObjet(donnees)) return []
  const plans = Array.isArray(donnees.plans) ? donnees.plans : []
  const synoptiques = Array.isArray(donnees.synoptiques) ? donnees.synoptiques : []
  return [
    ...plans.map((p: unknown) => (estObjet(p) && estObjet(p.projet) ? p.projet.fond : null)),
    ...synoptiques.map((s: unknown) => (estObjet(s) ? s.fond : null)),
  ].filter(estObjet)
}

const refDe = (fond: Brut): RefFond | null => {
  const r = fond.enLigne
  return estObjet(r) && typeof r.empreinte === 'string' && typeof r.chemin === 'string' ? { empreinte: r.empreinte, chemin: r.chemin } : null
}

// Les fichiers dont un chantier en ligne a besoin, chacun une fois.
export function referencesDe(donnees: unknown): RefFond[] {
  const refs = new Map<string, RefFond>()
  for (const fond of fondsBruts(donnees)) {
    const r = refDe(fond)
    if (r) refs.set(r.chemin, r)
  }
  return [...refs.values()]
}

// Le chantier relu depuis la base, ses images remises en place (`images` :
// image de chaque empreinte), puis vérifié comme un fichier de chantier. Une
// image absente laisse le fond vide (« à réimporter ») et est signalée dans
// `manquants`.
export function reinjecterFonds(donnees: unknown, images: ReadonlyMap<string, string>): LectureChantier & { manquants: RefFond[] } {
  const copie = JSON.parse(JSON.stringify(donnees ?? null)) as unknown
  const manquants: RefFond[] = []
  for (const fond of fondsBruts(copie)) {
    const r = refDe(fond)
    if (!r) continue
    const image = images.get(r.empreinte)
    if (image === undefined && !manquants.some((m) => m.chemin === r.chemin)) manquants.push(r)
    fond.image = image ?? ''
    delete fond.enLigne
  }
  return { ...lireChantier(JSON.stringify(copie)), manquants }
}

// Les fichiers d'un dossier de chantier qui ne servent plus (fond remplacé)
// et qui ont plus de `delai` millisecondes : ceux qu'on peut effacer sans
// risquer de retirer un fichier qu'un collègue vient d'envoyer et qu'il est en
// train d'enregistrer.
export function fondsInutiles(
  fichiers: { chemin: string; creeLe: string | null }[],
  references: ReadonlySet<string>,
  maintenant: number,
  delai: number,
): string[] {
  return fichiers
    .filter((f) => !references.has(f.chemin))
    .filter((f) => {
      const cree = f.creeLe ? Date.parse(f.creeLe) : NaN
      return Number.isFinite(cree) && maintenant - cree > delai
    })
    .map((f) => f.chemin)
}
