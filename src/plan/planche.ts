import { largeurTexteEstimee } from './dessin.ts'
import type { Resultat } from './echelle.ts'
import type { Rectangle } from './elements.ts'
import { rectangleAffiche, type EtapePhasage, type HeuresCreneau, type ImageSynoptique, type Synoptique } from './synoptique.ts'
import { formaterHoraire, partiesHoraire } from './temps.ts'

// Une image de synoptique mise en page comme une planche du commanditaire :
// au-dessus du plan, le bandeau de titre (fond bleu clair, au centre) et le
// créneau horaire (fond gris clair, bord rouge, à droite) ; au-dessous, à
// gauche, l'encart PHASAGE (bandeau gris foncé, étapes sur fond gris clair).
// Ces cadres sont posés dans des bandes au-dessus et au-dessous du plan,
// comme sur ses planches : ils ne masquent jamais les voies ni les zones.
// Les bandes ont la même hauteur sur toutes les images du synoptique, pour
// qu'on les feuillette sans que le plan saute.
//
// Aussi : les étapes de l'encart (ajout, numéro proposé, modification) et le
// texte du créneau.

// ——— Encart PHASAGE ———

// Numéro proposé pour une nouvelle étape : le plus grand numéro déjà donné
// jusqu'à cette image comprise, plus 1 (la numérotation est continue sur tout
// le synoptique).
export function numeroEtapePropose(s: Synoptique, index: number): number {
  const numeros = s.images.slice(0, index + 1).flatMap((im) => im.phasage.map((e) => e.numero))
  return Math.max(0, ...numeros) + 1
}

const avecPhasage = (s: Synoptique, index: number, phasage: EtapePhasage[]): Synoptique => ({
  ...s,
  images: s.images.map((im, i) => (i === index ? { ...im, phasage } : im)),
})

export function ajouterEtape(s: Synoptique, index: number): { synoptique: Synoptique; position: number } {
  const image = s.images[index]
  if (!image) return { synoptique: s, position: -1 }
  const phasage = [...image.phasage, { numero: numeroEtapePropose(s, index), libelle: '' }]
  return { synoptique: avecPhasage(s, index, phasage), position: phasage.length - 1 }
}

export function erreurNumeroEtape(numero: number): string | null {
  return Number.isInteger(numero) && numero >= 1 && numero <= 9999 ? null : "Le numéro d'étape est un nombre entier à partir de 1."
}

export function modifierEtape(s: Synoptique, index: number, position: number, champs: Partial<EtapePhasage>): Resultat<Synoptique> {
  const image = s.images[index]
  if (!image?.phasage[position]) return { ok: true, valeur: s }
  if (champs.numero !== undefined) {
    const erreur = erreurNumeroEtape(champs.numero)
    if (erreur) return { ok: false, erreur }
  }
  return { ok: true, valeur: avecPhasage(s, index, image.phasage.map((e, i) => (i === position ? { ...e, ...champs } : e))) }
}

export function supprimerEtape(s: Synoptique, index: number, position: number): Synoptique {
  const image = s.images[index]
  if (!image?.phasage[position]) return s
  return avecPhasage(s, index, image.phasage.filter((_, i) => i !== position))
}

export function deplacerEtape(s: Synoptique, index: number, position: number, vers: -1 | 1): Synoptique {
  const image = s.images[index]
  const j = position + vers
  if (!image?.phasage[position] || j < 0 || j >= image.phasage.length) return s
  const phasage = [...image.phasage]
  ;[phasage[position], phasage[j]] = [phasage[j], phasage[position]]
  return avecPhasage(s, index, phasage)
}

// « 3 – Dépose des rails… » : la première ligne du libellé porte le numéro.
export const texteEtape = (e: EtapePhasage): string => `${e.numero} – ${e.libelle}`

// ——— Créneau horaire ———

export function modifierCreneau(s: Synoptique, index: number, champs: { titre?: string; heures?: HeuresCreneau }): Synoptique {
  if (!s.images[index]) return s
  return { ...s, images: s.images.map((im, i) => (i === index ? { ...im, ...champs } : im)) }
}

// Les lignes du créneau : le titre (s'il y en a un), puis les heures.
// « Ve/Sa » puis « 00h30 – 03h30 » quand début et fin sont le même jour (ou
// la même nuit), « Ve 22h30 – » puis « Ve/Sa 01h30 » sinon ; « Sa 20h00 »
// pour le début seul. Sans titre, les heures s'affichent toujours.
export function lignesCreneau(t0: string, image: Pick<ImageSynoptique, 'debut' | 'fin' | 'titre' | 'heures'>): { titre: string[]; heures: string[] } {
  const titre = image.titre.trim() === '' ? [] : image.titre.trim().split('\n').map((l) => l.trim())
  let heures: string[]
  if (image.heures === 'aucune' && titre.length > 0) heures = []
  else if (image.heures === 'debut') heures = [formaterHoraire(t0, image.debut)]
  else {
    const a = partiesHoraire(t0, image.debut)
    const b = partiesHoraire(t0, image.fin)
    if (!a || !b) heures = ['?']
    else if (a.jour === b.jour) heures = [a.jour, `${a.heure} – ${b.heure}`]
    else heures = [`${a.jour} ${a.heure} –`, `${b.jour} ${b.heure}`]
  }
  return { titre, heures }
}

// ——— Découpage d'un texte en lignes ———

// Coupe un texte en lignes d'au plus `largeurMax` (estimée), aux espaces ;
// les retours à la ligne tapés sont gardés. Un mot trop long reste entier.
export function couperLignes(texte: string, largeurMax: number, taille: number, gras = false): string[] {
  const lignes: string[] = []
  for (const paragraphe of texte.split('\n')) {
    const mots = paragraphe.split(/\s+/).filter((m) => m !== '')
    if (mots.length === 0) {
      lignes.push('')
      continue
    }
    let ligne = mots[0]
    for (const mot of mots.slice(1)) {
      const essai = `${ligne} ${mot}`
      if (largeurTexteEstimee(essai, taille, gras) <= largeurMax) ligne = essai
      else {
        lignes.push(ligne)
        ligne = mot
      }
    }
    lignes.push(ligne)
  }
  return lignes
}

// ——— Mise en page ———

export type LigneTexte = { texte: string; x: number; y: number; taille: number; gras: boolean }

export type MiseEnPage = {
  // La partie du plan montrée (cadrage), et la planche entière avec ses bandes.
  carte: Rectangle
  planche: Rectangle
  bandeau: { boite: Rectangle; lignes: LigneTexte[] } | null
  creneau: { boite: Rectangle; lignes: LigneTexte[] }
  // Encart PHASAGE de l'image : null s'il est vide.
  phasage: { boite: Rectangle; entete: Rectangle; titre: LigneTexte; lignes: LigneTexte[] } | null
}

// Proportions relevées sur les planches du commanditaire, en centièmes de la
// largeur du plan montré (textes un peu plus grands, pour rester lisibles à
// l'écran, où la planche est plus petite qu'une diapositive).
const PROPORTIONS = {
  texteTitre: 1.75,
  texteCreneau: 1.75,
  textePhasage: 1.45,
  marge: 1.1,
  retrait: 0.9,
  largeurBandeau: 56,
  largeurCreneauMin: 14,
  largeurCreneauMax: 22,
  largeurPhasage: 56,
  interligne: 1.3,
} as const

// Une unité = un centième de la largeur du plan montré (un cadrage très haut
// et étroit compte comme s'il était au format d'une diapositive).
const unite = (carte: Rectangle): number => Math.max(carte.largeur, carte.hauteur * 1.6) / 100

type Mesures = ReturnType<typeof mesures>

function mesures(carte: Rectangle) {
  const u = unite(carte)
  const p = PROPORTIONS
  return {
    u,
    marge: p.marge * u,
    retrait: p.retrait * u,
    titre: p.texteTitre * u,
    creneau: p.texteCreneau * u,
    phasage: p.textePhasage * u,
    largeurBandeau: p.largeurBandeau * u,
    largeurPhasage: Math.min(p.largeurPhasage * u, carte.largeur),
  }
}

// Lignes du bandeau de titre, en gras, centrées.
function lignesBandeau(texte: string, m: Mesures): string[] {
  return texte.trim() === '' ? [] : couperLignes(texte.trim(), m.largeurBandeau - 2 * m.retrait, m.titre, true)
}

// Contenu du créneau : lignes et largeur de la boîte.
function contenuCreneau(t0: string, image: ImageSynoptique, m: Mesures) {
  const { titre, heures } = lignesCreneau(t0, image)
  const largeurMax = PROPORTIONS.largeurCreneauMax * m.u - 2 * m.retrait
  const lignes = [
    ...titre.flatMap((l) => couperLignes(l, largeurMax, m.creneau, true)).map((texte) => ({ texte, gras: true })),
    // Sous un titre, les heures sont en maigre, pour qu'on distingue les deux.
    ...heures.map((texte) => ({ texte, gras: titre.length === 0 })),
  ]
  const plusLongue = Math.max(...lignes.map((l) => largeurTexteEstimee(l.texte, m.creneau, l.gras)))
  const largeur = Math.min(PROPORTIONS.largeurCreneauMax * m.u, Math.max(PROPORTIONS.largeurCreneauMin * m.u, plusLongue + 2 * m.retrait))
  return { lignes, largeur, hauteur: lignes.length * PROPORTIONS.interligne * m.creneau + 2 * m.retrait * 0.8 }
}

// Lignes de l'encart PHASAGE : chaque étape commence par son numéro ; les
// suites de ligne repartent au bord, comme sur les planches.
function lignesPhasage(phasage: EtapePhasage[], m: Mesures): string[] {
  return phasage.flatMap((e) => couperLignes(texteEtape(e), m.largeurPhasage - 2 * m.retrait, m.phasage))
}

const hauteurEntetePhasage = (m: Mesures) => m.phasage * 1.9
const hauteurCorpsPhasage = (lignes: number, m: Mesures) => lignes * PROPORTIONS.interligne * m.phasage + 2 * m.retrait

export function miseEnPage(s: Synoptique, index: number): MiseEnPage {
  const carte = rectangleAffiche(s)
  const m = mesures(carte)
  const image = s.images[index]

  // Bande du haut : assez haute pour le bandeau et pour le plus haut des
  // créneaux du synoptique.
  const bandeauLignes = lignesBandeau(s.bandeau, m)
  const hauteurBandeau = bandeauLignes.length > 0 ? bandeauLignes.length * PROPORTIONS.interligne * m.titre + 2 * m.retrait : 0
  const creneaux = s.images.map((im) => contenuCreneau(s.t0, im, m))
  const hauteurHaut = Math.max(hauteurBandeau, ...creneaux.map((c) => c.hauteur)) + 2 * m.marge
  const haut = carte.y - hauteurHaut

  // Bande du bas : la hauteur du plus grand encart PHASAGE du synoptique ;
  // pas de bande si aucune image n'a d'étape.
  const corps = Math.max(0, ...s.images.map((im) => (im.phasage.length > 0 ? lignesPhasage(im.phasage, m).length : 0)))
  const hauteurBas = corps > 0 ? hauteurEntetePhasage(m) + hauteurCorpsPhasage(corps, m) : 0

  const planche = { x: carte.x, y: haut, largeur: carte.largeur, hauteur: hauteurHaut + carte.hauteur + hauteurBas }

  const centreVertical = (hauteur: number) => haut + (hauteurHaut - hauteur) / 2
  const aligner = (lignes: { texte: string; gras: boolean }[], x: number, y: number, taille: number): LigneTexte[] =>
    lignes.map((l, i) => ({ texte: l.texte, gras: l.gras, taille, x, y: y + (i + 0.78) * PROPORTIONS.interligne * taille }))

  let bandeau: MiseEnPage['bandeau'] = null
  if (bandeauLignes.length > 0) {
    const largeur = Math.min(m.largeurBandeau, carte.largeur * 0.7)
    const boite = { x: carte.x + (carte.largeur - largeur) / 2, y: centreVertical(hauteurBandeau), largeur, hauteur: hauteurBandeau }
    const lignes = aligner(
      bandeauLignes.map((texte) => ({ texte, gras: true })),
      boite.x + largeur / 2,
      boite.y + m.retrait,
      m.titre,
    )
    bandeau = { boite, lignes }
  }

  const c = creneaux[index]
  const boiteCreneau = { x: carte.x + carte.largeur - 2 * m.u - c.largeur, y: centreVertical(c.hauteur), largeur: c.largeur, hauteur: c.hauteur }
  const creneau = { boite: boiteCreneau, lignes: aligner(c.lignes, boiteCreneau.x + c.largeur / 2, boiteCreneau.y + m.retrait * 0.8, m.creneau) }

  let phasage: MiseEnPage['phasage'] = null
  if (image && image.phasage.length > 0) {
    const y = carte.y + carte.hauteur
    const boite = { x: carte.x, y, largeur: m.largeurPhasage, hauteur: hauteurBas }
    const entete = { x: carte.x, y, largeur: m.largeurPhasage, hauteur: hauteurEntetePhasage(m) }
    const titre: LigneTexte = { texte: 'PHASAGE', x: carte.x + m.largeurPhasage / 2, y: y + entete.hauteur * 0.5 + m.phasage * 0.36, taille: m.phasage, gras: true }
    const lignes = aligner(
      lignesPhasage(image.phasage, m).map((texte) => ({ texte, gras: false })),
      carte.x + m.retrait,
      y + entete.hauteur + m.retrait,
      m.phasage,
    )
    phasage = { boite, entete, titre, lignes }
  }

  return { carte, planche, bandeau, creneau, phasage }
}
