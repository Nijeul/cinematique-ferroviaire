import type { Zone } from './projet.ts'
import type { Synoptique } from './synoptique.ts'

// Zones affichées d'un synoptique (demande du commanditaire : « je me fiche
// de voir les RVB des zones que je ne traite pas dans ce synoptique »). Le
// réglage vaut pour tout le synoptique, pas image par image : une zone
// masquée disparaît de toutes ses images — tracé, nom, état, avancement,
// coupes de tronçonnage, lignes de légende, exports compris. Ses données
// restent dans les images (état, avancement, coupes) : réaffichée, elle
// revient telle qu'elle était. Par défaut, toutes les zones sont affichées.

// Identifiants des zones masquées (liste vide : tout est affiché).
export type ZonesMasquees = string[]

export const zoneAffichee = (s: Pick<Synoptique, 'zonesMasquees'>, zoneId: string): boolean => !s.zonesMasquees.includes(zoneId)

// Les zones d'une liste qui restent affichées, dans le même ordre.
export function zonesVisibles<Z extends Pick<Zone, 'id'>>(s: Pick<Synoptique, 'zonesMasquees'>, zones: Z[]): Z[] {
  if (s.zonesMasquees.length === 0) return zones
  const masquees = new Set(s.zonesMasquees)
  return zones.filter((z) => !masquees.has(z.id))
}

// Une ligne du panneau « Zones affichées » : la zone, le nom de sa voie, et
// si elle est affichée.
export type ZoneDuSynoptique = { zone: Zone; voie: string; affichee: boolean }

// Toutes les zones du synoptique (copie figée du plan : les mêmes dans chaque
// image ; par prudence, celles qui ne seraient que dans une image sont
// ajoutées), dans l'ordre du plan.
export function zonesDuSynoptique(s: Synoptique): ZoneDuSynoptique[] {
  const vues = new Map<string, ZoneDuSynoptique>()
  for (const image of s.images) {
    const { zones, voies } = image.contenu
    for (const zone of zones) {
      if (vues.has(zone.id)) continue
      const voie = voies.find((v) => v.id === zone.voieId)?.nom ?? ''
      vues.set(zone.id, { zone, voie, affichee: zoneAffichee(s, zone.id) })
    }
  }
  return [...vues.values()]
}

// Affiche ou masque une zone dans tout le synoptique.
export function afficherZone(s: Synoptique, zoneId: string, affichee: boolean): Synoptique {
  if (zoneAffichee(s, zoneId) === affichee) return s
  const zonesMasquees = affichee ? s.zonesMasquees.filter((id) => id !== zoneId) : [...s.zonesMasquees, zoneId]
  return { ...s, zonesMasquees }
}

// « Tout afficher » / « Tout masquer ».
export function afficherToutesLesZones(s: Synoptique, affichees: boolean): Synoptique {
  const zonesMasquees = affichees ? [] : zonesDuSynoptique(s).map((z) => z.zone.id)
  if (zonesMasquees.length === s.zonesMasquees.length && zonesMasquees.every((id) => s.zonesMasquees.includes(id))) return s
  return { ...s, zonesMasquees }
}

// « 2 zones sur 4 affichées », pour le titre du panneau.
export function texteZonesAffichees(s: Synoptique): string {
  const zones = zonesDuSynoptique(s)
  const affichees = zones.filter((z) => z.affichee).length
  if (zones.length === 0) return 'aucune zone'
  if (affichees === zones.length) return zones.length === 1 ? 'la zone est affichée' : `les ${zones.length} zones sont affichées`
  return `${affichees} sur ${zones.length} affichée${affichees > 1 ? 's' : ''}`
}
