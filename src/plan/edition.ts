import {
  COULEUR_VOIE_PAR_DEFAUT,
  EPAISSEUR_MAX,
  EPAISSEUR_MIN,
  epaisseurParDefaut,
  type Calque,
  type CalqueFond,
  type Extremites,
  type Fond,
  type NomCalque,
  type Point,
  type Projet,
  type Voie,
} from './projet.ts'
import { bornerAbscisse } from './trace.ts'

// Modifications du projet : voies, fond, calques. Chaque fonction renvoie un
// nouveau projet sans toucher à l'ancien : c'est ce qui rend l'annulation
// possible.

function remplacerVoie(projet: Projet, id: string, modifier: (voie: Voie) => Voie): Projet {
  return { ...projet, voies: projet.voies.map((voie) => (voie.id === id ? modifier(voie) : voie)) }
}

// « voie-1 », « zone-4 »… : le numéro suivant le plus grand déjà pris.
export function nouvelIdentifiant(elements: { id: string }[], prefixe = 'voie'): string {
  const motif = new RegExp(`^${prefixe}-(\\d+)$`)
  const numeros = elements.map((e) => Number(motif.exec(e.id)?.[1] ?? 0))
  return `${prefixe}-${Math.max(0, ...numeros) + 1}`
}

// « Voie 1 », « Voie 2 »… sans reprendre un nom déjà pris.
export function nomParDefaut(elements: { nom: string }[], base = 'Voie'): string {
  const pris = new Set(elements.map((e) => e.nom))
  let n = elements.length + 1
  while (pris.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

// Un calque sur lequel on pose un élément doit se voir.
export function afficherCalque(projet: Projet, nom: NomCalque): Projet {
  if (projet.calques[nom].visible) return projet
  return { ...projet, calques: { ...projet.calques, [nom]: { ...projet.calques[nom], visible: true } } }
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
  return { id, projet: afficherCalque({ ...projet, voies: [...projet.voies, voie] }, 'voies') }
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

// Après un changement du tracé d'une voie, ce qui y est posé garde son
// abscisse, ramenée dans la nouvelle longueur si la voie a raccourci.
export function recalerSurVoie(projet: Projet, voieId: string): Projet {
  const voie = projet.voies.find((v) => v.id === voieId)
  if (!voie) return projet
  const borner = (s: number) => bornerAbscisse(voie.points, s)
  const recaler = <T extends { voieId: string; abscisse: number }>(a: T): T =>
    a.voieId === voieId && borner(a.abscisse) !== a.abscisse ? { ...a, abscisse: borner(a.abscisse) } : a
  return {
    ...projet,
    zones: projet.zones.map((z) =>
      z.voieId === voieId && (borner(z.debut) !== z.debut || borner(z.fin) !== z.fin)
        ? { ...z, debut: borner(z.debut), fin: borner(z.fin) }
        : z,
    ),
    appareils: projet.appareils.map((a) => {
      const pointe = recaler(a.pointe)
      const talon = recaler(a.talon)
      return pointe === a.pointe && talon === a.talon ? a : { ...a, pointe, talon }
    }),
  }
}

export function deplacerPoint(projet: Projet, id: string, indice: number, point: Point): Projet {
  const deplace = remplacerVoie(projet, id, (voie) => ({
    ...voie,
    points: voie.points.map((p, i) => (i === indice ? { x: point.x, y: point.y } : p)),
  }))
  return recalerSurVoie(deplace, id)
}

// Appareils touchant une voie, communications comprises : supprimer un BS
// d'une communication supprime aussi son jumeau.
function appareilsLies(projet: Projet, touche: (a: Projet['appareils'][number]) => boolean): Set<string> {
  const communications = new Set(projet.appareils.filter(touche).map((a) => a.communication ?? a.id))
  return new Set(projet.appareils.filter((a) => communications.has(a.communication ?? a.id)).map((a) => a.id))
}

// Ce qui disparaît avec une voie : ses zones et ses appareils.
export function dependancesVoie(projet: Projet, id: string): { zones: number; appareils: number } {
  return {
    zones: projet.zones.filter((z) => z.voieId === id).length,
    appareils: appareilsLies(projet, (a) => a.pointe.voieId === id || a.talon.voieId === id).size,
  }
}

// Supprime la voie avec ses zones et ses appareils : un seul Annuler restaure
// le tout.
export function supprimerVoie(projet: Projet, id: string): Projet {
  const appareils = appareilsLies(projet, (a) => a.pointe.voieId === id || a.talon.voieId === id)
  return {
    ...projet,
    voies: projet.voies.filter((voie) => voie.id !== id),
    zones: projet.zones.filter((z) => z.voieId !== id),
    appareils: projet.appareils.filter((a) => !appareils.has(a.id)),
  }
}

// Supprime un appareil ; dans une communication, les deux BS partent ensemble.
export function supprimerAppareil(projet: Projet, id: string): Projet {
  const appareils = appareilsLies(projet, (a) => a.id === id)
  return { ...projet, appareils: projet.appareils.filter((a) => !appareils.has(a.id)) }
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
  const reduit = remplacerVoie(projet, id, (v) => ({ ...v, points: v.points.filter((_, i) => i !== indice) }))
  return { projet: recalerSurVoie(reduit, id), voieSupprimee: false }
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

export function modifierCalque(projet: Projet, nom: NomCalque, champs: Partial<Calque>): Projet {
  return { ...projet, calques: { ...projet.calques, [nom]: { ...projet.calques[nom], ...champs } } }
}

export function modifierExtremites(projet: Projet, champs: Partial<Extremites>): Projet {
  return { ...projet, extremites: { ...projet.extremites, ...champs } }
}
