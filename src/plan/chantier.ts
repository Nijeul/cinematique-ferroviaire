import { ajouterType, creerCatalogue, modifierType, supprimerType, type ChampsType, type DimensionsEngin, type TypeEngin } from './catalogue.ts'
import type { Resultat } from './echelle.ts'
import { nomParDefaut, nouvelIdentifiant, remplacerFond } from './edition.ts'
import { avisEnginsRetires, compterEnginsDuPlan } from './lecture.ts'
import { CALQUES_ELEMENTS, creerCalques, creerProjet, type Echelle, type Fond, type Projet } from './projet.ts'
import { CALQUE_ENGINS_PAR_DEFAUT, creerSynoptique, type DemandeValide, type Synoptique } from './synoptique.ts'

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
  // Les types d'engins qu'on pose dans les synoptiques de ce chantier.
  catalogue: TypeEngin[]
}

export function creerChantier(id: string, nom: string, maintenant: string): Chantier {
  return { id, nom, modifieLe: maintenant, plans: [], synoptiques: [], catalogue: creerCatalogue() }
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

export const nomPlanPropose = (c: Chantier): string => nomParDefaut(c.plans.map((p) => p.projet), 'Plan')

// Le plan créé par l'assistant « Nouveau plan » : un nom, un fond ou non, et
// l'échelle, obligatoire.
export function nouveauPlan(nom: string, fond: Fond | null, echelle: Echelle): Projet {
  const vierge = creerProjet(nom.trim() || 'Plan sans nom')
  return { ...(fond ? remplacerFond(vierge, fond) : vierge), echelle: { ...echelle } }
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

// ——— Catalogue d'engins ———

export function ajouterTypeChantier(c: Chantier, dimensions: DimensionsEngin): Resultat<{ chantier: Chantier; id: string }> {
  const r = ajouterType(c.catalogue, dimensions)
  return r.ok ? { ok: true, valeur: { id: r.valeur.id, chantier: { ...c, catalogue: r.valeur.catalogue } } } : r
}

// Un type modifié : seuls les prochains engins posés prennent ses nouvelles
// valeurs. Ceux déjà posés dans les synoptiques (copies figées) gardent les
// leurs.
export function modifierTypeChantier(c: Chantier, id: string, champs: ChampsType): Resultat<Chantier> {
  const r = modifierType(c.catalogue, id, champs)
  return r.ok ? { ok: true, valeur: { ...c, catalogue: r.valeur } } : r
}

// Les engins déjà posés gardent leurs dimensions (ils en ont une copie).
export const supprimerTypeChantier = (c: Chantier, id: string): Chantier => ({ ...c, catalogue: supprimerType(c.catalogue, id) })

// Nombre de synoptiques du chantier où ce type est posé (engin ou véhicule
// d'une rame, sur au moins une image).
export const synoptiquesDuType = (c: Chantier, id: string): number =>
  c.synoptiques.filter((s) =>
    s.images.some((im) => im.contenu.engins.some((e) => e.typeId === id) || im.contenu.rames.some((r) => r.vehicules.some((v) => v.typeId === id))),
  ).length

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
  if (!p.echelle) parties.push('échelle non définie')
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

// ——— Chantiers gardés dans le navigateur par les étapes précédentes ———

// Un chantier rangé dans le navigateur avant l'étape 5 n'a ni catalogue, ni
// échelle, ni engins : on complète ce qui manque (catalogue par défaut, plans
// et synoptiques sans échelle, images sans engins), sans rien changer
// d'autre. Un chantier rangé avant la correction de l'étape 5 peut avoir des
// engins sur ses plans : ils en sont retirés, avec un avis par plan à montrer
// une fois (le chantier corrigé est aussitôt réenregistré). Les engins de ses
// synoptiques restent dans leurs images.
type Souple = Record<string, unknown>

// Calques d'un plan ou d'une image : ceux d'aujourd'hui, sans le calque
// « Engins » que les plans avaient avant la correction de l'étape 5.
const calquesDe = (brut: unknown): Souple => {
  const calques = { ...creerCalques(), ...(brut as Souple) }
  return Object.fromEntries(Object.entries(calques).filter(([nom]) => nom === 'fond' || (CALQUES_ELEMENTS as readonly string[]).includes(nom)))
}

function migrerPlan(p: Souple, avis: string[]): Souple {
  const reste = { ...p }
  delete reste.engins
  delete reste.rames
  const retire = avisEnginsRetires(typeof p.nom === 'string' ? p.nom : 'sans nom', compterEnginsDuPlan(p))
  if (retire) avis.push(retire)
  return { echelle: null, ...reste, calques: calquesDe(p.calques) }
}

export function migrerChantier(brut: Chantier): { chantier: Chantier; avis: string[] } {
  const c = brut as unknown as Souple & {
    plans: { projet: Souple }[]
    synoptiques: (Souple & { images: (Souple & { contenu: Souple })[] })[]
  }
  const avis: string[] = []
  const chantier = {
    ...c,
    catalogue: c.catalogue ?? creerCatalogue(),
    plans: c.plans.map((p) => ({ ...p, projet: migrerPlan(p.projet, avis) })),
    synoptiques: c.synoptiques.map((s) => ({
      echelle: null,
      calqueEngins: { ...CALQUE_ENGINS_PAR_DEFAUT },
      ...s,
      images: s.images.map((im) => ({
        ...im,
        contenu: { engins: [], rames: [], ...im.contenu, calques: calquesDe(im.contenu.calques) },
      })),
    })),
  } as unknown as Chantier
  return { chantier, avis }
}
