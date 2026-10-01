import type { Ancrage, Point, Projet, Voie } from './projet.ts'
import { pointEtendu } from './engins.ts'
import { longueurPolyligne, pointAAbscisse, sansDoublons, sousPolyligne } from './trace.ts'

// Itinéraire d'un engin ou d'une rame d'une voie à une autre, à travers les
// appareils du plan (BS et communications), comme sur le terrain : on ne
// prend la branche déviée d'un appareil que dans le sens où elle part (en
// venant du côté de la pointe, sur la voie directe) ; sinon il faut
// rebrousser : dépasser l'appareil (l'engin entier, plus une marge), puis
// repartir en sens inverse. Sert à l'animation d'une image à la suivante
// (animation.ts). Le plan n'a pas d'autre topologie que ses appareils : deux
// voies que rien ne relie n'ont pas d'itinéraire (null).

// Un bout de la branche déviée d'un appareil, sur une voie : son abscisse,
// et le sens (+1 : vers les abscisses croissantes) dans lequel la branche
// part de la voie. On entre dans la branche en roulant dans ce sens ; on en
// sort en roulant dans le sens opposé à celui du bout d'arrivée.
export type BoutBranche = Ancrage & { cote: 1 | -1; point: Point }

// Une branche : le biais d'un BS, ou celui d'une communication (deux BS
// talon contre talon, traités comme un seul passage).
export type Branche = { id: string; nom: string; a: BoutBranche; b: BoutBranche; longueur: number }

export type Reseau = { voies: Map<string, Voie>; branches: Branche[] }

// Sens de départ de la branche depuis la voie : celui où se trouve l'autre
// bout, vu le long de la voie.
function coteDe(voie: Voie, abscisse: number, autre: Point): 1 | -1 {
  const { point, direction } = pointAAbscisse(voie.points, abscisse)
  const produit = (autre.x - point.x) * direction.x + (autre.y - point.y) * direction.y
  return produit >= 0 ? 1 : -1
}

export function reseau(contenu: Pick<Projet, 'voies' | 'appareils'>): Reseau {
  const voies = new Map(contenu.voies.map((v) => [v.id, v]))
  const branches: Branche[] = []
  const communications = new Set<string>()
  for (const appareil of contenu.appareils) {
    if (appareil.communication) {
      if (communications.has(appareil.communication)) continue
      communications.add(appareil.communication)
    }
    const directe = voies.get(appareil.pointe.voieId)
    const deviee = voies.get(appareil.talon.voieId)
    if (!directe || !deviee || directe.id === deviee.id) continue
    const pointe = pointAAbscisse(directe.points, appareil.pointe.abscisse).point
    const talon = pointAAbscisse(deviee.points, appareil.talon.abscisse).point
    const jumeau = appareil.communication
      ? contenu.appareils.find((a) => a.communication === appareil.communication && a.id !== appareil.id)
      : undefined
    branches.push({
      id: appareil.communication ?? appareil.id,
      nom: jumeau ? `${appareil.nom} / ${jumeau.nom}` : appareil.nom,
      a: { ...appareil.pointe, cote: coteDe(directe, appareil.pointe.abscisse, talon), point: pointe },
      b: { ...appareil.talon, cote: coteDe(deviee, appareil.talon.abscisse, pointe), point: talon },
      longueur: Math.hypot(talon.x - pointe.x, talon.y - pointe.y),
    })
  }
  return { voies, branches }
}

// ——— Recherche du plus court chemin ———

// Un tronçon de l'itinéraire entre deux rebroussements (ou le départ et
// l'arrivée) : le milieu de l'engin y roule de `debut` à `fin` le long de
// `points`, tracé prolongé en amont et en aval le long des voies (de la
// longueur de l'engin), pour que les véhicules d'une rame qui ne sont pas
// encore (ou plus) sur le tronçon restent sur la voie.
export type Troncon = { points: Point[]; debut: number; fin: number }

export type Itineraire = {
  // Polyligne continue parcourue par le milieu de l'engin, du départ à
  // l'arrivée, rebroussements compris (le tracé revient alors sur lui-même).
  points: Point[]
  longueur: number
  // Distances parcourues (le long de `points`) aux rebroussements et aux
  // passages sur une branche d'appareil (entrée et sortie).
  rebroussements: number[]
  passages: number[]
  // Noms des appareils empruntés, dans l'ordre.
  appareils: string[]
  troncons: Troncon[]
  // Sens de marche au départ, sur la voie de départ, et à l'arrivée, sur la
  // voie d'arrivée (+1 : vers les abscisses croissantes).
  sensDepart: 1 | -1
  sensArrivee: 1 | -1
}

// Un arrêt possible sur une voie : un bout de branche, le départ, l'arrivée.
type Arret = { cle: string; voieId: string; abscisse: number; bout: { branche: Branche; cote: 'a' | 'b' } | null }

type Arete =
  | { genre: 'voie'; vers: string; cout: number }
  | { genre: 'branche'; vers: string; cout: number; branche: Branche; depuis: 'a' | 'b' }
  | { genre: 'rebroussement'; vers: string; cout: number }

const cleEtat = (arret: string, sens: 1 | -1) => `${arret}|${sens}`

// Marge de dégagement d'un rebroussement, en unités du plan.
export const margeRebroussement = (pixelsParMetre: number): number => 5 * pixelsParMetre

// `longueur` : celle de l'engin ou de la rame (unités du plan) ; `marge` :
// ce dont il dépasse encore l'appareil quand il rebrousse.
export function itineraire(
  contenu: Pick<Projet, 'voies' | 'appareils'>,
  depart: Ancrage,
  arrivee: Ancrage,
  longueur: number,
  marge: number,
): Itineraire | null {
  const r = reseau(contenu)
  if (!r.voies.has(depart.voieId) || !r.voies.has(arrivee.voieId)) return null
  // Les arrêts, voie par voie, rangés le long de chaque voie.
  const arrets = new Map<string, Arret>()
  const ajouter = (a: Arret) => arrets.set(a.cle, a)
  ajouter({ cle: 'depart', voieId: depart.voieId, abscisse: depart.abscisse, bout: null })
  ajouter({ cle: 'arrivee', voieId: arrivee.voieId, abscisse: arrivee.abscisse, bout: null })
  for (const b of r.branches) {
    ajouter({ cle: `${b.id}:a`, voieId: b.a.voieId, abscisse: b.a.abscisse, bout: { branche: b, cote: 'a' } })
    ajouter({ cle: `${b.id}:b`, voieId: b.b.voieId, abscisse: b.b.abscisse, bout: { branche: b, cote: 'b' } })
  }
  const parVoie = new Map<string, Arret[]>()
  for (const a of arrets.values()) parVoie.set(a.voieId, [...(parVoie.get(a.voieId) ?? []), a])
  for (const liste of parVoie.values()) liste.sort((x, y) => x.abscisse - y.abscisse || x.cle.localeCompare(y.cle))

  // Un rebroussement coûte le chemin réellement parcouru (aller et retour
  // au-delà de l'appareil) et autant de pénalité : on l'évite s'il existe un
  // chemin sans détour comparable.
  const depassement = longueur / 2 + marge
  const coutRebroussement = 4 * depassement

  const aretes = (cle: string): Arete[] => {
    const [nom, s] = cle.split('|')
    const sens = Number(s) as 1 | -1
    const arret = arrets.get(nom)!
    const liste = parVoie.get(arret.voieId)!
    const i = liste.indexOf(arret)
    const resultat: Arete[] = []
    const suivant = liste[i + sens]
    if (suivant) resultat.push({ genre: 'voie', vers: cleEtat(suivant.cle, sens), cout: Math.abs(suivant.abscisse - arret.abscisse) })
    if (arret.bout) {
      const { branche, cote } = arret.bout
      const ici = branche[cote]
      const autre = cote === 'a' ? branche.b : branche.a
      if (ici.cote === sens) {
        const sortie = (-autre.cote) as 1 | -1
        resultat.push({ genre: 'branche', vers: cleEtat(`${branche.id}:${cote === 'a' ? 'b' : 'a'}`, sortie), cout: branche.longueur, branche, depuis: cote })
      }
      resultat.push({ genre: 'rebroussement', vers: cleEtat(nom, (-sens) as 1 | -1), cout: coutRebroussement })
    }
    return resultat
  }

  // Dijkstra sur les états (arrêt, sens de marche) ; au départ, l'engin
  // part dans le sens qu'il veut.
  const distances = new Map<string, number>([
    [cleEtat('depart', 1), 0],
    [cleEtat('depart', -1), 0],
  ])
  const precedent = new Map<string, { depuis: string; arete: Arete }>()
  const faits = new Set<string>()
  let fin: string | null = null
  for (;;) {
    let courant: string | null = null
    let mini = Infinity
    for (const [cle, d] of distances) {
      if (!faits.has(cle) && d < mini) {
        mini = d
        courant = cle
      }
    }
    if (courant === null) break
    if (courant.startsWith('arrivee|')) {
      fin = courant
      break
    }
    faits.add(courant)
    for (const a of aretes(courant)) {
      const d = mini + a.cout
      if (d < (distances.get(a.vers) ?? Infinity) - 1e-9) {
        distances.set(a.vers, d)
        precedent.set(a.vers, { depuis: courant, arete: a })
      }
    }
  }
  if (fin === null) return null

  const chemin: { depuis: string; arete: Arete }[] = []
  for (let cle = fin; precedent.has(cle); cle = precedent.get(cle)!.depuis) chemin.unshift(precedent.get(cle)!)
  const sensDe = (cle: string) => Number(cle.split('|')[1]) as 1 | -1
  const sensDepart = sensDe(chemin[0]?.depuis ?? fin)
  return assembler(r, arrets, chemin, sensDepart, sensDe(fin), depassement, longueur)
}

// Portion de voie de l'abscisse `de` à `a`, dans le sens de marche
// (prolongée dans l'axe au-delà des bouts de la voie).
function portion(voie: Voie, de: number, a: number): Point[] {
  const longueur = longueurPolyligne(voie.points)
  const dedans = sousPolyligne(voie.points, Math.min(Math.max(de, 0), longueur), Math.min(Math.max(a, 0), longueur))
  const points = de <= a ? dedans : [...dedans].reverse()
  const avant = de < 0 || de > longueur ? [pointEtendu(voie.points, de)] : []
  const apres = a < 0 || a > longueur ? [pointEtendu(voie.points, a)] : []
  return [...avant, ...points, ...apres]
}

function assembler(
  r: Reseau,
  arrets: Map<string, Arret>,
  chemin: { depuis: string; arete: Arete }[],
  sensDepart: 1 | -1,
  sensArrivee: 1 | -1,
  depassement: number,
  longueurEngin: number,
): Itineraire {
  const arretDe = (cle: string) => arrets.get(cle.split('|')[0])!
  const depart = arrets.get('depart')!
  const arrivee = arrets.get('arrivee')!
  const prolongement = Math.max(longueurEngin, 1)
  const troncons: Troncon[] = []
  const appareils: string[] = []
  const rebroussements: number[] = []
  const passages: number[] = []
  let points: Point[] = []
  let parcouru = 0

  // Tronçon en cours : ses points, d'où il part (voie, abscisse, sens).
  let courant: Point[] = []
  let origine = { voieId: depart.voieId, abscisse: depart.abscisse, sens: sensDepart as 1 | -1 }

  const avancer = (morceau: Point[]) => {
    const nets = sansDoublons([...(courant.length > 0 ? [courant[courant.length - 1]] : []), ...morceau])
    parcouru += longueurPolyligne(nets)
    courant = sansDoublons([...courant, ...morceau])
  }
  const fermer = (voieId: string, abscisse: number, sens: 1 | -1) => {
    const debut = r.voies.get(origine.voieId)!
    const finVoie = r.voies.get(voieId)!
    const amont = portion(debut, origine.abscisse - origine.sens * prolongement, origine.abscisse)
    const aval = portion(finVoie, abscisse, abscisse + sens * prolongement)
    const tout = sansDoublons([...amont, ...courant, ...aval])
    const lAmont = longueurPolyligne(sansDoublons(amont))
    const lTroncon = longueurPolyligne(sansDoublons(courant))
    troncons.push({ points: tout, debut: lAmont, fin: lAmont + lTroncon })
    points = sansDoublons([...points, ...courant])
  }

  courant = [pointAAbscisse(r.voies.get(depart.voieId)!.points, depart.abscisse).point]
  for (const { depuis, arete } of chemin) {
    const de = arretDe(depuis)
    const vers = arretDe(arete.vers)
    if (arete.genre === 'voie') {
      avancer(portion(r.voies.get(de.voieId)!, de.abscisse, vers.abscisse))
    } else if (arete.genre === 'branche') {
      const b = arete.branche
      const [entree, sortie] = arete.depuis === 'a' ? [b.a, b.b] : [b.b, b.a]
      passages.push(parcouru)
      avancer([entree.point, sortie.point])
      passages.push(parcouru)
      appareils.push(b.nom)
    } else {
      // Rebroussement : l'engin dépasse l'appareil, s'arrête, repart.
      const sens = Number(depuis.split('|')[1]) as 1 | -1
      const voie = r.voies.get(de.voieId)!
      const bout = de.abscisse + sens * depassement
      avancer(portion(voie, de.abscisse, bout))
      rebroussements.push(parcouru)
      fermer(de.voieId, bout, sens)
      courant = [pointEtendu(voie.points, bout)]
      origine = { voieId: de.voieId, abscisse: bout, sens: (-sens) as 1 | -1 }
      // Retour jusqu'à l'appareil, d'où il repart.
      avancer(portion(voie, bout, de.abscisse))
    }
  }
  fermer(arrivee.voieId, arrivee.abscisse, sensArrivee)
  return { points, longueur: parcouru, rebroussements, passages, appareils, troncons, sensDepart, sensArrivee }
}

// Où en est le milieu de l'engin après avoir parcouru `u` (de 0 à la
// longueur de l'itinéraire) : le tronçon, et l'abscisse le long de ses
// points ; `rang` = nombre de rebroussements déjà faits.
export function surItineraire(it: Itineraire, u: number): { troncon: Troncon; abscisse: number; rang: number } {
  let reste = Math.max(0, Math.min(it.longueur, u))
  for (let i = 0; i < it.troncons.length; i++) {
    const t = it.troncons[i]
    const l = t.fin - t.debut
    if (reste <= l + 1e-9 || i === it.troncons.length - 1) return { troncon: t, abscisse: t.debut + Math.min(reste, l), rang: i }
    reste -= l
  }
  // (Jamais atteint : un itinéraire a toujours au moins un tronçon.)
  const t = it.troncons[0]
  return { troncon: t, abscisse: t.debut, rang: 0 }
}
