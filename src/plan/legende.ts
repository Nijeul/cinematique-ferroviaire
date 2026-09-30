import type { DimensionsEngin, TypeEngin } from './catalogue.ts'
import { pasPresents, texteCoupes } from './coupes.ts'
import { formaterMetres } from './echelle.ts'
import { groupesDeVehicules, longueurRame, texteComposition, type Engin, type Rame } from './engins.ts'
import type { EtatVoie } from './etatsVoie.ts'
import { etatDeZone } from './etatsZones.ts'
import { etatsExploitationPresents, type EtatExploitation } from './exploitation.ts'
import type { TypeFleche } from './fleches.ts'
import type { Synoptique } from './synoptique.ts'
import { enginsAffiches } from './numerosEngins.ts'
import { zonesVisibles } from './zonesAffichees.ts'

// La légende d'une image de synoptique, construite d'après ce que l'image
// montre, et seulement cela — comme sur les planches du commanditaire, où
// chaque planche a la sienne (« TTX 1 déblais + sous-couche ballast », « Sens
// de travail »…). Elle remplace les carrés noirs numérotés des pelles, que le
// commanditaire voulait « mieux expliqués » :
//
// - chaque engin ou rame qui a un numéro : « 1 — Pelle RR », suivi de sa
//   description facultative (« déblais ») — si les numéros sont affichés sur
//   l'image (case « Numéros des engins sur l'image » du synoptique) ; sinon,
//   il est légendé comme un engin sans numéro ;
// - les engins sans numéro, regroupés quand ils sont pareils : « Pelle RR ×2 » ;
// - les rames : leur nom (« TTX 1 »), leur description, leur composition
//   courte ou leur longueur ;
// - les états de la voie présents, sauf le premier (Avant travaux : la
//   couleur propre de chaque zone, qui n'explique rien) ;
// - les coupes de tronçonnage (« Coupes rail tous les 6 m ») ;
// - les états d'exploitation présents, avec leurs voies (« Interceptée
//   (Voie 2, Voie 4) ») ;
// - les types de flèches présents.
//
// Chaque ligne a une clé : on peut la masquer sur une image précise. La case
// « Afficher la légende » du synoptique la masque sur toutes les images.

// Les listes du chantier dont la légende a besoin.
export type ListesChantier = {
  etatsVoie: EtatVoie[]
  typesFleches: TypeFleche[]
  catalogue: TypeEngin[]
  etatsExploitation: EtatExploitation[]
}

// Les listes d'un chantier, telles que la légende et le dessin les utilisent.
export const listesDe = (c: ListesChantier): ListesChantier => ({
  etatsVoie: c.etatsVoie,
  typesFleches: c.typesFleches,
  catalogue: c.catalogue,
  etatsExploitation: c.etatsExploitation,
})

type Base = {
  // Identifie la ligne dans l'image (pour la masquer).
  cle: string
  // Le nom, en gras pour un engin ou une rame (« 1 — Pelle RR », « TTX 1 »),
  // puis son complément en maigre (description, composition).
  nom: string
  complement: string
}

export type EntreeLegende =
  | (Base & { genre: 'engin'; numero: string; couleur: string; nombre: number })
  | (Base & { genre: 'rame'; numero: string; couleurPastille: string; couleurs: string[] })
  | (Base & { genre: 'etat'; etat: EtatVoie })
  | (Base & { genre: 'fleche'; type: TypeFleche })
  | (Base & { genre: 'coupes'; pas: number })
  | (Base & { genre: 'exploitation'; etatExploitation: EtatExploitation })

export const nomEnGras = (e: EntreeLegende): boolean => e.genre === 'engin' || e.genre === 'rame'

export const texteEntree = (e: EntreeLegende): string => [e.nom, e.complement].filter((t) => t !== '').join(' ')

const propre = (t: string): string => t.replace(/\s+/g, ' ').trim()

// Nom d'un engin dans la légende : sa catégorie (« Pelle RR »), suivie de son
// modèle quand le catalogue du chantier en a plusieurs dans cette catégorie
// (« BML 08-32U » ; le mot « Type » est retiré).
export function nomLegendeEngin(type: Pick<DimensionsEngin, 'categorie' | 'modele'>, catalogue: Pick<TypeEngin, 'categorie' | 'modele'>[]): string {
  const categorie = propre(type.categorie)
  const cle = categorie.toLowerCase()
  const modeles = new Set(catalogue.filter((t) => propre(t.categorie).toLowerCase() === cle).map((t) => propre(t.modele)))
  const seul = modeles.size === 1 && modeles.has(propre(type.modele))
  const modele = propre(type.modele).replace(/^type\s+/i, '')
  return seul || modele === '' ? categorie : `${categorie} ${modele}`
}

// « 1 — Pelle RR »
const avecNumero = (numero: string, nom: string): string => (numero === '' ? nom : `${numero} — ${nom}`)

const parNumero = (a: { numero: string }, b: { numero: string }): number => a.numero.localeCompare(b.numero, 'fr', { numeric: true })

// Composition courte (« BB 61000 + 10 × R39 ») jusqu'à trois groupes de
// véhicules, la longueur totale au-delà.
export function detailRame(rame: Pick<Rame, 'vehicules'>): string {
  return groupesDeVehicules(rame.vehicules).length <= 3 ? texteComposition(rame.vehicules) : formaterMetres(longueurRame(rame.vehicules))
}

const MAX_COULEURS_RAME = 3

function entreesEngins(engins: Engin[], rames: Rame[], catalogue: TypeEngin[]): EntreeLegende[] {
  const numerotes = engins
    .filter((e) => propre(e.numero) !== '')
    .map((e) => ({ e, numero: propre(e.numero) }))
    .sort(parNumero)
    .map(({ e, numero }): EntreeLegende => ({
      genre: 'engin',
      cle: `engin:${e.id}`,
      numero,
      nom: avecNumero(numero, nomLegendeEngin(e.type, catalogue)),
      complement: propre(e.description),
      couleur: e.couleur,
      nombre: 1,
    }))
  const lignesRames = rames.map((r): EntreeLegende => {
    const couleurs: string[] = []
    for (const v of r.vehicules) if (!couleurs.includes(v.type.couleur) && couleurs.length < MAX_COULEURS_RAME) couleurs.push(v.type.couleur)
    const description = propre(r.description)
    return {
      genre: 'rame',
      cle: `rame:${r.id}`,
      numero: propre(r.numero),
      nom: avecNumero(propre(r.numero), propre(r.nom) || 'Rame'),
      complement: [description, `(${detailRame(r)})`].filter((t) => t !== '').join(' '),
      couleurPastille: r.couleur,
      couleurs,
    }
  })
  // Engins sans numéro : regroupés quand ils ont le même nom, la même couleur
  // et la même description (« Pelle RR ×2 »).
  const groupes = new Map<string, { nom: string; couleur: string; description: string; nombre: number }>()
  for (const e of engins) {
    if (propre(e.numero) !== '') continue
    const nom = nomLegendeEngin(e.type, catalogue)
    const description = propre(e.description)
    const cle = `${nom}|${e.couleur}|${description}`
    const groupe = groupes.get(cle)
    if (groupe) groupe.nombre++
    else groupes.set(cle, { nom, couleur: e.couleur, description, nombre: 1 })
  }
  const sansNumero = [...groupes.entries()].map(([cle, g]): EntreeLegende => ({
    genre: 'engin',
    cle: `engins:${cle}`,
    numero: '',
    nom: g.nombre > 1 ? `${g.nom} ×${g.nombre}` : g.nom,
    complement: g.description,
    couleur: g.couleur,
    nombre: g.nombre,
  }))
  return [...lignesRames, ...numerotes, ...sansNumero]
}

// Toutes les lignes que la légende de l'image aurait, masquées comprises,
// dans l'ordre : rames, engins numérotés, autres engins, états, coupes,
// exploitation, flèches. Ce qui est sur un calque masqué n'est pas sur la
// planche : pas dans la légende. De même pour les zones masquées du
// synoptique : ni leur état, ni leurs coupes n'y figurent.
export function entreesLegende(s: Synoptique, index: number, listes: ListesChantier): EntreeLegende[] {
  const image = s.images[index]
  if (!image) return []
  const contenu = { ...image.contenu, zones: zonesVisibles(s, image.contenu.zones) }
  // Numéros masqués sur l'image : pas de numéro dans la légende non plus ;
  // les engins pareils (même nom, couleur et description) sont regroupés.
  const affiches = enginsAffiches(s, contenu)
  const engins = s.calqueEngins.visible && s.echelle ? entreesEngins(affiches.engins, affiches.rames, listes.catalogue) : []

  const etats: EntreeLegende[] = []
  if (contenu.calques.zones.visible) {
    const presents = new Set<string>()
    for (const zone of contenu.zones) {
      const e = etatDeZone(contenu.etatsZones, listes.etatsVoie, zone.id)
      if (!e) continue
      presents.add(e.etat.id)
      if (e.avancement) presents.add(e.avancement.reste.id)
    }
    for (const etat of listes.etatsVoie) {
      if (presents.has(etat.id) && etat.rendu !== 'zone') etats.push({ genre: 'etat', cle: `etat:${etat.id}`, nom: etat.nom, complement: '', etat })
    }
  }

  const coupes: EntreeLegende[] =
    contenu.calques.zones.visible && s.echelle
      ? pasPresents(contenu).map((pas) => ({ genre: 'coupes', cle: `coupes:${pas}`, nom: texteCoupes(pas), complement: '', pas }))
      : []

  const exploitation: EntreeLegende[] =
    s.calqueExploitation.visible && contenu.calques.voies.visible
      ? etatsExploitationPresents(contenu, listes.etatsExploitation).map(({ etat, voies }) => ({
          genre: 'exploitation',
          cle: `exploitation:${etat.id}`,
          nom: etat.nom,
          complement: `(${voies.join(', ')})`,
          etatExploitation: etat,
        }))
      : []

  const fleches: EntreeLegende[] = []
  if (s.calqueFleches.visible) {
    const presents = new Set(contenu.fleches.map((f) => f.typeId))
    for (const type of listes.typesFleches) {
      if (presents.has(type.id)) fleches.push({ genre: 'fleche', cle: `fleche:${type.id}`, nom: type.nom, complement: '', type })
    }
  }
  return [...engins, ...etats, ...coupes, ...exploitation, ...fleches]
}

// Ce que la légende de l'image montre : rien si la case « Afficher la
// légende » du synoptique est décochée, et sans les lignes masquées sur cette
// image.
export function legendeAffichee(s: Synoptique, index: number, listes: ListesChantier): EntreeLegende[] {
  const image = s.images[index]
  if (!image || !s.afficherLegende) return []
  const masquees = new Set(image.legendeMasquee)
  return entreesLegende(s, index, listes).filter((e) => !masquees.has(e.cle))
}

export const modifierAfficherLegende = (s: Synoptique, afficher: boolean): Synoptique => ({ ...s, afficherLegende: afficher })

// Masque (ou réaffiche) une ligne de la légende sur une image.
export function masquerLigneLegende(s: Synoptique, index: number, cle: string, masquee: boolean): Synoptique {
  const image = s.images[index]
  if (!image || image.legendeMasquee.includes(cle) === masquee) return s
  const legendeMasquee = masquee ? [...image.legendeMasquee, cle] : image.legendeMasquee.filter((c) => c !== cle)
  return { ...s, images: s.images.map((im, i) => (i === index ? { ...im, legendeMasquee } : im)) }
}
