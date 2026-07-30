import type { Effet, Operation, Projet } from '../domain/projet.ts'
import { idUnique } from './outils.ts'

// Bibliothèque de modes opératoires : des séquences types, réutilisables sur
// n'importe quelle cible. Aucune valeur d'un chantier réel ici — uniquement
// de la méthode courante, exprimée avec les verbes fermés du format.

export type EtapeMode = {
  libelle: string
  dureeMinutes: number
  effets: Effet[]
  // Décalage du début par rapport à la fin de l'étape précédente (0 = enchaîné).
  decalageMinutes?: number
}

export type ModeOperatoire = {
  id: string
  nom: string
  description: string
  cible: 'zone' | 'appareil'
  etapes: EtapeMode[]
}

export const MODES_OPERATOIRES: ModeOperatoire[] = [
  {
    id: 'rvb-complet',
    nom: 'RVB complet d’une zone',
    description: 'Dépose, déballastage, sous-couche, pose des traverses et rails neufs, calage.',
    cible: 'zone',
    etapes: [
      {
        libelle: 'Dépose rails et traverses',
        dureeMinutes: 60,
        effets: [
          { verbe: 'deposer_rails', vers: 'deposes_en_extremite' },
          { verbe: 'deposer_traverses', vers: 'deposees' },
        ] as Effet[],
      },
      { libelle: 'Déballastage', dureeMinutes: 60, effets: [{ verbe: 'deballaster', vers: 'deballaste' }] as Effet[] },
      {
        libelle: 'Déchargement de sous-couche',
        dureeMinutes: 60,
        effets: [{ verbe: 'decharger_sous_couche', vers: 'deversee' }] as Effet[],
      },
      {
        libelle: 'Lissage puis compactage',
        dureeMinutes: 60,
        effets: [
          { verbe: 'lisser', vers: 'lissee' },
          { verbe: 'compacter', vers: 'compactee' },
        ] as Effet[],
      },
      {
        libelle: 'Pose des traverses neuves',
        dureeMinutes: 60,
        effets: [{ verbe: 'poser_traverses', vers: 'neuves_posees' }] as Effet[],
      },
      { libelle: 'Pose des rails neufs', dureeMinutes: 60, effets: [{ verbe: 'poser_rails', vers: 'neufs_poses' }] as Effet[] },
      { libelle: 'Calage', dureeMinutes: 30, effets: [{ verbe: 'caler', vers: 'calee' }] as Effet[] },
    ],
  },
  {
    id: 'rr-zone',
    nom: 'Renouvellement rail (RR)',
    description: 'Tronçonnage, dépose des rails, pose des rails neufs.',
    cible: 'zone',
    etapes: [
      { libelle: 'Tronçonnage', dureeMinutes: 30, effets: [{ verbe: 'tronconner', vers: 'tronconnes' }] as Effet[] },
      {
        libelle: 'Dépose des rails',
        dureeMinutes: 30,
        effets: [{ verbe: 'deposer_rails', vers: 'deposes_en_extremite' }] as Effet[],
      },
      { libelle: 'Pose des rails neufs', dureeMinutes: 60, effets: [{ verbe: 'poser_rails', vers: 'neufs_poses' }] as Effet[] },
    ],
  },
  {
    id: 'depose-adv',
    nom: 'Dépose d’un appareil en panneaux',
    description: 'Dépose de l’appareil, découpé en panneaux à acheminer ensuite.',
    cible: 'appareil',
    etapes: [
      {
        libelle: 'Dépose de l’appareil',
        dureeMinutes: 60,
        effets: [{ verbe: 'deposer_adv' }] as Effet[],
      },
    ],
  },
  {
    id: 'bdml',
    nom: 'BDML de finition',
    description: 'Bourrage, réglage, soudures de libération.',
    cible: 'zone',
    etapes: [
      { libelle: 'Bourrage', dureeMinutes: 60, effets: [{ verbe: 'bourrer', vers: 'bourree' }] as Effet[] },
      { libelle: 'Réglage', dureeMinutes: 30, effets: [{ verbe: 'regler', vers: 'reglee' }] as Effet[] },
      { libelle: 'Soudures', dureeMinutes: 30, effets: [{ verbe: 'souder', vers: 'soudee' }] as Effet[] },
    ],
  },
]

// Applique un mode : crée les opérations enchaînées sur la cible, à partir
// de tDebut. Renvoie les opérations créées, sans modifier le projet.
export function operationsDuMode(
  projet: Projet,
  mode: ModeOperatoire,
  parametres: { cible: string; tDebut: number; ressources: string[]; nomCible?: string },
): Operation[] {
  const operations: Operation[] = []
  const existantes = [...projet.operations]
  let t = parametres.tDebut
  let numero = Math.max(0, ...projet.operations.map((op) => op.numero)) + 1
  for (const etape of mode.etapes) {
    t += etape.decalageMinutes ?? 0
    const id = idUnique('op', [...existantes, ...operations])
    operations.push({
      id,
      numero: numero++,
      libelle: `${etape.libelle} ${parametres.nomCible ?? parametres.cible}`,
      tDebut: t,
      tFin: t + etape.dureeMinutes,
      ressources: parametres.ressources,
      cibles: [parametres.cible],
      effets: structuredClone(etape.effets),
      sens: mode.cible === 'zone' ? 'pk_croissant' : undefined,
      flux: [],
    })
    t += etape.dureeMinutes
  }
  return operations
}
