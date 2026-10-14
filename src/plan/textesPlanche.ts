import { commentaireSousPointeur, miseEnPageCommentaire, modifierCommentairesImage, validerTexteCommentaire } from './commentaires.ts'
import { largeurTexteEstimee } from './dessin.ts'
import type { Rectangle } from './elements.ts'
import {
  flecheSousPointeur,
  modifierFleche,
  modifierFlechesImage,
  placeLibelleFleche,
  tailleLibelleFleche,
  typeFlecheParId,
  uniteFleche,
} from './fleches.ts'
import type { ListesChantier } from './legende.ts'
import type { Resultat } from './echelle.ts'
import { COULEURS_PLANCHE, INTERLIGNE_PLANCHE, lignesCreneau, miseEnPage, modifierCreneau, modifierEtape } from './planche.ts'
import type { Point } from './projet.ts'
import { modifierHorairesImage, projetDeImage, rectangleAffiche, type Synoptique } from './synoptique.ts'
import { formaterPlage, lirePlageTapee } from './temps.ts'

// Les textes d'une planche qu'on modifie en double-cliquant dessus, à leur
// place sur l'image : les commentaires, les libellés des flèches, le bandeau
// de titre (commun au synoptique), le titre du créneau et chaque étape de
// l'encart PHASAGE. Un même mécanisme pour tous : le texte s'ouvre dans un
// champ de la même taille, police et couleur ; Entrée valide (Maj+Entrée va à
// la ligne, sauf pour un libellé de flèche, qui tient sur une ligne), Échap
// annule, un clic ailleurs valide ; la modification s'annule d'un seul Ctrl+Z.
// Les heures du créneau se tapent aussi (« 22h30 – 01h15 ») : elles changent
// le début et la fin de l'image, toujours en minutes depuis T0 ; une saisie
// illisible ou hors du synoptique est refusée avec un message, le champ reste
// ouvert. Le numéro d'une étape ne se tape pas : il reste affiché devant.

export type TexteEditable =
  | { genre: 'commentaire'; id: string }
  | { genre: 'fleche'; id: string }
  | { genre: 'bandeau' }
  | { genre: 'creneau' }
  | { genre: 'heures' }
  | { genre: 'etape'; position: number }

// ——— Touches ———

export type ActionToucheEdition = 'valider' | 'aLaLigne' | 'annuler' | null

export function actionToucheEdition(touche: string, maj: boolean, multiligne = true): ActionToucheEdition {
  if (touche === 'Escape') return 'annuler'
  if (touche === 'Enter') return maj && multiligne ? 'aLaLigne' : 'valider'
  return null
}

// Un libellé de flèche et les heures tiennent sur une ligne ; les autres textes en ont plusieurs.
export const texteMultiligne = (cible: TexteEditable): boolean => cible.genre !== 'fleche' && cible.genre !== 'heures'

// ——— Le texte et sa modification ———

// Le texte modifiable, tel qu'il est enregistré (pour une étape : le libellé,
// sans son numéro) ; null si la cible n'existe pas (ou plus) dans l'image.
export function texteDe(s: Synoptique, index: number, cible: TexteEditable): string | null {
  const image = s.images[index]
  if (!image) return null
  switch (cible.genre) {
    case 'commentaire':
      return image.contenu.commentaires.find((c) => c.id === cible.id)?.texte ?? null
    case 'fleche':
      return image.contenu.fleches.find((f) => f.id === cible.id)?.libelle ?? null
    case 'bandeau':
      return s.bandeau
    case 'creneau':
      return image.titre
    case 'heures': {
      // Les heures telles qu'affichées, sur une ligne ; null si le créneau ne les montre pas.
      const { heures } = lignesCreneau(s.t0, image)
      return heures.length > 0 ? heures.join(' ') : null
    }
    case 'etape':
      return image.phasage[cible.position]?.libelle ?? null
  }
}

// Le texte tapé sur l'image, validé : le même synoptique s'il n'a pas changé
// (rien à annuler), sinon une seule modification (un seul Ctrl+Z). Comme dans
// les panneaux de droite : une étape vidée reste dans l'encart (« 3 – ») ;
// un bandeau, un titre de créneau ou un libellé vides ne s'affichent plus.
export function appliquerTexte(s: Synoptique, index: number, cible: TexteEditable, texte: string): Synoptique {
  const r = verifierTexte(s, index, cible, texte)
  return r.ok ? r.valeur : s
}

// Les heures du créneau tapées sur la planche : nouveau début et nouvelle fin
// de l'image (une seule heure si le créneau n'affiche que le début), dans les
// bornes du synoptique ; sinon, ce qui ne va pas, et ce qui a été compris.
export function appliquerHeures(s: Synoptique, index: number, texte: string): Resultat<Synoptique> {
  const image = s.images[index]
  if (!image) return { ok: true, valeur: s }
  const lu = lirePlageTapee(s.t0, texte, image, image.heures === 'debut')
  if (!lu.ok) return lu
  const { debut, fin } = lu.valeur
  if (debut === image.debut && fin === image.fin) return { ok: true, valeur: s }
  const r = modifierHorairesImage(s, index, { debut, fin })
  return r.ok ? r : { ok: false, erreur: `${r.erreur} Compris : ${formaterPlage(s.t0, debut, fin)}.` }
}

// Comme appliquerTexte, mais dit pourquoi un texte est refusé (seules les
// heures peuvent l'être) : le champ reste alors ouvert.
export function verifierTexte(s: Synoptique, index: number, cible: TexteEditable, texte: string): Resultat<Synoptique> {
  const actuel = texteDe(s, index, cible)
  if (actuel === null) return { ok: true, valeur: s }
  // Un libellé de flèche tient sur une ligne : un retour collé devient une espace.
  const nouveau = texteMultiligne(cible) ? texte : texte.replace(/\s*[\r\n]+\s*/g, ' ')
  if (nouveau === actuel) return { ok: true, valeur: s }
  if (cible.genre === 'heures') return appliquerHeures(s, index, nouveau)
  return { ok: true, valeur: remplacerTexte(s, index, cible, nouveau) }
}

function remplacerTexte(s: Synoptique, index: number, cible: Exclude<TexteEditable, { genre: 'heures' }>, nouveau: string): Synoptique {
  switch (cible.genre) {
    case 'commentaire':
      return modifierCommentairesImage(s, index, (l) => validerTexteCommentaire(l, cible.id, nouveau))
    case 'fleche':
      return modifierFlechesImage(s, index, (l) => modifierFleche(l, cible.id, { libelle: nouveau }))
    case 'bandeau':
      return { ...s, bandeau: nouveau }
    case 'creneau':
      return modifierCreneau(s, index, { titre: nouveau })
    case 'etape': {
      const r = modifierEtape(s, index, cible.position, { libelle: nouveau })
      return r.ok ? r.valeur : s
    }
  }
}

// ——— Le champ de saisie, à la place du texte ———

export type ChampEdition = {
  // Rectangle du champ en unités du plan, avant rotation.
  boite: Rectangle
  // Rotation du champ (libellé le long d'une flèche), en degrés, autour d'un point.
  rotation: { angle: number; x: number; y: number } | null
  // Retraits intérieurs, taille et interligne du texte, en unités du plan.
  retrait: { x: number; y: number }
  taille: number
  interligne: number
  gras: boolean
  couleur: string
  fond: string
  centre: boolean
  // Texte fixe devant le champ (numéro d'une étape : « 3 – »).
  prefixe: string
  multiligne: boolean
  // Le texte passe à la ligne au bord du cadre (bandeau, créneau, PHASAGE),
  // ou le cadre s'élargit avec lui (commentaire, libellé de flèche).
  coupe: boolean
}

// Un texte vide garde un champ d'une lettre de large, à l'endroit où le
// texte s'afficherait.
const TEXTE_TEMOIN = 'M'
const temoin = (texte: string): string => (texte.trim() === '' ? TEXTE_TEMOIN : texte)

// La planche dessinée pendant la frappe : avec le texte en cours (le cadre
// grandit avec lui), ou un témoin d'une lettre s'il est vide, pour que le
// champ garde sa place. Le texte édité n'est pas dessiné : le champ le remplace.
// Les heures, elles, ne se dessinent avec le texte en cours que s'il est valable.
export const syntheseEdition = (s: Synoptique, index: number, cible: TexteEditable, texte: string): Synoptique =>
  appliquerTexte(s, index, cible, cible.genre === 'heures' ? texte : temoin(texte))

// Place, taille et style du champ de saisie, d'après la planche mise en page
// avec le texte en cours. null si la cible n'existe pas ou ne se voit pas.
export function champEdition(s: Synoptique, index: number, listes: ListesChantier, cible: TexteEditable, texte: string): ChampEdition | null {
  const apercu = syntheseEdition(s, index, cible, texte)
  const image = apercu.images[index]
  if (!image || texteDe(apercu, index, cible) === null) return null
  const coupe = cible.genre !== 'commentaire' && cible.genre !== 'fleche'
  const base = { rotation: null, prefixe: '', multiligne: texteMultiligne(cible), coupe }
  if (cible.genre === 'commentaire') {
    const c = image.contenu.commentaires.find((x) => x.id === cible.id)!
    const m = miseEnPageCommentaire(c, apercu)
    // Un peu de place en plus à droite et en bas pour la lettre suivante.
    const boite = { ...m.boite, largeur: m.boite.largeur + m.taille * 1.5, hauteur: m.boite.hauteur + m.interligne * 0.5 }
    return { ...base, boite, retrait: { x: m.retrait, y: m.retrait * 0.7 }, taille: m.taille, interligne: m.interligne, gras: c.gras, couleur: c.couleur, fond: '#ffffff', centre: false }
  }
  if (cible.genre === 'fleche') {
    const planche = projetDeImage(apercu, image)
    const f = planche.fleches.find((x) => x.id === cible.id)!
    const type = typeFlecheParId(listes.typesFleches, f.typeId)
    const taille = tailleLibelleFleche(planche)
    const place = type ? placeLibelleFleche(f, type, uniteFleche(planche), taille) : null
    if (!place) return null
    const interligne = taille * 1.25
    const retrait = { x: taille * 0.3, y: taille * 0.1 }
    const largeur = largeurTexteEstimee(f.libelle.trim(), taille, true) + 2 * retrait.x + taille * 1.5
    const hauteur = interligne + 2 * retrait.y
    // La ligne de base du libellé tombe à ~0,97 taille sous le haut de la ligne.
    const boite = { x: place.x - largeur / 2, y: place.y - retrait.y - taille * 0.97, largeur, hauteur }
    return {
      ...base,
      boite,
      rotation: { angle: place.angle, x: place.x, y: place.y },
      retrait,
      taille,
      interligne,
      gras: true,
      couleur: COULEURS_PLANCHE.texte,
      fond: '#ffffff',
      centre: true,
    }
  }
  const page = miseEnPage(apercu, index, listes)
  if (cible.genre === 'bandeau') {
    if (!page.bandeau) return null
    const taille = page.bandeau.lignes[0].taille
    return {
      ...base,
      boite: page.bandeau.boite,
      retrait: { x: page.retrait, y: page.retrait },
      taille,
      interligne: taille * INTERLIGNE_PLANCHE,
      gras: true,
      couleur: COULEURS_PLANCHE.texte,
      fond: COULEURS_PLANCHE.fondBandeau,
      centre: true,
    }
  }
  if (cible.genre === 'creneau') {
    const { boite, lignes, titre } = page.creneau
    const taille = lignes[0].taille
    const interligne = taille * INTERLIGNE_PLANCHE
    // Le champ couvre les lignes du titre ; les heures restent dessinées dessous.
    return {
      ...base,
      boite: { x: boite.x, y: boite.y, largeur: boite.largeur, hauteur: page.retrait * 0.8 + Math.max(1, titre) * interligne },
      retrait: { x: page.retrait * 0.5, y: page.retrait * 0.8 },
      taille,
      interligne,
      gras: true,
      couleur: COULEURS_PLANCHE.texte,
      fond: COULEURS_PLANCHE.fondCreneau,
      centre: true,
    }
  }
  if (cible.genre === 'heures') {
    const { boite, lignes, titre } = page.creneau
    const taille = lignes[0].taille
    const interligne = taille * INTERLIGNE_PLANCHE
    // Le champ couvre les lignes des heures (deux au moins, pour la saisie sur une ligne qui passe à la ligne).
    return {
      ...base,
      boite: { x: boite.x, y: boite.y + page.retrait * 0.8 + titre * interligne, largeur: boite.largeur, hauteur: Math.max(2, lignes.length - titre) * interligne },
      retrait: { x: page.retrait * 0.5, y: 0 },
      taille,
      interligne,
      gras: lignes[titre]?.gras ?? true,
      couleur: COULEURS_PLANCHE.texte,
      fond: COULEURS_PLANCHE.fondCreneau,
      centre: true,
    }
  }
  const p = page.phasage
  const etape = p?.etapes[cible.position]
  if (!p || !etape) return null
  const taille = p.titre.taille
  const interligne = taille * INTERLIGNE_PLANCHE
  const prefixe = `${image.phasage[cible.position].numero} – `
  const haut = p.entete.y + p.entete.hauteur + page.retrait + etape.debut * interligne
  return {
    ...base,
    boite: { x: p.boite.x, y: haut, largeur: p.boite.largeur, hauteur: (etape.fin - etape.debut) * interligne },
    retrait: { x: page.retrait, y: 0 },
    taille,
    interligne,
    gras: false,
    couleur: COULEURS_PLANCHE.textePhasage,
    fond: COULEURS_PLANCHE.fondPhasage,
    centre: false,
    prefixe,
  }
}

// ——— Le texte sous le pointeur ———

const dans = (r: Rectangle, p: Point, marge = 0): boolean =>
  p.x >= r.x - marge && p.x <= r.x + r.largeur + marge && p.y >= r.y - marge && p.y <= r.y + r.hauteur + marge

// Ce qui se double-clique, du dessus vers le dessous : dans le cadre de
// l'image, un commentaire, puis le libellé ou le trait d'une flèche (calques
// visibles et non verrouillés) ; autour, le bandeau (même vide : à sa place),
// le titre ou les heures du créneau, une étape du PHASAGE. `tolerance` en unités du plan.
export function texteSousPointeur(
  s: Synoptique,
  index: number,
  listes: ListesChantier,
  p: Point,
  tolerance: number,
  actifs: { commentaires: boolean; fleches: boolean },
): TexteEditable | null {
  const image = s.images[index]
  if (!image) return null
  if (dans(rectangleAffiche(s), p)) {
    if (actifs.commentaires) {
      const id = commentaireSousPointeur(image.contenu.commentaires, s, p, tolerance)
      if (id) return { genre: 'commentaire', id }
    }
    if (actifs.fleches) {
      const fleches = image.contenu.fleches
      // Un libellé (même vide, à sa place), puis le trait.
      for (let i = fleches.length - 1; i >= 0; i--) {
        const cible: TexteEditable = { genre: 'fleche', id: fleches[i].id }
        const champ = champEdition(s, index, listes, cible, fleches[i].libelle)
        if (!champ?.rotation) continue
        const { angle, x, y } = champ.rotation
        const a = (-angle * Math.PI) / 180
        const dx = p.x - x
        const dy = p.y - y
        const q = { x: x + dx * Math.cos(a) - dy * Math.sin(a), y: y + dx * Math.sin(a) + dy * Math.cos(a) }
        if (dans(champ.boite, q, tolerance)) return cible
      }
      const id = flecheSousPointeur(fleches, listes.typesFleches, uniteFleche(projetDeImage(s, image)), p, tolerance)
      if (id) return { genre: 'fleche', id }
    }
    return null
  }
  const page = miseEnPage(s, index, listes)
  const bandeau = page.bandeau?.boite ?? miseEnPage({ ...s, bandeau: TEXTE_TEMOIN }, index, listes).bandeau?.boite
  if (bandeau && dans(bandeau, p)) return { genre: 'bandeau' }
  const cr = page.creneau
  if (dans(cr.boite, p)) {
    // Les heures, sous le titre (sans titre, tout le créneau : ce sont les heures).
    const hautHeures = cr.boite.y + page.retrait * 0.8 + cr.titre * cr.lignes[0].taille * INTERLIGNE_PLANCHE
    return cr.lignes.length > cr.titre && (cr.titre === 0 || p.y >= hautHeures) ? { genre: 'heures' } : { genre: 'creneau' }
  }
  const ph = page.phasage
  if (ph && dans(ph.boite, p) && p.y > ph.entete.y + ph.entete.hauteur) {
    const lh = ph.titre.taille * INTERLIGNE_PLANCHE
    const ligne = Math.floor((p.y - (ph.entete.y + ph.entete.hauteur + page.retrait)) / lh)
    // Au-dessus de la première ligne : la première étape ; sous la dernière : la dernière.
    const bornee = Math.min(ph.lignes.length - 1, Math.max(0, ligne))
    const position = ph.etapes.findIndex((e) => bornee >= e.debut && bornee < e.fin)
    if (position >= 0) return { genre: 'etape', position }
  }
  return null
}
