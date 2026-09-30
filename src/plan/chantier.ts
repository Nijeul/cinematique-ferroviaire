import { lireCartouche } from './cartouche.ts'
import { ajouterType, creerCatalogue, modifierType, supprimerType, type ChampsType, type DimensionsEngin, type TypeEngin } from './catalogue.ts'
import type { Resultat } from './echelle.ts'
import { nomParDefaut, nouvelIdentifiant, remplacerFond } from './edition.ts'
import {
  ajouterEtat,
  creerEtatsVoie,
  deplacerEtat,
  etatPrecedent,
  modifierEtat,
  peutSupprimerEtat,
  type ChampsEtat,
  type EtatVoie,
} from './etatsVoie.ts'
import { imagesAvecEtat, remplacerEtat } from './etatsZones.ts'
import {
  ajouterEtatExploitation,
  CALQUE_EXPLOITATION_PAR_DEFAUT,
  creerEtatsExploitation,
  deplacerEtatExploitation,
  imagesAvecEtatExploitation,
  modifierEtatExploitation,
  retirerEtatExploitation,
  type ChampsEtatExploitation,
  type EtatExploitation,
} from './exploitation.ts'
import { CALQUE_COMMENTAIRES_PAR_DEFAUT } from './commentaires.ts'
import {
  ajouterTypeFleche,
  creerTypesFleches,
  deplacerTypeFleche,
  imagesAvecTypeFleche,
  modifierTypeFleche,
  retirerFlechesDuType,
  type ChampsTypeFleche,
  type TypeFleche,
} from './fleches.ts'
import { avisEnginsRetires, compterEnginsDuPlan } from './lecture.ts'
import { CALQUES_ELEMENTS, creerCalques, creerProjet, type Echelle, type Fond, type Projet } from './projet.ts'
import { CALQUE_ENGINS_PAR_DEFAUT, CALQUE_FLECHES_PAR_DEFAUT, creerSynoptique, type DemandeValide, type Synoptique } from './synoptique.ts'

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
  // Les états que prennent les zones de travaux dans les images des
  // synoptiques (Avant travaux, Déposée…), dans l'ordre des travaux.
  etatsVoie: EtatVoie[]
  // Les types de flèches qu'on trace dans les images (sens de travail,
  // chemin de roule…), dans l'ordre de la légende.
  typesFleches: TypeFleche[]
  // Les états d'exploitation qu'on attribue aux voies dans les images
  // (Interceptée, Annoncée…), dans l'ordre de la légende.
  etatsExploitation: EtatExploitation[]
}

export function creerChantier(id: string, nom: string, maintenant: string): Chantier {
  return {
    id,
    nom,
    modifieLe: maintenant,
    plans: [],
    synoptiques: [],
    catalogue: creerCatalogue(),
    etatsVoie: creerEtatsVoie(),
    typesFleches: creerTypesFleches(),
    etatsExploitation: creerEtatsExploitation(),
  }
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

// Identifiant d'un nouveau chantier, unique pour toute l'équipe : deux
// collègues qui créent un chantier chacun de leur côté (hors ligne compris)
// n'obtiennent jamais le même (« chantier-k3f9x2qa »).
export function identifiantChantierUnique(ids: string[], aleatoire: () => number = Math.random): string {
  const pris = new Set(ids)
  for (let essai = 0; essai < 100; essai++) {
    let suffixe = ''
    while (suffixe.length < 8) suffixe += Math.floor(aleatoire() * 36).toString(36)
    const id = `chantier-${suffixe}`
    if (!pris.has(id)) return id
  }
  return identifiantChantierLibre(ids)
}

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

// ——— États de la voie ———
//
// Contrairement aux engins (copies figées), les zones des images désignent un
// état de la liste : changer la couleur d'un état change toutes les images
// qui l'utilisent.

export function ajouterEtatChantier(c: Chantier, nom: string): Resultat<{ chantier: Chantier; id: string }> {
  const r = ajouterEtat(c.etatsVoie, nom)
  return r.ok ? { ok: true, valeur: { id: r.valeur.id, chantier: { ...c, etatsVoie: r.valeur.liste } } } : r
}

export function modifierEtatChantier(c: Chantier, id: string, champs: ChampsEtat): Resultat<Chantier> {
  const r = modifierEtat(c.etatsVoie, id, champs)
  return r.ok ? { ok: true, valeur: { ...c, etatsVoie: r.valeur } } : r
}

export const deplacerEtatChantier = (c: Chantier, id: string, vers: -1 | 1): Chantier => ({ ...c, etatsVoie: deplacerEtat(c.etatsVoie, id, vers) })

// Nombre d'images du chantier où une zone est dans cet état (pour la
// confirmation avant de le supprimer).
export const imagesDeLEtat = (c: Chantier, id: string): number => imagesAvecEtat(c.synoptiques, id)

// Supprime un état de la liste : les zones qui y étaient reviennent à l'état
// précédent de la liste. Le premier état (Avant travaux) ne se supprime pas.
export function supprimerEtatChantier(c: Chantier, id: string): Resultat<{ chantier: Chantier; repli: EtatVoie }> {
  const etat = c.etatsVoie.find((e) => e.id === id)
  if (!etat || !peutSupprimerEtat(c.etatsVoie, id)) {
    return { ok: false, erreur: `Le premier état (« ${c.etatsVoie[0]?.nom ?? ''} ») ne peut pas être supprimé : c'est celui des zones non touchées.` }
  }
  const repli = etatPrecedent(c.etatsVoie, id)!
  return {
    ok: true,
    valeur: {
      repli,
      chantier: {
        ...c,
        etatsVoie: c.etatsVoie.filter((e) => e.id !== id),
        synoptiques: c.synoptiques.map((s) => remplacerEtat(s, id, repli.id)),
      },
    },
  }
}

// ——— Types de flèches ———
//
// Comme les états : les flèches des images désignent un type de la liste,
// changer la couleur d'un type change toutes les images qui l'utilisent.

export function ajouterTypeFlecheChantier(c: Chantier, nom: string): Resultat<{ chantier: Chantier; id: string }> {
  const r = ajouterTypeFleche(c.typesFleches, nom)
  return r.ok ? { ok: true, valeur: { id: r.valeur.id, chantier: { ...c, typesFleches: r.valeur.liste } } } : r
}

export function modifierTypeFlecheChantier(c: Chantier, id: string, champs: ChampsTypeFleche): Resultat<Chantier> {
  const r = modifierTypeFleche(c.typesFleches, id, champs)
  return r.ok ? { ok: true, valeur: { ...c, typesFleches: r.valeur } } : r
}

export const deplacerTypeFlecheChantier = (c: Chantier, id: string, vers: -1 | 1): Chantier => ({
  ...c,
  typesFleches: deplacerTypeFleche(c.typesFleches, id, vers),
})

// Nombre d'images du chantier qui ont une flèche de ce type (pour la
// confirmation avant de le supprimer).
export const imagesDuTypeFleche = (c: Chantier, id: string): number => imagesAvecTypeFleche(c.synoptiques, id)

// Supprime un type de la liste, et les flèches de ce type dans toutes les images.
export const supprimerTypeFlecheChantier = (c: Chantier, id: string): Chantier => ({
  ...c,
  typesFleches: c.typesFleches.filter((t) => t.id !== id),
  synoptiques: c.synoptiques.map((s) => retirerFlechesDuType(s, id)),
})

// ——— États d'exploitation des voies ———
//
// Comme les types de flèches : les voies des images désignent un état de la
// liste, changer la couleur d'un état change toutes les images qui l'utilisent.

export function ajouterEtatExploitationChantier(c: Chantier, nom: string): Resultat<{ chantier: Chantier; id: string }> {
  const r = ajouterEtatExploitation(c.etatsExploitation, nom)
  return r.ok ? { ok: true, valeur: { id: r.valeur.id, chantier: { ...c, etatsExploitation: r.valeur.liste } } } : r
}

export function modifierEtatExploitationChantier(c: Chantier, id: string, champs: ChampsEtatExploitation): Resultat<Chantier> {
  const r = modifierEtatExploitation(c.etatsExploitation, id, champs)
  return r.ok ? { ok: true, valeur: { ...c, etatsExploitation: r.valeur } } : r
}

export const deplacerEtatExploitationChantier = (c: Chantier, id: string, vers: -1 | 1): Chantier => ({
  ...c,
  etatsExploitation: deplacerEtatExploitation(c.etatsExploitation, id, vers),
})

// Nombre d'images du chantier où une voie est dans cet état (pour la
// confirmation avant de le supprimer).
export const imagesDeLEtatExploitation = (c: Chantier, id: string): number => imagesAvecEtatExploitation(c.synoptiques, id)

// Supprime un état de la liste : les voies qui y étaient n'ont plus d'état.
export const supprimerEtatExploitationChantier = (c: Chantier, id: string): Chantier => ({
  ...c,
  etatsExploitation: c.etatsExploitation.filter((e) => e.id !== id),
  synoptiques: c.synoptiques.map((s) => retirerEtatExploitation(s, id)),
})

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
// d'autre. Avant l'étape 6, il n'a ni états de la voie, ni bandeau, ni
// créneau, ni encart PHASAGE : il reçoit la liste d'états par défaut, et
// toutes ses zones sont avant travaux. Avant l'étape 7, il n'a ni types de
// flèches, ni flèches, ni description d'engins, ni réglages de légende : il
// reçoit la liste de flèches par défaut, ses images n'ont pas de flèche et
// leur légende s'affiche en entier. Avant l'étape 8, ses synoptiques n'ont
// pas de cartouche : ils en reçoivent un vide. Un chantier rangé avant la
// correction de l'étape 5 peut avoir des engins sur ses plans : ils en sont
// retirés, avec un avis par plan à montrer une fois (le chantier corrigé est
// aussitôt réenregistré). Les engins de ses synoptiques restent dans leurs
// images. Avant l'étape 10, il n'a ni états d'exploitation, ni commentaires,
// ni coupes : il reçoit la liste d'états d'exploitation par défaut, et ses
// images n'ont ni hachures, ni commentaires, ni coupes.
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
    synoptiques: (Souple & { images: (Souple & { contenu: Souple & { engins?: Souple[]; rames?: Souple[] } })[] })[]
  }
  const avis: string[] = []
  const chantier = {
    ...c,
    catalogue: c.catalogue ?? creerCatalogue(),
    etatsVoie: c.etatsVoie ?? creerEtatsVoie(),
    typesFleches: c.typesFleches ?? creerTypesFleches(),
    etatsExploitation: c.etatsExploitation ?? creerEtatsExploitation(),
    plans: c.plans.map((p) => ({ ...p, projet: migrerPlan(p.projet, avis) })),
    synoptiques: c.synoptiques.map((s) => ({
      echelle: null,
      calqueEngins: { ...CALQUE_ENGINS_PAR_DEFAUT },
      calqueFleches: { ...CALQUE_FLECHES_PAR_DEFAUT },
      calqueExploitation: { ...CALQUE_EXPLOITATION_PAR_DEFAUT },
      calqueCommentaires: { ...CALQUE_COMMENTAIRES_PAR_DEFAUT },
      afficherLegende: true,
      bandeau: '',
      ...s,
      cartouche: lireCartouche(s.cartouche),
      images: s.images.map((im) => ({
        titre: '',
        heures: 'plage',
        phasage: [],
        legendeMasquee: [],
        ...im,
        contenu: {
          etatsZones: {},
          fleches: [],
          exploitation: {},
          commentaires: [],
          coupes: {},
          ...im.contenu,
          engins: (im.contenu.engins ?? []).map((e) => ({ description: '', ...e })),
          rames: (im.contenu.rames ?? []).map((r) => ({ description: '', ...r })),
          calques: calquesDe(im.contenu.calques),
        },
      })),
    })),
  } as unknown as Chantier
  return { chantier, avis }
}
