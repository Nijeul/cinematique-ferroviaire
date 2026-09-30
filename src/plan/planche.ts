import { largeurTexteEstimee } from './dessin.ts'
import type { Resultat } from './echelle.ts'
import type { Rectangle } from './elements.ts'
import { legendeAffichee, nomEnGras, texteEntree, type EntreeLegende, type ListesChantier } from './legende.ts'
import { rectangleAffiche, type EtapePhasage, type HeuresCreneau, type ImageSynoptique, type Synoptique } from './synoptique.ts'
import { formaterHoraire, partiesHoraire } from './temps.ts'

// Une image de synoptique mise en page comme une planche du commanditaire :
// au-dessus du plan, le bandeau de titre (fond bleu clair, au centre) et le
// créneau horaire (fond gris clair, bord rouge, à droite) ; au-dessous, à
// gauche, l'encart PHASAGE (bandeau gris foncé, étapes sur fond gris clair),
// et à droite la LÉGENDE de l'image, dans le même style (échantillons à
// gauche, textes à droite, sur plusieurs colonnes si elle est longue).
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

// Couleurs relevées sur les planches du commanditaire : communes au dessin de
// la planche et aux zones de texte des exports PowerPoint.
export const COULEURS_PLANCHE = {
  fondBandeau: '#e4eff9',
  bordBandeau: '#1f4e8c',
  fondCreneau: '#efefef',
  bordCreneau: '#e0201b',
  entetePhasage: '#76726f',
  fondPhasage: '#ececec',
  textePhasage: '#3c3c3c',
  texte: '#1c2430',
} as const

// Épaisseur du bord du bandeau et du créneau, en traits de planche (voir
// `MiseEnPage.trait`).
export const BORDS_PLANCHE = { bandeau: 2.2, creneau: 2.6 } as const

export type LigneTexte = { texte: string; x: number; y: number; taille: number; gras: boolean }

// Ligne de la légende : ses `grasJusqua` premiers caractères sont en gras (le
// nom « TTX 1 »), la suite en maigre (la description).
export type LigneMixte = { texte: string; x: number; y: number; taille: number; grasJusqua: number }

// Une ligne de la légende placée : l'échantillon (à gauche) et le texte.
export type EntreePlacee = { entree: EntreeLegende; echantillon: Rectangle; lignes: LigneMixte[] }

export type MiseEnPage = {
  // La partie du plan montrée (cadrage), et la planche entière avec ses bandes.
  carte: Rectangle
  planche: Rectangle
  // Trait de base des cadres (bords du bandeau et du créneau), et retrait du
  // texte dans les cadres, en unités du plan.
  trait: number
  retrait: number
  bandeau: { boite: Rectangle; lignes: LigneTexte[] } | null
  creneau: { boite: Rectangle; lignes: LigneTexte[] }
  // Encart PHASAGE de l'image : null s'il est vide.
  phasage: { boite: Rectangle; entete: Rectangle; titre: LigneTexte; lignes: LigneTexte[] } | null
  // Légende de l'image : null si elle est vide ou masquée.
  legende: { boite: Rectangle; entete: Rectangle; titre: LigneTexte; entrees: EntreePlacee[] } | null
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
  largeurPhasageAvecLegende: 46,
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

// ——— Légende ———

// Proportions de la légende, en tailles de texte (celle de l'encart PHASAGE).
const LEGENDE = {
  largeurEchantillon: 3.4,
  hauteurEchantillon: 0.95,
  espaceEchantillon: 0.6,
  ecartEntrees: 0.3,
  ecartColonnes: 1.2,
  // Au-delà de ces lignes en une colonne, on essaie deux ou trois colonnes.
  lignesAvantColonnes: 5,
  colonnesMax: 3,
  // Un texte plus étroit que cela (en tailles) ne vaut pas une colonne de plus.
  texteMin: 9,
} as const

type LigneAPlacer = { texte: string; grasJusqua: number }

// Coupe le texte d'une ligne de légende ; le nom en gras reste en gras sur
// les lignes où il se poursuit.
function couperEntree(e: EntreeLegende, largeur: number, taille: number): LigneAPlacer[] {
  let reste = nomEnGras(e) ? e.nom.length : 0
  return couperLignes(texteEntree(e), largeur, taille, nomEnGras(e)).map((texte) => {
    const grasJusqua = Math.max(0, Math.min(texte.length, reste))
    reste -= texte.length + 1
    return { texte, grasJusqua }
  })
}

type Colonnes = { hauteur: number; largeurColonne: number; colonnes: { entree: EntreeLegende; lignes: LigneAPlacer[] }[][] }

// Coupe une suite de hauteurs en au plus `n` morceaux consécutifs, pour que
// le plus haut soit le moins haut possible (colonnes équilibrées). Renvoie le
// nombre d'éléments de chaque morceau.
export function repartir(hauteurs: number[], n: number, ecart: number): number[] {
  const total = (debut: number, fin: number) => hauteurs.slice(debut, fin).reduce((a, b) => a + b, 0) + Math.max(0, fin - debut - 1) * ecart
  // meilleur[k][i] : la plus petite hauteur maximale pour les i premiers éléments en k morceaux.
  const m = hauteurs.length
  const meilleur: { haut: number; coupe: number }[][] = [[{ haut: 0, coupe: 0 }, ...hauteurs.map(() => ({ haut: Infinity, coupe: 0 }))]]
  for (let k = 1; k <= n; k++) {
    const ligne = [{ haut: 0, coupe: 0 }]
    for (let i = 1; i <= m; i++) {
      let choix = { haut: Infinity, coupe: 0 }
      for (let j = k - 1; j < i; j++) {
        const haut = Math.max(meilleur[k - 1][j].haut, total(j, i))
        if (haut < choix.haut - 1e-9) choix = { haut, coupe: j }
      }
      ligne.push(choix)
    }
    meilleur.push(ligne)
  }
  const tailles: number[] = []
  let i = m
  for (let k = Math.min(n, m); k >= 1 && i > 0; k--) {
    const j = meilleur[k][i].coupe
    tailles.unshift(i - j)
    i = j
  }
  return tailles
}

// Répartit les lignes en `n` colonnes, dans l'ordre, du haut en bas puis de
// gauche à droite, de hauteurs aussi égales que possible. Hauteur du corps,
// marges comprises.
function enColonnes(entrees: EntreeLegende[], n: number, largeur: number, m: Mesures): Colonnes {
  const taille = m.phasage
  const lh = PROPORTIONS.interligne * taille
  const ecart = LEGENDE.ecartEntrees * taille
  const largeurColonne = (largeur - 2 * m.retrait - (n - 1) * LEGENDE.ecartColonnes * taille) / n
  const largeurTexte = largeurColonne - (LEGENDE.largeurEchantillon + LEGENDE.espaceEchantillon) * taille
  const coupees = entrees.map((entree) => ({ entree, lignes: couperEntree(entree, largeurTexte, taille) }))
  const colonnes: (typeof coupees)[] = []
  let debut = 0
  for (const nombre of repartir(coupees.map((e) => e.lignes.length * lh), n, ecart)) {
    colonnes.push(coupees.slice(debut, debut + nombre))
    debut += nombre
  }
  const hauteurColonne = (c: typeof coupees) => c.reduce((h, e) => h + e.lignes.length * lh, 0) + Math.max(0, c.length - 1) * ecart
  return { largeurColonne, colonnes, hauteur: Math.max(0, ...colonnes.map(hauteurColonne)) + 2 * m.retrait }
}

// Le nombre de colonnes : une seule tant que la légende est courte ; sinon
// celui qui donne la légende la moins haute, sans colonnes trop étroites.
function colonnesLegende(entrees: EntreeLegende[], largeur: number, m: Mesures): Colonnes {
  const une = enColonnes(entrees, 1, largeur, m)
  const lignes = une.colonnes.flat().reduce((n, e) => n + e.lignes.length, 0)
  if (lignes <= LEGENDE.lignesAvantColonnes) return une
  let meilleure = une
  for (let n = 2; n <= LEGENDE.colonnesMax; n++) {
    const essai = enColonnes(entrees, n, largeur, m)
    const texte = essai.largeurColonne - (LEGENDE.largeurEchantillon + LEGENDE.espaceEchantillon) * m.phasage
    if (texte >= LEGENDE.texteMin * m.phasage && essai.hauteur < meilleure.hauteur - 1e-9) meilleure = essai
  }
  return meilleure
}

function placerLegende(c: Colonnes, x: number, y: number, m: Mesures): EntreePlacee[] {
  const taille = m.phasage
  const lh = PROPORTIONS.interligne * taille
  const placees: EntreePlacee[] = []
  c.colonnes.forEach((colonne, i) => {
    const x0 = x + m.retrait + i * (c.largeurColonne + LEGENDE.ecartColonnes * taille)
    const xTexte = x0 + (LEGENDE.largeurEchantillon + LEGENDE.espaceEchantillon) * taille
    let haut = y + m.retrait
    for (const { entree, lignes } of colonne) {
      // L'échantillon est centré sur la première ligne du texte.
      const milieu = haut + 0.78 * lh - 0.35 * taille
      const h = LEGENDE.hauteurEchantillon * taille
      placees.push({
        entree,
        echantillon: { x: x0, y: milieu - h / 2, largeur: LEGENDE.largeurEchantillon * taille, hauteur: h },
        lignes: lignes.map((l, k) => ({ ...l, x: xTexte, y: haut + (k + 0.78) * lh, taille })),
      })
      haut += lignes.length * lh + LEGENDE.ecartEntrees * taille
    }
  })
  return placees
}

// Lignes du bandeau de titre, en gras, centrées, dans un bandeau de largeur
// donnée.
function lignesBandeau(texte: string, largeur: number, m: Mesures): string[] {
  return texte.trim() === '' ? [] : couperLignes(texte.trim(), largeur - 2 * m.retrait, m.titre, true)
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

// Écart entre le créneau et le bord droit du plan, en unités.
const ECART_CRENEAU = 2

export function miseEnPage(s: Synoptique, index: number, listes: ListesChantier): MiseEnPage {
  const carte = rectangleAffiche(s)
  const image = s.images[index]
  // Avec une légende, l'encart PHASAGE se resserre à gauche et laisse à la
  // légende un peu plus de la moitié de la largeur.
  const legendes = s.images.map((_, i) => legendeAffichee(s, i, listes))
  const avecLegende = legendes.some((l) => l.length > 0)
  const base = mesures(carte)
  const m = avecLegende ? { ...base, largeurPhasage: Math.min(PROPORTIONS.largeurPhasageAvecLegende * base.u, carte.largeur * 0.46) } : base
  const largeurLegende = carte.largeur - m.largeurPhasage - m.marge

  // Bande du haut : assez haute pour le bandeau et pour le plus haut des
  // créneaux du synoptique. Le bandeau, centré, s'arrête avant le plus large
  // des créneaux (à droite), pour ne pas le toucher (sauf sur un cadrage très
  // étroit, où il garde au moins le quart de la largeur).
  const creneaux = s.images.map((im) => contenuCreneau(s.t0, im, m))
  const gaucheCreneaux = carte.largeur - ECART_CRENEAU * m.u - Math.max(...creneaux.map((c) => c.largeur))
  const largeurBandeau = Math.max(
    carte.largeur * 0.25,
    Math.min(m.largeurBandeau, carte.largeur * 0.7, 2 * (gaucheCreneaux - m.marge - carte.largeur / 2)),
  )
  const bandeauLignes = lignesBandeau(s.bandeau, largeurBandeau, m)
  const hauteurBandeau = bandeauLignes.length > 0 ? bandeauLignes.length * PROPORTIONS.interligne * m.titre + 2 * m.retrait : 0
  const hauteurHaut = Math.max(hauteurBandeau, ...creneaux.map((c) => c.hauteur)) + 2 * m.marge
  const haut = carte.y - hauteurHaut

  // Bande du bas : la hauteur du plus grand encart PHASAGE ou de la plus
  // grande légende du synoptique ; pas de bande si aucune image n'a ni étape
  // ni légende.
  const corps = Math.max(0, ...s.images.map((im) => (im.phasage.length > 0 ? lignesPhasage(im.phasage, m).length : 0)))
  const colonnes = legendes.map((l) => (l.length > 0 ? colonnesLegende(l, largeurLegende, m) : null))
  const corpsLegende = Math.max(0, ...colonnes.map((c) => c?.hauteur ?? 0))
  const hauteurBas =
    corps > 0 || corpsLegende > 0 ? hauteurEntetePhasage(m) + Math.max(corps > 0 ? hauteurCorpsPhasage(corps, m) : 0, corpsLegende) : 0

  const planche = { x: carte.x, y: haut, largeur: carte.largeur, hauteur: hauteurHaut + carte.hauteur + hauteurBas }

  const centreVertical = (hauteur: number) => haut + (hauteurHaut - hauteur) / 2
  const aligner = (lignes: { texte: string; gras: boolean }[], x: number, y: number, taille: number): LigneTexte[] =>
    lignes.map((l, i) => ({ texte: l.texte, gras: l.gras, taille, x, y: y + (i + 0.78) * PROPORTIONS.interligne * taille }))

  let bandeau: MiseEnPage['bandeau'] = null
  if (bandeauLignes.length > 0) {
    const boite = {
      x: carte.x + (carte.largeur - largeurBandeau) / 2,
      y: centreVertical(hauteurBandeau),
      largeur: largeurBandeau,
      hauteur: hauteurBandeau,
    }
    const lignes = aligner(
      bandeauLignes.map((texte) => ({ texte, gras: true })),
      boite.x + largeurBandeau / 2,
      boite.y + m.retrait,
      m.titre,
    )
    bandeau = { boite, lignes }
  }

  const c = creneaux[index]
  const boiteCreneau = { x: carte.x + carte.largeur - ECART_CRENEAU * m.u - c.largeur, y: centreVertical(c.hauteur), largeur: c.largeur, hauteur: c.hauteur }
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

  let legende: MiseEnPage['legende'] = null
  const colonnesImage = colonnes[index]
  if (colonnesImage) {
    const y = carte.y + carte.hauteur
    const x = carte.x + carte.largeur - largeurLegende
    const entete = { x, y, largeur: largeurLegende, hauteur: hauteurEntetePhasage(m) }
    legende = {
      boite: { x, y, largeur: largeurLegende, hauteur: hauteurBas },
      entete,
      titre: { texte: 'LÉGENDE', x: x + largeurLegende / 2, y: y + entete.hauteur * 0.5 + m.phasage * 0.36, taille: m.phasage, gras: true },
      entrees: placerLegende(colonnesImage, x, y + entete.hauteur, m),
    }
  }

  return { carte, planche, trait: carte.largeur / 700, retrait: m.retrait, bandeau, creneau, phasage, legende }
}
