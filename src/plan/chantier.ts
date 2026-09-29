import { nomParDefaut, nouvelIdentifiant } from './edition.ts'
import { creerProjet, type Projet } from './projet.ts'
import { creerSynoptique, type DemandeValide, type Synoptique } from './synoptique.ts'

// Un chantier : plusieurs plans (un par phase : définitive, provisoire,
// transitoire…) et les synoptiques créés à partir de ces plans. Chaque
// fonction renvoie un nouveau chantier ; la date de modification est posée
// par l'interface.

export type PlanDuChantier = { id: string; projet: Projet }

export type Chantier = {
  id: string
  nom: string
  // Date ISO de la dernière modification.
  modifieLe: string
  plans: PlanDuChantier[]
  synoptiques: Synoptique[]
}

export function creerChantier(id: string, nom: string, maintenant: string): Chantier {
  return { id, nom, modifieLe: maintenant, plans: [], synoptiques: [] }
}

// « Nouveau chantier », puis « Nouveau chantier 2 »… sans reprendre un nom pris.
export function nomLibre(noms: string[], base: string): string {
  const pris = new Set(noms)
  if (!pris.has(base)) return base
  let n = 2
  while (pris.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

// « chantier-1 », « chantier-2 »… : le numéro suivant le plus grand déjà pris.
export const identifiantChantierLibre = (ids: string[]): string =>
  nouvelIdentifiant(
    ids.map((id) => ({ id })),
    'chantier',
  )

export const toucher = (c: Chantier, maintenant: string): Chantier => ({ ...c, modifieLe: maintenant })

export const renommerChantier = (c: Chantier, nom: string): Chantier => ({ ...c, nom })

const nomsDesPlans = (c: Chantier) => c.plans.map((p) => p.projet.nom)

// ——— Plans ———

export function ajouterPlan(c: Chantier, projet: Projet): { chantier: Chantier; id: string } {
  const id = nouvelIdentifiant(c.plans, 'plan')
  return { id, chantier: { ...c, plans: [...c.plans, { id, projet }] } }
}

export function ajouterPlanVierge(c: Chantier): { chantier: Chantier; id: string } {
  return ajouterPlan(c, creerProjet(nomParDefaut(c.plans.map((p) => p.projet), 'Plan')))
}

// Copie d'un plan (pour une phase provisoire…), rangée juste après lui.
export function copierPlan(c: Chantier, planId: string): { chantier: Chantier; id: string } {
  const indice = c.plans.findIndex((p) => p.id === planId)
  if (indice < 0) return { chantier: c, id: planId }
  const original = c.plans[indice]
  const id = nouvelIdentifiant(c.plans, 'plan')
  const projet = { ...structuredClone(original.projet), nom: nomLibre(nomsDesPlans(c), `${original.projet.nom} (copie)`) }
  const plans = [...c.plans.slice(0, indice + 1), { id, projet }, ...c.plans.slice(indice + 1)]
  return { id, chantier: { ...c, plans } }
}

export function remplacerPlan(c: Chantier, planId: string, projet: Projet): Chantier {
  return { ...c, plans: c.plans.map((p) => (p.id === planId ? { ...p, projet } : p)) }
}

export function renommerPlan(c: Chantier, planId: string, nom: string): Chantier {
  return { ...c, plans: c.plans.map((p) => (p.id === planId ? { ...p, projet: { ...p.projet, nom } } : p)) }
}

// Les synoptiques créés depuis ce plan restent : ce sont des copies figées.
export function supprimerPlan(c: Chantier, planId: string): Chantier {
  return { ...c, plans: c.plans.filter((p) => p.id !== planId) }
}

// ——— Synoptiques ———

export function ajouterSynoptique(
  c: Chantier,
  plan: PlanDuChantier,
  demande: DemandeValide,
  maintenant: string,
): { chantier: Chantier; id: string } {
  const id = nouvelIdentifiant(c.synoptiques, 'synoptique')
  return { id, chantier: { ...c, synoptiques: [...c.synoptiques, creerSynoptique(id, demande, plan, maintenant)] } }
}

export function remplacerSynoptique(c: Chantier, s: Synoptique): Chantier {
  return { ...c, synoptiques: c.synoptiques.map((x) => (x.id === s.id ? s : x)) }
}

export function renommerSynoptique(c: Chantier, id: string, nom: string): Chantier {
  return { ...c, synoptiques: c.synoptiques.map((s) => (s.id === id ? { ...s, nom } : s)) }
}

export function supprimerSynoptique(c: Chantier, id: string): Chantier {
  return { ...c, synoptiques: c.synoptiques.filter((s) => s.id !== id) }
}

// ——— Résumés ———

const pluriel = (n: number, singulier: string, plurielForme = `${singulier}s`) =>
  `${n} ${n > 1 ? plurielForme : singulier}`

export const textePlans = (n: number): string => pluriel(n, 'plan')
export const texteSynoptiques = (n: number): string => pluriel(n, 'synoptique')
export const texteImages = (n: number): string => pluriel(n, 'image')

// « 3 voies · 2 zones · 1 appareil · fond plan.pdf (page 2) »
export function resumePlan(p: Projet): string {
  const parties = [
    p.voies.length > 0 && pluriel(p.voies.length, 'voie'),
    p.zones.length > 0 && pluriel(p.zones.length, 'zone'),
    p.appareils.length > 0 && pluriel(p.appareils.length, 'appareil'),
    p.cadres.length > 0 && pluriel(p.cadres.length, 'cadre'),
    p.textes.length > 0 && pluriel(p.textes.length, 'texte'),
  ].filter((x): x is string => typeof x === 'string')
  if (parties.length === 0) parties.push('rien de tracé')
  parties.push(p.fond ? `fond ${p.fond.nomFichier}${p.fond.page ? ` (page ${p.fond.page})` : ''}` : 'sans fond')
  return parties.join(' · ')
}

// Ce qui sera perdu en supprimant le chantier, pour la confirmation.
export function descriptionPerte(c: Chantier): string {
  if (c.plans.length === 0 && c.synoptiques.length === 0) return 'Ce chantier est vide.'
  const images = c.synoptiques.reduce((n, s) => n + s.images.length, 0)
  const synoptiques = c.synoptiques.length > 0 ? ` et ${texteSynoptiques(c.synoptiques.length)} (${texteImages(images)})` : ''
  return `${textePlans(c.plans.length)}${synoptiques}, fonds de plan compris.`
}

// Le chantier créé automatiquement pour ne pas perdre le plan de la
// sauvegarde automatique des étapes 2 et 3.
export const NOM_CHANTIER_RECUPERE = 'Chantier récupéré'

export function chantierRecupere(id: string, projet: Projet, maintenant: string): Chantier {
  return ajouterPlan(creerChantier(id, NOM_CHANTIER_RECUPERE, maintenant), projet).chantier
}
