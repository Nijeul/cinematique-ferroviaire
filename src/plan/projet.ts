// Le projet : un fond de plan (image ou page de PDF) et ce qui est tracé
// dessus au calque — cadres, voies, zones de travaux, appareils de voie,
// textes. Coordonnées en pixels de l'image de fond, origine en haut à gauche.
// Ni React ni DOM ici : tout est testable sans navigateur.

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

// Un endroit sur une voie : sa distance depuis le premier point de la voie,
// mesurée le long du tracé (abscisse curviligne, en pixels du plan). Ce qui
// est posé sur une voie suit donc la voie quand on en déplace les points.
export type Ancrage = { voieId: string; abscisse: number }

// Zone de travaux : une portion de voie, de l'abscisse `debut` à `fin`
// (debut ≤ fin). La longueur réelle est tapée dans le nom (« RVB 50 m »).
export type Zone = {
  id: string
  nom: string
  couleur: string
  voieId: string
  debut: number
  fin: number
}

// Branchement simple (BS) : la pointe sur la voie directe, le talon sur la
// voie déviée. Deux BS talon contre talon forment une communication : ils
// portent alors le même identifiant de communication.
export type Appareil = {
  id: string
  nom: string
  pointe: Ancrage
  talon: Ancrage
  communication: string | null
}

// Cadre : rectangle libre (stockage, base arrière, pont, zone d'étanchéité…).
export type Cadre = {
  id: string
  nom: string
  couleur: string
  x: number
  y: number
  largeur: number
  hauteur: number
  pointille: boolean
  rempli: boolean
}

// Texte libre, posé où l'on veut. (x, y) = début de la ligne de base.
export type Texte = {
  id: string
  texte: string
  x: number
  y: number
  taille: number
  couleur: string
  gras: boolean
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

// Échelle du plan : combien d'unités du plan (pixels du fond) font un mètre
// réel. Calée à la création du plan (deux points dont on connaît l'écart, ou
// la largeur réelle de la toile) ; null pour les plans des étapes 2 à 4, qui
// n'en avaient pas. Elle est copiée dans les synoptiques créés depuis le plan :
// c'est là que les engins se posent, à la bonne taille. Le plan lui-même ne
// contient aucun engin.
export type Echelle = { pixelsParMetre: number }

// Noms des deux bouts du plan : Nord à gauche, Sud à droite par défaut (repère
// du commanditaire), renommables (« Paris » / « Poitiers »…).
export type Extremites = { gauche: string; droite: string }

export type CalqueFond = { visible: boolean; opacite: number; verrouille: boolean }
// Calque verrouillé : ses éléments ne se choisissent plus sur le plan et ne se
// modifient plus, pour ne pas les bouger par mégarde.
export type Calque = { visible: boolean; verrouille: boolean }

// Calques dans l'ordre d'affichage, du dessous vers le dessus.
export const CALQUES_ELEMENTS = ['cadres', 'voies', 'zones', 'appareils', 'textes'] as const
export type NomCalque = (typeof CALQUES_ELEMENTS)[number]

export type Calques = { fond: CalqueFond } & Record<NomCalque, Calque>

export type Projet = {
  nom: string
  // Taille du plan de travail : celle du fond, ou la toile par défaut.
  largeur: number
  hauteur: number
  fond: Fond | null
  echelle: Echelle | null
  extremites: Extremites
  calques: Calques
  cadres: Cadre[]
  voies: Voie[]
  zones: Zone[]
  appareils: Appareil[]
  textes: Texte[]
}

// Marque et version du fichier enregistré, pour reconnaître nos projets.
// Version 2 : fond et voies (étape 2). Version 3 : zones, appareils, cadres,
// textes et extrémités (étape 3). Version 4 : échelle (étape 5). Les
// fichiers de version 4 enregistrés avant la correction de l'étape 5
// pouvaient contenir des engins : ils en sont retirés à la lecture, car les
// engins se posent désormais dans les synoptiques.
export const FORMAT_FICHIER = 'cinematique-ferroviaire/projet'
export const VERSION_FICHIER = 4
export const EXTENSION_FICHIER = '.cinematique.json'

export const TOILE_PAR_DEFAUT = { largeur: 1600, hauteur: 900 } as const
export const COULEUR_VOIE_PAR_DEFAUT = '#454f59'
// Couleurs de l'aperçu validé à l'étape 1 : zone bleu ardoise, stockage vert
// olive, texte presque noir.
export const COULEUR_ZONE_PAR_DEFAUT = '#33506b'
export const COULEUR_CADRE_PAR_DEFAUT = '#7a8a63'
export const COULEUR_TEXTE_PAR_DEFAUT = '#1c2430'
export const EXTREMITES_PAR_DEFAUT: Extremites = { gauche: 'Nord', droite: 'Sud' }
export const EPAISSEUR_MIN = 1
export const EPAISSEUR_MAX = 200
export const TAILLE_TEXTE_MIN = 4
export const TAILLE_TEXTE_MAX = 400

export function creerCalques(): Calques {
  return {
    fond: { visible: true, opacite: 1, verrouille: false },
    cadres: { visible: true, verrouille: false },
    voies: { visible: true, verrouille: false },
    zones: { visible: true, verrouille: false },
    appareils: { visible: true, verrouille: false },
    textes: { visible: true, verrouille: false },
  }
}

export function creerProjet(nom = 'Nouveau projet'): Projet {
  return {
    nom,
    largeur: TOILE_PAR_DEFAUT.largeur,
    hauteur: TOILE_PAR_DEFAUT.hauteur,
    fond: null,
    echelle: null,
    extremites: { ...EXTREMITES_PAR_DEFAUT },
    calques: creerCalques(),
    cadres: [],
    voies: [],
    zones: [],
    appareils: [],
    textes: [],
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
