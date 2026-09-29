import type { Resultat } from './echelle.ts'
import { nouvelIdentifiant } from './edition.ts'

// Les états de la voie d'un chantier : ce que devient une zone de travaux au
// fil de l'OCP (avant travaux, déposée, déballastée…). Chaque chantier a sa
// liste, modifiable dans la page du chantier comme le catalogue d'engins ;
// dans chaque image d'un synoptique, chaque zone est dans l'un de ces états.
//
// Le rendu d'un état reprend celui des synoptiques du commanditaire :
// - « zone » : la couleur propre de la zone, comme sur le plan (réservé au
//   premier état, Avant travaux) ;
// - « aplat » : un aplat de la couleur de l'état ;
// - « ballast » : une texture de gravier gris, avec, si `voile` est coché, un
//   aplat semi-transparent de la couleur de l'état par-dessus (jaune tacheté
//   de la voie neuve).

export type RenduEtat = 'zone' | 'aplat' | 'ballast'

export type EtatVoie = {
  id: string
  nom: string
  rendu: RenduEtat
  // Couleur de l'aplat, ou du voile posé sur la texture ballast.
  couleur: string
  voile: boolean
}

// ——— Liste par défaut ———
//
// Seul endroit où elle est écrite. Ordre des travaux d'un RVB, donné par le
// commanditaire : Avant travaux, Déposée, Déballastée, Sous-couche ballast,
// Voie neuve posée. Couleurs relevées sur ses synoptiques (gris ballast,
// saumon, jaune) ; celle de la sous-couche ballast (brun clair, bien distinct
// du saumon et du jaune) est un choix à confirmer par le commanditaire.

const COULEUR_SAUMON = '#f4b183'
const COULEUR_SOUS_COUCHE = '#a07c52'
const COULEUR_JAUNE = '#e8dc3c'
// Teinte d'un nouvel état ajouté par l'utilisateur, à changer ensuite.
const COULEUR_NOUVEL_ETAT = '#8fb3d9'

export const ETATS_PAR_DEFAUT: readonly EtatVoie[] = [
  { id: 'etat-1', nom: 'Avant travaux', rendu: 'zone', couleur: '#33506b', voile: false },
  { id: 'etat-2', nom: 'Déposée', rendu: 'ballast', couleur: '#9a9893', voile: false },
  { id: 'etat-3', nom: 'Déballastée', rendu: 'aplat', couleur: COULEUR_SAUMON, voile: false },
  { id: 'etat-4', nom: 'Sous-couche ballast', rendu: 'aplat', couleur: COULEUR_SOUS_COUCHE, voile: false },
  { id: 'etat-5', nom: 'Voie neuve posée', rendu: 'ballast', couleur: COULEUR_JAUNE, voile: true },
]

export const creerEtatsVoie = (): EtatVoie[] => ETATS_PAR_DEFAUT.map((e) => ({ ...e }))

// Un état désigné par son identifiant ; le premier de la liste s'il n'existe
// plus (jamais d'erreur à l'affichage).
export const etatParId = (liste: EtatVoie[], id: string | undefined): EtatVoie | undefined =>
  liste.find((e) => e.id === id) ?? liste[0]

// L'état juste avant dans la liste (repli quand un état est supprimé, et
// « reste » proposé pour un avancement partiel) ; le premier s'il n'y en a pas.
export function etatPrecedent(liste: EtatVoie[], id: string): EtatVoie | undefined {
  const i = liste.findIndex((e) => e.id === id)
  return i > 0 ? liste[i - 1] : liste[0]
}

// ——— Modification de la liste ———

export type ChampsEtat = Partial<Pick<EtatVoie, 'nom' | 'rendu' | 'couleur' | 'voile'>>

export function erreurEtat(liste: EtatVoie[], id: string | null, champs: ChampsEtat): string | null {
  if (champs.nom !== undefined && champs.nom.trim() === '') return "Donnez un nom à l'état."
  const premier = liste[0]
  if (champs.rendu === 'zone' && id !== premier?.id) {
    return `La couleur propre de la zone est réservée au premier état (« ${premier?.nom ?? 'Avant travaux'} »).`
  }
  if (champs.rendu !== undefined && champs.rendu !== 'zone' && id !== null && id === premier?.id) {
    return `Le premier état (« ${premier.nom} ») garde la couleur propre de chaque zone.`
  }
  if (champs.couleur !== undefined && !/^#[0-9a-f]{6}$/i.test(champs.couleur)) return 'Couleur invalide.'
  return null
}

// Nouvel état, ajouté en fin de liste : un aplat de couleur, à régler ensuite.
export function ajouterEtat(liste: EtatVoie[], nom: string): Resultat<{ liste: EtatVoie[]; id: string }> {
  const erreur = erreurEtat(liste, null, { nom })
  if (erreur) return { ok: false, erreur }
  const id = nouvelIdentifiant(liste, 'etat')
  return { ok: true, valeur: { id, liste: [...liste, { id, nom: nom.trim(), rendu: 'aplat', couleur: COULEUR_NOUVEL_ETAT, voile: false }] } }
}

export function modifierEtat(liste: EtatVoie[], id: string, champs: ChampsEtat): Resultat<EtatVoie[]> {
  const erreur = erreurEtat(liste, id, champs)
  if (erreur) return { ok: false, erreur }
  const propres = champs.nom !== undefined ? { ...champs, nom: champs.nom.trim() } : champs
  return { ok: true, valeur: liste.map((e) => (e.id === id ? { ...e, ...propres } : e)) }
}

// Le premier état (Avant travaux) reste en tête : il ne se déplace pas, et
// rien ne passe devant lui.
export function peutDeplacerEtat(liste: EtatVoie[], id: string, vers: -1 | 1): boolean {
  const i = liste.findIndex((e) => e.id === id)
  const j = i + vers
  return i > 0 && j > 0 && j < liste.length
}

export function deplacerEtat(liste: EtatVoie[], id: string, vers: -1 | 1): EtatVoie[] {
  if (!peutDeplacerEtat(liste, id, vers)) return liste
  const i = liste.findIndex((e) => e.id === id)
  const copie = [...liste]
  ;[copie[i], copie[i + vers]] = [copie[i + vers], copie[i]]
  return copie
}

// Le premier état ne se supprime pas : c'est l'état de toute zone non touchée.
export const peutSupprimerEtat = (liste: EtatVoie[], id: string): boolean => liste.findIndex((e) => e.id === id) > 0

// ——— Texture ballast ———

// Un caillou du motif, dans une tuile carrée de côté 1 : centre, demi-axes,
// angle en degrés, et teinte (indice dans TEINTES_CAILLOUX).
export type Caillou = { x: number; y: number; rx: number; ry: number; angle: number; teinte: number }

export const FOND_BALLAST = '#a4a29c'
export const TEINTES_CAILLOUX = ['#6f6d68', '#c9c7c0', '#8a8882', '#55534f', '#b5b3ac'] as const

// Générateur pseudo-aléatoire à graine fixe : le motif est le même à chaque
// affichage.
function aleatoire(graine: number): () => number {
  let s = graine >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

// Motif de gravier : des cailloux répartis dans la tuile. Ceux qui touchent
// un bord sont répétés de l'autre côté, pour que les tuiles se raccordent
// sans couture visible.
export function motifBallast(nombre = 16, graine = 7): Caillou[] {
  const hasard = aleatoire(graine)
  const cailloux: Caillou[] = []
  for (let i = 0; i < nombre; i++) {
    const rx = 0.08 + hasard() * 0.06
    const c: Caillou = {
      x: hasard(),
      y: hasard(),
      rx,
      ry: rx * (0.6 + hasard() * 0.35),
      angle: Math.round(hasard() * 180),
      teinte: Math.floor(hasard() * TEINTES_CAILLOUX.length),
    }
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        const x = c.x + dx
        const y = c.y + dy
        if (x + c.rx > 0 && x - c.rx < 1 && y + c.rx > 0 && y - c.rx < 1) cailloux.push({ ...c, x, y })
      }
    }
  }
  return cailloux
}
