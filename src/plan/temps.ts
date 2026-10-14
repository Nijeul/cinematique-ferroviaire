import type { Resultat } from './echelle.ts'

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

// ——— Heures tapées sur la planche ———

// « 10h15 – 10h35 », « 10h15-10h35 », « 10:15 10:35 », « 22h30 – 01h15 »,
// « Ve 22h30 – Sa 01h15 », « Ve/Sa 00h30 – 03h30 » : une ou deux heures, chacune
// précédée ou non de son jour. « Ve/Sa » (la nuit de vendredi à samedi) vaut
// samedi, comme sur les planches. Les jours s'écrivent en abrégé ou en entier.
export type HeureTapee = { jour: number | null; heures: number; minutes: number }

const NOMS_JOURS: Record<string, number> = {
  di: 0, dim: 0, dimanche: 0,
  lu: 1, lun: 1, lundi: 1,
  ma: 2, mar: 2, mardi: 2,
  me: 3, mer: 3, mercredi: 3,
  je: 4, jeu: 4, jeudi: 4,
  ve: 5, ven: 5, vendredi: 5,
  sa: 6, sam: 6, samedi: 6,
}
// Les noms de jours, les plus longs d'abord (« samedi » avant « sa »).
const NOMS = Object.keys(NOMS_JOURS).sort((x, y) => y.length - x.length).join('|')
const JOUR = `(${NOMS})(?:\\s*\\/\\s*(${NOMS}))?\\.?\\s*`
const HEURE = '(\\d{1,2})\\s*(?:h|:)\\s*(\\d{2})?'
const MOTIF_HEURE = new RegExp(`(?:${JOUR})?${HEURE}`, 'g')
// Ce qui peut séparer deux heures : espaces, tirets, flèche, « à ».
const SEPARATEURS = /^[\s\-–—→>,;]*(?:à|a|au)?[\s\-–—→>,;]*$/

export function lireHeuresTapees(texte: string): Resultat<HeureTapee[]> {
  const t = texte.toLowerCase().replace(/\s+/g, ' ').trim()
  const illisible = `Heures illisibles : « ${texte.trim()} ». Écrivez par exemple « 22h30 – 01h15 » ou « Ve 22h30 – Sa 01h15 ».`
  if (t === '') return { ok: false, erreur: 'Indiquez les heures, par exemple « 22h30 – 01h15 ».' }
  const lues: HeureTapee[] = []
  const restes: string[] = []
  let fin = 0
  for (const m of t.matchAll(MOTIF_HEURE)) {
    restes.push(t.slice(fin, m.index))
    fin = m.index + m[0].length
    const [, j1, j2, h, mn] = m
    let jour: number | null = null
    if (j1) {
      const a = NOMS_JOURS[j1]
      const b = j2 === undefined ? undefined : NOMS_JOURS[j2]
      // « Ve/Sa » : la nuit de vendredi à samedi, deux jours qui se suivent.
      if (b !== undefined && b !== (a + 1) % 7)
        return { ok: false, erreur: `« ${JOURS[a]}/${JOURS[b]} » : écrivez deux jours qui se suivent (« Ve/Sa »).` }
      jour = b ?? a
    }
    const heures = Number(h)
    const minutes = mn === undefined ? 0 : Number(mn)
    if (heures > 23 || minutes > 59) return { ok: false, erreur: `Heure impossible : « ${m[0].trim()} » (de 00h00 à 23h59).` }
    lues.push({ jour, heures, minutes })
  }
  restes.push(t.slice(fin))
  if (lues.length === 0 || lues.length > 2 || !restes.slice(1, -1).every((r) => SEPARATEURS.test(r)) || restes[0].trim() !== '' || restes[restes.length - 1].trim() !== '')
    return { ok: false, erreur: illisible }
  return { ok: true, valeur: lues }
}

// L'heure tapée, en minutes depuis T0 : avec son jour, le jour de ce nom le
// plus proche de `reference` ; sans jour, l'heure la plus proche de
// `reference`, ou (`apres`) la première après elle (passage de minuit).
export function placerHeure(t0: string, h: HeureTapee, reference: number, apres = false): number | null {
  // Minuit du jour de T0, en minutes depuis T0 (négatif ou nul).
  const minuit = minutesDepuisT0(t0, `${t0.slice(0, 10)}T00:00`)
  if (minuit === null) return null
  const hhmm = `T${deuxChiffres(h.heures)}:${deuxChiffres(h.minutes)}`
  const suivante = apres && h.jour === null
  const jourReference = Math.floor((reference - minuit) / 1440)
  let meilleur: number | null = null
  // Une semaine de part et d'autre : assez pour trouver le jour nommé.
  for (let k = jourReference - 8; k <= jourReference + 8; k++) {
    const date = instantDepuisT0(t0, minuit + k * 1440).slice(0, 10)
    const minutes = minutesDepuisT0(t0, `${date}${hhmm}`)
    if (minutes === null) continue
    if (h.jour !== null && new Date(`${date}T00:00Z`).getUTCDay() !== h.jour) continue
    if (suivante && minutes <= reference) continue
    const mieux = meilleur === null || (suivante ? minutes < meilleur : Math.abs(minutes - reference) < Math.abs(meilleur - reference))
    if (mieux) meilleur = minutes
  }
  return meilleur
}

// Début et fin d'une image d'après les heures tapées. Une seule heure : le
// début seul (la fin ne change pas) — seulement si `debutSeul`. Le contrôle
// des bornes du synoptique reste à faire (voir erreurHoraires).
export function lirePlageTapee(t0: string, texte: string, actuel: { debut: number; fin: number }, debutSeul: boolean): Resultat<{ debut: number; fin: number }> {
  const lu = lireHeuresTapees(texte)
  if (!lu.ok) return lu
  const [a, b] = lu.valeur
  if (!b && !debutSeul) return { ok: false, erreur: 'Indiquez le début et la fin, par exemple « 22h30 – 01h15 ».' }
  const debut = placerHeure(t0, a, actuel.debut)
  if (debut === null) return { ok: false, erreur: "Le début du synoptique est incomplet : indiquez sa date et son heure." }
  if (!b) return { ok: true, valeur: { debut, fin: actuel.fin } }
  // Fin sans jour : la première fois que cette heure revient après le début.
  const fin = placerHeure(t0, b, debut, true)
  if (fin === null) return { ok: false, erreur: "Le début du synoptique est incomplet : indiquez sa date et son heure." }
  return { ok: true, valeur: { debut, fin } }
}
