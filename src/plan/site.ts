// Description d'un site pour une planche 2D — le vocabulaire des synoptiques.
// Toutes les distances sont en mètres le long du site, Nord à gauche (0),
// Sud à droite. Ni React ni DOM ici : tout est testable sans navigateur.

export type Voie = {
  id: string
  nom: string
  // Étendue de la voie le long du site, en mètres.
  de: number
  a: number
  // Ordre d'affichage de haut en bas, 0 en haut.
  rang: number
}

export type ZonePlan = {
  id: string
  nom: string
  voie: string
  de: number
  a: number
}

export type AppareilPlan = {
  id: string
  nom: string
  voieDirecte: string
  voieDeviee: string
  position: number
}

export type LieuPlan = {
  id: string
  nom: string
  type: 'stockage' | 'ouvrage'
  // Pour un stockage : la voie sous la bande de laquelle il se dessine.
  sous?: string
  de: number
  a: number
}

export type HorsPlan = { cote: 'gauche' | 'droite'; nom: string }

export type Site = {
  nom: string
  longueurMetres: number
  voies: Voie[]
  zones: ZonePlan[]
  appareils: AppareilPlan[]
  lieux: LieuPlan[]
  horsPlan: HorsPlan[]
}

export type ResultatSite = { ok: true; site: Site } | { ok: false; erreurs: string[] }

// Charge et vérifie un site. Les erreurs sont en français, prêtes à afficher.
export function chargerSite(texte: string): ResultatSite {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch (e) {
    return { ok: false, erreurs: [`Le fichier n'est pas un JSON valide : ${(e as Error).message}`] }
  }

  const site = brut as Site
  const erreurs: string[] = []
  if (typeof site?.nom !== 'string' || !Array.isArray(site.voies)) {
    return { ok: false, erreurs: ['Le fichier ne décrit pas un site (nom et voies attendus).'] }
  }
  site.zones ??= []
  site.appareils ??= []
  site.lieux ??= []
  site.horsPlan ??= []

  if (!(site.longueurMetres > 0)) erreurs.push('La longueur du site doit être positive.')
  if (site.voies.length === 0) erreurs.push('Le site doit compter au moins une voie.')

  const voiesParId = new Map(site.voies.map((voie) => [voie.id, voie]))
  const rangs = new Set<number>()
  for (const voie of site.voies) {
    if (voie.a <= voie.de) erreurs.push(`Voie « ${voie.id} » : l'étendue est vide ou inversée.`)
    if (rangs.has(voie.rang)) erreurs.push(`Deux voies partagent le rang ${voie.rang}.`)
    rangs.add(voie.rang)
  }

  for (const zone of site.zones) {
    const voie = voiesParId.get(zone.voie)
    if (!voie) {
      erreurs.push(`Zone « ${zone.id} » : la voie « ${zone.voie} » n'existe pas.`)
      continue
    }
    if (zone.a <= zone.de) erreurs.push(`Zone « ${zone.id} » : l'étendue est vide ou inversée.`)
    if (zone.de < voie.de || zone.a > voie.a) {
      erreurs.push(`Zone « ${zone.id} » : elle déborde de la voie « ${voie.nom} ».`)
    }
  }

  for (const adv of site.appareils) {
    for (const ref of [adv.voieDirecte, adv.voieDeviee]) {
      if (!voiesParId.has(ref)) erreurs.push(`Appareil « ${adv.id} » : la voie « ${ref} » n'existe pas.`)
    }
  }

  for (const lieu of site.lieux) {
    if (lieu.a <= lieu.de) erreurs.push(`Lieu « ${lieu.id} » : l'étendue est vide ou inversée.`)
    if (lieu.type === 'stockage' && (lieu.sous === undefined || !voiesParId.has(lieu.sous))) {
      erreurs.push(`Lieu « ${lieu.id} » : un stockage doit indiquer sous quelle voie il se dessine.`)
    }
  }

  return erreurs.length > 0 ? { ok: false, erreurs } : { ok: true, site }
}
