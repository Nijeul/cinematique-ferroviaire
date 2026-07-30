import { CIBLE_VERBE } from '../domain/etats.ts'
import type { Appareil, Operation, Projet, Zone } from '../domain/projet.ts'
import type {
  Contenu,
  EtatAppareil,
  EtatRessource,
  EtatScene,
  EtatZoneScene,
  Position,
  PositionLieu,
  PositionVoie,
} from './etatScene.ts'

// etatAt(projet, t) — le moteur. Fonction pure : l'état complet du chantier
// à l'instant t (minutes depuis T0) est recalculé depuis l'état initial et la
// liste des opérations, sans dépendre de l'instant précédent.
export function etatAt(projet: Projet, t: number): EtatScene {
  const ops = [...projet.operations].sort(
    (a, b) => a.tDebut - b.tDebut || a.id.localeCompare(b.id),
  )

  return {
    zones: calculerZones(projet, ops, t),
    appareils: calculerAppareils(projet, ops, t),
    ressources: calculerRessources(projet, ops, t),
    stocks: calculerStocks(projet, ops, t),
    operations: ops.filter((op) => op.tDebut <= t && t < op.tFin).map((op) => op.id),
  }
}

// Cache à une entrée pour le rendu : plusieurs composants demandent l'état du
// même instant dans la même image. etatAt reste pure ; ceci n'est qu'un
// mémoïseur au-dessus.
let cacheProjet: Projet | null = null
let cacheT: number | null = null
let cacheEtat: EtatScene | null = null

export function etatAtMemoise(projet: Projet, t: number): EtatScene {
  if (cacheProjet !== projet || cacheT !== t || cacheEtat === null) {
    cacheEtat = etatAt(projet, t)
    cacheProjet = projet
    cacheT = t
  }
  return cacheEtat
}

const avancement = (op: Operation, t: number): number =>
  t >= op.tFin ? 1 : t <= op.tDebut ? 0 : (t - op.tDebut) / (op.tFin - op.tDebut)

// --- Zones ------------------------------------------------------------------

function calculerZones(
  projet: Projet,
  ops: Operation[],
  t: number,
): Record<string, EtatZoneScene> {
  const zones: Record<string, EtatZoneScene> = {}
  for (const zone of projet.site.zones) {
    zones[zone.id] = { couches: { ...zone.etatInitial }, fronts: [] }
  }

  for (const op of ops) {
    if (op.tDebut >= t) continue
    const terminee = op.tFin <= t
    for (const cible of op.cibles) {
      const zone = zones[cible]
      if (!zone) continue
      for (const effet of op.effets) {
        const cibleVerbe = CIBLE_VERBE[effet.verbe]
        if (!cibleVerbe) continue
        const vers = effet.vers ?? cibleVerbe.defaut
        if (terminee) {
          zone.couches[cibleVerbe.couche] = vers as never
        } else {
          zone.fronts.push({
            couche: cibleVerbe.couche,
            de: zone.couches[cibleVerbe.couche],
            vers,
            sens: op.sens ?? 'pk_croissant',
            fraction: avancement(op, t),
            operation: op.id,
          })
        }
      }
    }
  }
  return zones
}

// --- Appareils et panneaux --------------------------------------------------

function calculerAppareils(
  projet: Projet,
  ops: Operation[],
  t: number,
): Record<string, EtatAppareil> {
  const appareils: Record<string, EtatAppareil> = {}
  for (const adv of projet.site.appareils) {
    appareils[adv.id] = {
      pose: true,
      panneaux: Object.fromEntries(adv.panneaux.map((p) => [p, { chez: adv.id }])),
    }
  }

  for (const op of ops) {
    if (op.tDebut >= t) continue
    const terminee = op.tFin <= t

    for (const cible of op.cibles) {
      const etat = appareils[cible]
      if (!etat) continue
      for (const effet of op.effets) {
        if (effet.verbe !== 'deposer_adv' && effet.verbe !== 'poser_adv') continue
        if (terminee) {
          etat.pose = effet.verbe === 'poser_adv'
          delete etat.enCours
        } else {
          etat.enCours = { verbe: effet.verbe, fraction: avancement(op, t), operation: op.id }
        }
      }
    }

    // Déplacement des panneaux par les flux, quel que soit le verbe porteur.
    for (const flux of op.flux) {
      if (flux.quoi !== 'panneau_adv' || flux.ref === undefined) continue
      const [advId, panneau] = flux.ref.split('.')
      const etat = appareils[advId]
      if (!etat || !panneau || !(panneau in etat.panneaux)) continue
      if (terminee) {
        etat.panneaux[panneau] = { chez: flux.vers }
      } else {
        etat.panneaux[panneau] = {
          chez: flux.de,
          enTransit: {
            porteur: flux.porteur ?? op.ressources[0] ?? '',
            fraction: avancement(op, t),
            vers: flux.vers,
          },
        }
      }
    }
  }
  return appareils
}

// --- Ressources -------------------------------------------------------------

function calculerRessources(
  projet: Projet,
  ops: Operation[],
  t: number,
): Record<string, EtatRessource> {
  const zonesParId = new Map(projet.site.zones.map((z) => [z.id, z]))
  const lieuxParId = new Set(projet.site.lieux.map((l) => l.id))
  const advParId = new Map(projet.site.appareils.map((a) => [a.id, a]))

  // Position « au repos » d'un identifiant du site, pour servir d'origine ou
  // de destination à un déplacement.
  const positionDe = (id: string): PositionVoie | PositionLieu => {
    const zone = zonesParId.get(id)
    if (zone) return { type: 'voie', voie: zone.voie, pk: (zone.pkDebut + zone.pkFin) / 2 }
    const adv = advParId.get(id)
    if (adv) return { type: 'voie', voie: adv.voieDirecte, pk: adv.pkPointe }
    return { type: 'lieu', lieu: id }
  }

  const ressources: Record<string, EtatRessource> = {}
  for (const res of projet.ressources) {
    ressources[res.id] = {
      position: { type: 'lieu', lieu: res.lieuInitial },
      mode: res.modeInitial,
      charge: [],
    }
  }

  for (const op of ops) {
    if (op.tDebut >= t) continue
    const terminee = op.tFin <= t
    const fraction = avancement(op, t)

    for (const resId of op.ressources) {
      const etat = ressources[resId]
      if (!etat) continue

      for (const effet of op.effets) {
        if ((effet.verbe === 'enrailler' || effet.verbe === 'derailler') && terminee) {
          etat.mode = (effet.vers as 'rail' | 'route' | undefined) ??
            (effet.verbe === 'enrailler' ? 'rail' : 'route')
        }

        if (effet.verbe === 'circuler') {
          const arrivee: PositionVoie | PositionLieu =
            effet.voie !== undefined && effet.pkArrivee !== undefined
              ? { type: 'voie', voie: effet.voie, pk: effet.pkArrivee }
              : positionDe(op.cibles.find((c) => lieuxParId.has(c)) ?? op.cibles[0] ?? '')
          etat.position = deplacer(etat.position, arrivee, fraction)
        }

        if (effet.verbe === 'acheminer') {
          const voyages = op.flux.filter((f) => (f.porteur ?? op.ressources[0]) === resId)
          if (voyages.length > 0) {
            etat.position = positionVoyages(voyages.map((f) => [positionDe(f.de), positionDe(f.vers)]), fraction)
          } else if (op.cibles.length > 0) {
            etat.position = deplacer(etat.position, positionDe(op.cibles[0]), fraction)
          }
        }

        // Travail sur zone : l'engin est au droit du front de progression.
        const cibleVerbe = CIBLE_VERBE[effet.verbe]
        if (cibleVerbe) {
          const zonesCibles = op.cibles
            .map((c) => zonesParId.get(c))
            .filter((z): z is Zone => z !== undefined)
          if (zonesCibles.length > 0) {
            etat.position = positionSurZones(zonesCibles, op.sens ?? 'pk_croissant', fraction)
          }
        }

        if (effet.verbe === 'deposer_adv' || effet.verbe === 'poser_adv') {
          const adv = op.cibles.map((c) => advParId.get(c)).find((a): a is Appareil => a !== undefined)
          if (adv) etat.position = { type: 'voie', voie: adv.voieDirecte, pk: adv.pkPointe }
        }
      }
    }

    // Charges portées : un flux remplit ou vide l'engin au rythme de l'opération.
    for (const flux of op.flux) {
      const q = (flux.quantite ?? 1) * fraction
      if (q === 0) continue
      if (ressources[flux.vers]) ajouterContenu(ressources[flux.vers].charge, flux.quoi, q)
      if (ressources[flux.de]) ajouterContenu(ressources[flux.de].charge, flux.quoi, -q)
    }
  }
  return ressources
}

// Interpolation d'un déplacement : sur la même voie, le PK avance ; sinon,
// transit entre deux positions que le rendu interpolera.
function deplacer(
  depart: Position,
  arrivee: PositionVoie | PositionLieu,
  fraction: number,
): Position {
  if (fraction >= 1) return arrivee
  const origine = depart.type === 'transit' ? depart.vers : depart
  if (origine.type === 'voie' && arrivee.type === 'voie' && origine.voie === arrivee.voie) {
    return {
      type: 'voie',
      voie: origine.voie,
      pk: origine.pk + (arrivee.pk - origine.pk) * fraction,
    }
  }
  return { type: 'transit', de: origine, vers: arrivee, fraction }
}

// Voyages successifs d'un porteur pendant une opération d'acheminement :
// la fenêtre de l'opération est découpée en autant de segments que de flux.
function positionVoyages(
  voyages: [PositionVoie | PositionLieu, PositionVoie | PositionLieu][],
  fraction: number,
): Position {
  if (fraction >= 1) return voyages[voyages.length - 1][1]
  const n = voyages.length
  const indice = Math.min(Math.floor(fraction * n), n - 1)
  const fractionVoyage = fraction * n - indice
  const [de, vers] = voyages[indice]
  return { type: 'transit', de, vers, fraction: fractionVoyage }
}

// Position au droit du front sur une suite de zones, parcourues dans le sens
// de progression de l'opération.
function positionSurZones(zones: Zone[], sens: 'pk_croissant' | 'pk_decroissant', fraction: number): Position {
  const ordonnees = [...zones].sort((a, b) =>
    sens === 'pk_croissant' ? a.pkDebut - b.pkDebut : b.pkDebut - a.pkDebut,
  )
  const totale = ordonnees.reduce((somme, z) => somme + (z.pkFin - z.pkDebut), 0)
  let restant = Math.min(fraction, 1) * totale
  for (const zone of ordonnees) {
    const etendue = zone.pkFin - zone.pkDebut
    if (restant <= etendue || zone === ordonnees[ordonnees.length - 1]) {
      const avanceeBornee = Math.min(restant, etendue)
      const pk =
        sens === 'pk_croissant' ? zone.pkDebut + avanceeBornee : zone.pkFin - avanceeBornee
      return { type: 'voie', voie: zone.voie, pk }
    }
    restant -= etendue
  }
  const premiere = ordonnees[0]
  return { type: 'voie', voie: premiere.voie, pk: premiere.pkDebut }
}

// --- Stocks -----------------------------------------------------------------

function calculerStocks(
  projet: Projet,
  ops: Operation[],
  t: number,
): Record<string, { contenus: Contenu[] }> {
  const stocks: Record<string, { contenus: Contenu[] }> = {}
  for (const lieu of projet.site.lieux) {
    stocks[lieu.id] = { contenus: [] }
  }
  for (const [lieuId, contenus] of Object.entries(projet.stocks)) {
    stocks[lieuId] = { contenus: contenus.map((c) => ({ ...c })) }
  }

  for (const op of ops) {
    if (op.tDebut >= t) continue
    const fraction = avancement(op, t)
    for (const flux of op.flux) {
      const q = (flux.quantite ?? 1) * fraction
      if (q === 0) continue
      if (stocks[flux.vers]) ajouterContenu(stocks[flux.vers].contenus, flux.quoi, q)
      if (stocks[flux.de]) ajouterContenu(stocks[flux.de].contenus, flux.quoi, -q)
    }
  }
  return stocks
}

function ajouterContenu(contenus: Contenu[], quoi: string, quantite: number): void {
  const existant = contenus.find((c) => c.quoi === quoi)
  if (existant) existant.quantite += quantite
  else contenus.push({ quoi, quantite })
}
