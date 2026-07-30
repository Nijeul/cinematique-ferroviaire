import type { z } from 'zod'
import { ProjetSchema, type Projet } from './projet.ts'
import { VERBES } from './etats.ts'

export type ResultatChargement =
  | { ok: true; projet: Projet }
  | { ok: false; erreurs: string[] }

// Charge et valide un fichier .cinef. Ne lève jamais : toutes les erreurs
// sont renvoyées sous forme de messages en français, exploitables tels quels
// par l'interface.
export function chargerProjet(texte: string): ResultatChargement {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch (e) {
    return {
      ok: false,
      erreurs: [`Le fichier n'est pas un JSON valide : ${(e as Error).message}`],
    }
  }

  const analyse = ProjetSchema.safeParse(brut)
  if (!analyse.success) {
    return { ok: false, erreurs: analyse.error.issues.map((i) => formaterProbleme(i, brut)) }
  }

  const erreurs = verifierReferences(analyse.data)
  if (erreurs.length > 0) return { ok: false, erreurs }

  return { ok: true, projet: analyse.data }
}

// --- Mise en français des problèmes de structure ---------------------------

function formaterProbleme(issue: z.core.$ZodIssue, brut: unknown): string {
  return `${decrireChemin(issue.path, brut)} : ${traduireMessage(issue)}`
}

function traduireMessage(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined
        ? 'champ obligatoire manquant'
        : `type invalide (attendu : ${issue.expected})`
    case 'invalid_value':
      return `valeur inconnue (valeurs possibles : ${issue.values.map(String).join(', ')})`
    case 'unrecognized_keys':
      return `champ inconnu : ${issue.keys.join(', ')}`
    case 'too_small':
      return issue.message
    case 'invalid_format':
      return issue.format === 'datetime'
        ? 'date-heure attendue au format 2025-09-12T22:30:00'
        : issue.message
    default:
      return issue.message
  }
}

// Rend un chemin Zod lisible : « operations[3] (op-04) → effets[0] → verbe ».
function decrireChemin(chemin: PropertyKey[], brut: unknown): string {
  if (chemin.length === 0) return 'racine du fichier'
  const morceaux: string[] = []
  let courant: unknown = brut
  for (const segment of chemin) {
    if (typeof segment === 'number' && Array.isArray(courant)) {
      const element = courant[segment] as { id?: unknown } | undefined
      const id = element && typeof element.id === 'string' ? ` (${element.id})` : ''
      morceaux[morceaux.length - 1] += `[${segment}]${id}`
      courant = element
    } else {
      morceaux.push(String(segment))
      courant =
        typeof courant === 'object' && courant !== null
          ? (courant as Record<PropertyKey, unknown>)[segment]
          : undefined
    }
  }
  return morceaux.join(' → ')
}

// --- Cohérence des références ----------------------------------------------

// Vérifie que tout identifiant cité existe : voies des zones et des appareils,
// ressources et cibles des opérations, origine, destination et porteur des
// flux, panneaux référencés, lieux des stocks…
function verifierReferences(projet: Projet): string[] {
  const erreurs: string[] = []

  const voies = new Map(projet.site.voies.map((v) => [v.id, v]))
  const zones = new Map(projet.site.zones.map((zo) => [zo.id, zo]))
  const lieux = new Map(projet.site.lieux.map((l) => [l.id, l]))
  const appareils = new Map(projet.site.appareils.map((a) => [a.id, a]))
  const ressources = new Map(projet.ressources.map((r) => [r.id, r]))

  verifierUnicite(erreurs, 'voie', projet.site.voies)
  verifierUnicite(erreurs, 'zone', projet.site.zones)
  verifierUnicite(erreurs, 'lieu', projet.site.lieux)
  verifierUnicite(erreurs, 'appareil', projet.site.appareils)
  verifierUnicite(erreurs, 'ressource', projet.ressources)
  verifierUnicite(erreurs, 'opération', projet.operations)

  // Zones, lieux, appareils et ressources partagent l'espace de nommage des
  // cibles et des flux : un même id dans deux familles serait ambigu.
  const familles: [string, { id: string }[]][] = [
    ['zone', projet.site.zones],
    ['lieu', projet.site.lieux],
    ['appareil', projet.site.appareils],
    ['ressource', projet.ressources],
  ]
  const vus = new Map<string, string>()
  for (const [famille, elements] of familles) {
    for (const e of elements) {
      const deja = vus.get(e.id)
      if (deja && deja !== famille) {
        erreurs.push(`L'identifiant « ${e.id} » est utilisé à la fois par un(e) ${deja} et un(e) ${famille}.`)
      }
      vus.set(e.id, famille)
    }
  }
  const cibleConnue = (id: string) => zones.has(id) || lieux.has(id) || appareils.has(id)
  const emplacementConnu = (id: string) => cibleConnue(id) || ressources.has(id)

  for (const zone of projet.site.zones) {
    const ou = `Zone « ${zone.id} »`
    if (!voies.has(zone.voie)) erreurs.push(`${ou} : la voie « ${zone.voie} » n'existe pas.`)
    if (zone.pkFin <= zone.pkDebut)
      erreurs.push(`${ou} : pkFin (${zone.pkFin}) doit être après pkDebut (${zone.pkDebut}).`)
    const longueurPk = (zone.pkFin - zone.pkDebut) * 1000
    if (Math.abs(longueurPk - zone.longueur) > 0.5)
      erreurs.push(
        `${ou} : la longueur déclarée (${zone.longueur} m) ne correspond pas aux PK (${longueurPk.toFixed(0)} m entre ${zone.pkDebut} et ${zone.pkFin}).`,
      )
  }

  for (const adv of projet.site.appareils) {
    const ou = `Appareil « ${adv.id} »`
    if (!voies.has(adv.voieDirecte)) erreurs.push(`${ou} : la voie directe « ${adv.voieDirecte} » n'existe pas.`)
    if (!voies.has(adv.voiedeviee)) erreurs.push(`${ou} : la voie déviée « ${adv.voiedeviee} » n'existe pas.`)
  }

  for (const res of projet.ressources) {
    if (!lieux.has(res.lieuInitial))
      erreurs.push(`Ressource « ${res.id} » : le lieu initial « ${res.lieuInitial} » n'existe pas.`)
  }

  for (const lieuId of Object.keys(projet.stocks)) {
    if (!lieux.has(lieuId)) erreurs.push(`Stocks : le lieu « ${lieuId} » n'existe pas.`)
  }

  for (const op of projet.operations) {
    const ou = `Opération « ${op.id} »`
    if (op.tFin > projet.temps.dureeMinutes)
      erreurs.push(
        `${ou} : tFin (${op.tFin}) dépasse la durée du chantier (${projet.temps.dureeMinutes} min).`,
      )
    for (const id of op.ressources) {
      if (!ressources.has(id)) erreurs.push(`${ou} : la ressource « ${id} » n'existe pas.`)
    }
    for (const id of op.cibles) {
      if (!cibleConnue(id))
        erreurs.push(`${ou} : la cible « ${id} » n'est ni une zone, ni un lieu, ni un appareil.`)
    }
    for (const effet of op.effets) {
      if (effet.voie !== undefined && !voies.has(effet.voie))
        erreurs.push(`${ou} : la voie « ${effet.voie} » de l'effet « ${effet.verbe} » n'existe pas.`)
      if (effet.decoupage) {
        for (const cible of op.cibles) {
          const adv = appareils.get(cible)
          if (!adv) continue
          for (const panneau of effet.decoupage) {
            if (!adv.panneaux.includes(panneau))
              erreurs.push(
                `${ou} : le panneau « ${panneau} » n'est pas déclaré sur l'appareil « ${adv.id} » (panneaux : ${adv.panneaux.join(', ')}).`,
              )
          }
        }
      }
      const couchesTouchees = VERBES[effet.verbe].couches
      if (couchesTouchees.length > 0 && op.cibles.length > 0 && !op.cibles.some((c) => zones.has(c)))
        erreurs.push(`${ou} : le verbe « ${effet.verbe} » modifie une zone, mais aucune cible n'en est une.`)
    }
    for (const flux of op.flux) {
      if (!emplacementConnu(flux.de))
        erreurs.push(`${ou} : l'origine du flux « ${flux.de} » n'existe pas.`)
      if (!emplacementConnu(flux.vers))
        erreurs.push(`${ou} : la destination du flux « ${flux.vers} » n'existe pas.`)
      if (flux.porteur !== undefined && !ressources.has(flux.porteur))
        erreurs.push(`${ou} : le porteur « ${flux.porteur} » n'existe pas.`)
      if (flux.quoi === 'panneau_adv' && flux.ref !== undefined) {
        const [advId, panneau, ...reste] = flux.ref.split('.')
        const adv = appareils.get(advId)
        if (reste.length > 0 || !panneau) {
          erreurs.push(`${ou} : la référence de panneau « ${flux.ref} » doit s'écrire « appareil.panneau ».`)
        } else if (!adv) {
          erreurs.push(`${ou} : la référence « ${flux.ref} » vise l'appareil « ${advId} », qui n'existe pas.`)
        } else if (!adv.panneaux.includes(panneau)) {
          erreurs.push(
            `${ou} : le panneau « ${panneau} » n'est pas déclaré sur l'appareil « ${advId} » (panneaux : ${adv.panneaux.join(', ')}).`,
          )
        }
      }
    }
  }

  for (const vue of projet.vues) {
    if (vue.type === 'suivi') {
      if (vue.ressource === undefined)
        erreurs.push(`Vue « ${vue.id} » : une vue de type « suivi » doit désigner une ressource.`)
      else if (!ressources.has(vue.ressource))
        erreurs.push(`Vue « ${vue.id} » : la ressource « ${vue.ressource} » n'existe pas.`)
    }
  }

  return erreurs
}

function verifierUnicite(erreurs: string[], famille: string, elements: { id: string }[]): void {
  const vus = new Set<string>()
  for (const e of elements) {
    if (vus.has(e.id)) erreurs.push(`Deux ${famille}s portent l'identifiant « ${e.id} ».`)
    vus.add(e.id)
  }
}
