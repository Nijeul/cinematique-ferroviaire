// Table des six couches d'état d'une zone — liste fermée (FORMAT.md §3).
// Ajouter une valeur se fait dans FORMAT.md d'abord, jamais ici en douce.
export const COUCHES = {
  plateforme: ['existante', 'decaissee', 'ecretee'],
  sousCouche: ['absente', 'deversee', 'lissee', 'compactee'],
  ballast: ['ancien', 'deballaste', 'neuf_repandu', 'regale'],
  traverses: ['anciennes', 'deposees', 'absentes', 'neuves_reparties', 'neuves_posees'],
  rails: ['poses', 'tronconnes', 'desclisses', 'deposes_en_extremite', 'absents', 'neufs_poses'],
  geometrie: ['nc', 'calee', 'bourree', 'reglee', 'soudee'],
} as const

export type Couche = keyof typeof COUCHES
export type ValeurCouche<C extends Couche> = (typeof COUCHES)[C][number]
export type EtatZone = { [C in Couche]: ValeurCouche<C> }

// État d'une voie en exploitation, avant travaux.
export const ETAT_INITIAL_DEFAUT: EtatZone = {
  plateforme: 'existante',
  sousCouche: 'absente',
  ballast: 'ancien',
  traverses: 'anciennes',
  rails: 'poses',
  geometrie: 'reglee',
}

// Verbes d'opération — liste fermée (FORMAT.md §5).
// `couches` : couches modifiées quand la cible est une zone.
// `vers` : valeurs admises pour le champ `vers` de l'effet.
const toutesValeurs = (...couches: Couche[]): readonly string[] =>
  couches.flatMap((c) => [...COUCHES[c]])

export const VERBES: Record<string, { couches: readonly Couche[]; vers: readonly string[] }> = {
  tronconner: { couches: ['rails'], vers: COUCHES.rails },
  desclisser: { couches: ['rails'], vers: COUCHES.rails },
  deposer_rails: { couches: ['rails'], vers: COUCHES.rails },
  poser_rails: { couches: ['rails'], vers: COUCHES.rails },
  deposer_traverses: { couches: ['traverses'], vers: COUCHES.traverses },
  repartir_traverses: { couches: ['traverses'], vers: COUCHES.traverses },
  poser_traverses: { couches: ['traverses'], vers: COUCHES.traverses },
  deballaster: { couches: ['ballast', 'plateforme'], vers: toutesValeurs('ballast', 'plateforme') },
  ballaster: { couches: ['ballast', 'plateforme'], vers: toutesValeurs('ballast', 'plateforme') },
  ecreter: { couches: ['ballast', 'plateforme'], vers: toutesValeurs('ballast', 'plateforme') },
  decharger_sous_couche: { couches: ['sousCouche'], vers: COUCHES.sousCouche },
  lisser: { couches: ['sousCouche'], vers: COUCHES.sousCouche },
  compacter: { couches: ['sousCouche'], vers: COUCHES.sousCouche },
  caler: { couches: ['geometrie'], vers: COUCHES.geometrie },
  bourrer: { couches: ['geometrie'], vers: COUCHES.geometrie },
  regler: { couches: ['geometrie'], vers: COUCHES.geometrie },
  souder: { couches: ['geometrie'], vers: COUCHES.geometrie },
  deposer_adv: { couches: [], vers: [] },
  poser_adv: { couches: [], vers: [] },
  enrailler: { couches: [], vers: ['rail', 'route'] },
  derailler: { couches: [], vers: ['rail', 'route'] },
  circuler: { couches: [], vers: [] },
  acheminer: { couches: [], vers: [] },
  attendre: { couches: [], vers: [] },
  installer: { couches: [], vers: [] },
}

export const NOMS_VERBES = Object.keys(VERBES) as [string, ...string[]]

// Natures de matériaux transportables par un flux (FORMAT.md §5).
export const FLUX_QUOI = [
  'traverses_anciennes',
  'traverses_neuves',
  'rails',
  'ballast',
  'sous_couche',
  'panneau_adv',
] as const
