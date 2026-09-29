// Le temps d'un synoptique : un instant de référence T0 (date et heure du
// début), puis tout en minutes depuis T0 — un OCP franchit plusieurs minuits.
// La conversion en « Ve 22h30 » ou « Ve/Sa 01h30 » ne sert qu'à l'affichage.
//
// Un instant s'écrit « AAAA-MM-JJTHH:MM », comme dans les champs date et heure
// du navigateur : c'est l'heure du chantier, sans fuseau horaire. Les calculs
// se font en temps universel pour échapper aux changements d'heure.

const MOTIF_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/

// Jours dans l'ordre de Date.getUTCDay() : dimanche d'abord.
const JOURS = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'] as const

// Avant cette heure, on est encore « dans la nuit » de la veille : 01h30 le
// samedi s'écrit « Ve/Sa 01h30 », comme sur les synoptiques.
const HEURE_FIN_DE_NUIT = 6

const deuxChiffres = (n: number): string => String(n).padStart(2, '0')

// Instant saisi → minutes depuis 1970, ou null s'il est incomplet ou
// impossible (31 février…).
export function lireInstant(texte: string): number | null {
  const m = MOTIF_INSTANT.exec(texte.trim())
  if (!m) return null
  const [annee, mois, jour, heure, minute] = m.slice(1).map(Number)
  if (heure > 23 || minute > 59) return null
  const ms = Date.UTC(annee, mois - 1, jour, heure, minute)
  const date = new Date(ms)
  if (date.getUTCFullYear() !== annee || date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) return null
  return ms / 60000
}

export function ecrireInstant(minutes: number): string {
  const d = new Date(Math.round(minutes) * 60000)
  return (
    `${d.getUTCFullYear()}-${deuxChiffres(d.getUTCMonth() + 1)}-${deuxChiffres(d.getUTCDate())}` +
    `T${deuxChiffres(d.getUTCHours())}:${deuxChiffres(d.getUTCMinutes())}`
  )
}

// Minutes écoulées entre T0 et l'instant saisi (négatif s'il est avant T0).
export function minutesDepuisT0(t0: string, texte: string): number | null {
  const origine = lireInstant(t0)
  const instant = lireInstant(texte)
  return origine === null || instant === null ? null : instant - origine
}

// Instant (pour un champ de saisie) situé `minutes` après T0.
export function instantDepuisT0(t0: string, minutes: number): string {
  return ecrireInstant((lireInstant(t0) ?? 0) + minutes)
}

// Le jour (« Ve », ou « Ve/Sa » la nuit, avant 6 h) et l'heure (« 01h30 »)
// d'un instant, séparés : le créneau d'une planche les écrit sur deux lignes.
export function partiesHoraire(t0: string, minutes: number): { jour: string; heure: string } | null {
  const origine = lireInstant(t0)
  if (origine === null) return null
  const d = new Date((origine + Math.round(minutes)) * 60000)
  const heures = d.getUTCHours()
  const heure = `${deuxChiffres(heures)}h${deuxChiffres(d.getUTCMinutes())}`
  const jour = d.getUTCDay()
  return { jour: heures < HEURE_FIN_DE_NUIT ? `${JOURS[(jour + 6) % 7]}/${JOURS[jour]}` : JOURS[jour], heure }
}

// « Ve 22h30 », ou « Ve/Sa 01h30 » la nuit (avant 6 h).
export function formaterHoraire(t0: string, minutes: number): string {
  const p = partiesHoraire(t0, minutes)
  return p ? `${p.jour} ${p.heure}` : '?'
}

// « Ve 22h30 → Ve/Sa 01h30 »
export const formaterPlage = (t0: string, debut: number, fin: number): string =>
  `${formaterHoraire(t0, debut)} → ${formaterHoraire(t0, fin)}`

// « 45 min », « 3 h », « 1 h 30 », « 32 h »
export function formaterDuree(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const heures = Math.floor(total / 60)
  const reste = total % 60
  if (heures === 0) return `${reste} min`
  return reste === 0 ? `${heures} h` : `${heures} h ${deuxChiffres(reste)}`
}
