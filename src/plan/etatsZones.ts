import { etatParId, etatPrecedent, type EtatVoie } from './etatsVoie.ts'
import type { Point, Voie, Zone } from './projet.ts'
import type { Synoptique } from './synoptique.ts'
import { pointAAbscisse } from './trace.ts'

// L'état de chaque zone de travaux dans une image de synoptique : un état de
// la liste du chantier (Avant travaux, Déposée…), et éventuellement un
// avancement partiel — la zone n'est dans cet état que sur une partie de sa
// longueur, depuis l'un de ses bouts (« déballastée sur 40 % depuis le
// Sud »), le reste étant dans un autre état. Les zones du plan figé ne
// bougent pas : seul leur état change d'une image à l'autre.

// Côté de départ de l'avancement : le bout gauche (Nord par défaut) ou le
// bout droit (Sud) de la zone, tels qu'on les voit sur le plan.
export type CoteDepart = 'gauche' | 'droite'

export type Avancement = {
  // Part faite, de 0 à 100 %.
  pourcentage: number
  depuis: CoteDepart
  // État de la partie qui reste à faire.
  reste: string
}

// `etat` : l'état de la zone entière, ou de sa partie faite s'il y a un
// avancement.
export type EtatZone = { etat: string; avancement: Avancement | null }

// Par identifiant de zone. Une zone absente est dans le premier état de la
// liste (Avant travaux).
export type EtatsZones = Record<string, EtatZone>

const POURCENTAGE_PAR_DEFAUT = 50

export const bornerPourcentage = (p: number): number => (Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0)

// État d'une zone tel qu'il s'affiche : les états sont résolus dans la liste
// du chantier (un état disparu revient au premier de la liste).
export type EtatZoneResolu = {
  etat: EtatVoie
  avancement: { pourcentage: number; depuis: CoteDepart; reste: EtatVoie } | null
}

export function etatDeZone(etats: EtatsZones, liste: EtatVoie[], zoneId: string): EtatZoneResolu | null {
  const brut = etats[zoneId]
  const etat = etatParId(liste, brut?.etat)
  if (!etat) return null
  const a = brut?.avancement
  const reste = a ? etatParId(liste, a.reste) : undefined
  return { etat, avancement: a && reste ? { pourcentage: a.pourcentage, depuis: a.depuis, reste } : null }
}

// ——— Modification, dans une image ———

function remplacerEtatZone(s: Synoptique, index: number, zoneId: string, modifier: (e: EtatZone) => EtatZone, liste: EtatVoie[]): Synoptique {
  const image = s.images[index]
  if (!image || !image.contenu.zones.some((z) => z.id === zoneId)) return s
  const actuel: EtatZone = image.contenu.etatsZones[zoneId] ?? { etat: liste[0]?.id ?? '', avancement: null }
  const suivant = modifier(actuel)
  const etatsZones = { ...image.contenu.etatsZones, [zoneId]: suivant }
  return { ...s, images: s.images.map((im, i) => (i === index ? { ...im, contenu: { ...im.contenu, etatsZones } } : im)) }
}

// Choisit l'état de la zone (de sa partie faite, s'il y a un avancement).
export function choisirEtatZone(s: Synoptique, index: number, zoneId: string, etatId: string, liste: EtatVoie[]): Synoptique {
  return remplacerEtatZone(s, index, zoneId, (e) => ({ ...e, etat: etatId }), liste)
}

// Coche ou décoche « En partie ». Cochée : 50 % depuis le côté gauche, le
// reste dans l'état qui précède dans la liste (déballastée sur une partie,
// le reste encore déposé).
export function basculerAvancement(s: Synoptique, index: number, zoneId: string, actif: boolean, liste: EtatVoie[]): Synoptique {
  return remplacerEtatZone(
    s,
    index,
    zoneId,
    (e) => ({
      ...e,
      avancement: actif
        ? (e.avancement ?? { pourcentage: POURCENTAGE_PAR_DEFAUT, depuis: 'gauche', reste: etatPrecedent(liste, e.etat)?.id ?? e.etat })
        : null,
    }),
    liste,
  )
}

export function modifierAvancement(
  s: Synoptique,
  index: number,
  zoneId: string,
  champs: Partial<Avancement>,
  liste: EtatVoie[],
): Synoptique {
  return remplacerEtatZone(
    s,
    index,
    zoneId,
    (e) => {
      if (!e.avancement) return e
      const avancement = { ...e.avancement, ...champs }
      return { ...e, avancement: { ...avancement, pourcentage: bornerPourcentage(avancement.pourcentage) } }
    },
    liste,
  )
}

// ——— Suppression d'un état de la liste ———

// Nombre d'images (tous synoptiques confondus) où une zone est dans cet état,
// en entier, en partie ou pour son reste.
export function imagesAvecEtat(synoptiques: Synoptique[], etatId: string): number {
  let n = 0
  for (const s of synoptiques) {
    for (const im of s.images) {
      if (Object.values(im.contenu.etatsZones).some((e) => e.etat === etatId || e.avancement?.reste === etatId)) n++
    }
  }
  return n
}

// Les zones qui étaient dans l'état `ancien` passent dans l'état `repli` ;
// une zone dont les deux parties se retrouvent dans le même état n'a plus
// d'avancement.
export function remplacerEtat(s: Synoptique, ancien: string, repli: string): Synoptique {
  let change = false
  const images = s.images.map((im) => {
    const touche = Object.values(im.contenu.etatsZones).some((e) => e.etat === ancien || e.avancement?.reste === ancien)
    if (!touche) return im
    change = true
    const etatsZones: EtatsZones = {}
    for (const [zoneId, e] of Object.entries(im.contenu.etatsZones)) {
      const etat = e.etat === ancien ? repli : e.etat
      const reste = e.avancement && (e.avancement.reste === ancien ? repli : e.avancement.reste)
      etatsZones[zoneId] = { etat, avancement: e.avancement && reste !== etat ? { ...e.avancement, reste: reste! } : null }
    }
    return { ...im, contenu: { ...im.contenu, etatsZones } }
  })
  return change ? { ...s, images } : s
}

// ——— Géométrie de l'avancement ———

export type Troncon = { debut: number; fin: number }

export type Decoupage = {
  // Partie faite et reste, en abscisses le long de la voie (debut ≤ fin) ;
  // null quand la partie est vide (0 % ou 100 %).
  fait: Troncon | null
  reste: Troncon | null
  // Le front d'avancement : abscisse sur la voie, null aux bornes.
  front: number | null
}

// Le bout gauche de la zone est-il son début (plus petite abscisse) ? On
// compare les deux bouts tels qu'ils sont dessinés : la voie a pu être
// tracée de droite à gauche. Zone verticale : le début fait office de gauche.
export function debutEstAGauche(voie: Pick<Voie, 'points'>, zone: Pick<Zone, 'debut' | 'fin'>): boolean {
  const a = pointAAbscisse(voie.points, zone.debut).point
  const b = pointAAbscisse(voie.points, zone.fin).point
  return a.x <= b.x + 1e-9
}

// Coupe la zone à `pourcentage` de sa longueur (mesurée le long de la voie,
// courbes comprises), depuis le côté de départ.
export function decouperZone(
  voie: Pick<Voie, 'points'>,
  zone: Pick<Zone, 'debut' | 'fin'>,
  avancement: { pourcentage: number; depuis: CoteDepart },
): Decoupage {
  const p = bornerPourcentage(avancement.pourcentage) / 100
  const longueur = zone.fin - zone.debut
  const depuisDebut = (avancement.depuis === 'gauche') === debutEstAGauche(voie, zone)
  const front = depuisDebut ? zone.debut + p * longueur : zone.fin - p * longueur
  const avant: Troncon = { debut: zone.debut, fin: front }
  const apres: Troncon = { debut: front, fin: zone.fin }
  const [fait, reste] = depuisDebut ? [avant, apres] : [apres, avant]
  return {
    fait: p > 0 && longueur > 0 ? fait : null,
    reste: p < 1 && longueur > 0 ? reste : null,
    front: p > 0 && p < 1 && longueur > 0 ? front : null,
  }
}

// Trait du front d'avancement : en travers de la bande de la zone, un peu
// plus long qu'elle pour se voir.
export function traitDuFront(voie: Pick<Voie, 'points'>, abscisse: number, demiLargeur: number): [Point, Point] {
  const { point, direction } = pointAAbscisse(voie.points, abscisse)
  const n = { x: -direction.y, y: direction.x }
  const l = demiLargeur * 1.6
  return [
    { x: point.x + n.x * l, y: point.y + n.y * l },
    { x: point.x - n.x * l, y: point.y - n.y * l },
  ]
}
