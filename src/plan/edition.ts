import {
  COULEUR_VOIE_PAR_DEFAUT,
  EPAISSEUR_MAX,
  EPAISSEUR_MIN,
  epaisseurParDefaut,
  type CalqueFond,
  type CalqueVoies,
  type Fond,
  type Point,
  type Projet,
  type Voie,
} from './projet.ts'

// Modifications du projet. Chaque fonction renvoie un nouveau projet sans
// toucher à l'ancien : c'est ce qui rend l'annulation possible.

function remplacerVoie(projet: Projet, id: string, modifier: (voie: Voie) => Voie): Projet {
  return { ...projet, voies: projet.voies.map((voie) => (voie.id === id ? modifier(voie) : voie)) }
}

export function nouvelIdentifiant(voies: Voie[]): string {
  const numeros = voies.map((voie) => Number(/^voie-(\d+)$/.exec(voie.id)?.[1] ?? 0))
  return `voie-${Math.max(0, ...numeros) + 1}`
}

// « Voie 1 », « Voie 2 »… sans reprendre un nom déjà pris.
export function nomParDefaut(voies: Voie[]): string {
  const pris = new Set(voies.map((voie) => voie.nom))
  let n = voies.length + 1
  while (pris.has(`Voie ${n}`)) n++
  return `Voie ${n}`
}

export function ajouterVoie(projet: Projet, points: Point[]): { projet: Projet; id: string } {
  const id = nouvelIdentifiant(projet.voies)
  const voie: Voie = {
    id,
    nom: nomParDefaut(projet.voies),
    couleur: COULEUR_VOIE_PAR_DEFAUT,
    epaisseur: epaisseurParDefaut(projet),
    points: points.map((p) => ({ x: p.x, y: p.y })),
  }
  return {
    id,
    // Une voie qu'on vient de tracer doit se voir : le calque est réaffiché.
    projet: { ...projet, voies: [...projet.voies, voie], calques: { ...projet.calques, voies: { visible: true } } },
  }
}

export function bornerEpaisseur(epaisseur: number): number {
  if (!Number.isFinite(epaisseur)) return EPAISSEUR_MIN
  return Math.min(EPAISSEUR_MAX, Math.max(EPAISSEUR_MIN, epaisseur))
}

export function modifierVoie(
  projet: Projet,
  id: string,
  champs: Partial<Pick<Voie, 'nom' | 'couleur' | 'epaisseur'>>,
): Projet {
  return remplacerVoie(projet, id, (voie) => ({
    ...voie,
    ...champs,
    epaisseur: champs.epaisseur === undefined ? voie.epaisseur : bornerEpaisseur(champs.epaisseur),
  }))
}

export function deplacerPoint(projet: Projet, id: string, indice: number, point: Point): Projet {
  return remplacerVoie(projet, id, (voie) => ({
    ...voie,
    points: voie.points.map((p, i) => (i === indice ? { x: point.x, y: point.y } : p)),
  }))
}

export function supprimerVoie(projet: Projet, id: string): Projet {
  return { ...projet, voies: projet.voies.filter((voie) => voie.id !== id) }
}

// Retire un point ; si la voie n'en garderait qu'un, c'est la voie entière
// qui est supprimée (une voie a toujours au moins deux points).
export function supprimerPoint(
  projet: Projet,
  id: string,
  indice: number,
): { projet: Projet; voieSupprimee: boolean } {
  const voie = projet.voies.find((v) => v.id === id)
  if (!voie) return { projet, voieSupprimee: false }
  if (voie.points.length <= 2) return { projet: supprimerVoie(projet, id), voieSupprimee: true }
  return {
    projet: remplacerVoie(projet, id, (v) => ({ ...v, points: v.points.filter((_, i) => i !== indice) })),
    voieSupprimee: false,
  }
}

// Nouveau fond : le plan de travail prend la taille de l'image.
export function remplacerFond(projet: Projet, fond: Fond): Projet {
  return {
    ...projet,
    fond,
    largeur: fond.largeur,
    hauteur: fond.hauteur,
    calques: { ...projet.calques, fond: { ...projet.calques.fond, visible: true } },
  }
}

// Sans fond, le plan de travail garde sa taille : les voies ne bougent pas.
export function retirerFond(projet: Projet): Projet {
  return { ...projet, fond: null }
}

export function modifierCalqueFond(projet: Projet, champs: Partial<CalqueFond>): Projet {
  const fond = { ...projet.calques.fond, ...champs }
  fond.opacite = Math.min(1, Math.max(0, fond.opacite))
  return { ...projet, calques: { ...projet.calques, fond } }
}

export function modifierCalqueVoies(projet: Projet, champs: Partial<CalqueVoies>): Projet {
  return { ...projet, calques: { ...projet.calques, voies: { ...projet.calques.voies, ...champs } } }
}
