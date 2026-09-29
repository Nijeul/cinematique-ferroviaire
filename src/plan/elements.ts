import type { Reference } from './detection.ts'
import { afficherCalque, nomParDefaut, nouvelIdentifiant, supprimerAppareil, supprimerVoie } from './edition.ts'
import { tailleNom } from './geometrie.ts'
import {
  COULEUR_CADRE_PAR_DEFAUT,
  COULEUR_TEXTE_PAR_DEFAUT,
  COULEUR_ZONE_PAR_DEFAUT,
  epaisseurParDefaut,
  TAILLE_TEXTE_MAX,
  TAILLE_TEXTE_MIN,
  type Ancrage,
  type Appareil,
  type Cadre,
  type Point,
  type Projet,
  type Texte,
  type Zone,
} from './projet.ts'
import { bornerAbscisse, longueurPolyligne, pointAAbscisse, projeterSurPolyligne } from './trace.ts'

// Zones, appareils, cadres et textes : création, modification, déplacement.
// Comme pour les voies, chaque fonction renvoie un nouveau projet.

const remplacer = <T extends { id: string }>(liste: T[], id: string, modifier: (e: T) => T): T[] =>
  liste.map((e) => (e.id === id ? modifier(e) : e))

const pointsDe = (projet: Projet, voieId: string): Point[] => projet.voies.find((v) => v.id === voieId)?.points ?? []

// ——— Zones ———

export function ajouterZone(
  projet: Projet,
  voieId: string,
  debut: number,
  fin: number,
): { projet: Projet; id: string } {
  const points = pointsDe(projet, voieId)
  const id = nouvelIdentifiant(projet.zones, 'zone')
  const zone: Zone = {
    id,
    nom: nomParDefaut(projet.zones, 'Zone'),
    couleur: COULEUR_ZONE_PAR_DEFAUT,
    voieId,
    debut: bornerAbscisse(points, Math.min(debut, fin)),
    fin: bornerAbscisse(points, Math.max(debut, fin)),
  }
  return { id, projet: afficherCalque({ ...projet, zones: [...projet.zones, zone] }, 'zones') }
}

export function modifierZone(projet: Projet, id: string, champs: Partial<Pick<Zone, 'nom' | 'couleur'>>): Projet {
  return { ...projet, zones: remplacer(projet.zones, id, (z) => ({ ...z, ...champs })) }
}

// Déplace un bout de la zone le long de sa voie. Si le bout dépasse l'autre,
// ils échangent leur rôle : debut reste le plus petit.
export function deplacerBoutZone(projet: Projet, id: string, bout: 'debut' | 'fin', abscisse: number): Projet {
  return {
    ...projet,
    zones: remplacer(projet.zones, id, (z) => {
      const s = bornerAbscisse(pointsDe(projet, z.voieId), abscisse)
      const autre = bout === 'debut' ? z.fin : z.debut
      return { ...z, debut: Math.min(s, autre), fin: Math.max(s, autre) }
    }),
  }
}

// Fait glisser toute la zone le long de sa voie, sans changer sa longueur.
export function glisserZone(projet: Projet, id: string, decalage: number): Projet {
  return {
    ...projet,
    zones: remplacer(projet.zones, id, (z) => {
      const longueurVoie = longueurPolyligne(pointsDe(projet, z.voieId))
      const d = Math.min(longueurVoie - z.fin, Math.max(-z.debut, decalage))
      return { ...z, debut: z.debut + d, fin: z.fin + d }
    }),
  }
}

// ——— Appareils ———

// Numéro libre pour un appareil : « BS 3 », ou « BS 3a » / « BS 3b » pour
// une communication.
function numeroAppareilLibre(appareils: Appareil[]): number {
  const numeros = appareils.map((a) => Number(/^BS (\d+)[ab]?$/.exec(a.nom)?.[1] ?? 0))
  return Math.max(0, ...numeros) + 1
}

const ancrage = (projet: Projet, a: Ancrage): Ancrage => ({
  voieId: a.voieId,
  abscisse: bornerAbscisse(pointsDe(projet, a.voieId), a.abscisse),
})

// Branchement simple : pointe sur la voie directe, talon sur la voie déviée.
export function ajouterAppareil(projet: Projet, pointe: Ancrage, talon: Ancrage): { projet: Projet; id: string } {
  const id = nouvelIdentifiant(projet.appareils, 'bs')
  const appareil: Appareil = {
    id,
    nom: `BS ${numeroAppareilLibre(projet.appareils)}`,
    pointe: ancrage(projet, pointe),
    talon: ancrage(projet, talon),
    communication: null,
  }
  return { id, projet: afficherCalque({ ...projet, appareils: [...projet.appareils, appareil] }, 'appareils') }
}

// Communication : deux BS talon contre talon entre les voies A et B. Le
// premier a sa pointe en A, le second en B ; chacun reste un appareil à part
// entière, lié à l'autre par l'identifiant de communication.
export function ajouterCommunication(
  projet: Projet,
  a: Ancrage,
  b: Ancrage,
): { projet: Projet; ids: [string, string] } {
  const n = numeroAppareilLibre(projet.appareils)
  const communication = nouvelIdentifiant(
    projet.appareils.map((x) => ({ id: x.communication ?? '' })),
    'com',
  )
  const idA = nouvelIdentifiant(projet.appareils, 'bs')
  const idB = nouvelIdentifiant([...projet.appareils, { id: idA }], 'bs')
  const cA = ancrage(projet, a)
  const cB = ancrage(projet, b)
  const premier: Appareil = { id: idA, nom: `BS ${n}a`, pointe: cA, talon: cB, communication }
  const second: Appareil = { id: idB, nom: `BS ${n}b`, pointe: { ...cB }, talon: { ...cA }, communication }
  return {
    ids: [idA, idB],
    projet: afficherCalque({ ...projet, appareils: [...projet.appareils, premier, second] }, 'appareils'),
  }
}

export function jumeau(projet: Projet, appareil: Appareil): Appareil | undefined {
  if (!appareil.communication) return undefined
  return projet.appareils.find((a) => a.communication === appareil.communication && a.id !== appareil.id)
}

export function modifierAppareil(projet: Projet, id: string, champs: Partial<Pick<Appareil, 'nom'>>): Projet {
  return { ...projet, appareils: remplacer(projet.appareils, id, (a) => ({ ...a, ...champs })) }
}

// Inverser le sens d'un BS : la pointe passe à l'autre bout (et la voie
// directe devient la voie déviée). Sans objet pour une communication, dont
// les deux pointes sont déjà aux deux bouts.
export function inverserAppareil(projet: Projet, id: string): Projet {
  return {
    ...projet,
    appareils: remplacer(projet.appareils, id, (a) =>
      a.communication ? a : { ...a, pointe: a.talon, talon: a.pointe },
    ),
  }
}

// Change les deux bouts d'un appareil ; dans une communication, le jumeau
// suit (sa pointe est notre talon et inversement).
function placerBouts(projet: Projet, id: string, pointe: Ancrage, talon: Ancrage): Projet {
  const appareil = projet.appareils.find((a) => a.id === id)
  if (!appareil) return projet
  const autre = jumeau(projet, appareil)
  return {
    ...projet,
    appareils: projet.appareils.map((a) =>
      a.id === id ? { ...a, pointe, talon } : a.id === autre?.id ? { ...a, pointe: { ...talon }, talon: { ...pointe } } : a,
    ),
  }
}

export function deplacerBoutAppareil(projet: Projet, id: string, bout: 'pointe' | 'talon', abscisse: number): Projet {
  const appareil = projet.appareils.find((a) => a.id === id)
  if (!appareil) return projet
  const nouveau = ancrage(projet, { voieId: appareil[bout].voieId, abscisse })
  return bout === 'pointe'
    ? placerBouts(projet, id, nouveau, appareil.talon)
    : placerBouts(projet, id, appareil.pointe, nouveau)
}

// Fait glisser l'appareil : chaque bout suit le pointeur puis se recale sur
// sa propre voie.
export function glisserAppareil(projet: Projet, id: string, decalage: Point): Projet {
  const appareil = projet.appareils.find((a) => a.id === id)
  if (!appareil) return projet
  const suivre = (a: Ancrage): Ancrage => {
    const points = pointsDe(projet, a.voieId)
    const depart = pointAAbscisse(points, a.abscisse).point
    const cible = { x: depart.x + decalage.x, y: depart.y + decalage.y }
    return { voieId: a.voieId, abscisse: projeterSurPolyligne(points, cible).abscisse }
  }
  return placerBouts(projet, id, suivre(appareil.pointe), suivre(appareil.talon))
}

// ——— Cadres ———

export type Rectangle = { x: number; y: number; largeur: number; hauteur: number }

// Rectangle défini par deux coins opposés, tracé dans n'importe quel sens.
// Un cadre garde toujours au moins un pixel de large et de haut.
export function normaliserRectangle(a: Point, b: Point): Rectangle {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    largeur: Math.max(1, Math.abs(b.x - a.x)),
    hauteur: Math.max(1, Math.abs(b.y - a.y)),
  }
}

export function ajouterCadre(projet: Projet, a: Point, b: Point): { projet: Projet; id: string } {
  const id = nouvelIdentifiant(projet.cadres, 'cadre')
  const cadre: Cadre = {
    id,
    nom: nomParDefaut(projet.cadres, 'Cadre'),
    couleur: COULEUR_CADRE_PAR_DEFAUT,
    ...normaliserRectangle(a, b),
    pointille: true,
    rempli: true,
  }
  return { id, projet: afficherCalque({ ...projet, cadres: [...projet.cadres, cadre] }, 'cadres') }
}

export function modifierCadre(
  projet: Projet,
  id: string,
  champs: Partial<Pick<Cadre, 'nom' | 'couleur' | 'pointille' | 'rempli'>>,
): Projet {
  return { ...projet, cadres: remplacer(projet.cadres, id, (c) => ({ ...c, ...champs })) }
}

// Coins numérotés dans le sens des aiguilles d'une montre depuis le haut à
// gauche.
export function coinsCadre(c: Rectangle): Point[] {
  return [
    { x: c.x, y: c.y },
    { x: c.x + c.largeur, y: c.y },
    { x: c.x + c.largeur, y: c.y + c.hauteur },
    { x: c.x, y: c.y + c.hauteur },
  ]
}

// Tirer un coin : le coin opposé reste en place.
export function redimensionnerCadre(projet: Projet, id: string, coin: number, p: Point): Projet {
  return {
    ...projet,
    cadres: remplacer(projet.cadres, id, (c) => ({ ...c, ...normaliserRectangle(coinsCadre(c)[(coin + 2) % 4], p) })),
  }
}

export function glisserCadre(projet: Projet, id: string, decalage: Point): Projet {
  return {
    ...projet,
    cadres: remplacer(projet.cadres, id, (c) => ({ ...c, x: c.x + decalage.x, y: c.y + decalage.y })),
  }
}

// ——— Textes ———

export const tailleTexteParDefaut = (projet: Projet): number => tailleNom(epaisseurParDefaut(projet))

export function bornerTaille(taille: number): number {
  if (!Number.isFinite(taille)) return TAILLE_TEXTE_MIN
  return Math.min(TAILLE_TEXTE_MAX, Math.max(TAILLE_TEXTE_MIN, taille))
}

export function ajouterTexte(projet: Projet, p: Point): { projet: Projet; id: string } {
  const id = nouvelIdentifiant(projet.textes, 'texte')
  const texte: Texte = {
    id,
    texte: 'Texte',
    x: p.x,
    y: p.y,
    taille: tailleTexteParDefaut(projet),
    couleur: COULEUR_TEXTE_PAR_DEFAUT,
    gras: false,
  }
  return { id, projet: afficherCalque({ ...projet, textes: [...projet.textes, texte] }, 'textes') }
}

export function modifierTexte(
  projet: Projet,
  id: string,
  champs: Partial<Pick<Texte, 'texte' | 'taille' | 'couleur' | 'gras'>>,
): Projet {
  return {
    ...projet,
    textes: remplacer(projet.textes, id, (t) => ({
      ...t,
      ...champs,
      taille: champs.taille === undefined ? t.taille : bornerTaille(champs.taille),
    })),
  }
}

export function glisserTexte(projet: Projet, id: string, decalage: Point): Projet {
  return {
    ...projet,
    textes: remplacer(projet.textes, id, (t) => ({ ...t, x: t.x + decalage.x, y: t.y + decalage.y })),
  }
}

// ——— Suppression ———

// Supprime un élément ; une voie part avec ce qui est posé dessus, un BS
// de communication avec son jumeau.
export function supprimerElement(projet: Projet, ref: Reference): Projet {
  switch (ref.genre) {
    case 'voie':
      return supprimerVoie(projet, ref.id)
    case 'appareil':
      return supprimerAppareil(projet, ref.id)
    case 'zone':
      return { ...projet, zones: projet.zones.filter((z) => z.id !== ref.id) }
    case 'cadre':
      return { ...projet, cadres: projet.cadres.filter((c) => c.id !== ref.id) }
    case 'texte':
      return { ...projet, textes: projet.textes.filter((t) => t.id !== ref.id) }
    case 'engin':
      return { ...projet, engins: projet.engins.filter((e) => e.id !== ref.id) }
    case 'rame':
      return { ...projet, rames: projet.rames.filter((r) => r.id !== ref.id) }
  }
}
