import { CHAMPS_CARTOUCHE, type Cartouche } from './cartouche.ts'
import { lignesDuTexte, miseEnPageCommentaire } from './commentaires.ts'
import type { Resultat } from './echelle.ts'
import type { Rectangle } from './elements.ts'
import type { ListesChantier } from './legende.ts'
import { BORDS_PLANCHE, COULEURS_PLANCHE, lignesCreneau, miseEnPage, texteEtape, type MiseEnPage } from './planche.ts'
import type { Synoptique } from './synoptique.ts'

// Exports PowerPoint et PDF des images d'un synoptique : ce qui se calcule
// sans navigateur. Quelles images exporter, où poser chaque planche dans la
// page (ratio conservé, centrée, petite marge), et, pour PowerPoint, où poser
// les zones de texte modifiables (bandeau de titre, créneau horaire, encart
// PHASAGE, commentaires de l'image) pour qu'elles tombent exactement à leur
// place sur la planche. Et
// la mise en page de la page de garde avec son cartouche.
//
// Toutes les mesures de page sont en pouces (unité de PowerPoint ; le PDF
// est écrit en pouces lui aussi), les tailles de texte et les épaisseurs de
// trait en points (1 pouce = 72 points).

export const POINTS_PAR_POUCE = 72

// Police des exports : Arial pour les zones de texte PowerPoint (présente
// avec PowerPoint sous Windows comme sur Mac), et la même pour les textes de
// l'image de la planche (légende, noms…), pour qu'une diapositive n'en
// mélange pas deux ; à défaut, une police de mêmes dimensions.
export const POLICE_EXPORT = { powerpoint: 'Arial', image: 'Arial, "Liberation Sans", Helvetica, sans-serif' } as const
const MM_PAR_POUCE = 25.4

export type Taille = { largeur: number; hauteur: number }

// ——— Réglages de l'export ———

export type FormatExport = 'pptx' | 'pdf'

// Toutes les images, l'image affichée, ou « de n à m » (numéros tapés, à
// partir de 1).
export type ChoixImages = { genre: 'toutes' } | { genre: 'courante' } | { genre: 'plage'; de: number; a: number }

// PowerPoint : textes du bandeau, du créneau et du PHASAGE en zones de texte
// modifiables, ou toute la planche en une image (copie fidèle).
export type TextesPowerPoint = 'modifiables' | 'image'

export type FormatPdf = '16/9' | 'A4' | 'A3'

export type OptionsExport = {
  format: FormatExport
  images: ChoixImages
  pageDeGarde: boolean
  textes: TextesPowerPoint
  page: FormatPdf
}

export const OPTIONS_PAR_DEFAUT: OptionsExport = {
  format: 'pptx',
  images: { genre: 'toutes' },
  pageDeGarde: true,
  textes: 'modifiables',
  page: '16/9',
}

// ——— Choix des images ———

// Les index (à partir de 0) des images à exporter, dans l'ordre du
// synoptique ; `courante` est l'index de l'image affichée.
export function imagesChoisies(nombre: number, courante: number, choix: ChoixImages): Resultat<number[]> {
  if (nombre < 1) return { ok: false, erreur: "Ce synoptique n'a aucune image." }
  if (choix.genre === 'toutes') return { ok: true, valeur: Array.from({ length: nombre }, (_, i) => i) }
  if (choix.genre === 'courante') return { ok: true, valeur: [Math.min(nombre - 1, Math.max(0, courante))] }
  const { de, a } = choix
  if (!Number.isInteger(de) || !Number.isInteger(a)) return { ok: false, erreur: "Indiquez deux numéros d'image entiers." }
  if (de < 1 || a > nombre || de > nombre || a < 1) {
    return { ok: false, erreur: `Les numéros d'image vont de 1 à ${nombre}.` }
  }
  if (de > a) return { ok: false, erreur: `Le premier numéro (${de}) doit être inférieur ou égal au second (${a}).` }
  return { ok: true, valeur: Array.from({ length: a - de + 1 }, (_, i) => de - 1 + i) }
}

// ——— Pages ———

// Diapositive PowerPoint « grand écran » 16/9 (celle de ses synoptiques).
export const DIAPOSITIVE: Taille = { largeur: 40 / 3, hauteur: 7.5 }

export const PAGES_PDF: Record<FormatPdf, Taille & { libelle: string }> = {
  '16/9': { libelle: '16/9, comme les diapositives', ...DIAPOSITIVE },
  A4: { libelle: 'A4 paysage', largeur: 297 / MM_PAR_POUCE, hauteur: 210 / MM_PAR_POUCE },
  A3: { libelle: 'A3 paysage', largeur: 420 / MM_PAR_POUCE, hauteur: 297 / MM_PAR_POUCE },
}

// Petite marge autour de la planche : 2,5 % du petit côté de la page
// (environ 5 mm sur une diapositive ou un A4, 7 mm sur un A3).
export const margePage = (page: Taille): number => Math.min(page.largeur, page.hauteur) * 0.025

// Le rectangle où poser un contenu dans la page : le plus grand possible dans
// la page moins la marge, sans déformation, centré.
export function ajusterDansPage(contenu: Taille, page: Taille, marge = margePage(page)): Rectangle {
  const largeurUtile = Math.max(0, page.largeur - 2 * marge)
  const hauteurUtile = Math.max(0, page.hauteur - 2 * marge)
  if (!(contenu.largeur > 0) || !(contenu.hauteur > 0)) return { x: marge, y: marge, largeur: largeurUtile, hauteur: hauteurUtile }
  const k = Math.min(largeurUtile / contenu.largeur, hauteurUtile / contenu.hauteur)
  const largeur = contenu.largeur * k
  const hauteur = contenu.hauteur * k
  return { x: (page.largeur - largeur) / 2, y: (page.hauteur - hauteur) / 2, largeur, hauteur }
}

// Un rectangle de la planche (unités du plan) dans la page, où la planche
// entière occupe `cible`.
export function versPage(r: Rectangle, planche: Rectangle, cible: Rectangle): Rectangle {
  const k = cible.largeur / planche.largeur
  return { x: cible.x + (r.x - planche.x) * k, y: cible.y + (r.y - planche.y) * k, largeur: r.largeur * k, hauteur: r.hauteur * k }
}

// ——— Image de la planche ———

// Environ 2 400 pixels de large (180 points par pouce sur une diapositive) ;
// une planche très haute est réduite pour que sa hauteur ne dépasse pas
// autant, et la mémoire reste raisonnable.
export const COTE_RENDU = 2400

export function tailleRendu(planche: Taille, cote = COTE_RENDU): Taille {
  if (!(planche.largeur > 0) || !(planche.hauteur > 0)) return { largeur: cote, hauteur: Math.round(cote * 0.5625) }
  const k = cote / Math.max(planche.largeur, planche.hauteur)
  return { largeur: Math.max(1, Math.round(planche.largeur * k)), hauteur: Math.max(1, Math.round(planche.hauteur * k)) }
}

// Image PNG (sans perte, légère pour une planche sans fond : traits et
// aplats), JPEG quand un fond photo ou un plan scanné est affiché (en PNG, le
// fichier serait plusieurs fois plus lourd).
export const typeImageRendue = (avecFond: boolean): 'image/png' | 'image/jpeg' => (avecFond ? 'image/jpeg' : 'image/png')

// ——— Zones de texte PowerPoint ———

export type NomZone = 'bandeau' | 'creneau' | 'phasage-titre' | 'phasage-etapes' | 'commentaire'

export type ParagrapheZone = { texte: string; gras: boolean }

// Une zone de texte PowerPoint native, posée sur la planche à la place d'un
// texte de l'image. Position et taille en pouces ; taille du texte, bord,
// marges intérieures et interligne en points ; couleurs en « #rrggbb ».
export type ZoneTexte = {
  nom: NomZone
  x: number
  y: number
  largeur: number
  hauteur: number
  // null : sans fond (commentaire sans cadre).
  fond: string | null
  bord: { couleur: string; epaisseur: number } | null
  paragraphes: ParagrapheZone[]
  taille: number
  couleur: string
  alignement: 'centre' | 'gauche'
  vertical: 'milieu' | 'haut'
  marges: { gauche: number; droite: number; haut: number; bas: number }
  interligne: number
}

// Même interligne que sur la planche (planche.ts : 1,3 fois la taille du texte).
const INTERLIGNE = 1.3

// Les zones de texte d'une image : le bandeau (s'il y en a un), le créneau,
// l'encart PHASAGE (son bandeau gris foncé et ses étapes) s'il n'est pas
// vide, et les commentaires de l'image qui se voient dans le cadrage (calque
// « Commentaires » affiché), par-dessus le plan. Les textes sont les textes d'origine (pas coupés en lignes) :
// PowerPoint les fait passer à la ligne dans la zone, et ils restent
// modifiables comme n'importe quelle zone de texte.
export function zonesTexte(s: Synoptique, index: number, page: MiseEnPage, cible: Rectangle): ZoneTexte[] {
  const image = s.images[index]
  if (!image) return []
  const k = cible.largeur / page.planche.largeur
  const pt = (v: number) => v * k * POINTS_PAR_POUCE
  const place = (r: Rectangle) => {
    const p = versPage(r, page.planche, cible)
    return { x: p.x, y: p.y, largeur: p.largeur, hauteur: p.hauteur }
  }
  const retrait = pt(page.retrait)
  const zones: ZoneTexte[] = []

  if (page.bandeau) {
    const taille = pt(page.bandeau.lignes[0].taille)
    zones.push({
      nom: 'bandeau',
      ...place(page.bandeau.boite),
      fond: COULEURS_PLANCHE.fondBandeau,
      bord: { couleur: COULEURS_PLANCHE.bordBandeau, epaisseur: pt(page.trait * BORDS_PLANCHE.bandeau) },
      paragraphes: s.bandeau
        .trim()
        .split('\n')
        .map((l) => ({ texte: l.trim(), gras: true })),
      taille,
      couleur: COULEURS_PLANCHE.texte,
      alignement: 'centre',
      vertical: 'milieu',
      marges: { gauche: retrait, droite: retrait, haut: 0, bas: 0 },
      interligne: taille * INTERLIGNE,
    })
  }

  // Créneau : le titre en gras, puis les heures (en gras sans titre, en
  // maigre sous un titre), comme sur la planche.
  const { titre, heures } = lignesCreneau(s.t0, image)
  // (Le créneau a toujours au moins une ligne : les heures, sans titre.)
  const tailleCreneau = pt(page.creneau.lignes[0].taille)
  zones.push({
    nom: 'creneau',
    ...place(page.creneau.boite),
    fond: COULEURS_PLANCHE.fondCreneau,
    bord: { couleur: COULEURS_PLANCHE.bordCreneau, epaisseur: pt(page.trait * BORDS_PLANCHE.creneau) },
    paragraphes: [...titre.map((texte) => ({ texte, gras: true })), ...heures.map((texte) => ({ texte, gras: titre.length === 0 }))],
    taille: tailleCreneau,
    couleur: COULEURS_PLANCHE.texte,
    alignement: 'centre',
    vertical: 'milieu',
    marges: { gauche: retrait, droite: retrait, haut: 0, bas: 0 },
    interligne: tailleCreneau * INTERLIGNE,
  })

  if (page.phasage) {
    const taille = pt(page.phasage.titre.taille)
    const sansMarge = { gauche: 0, droite: 0, haut: 0, bas: 0 }
    zones.push({
      nom: 'phasage-titre',
      ...place(page.phasage.entete),
      fond: COULEURS_PLANCHE.entetePhasage,
      bord: null,
      paragraphes: [{ texte: page.phasage.titre.texte, gras: true }],
      taille,
      couleur: '#ffffff',
      alignement: 'centre',
      vertical: 'milieu',
      marges: sansMarge,
      interligne: taille * INTERLIGNE,
    })
    const { boite, entete } = page.phasage
    zones.push({
      nom: 'phasage-etapes',
      ...place({ x: boite.x, y: entete.y + entete.hauteur, largeur: boite.largeur, hauteur: boite.hauteur - entete.hauteur }),
      fond: COULEURS_PLANCHE.fondPhasage,
      bord: null,
      // « 3 – Dépose des rails… » ; les retours à la ligne tapés sont gardés.
      paragraphes: image.phasage.map((e) => ({ texte: texteEtape(e), gras: false })),
      taille,
      couleur: COULEURS_PLANCHE.textePhasage,
      alignement: 'gauche',
      vertical: 'haut',
      marges: { gauche: retrait, droite: retrait, haut: retrait, bas: 0 },
      interligne: taille * INTERLIGNE,
    })
  }

  if (s.calqueCommentaires.visible) {
    const c = page.carte
    for (const commentaire of image.contenu.commentaires) {
      const m = miseEnPageCommentaire(commentaire, s)
      const b = m.boite
      const visible = b.x < c.x + c.largeur && b.x + b.largeur > c.x && b.y < c.y + c.hauteur && b.y + b.hauteur > c.y
      if (!visible) continue
      zones.push({
        nom: 'commentaire',
        ...place(b),
        fond: commentaire.encadre ? '#ffffff' : null,
        bord: commentaire.encadre ? { couleur: commentaire.couleur, epaisseur: pt(m.taille * 0.08) } : null,
        paragraphes: lignesDuTexte(commentaire.texte).map((texte) => ({ texte, gras: commentaire.gras })),
        taille: pt(m.taille),
        couleur: commentaire.couleur,
        alignement: 'gauche',
        vertical: 'haut',
        marges: { gauche: pt(m.retrait), droite: pt(m.retrait), haut: pt(m.retrait * 0.7), bas: 0 },
        interligne: pt(m.interligne),
      })
    }
  }
  return zones
}

// ——— Planches à exporter ———

// Une planche dans sa page : l'index de l'image, où poser l'image de la
// planche, si ses textes sont posés à part (et alors, les zones de texte).
export type PlancheAExporter = { index: number; cible: Rectangle; textesAPart: boolean; zones: ZoneTexte[] }

export const tailleDePage = (options: Pick<OptionsExport, 'format' | 'page'>): Taille =>
  options.format === 'pptx' ? DIAPOSITIVE : PAGES_PDF[options.page]

export function planchesAExporter(s: Synoptique, indices: number[], listes: ListesChantier, options: OptionsExport): PlancheAExporter[] {
  const page = tailleDePage(options)
  const textesAPart = options.format === 'pptx' && options.textes === 'modifiables'
  return indices.map((index) => {
    const mise = miseEnPage(s, index, listes)
    const cible = ajusterDansPage(mise.planche, page)
    return { index, cible, textesAPart, zones: textesAPart ? zonesTexte(s, index, mise, cible) : [] }
  })
}

// ——— Page de garde ———

export type ColonneCartouche = { libelle: string; valeur: string; x: number; largeur: number }

export type PageDeGarde = {
  page: Taille
  // Cadre du titre (bleu foncé, texte blanc) : le nom du chantier, puis celui
  // du synoptique.
  titre: Rectangle
  lignesTitre: string[]
  tailleTitre: number
  // Zone où poser la vignette (ajustée sans déformation, centrée).
  zoneVignette: Rectangle
  // Le cartouche : une ligne de libellés, une ligne de valeurs.
  tableau: { x: number; y: number; largeur: number; hauteurEntete: number; hauteurValeurs: number; taille: number; colonnes: ColonneCartouche[] }
  couleurs: { titre: string; texteTitre: string; entete: string; texteEntete: string; valeurs: string; texteValeurs: string }
}

export function pageDeGarde(page: Taille, noms: { chantier: string; synoptique: string }, cartouche: Cartouche): PageDeGarde {
  const { largeur: L, hauteur: H } = page
  const pointsHauteur = H * POINTS_PAR_POUCE
  const tableau = { x: 0.05 * L, y: 0.73 * H, largeur: 0.9 * L, hauteurEntete: 0.07 * H, hauteurValeurs: 0.11 * H }
  const poids = CHAMPS_CARTOUCHE.reduce((t, c) => t + c.poids, 0)
  let x = tableau.x
  const colonnes = CHAMPS_CARTOUCHE.map(({ champ, libelle, poids: p }) => {
    const largeur = (tableau.largeur * p) / poids
    const colonne = { libelle, valeur: cartouche[champ].trim(), x, largeur }
    x += largeur
    return colonne
  })
  return {
    page,
    titre: { x: 0.17 * L, y: 0.05 * H, largeur: 0.66 * L, hauteur: 0.15 * H },
    lignesTitre: [noms.chantier.trim(), noms.synoptique.trim()].filter((t) => t !== ''),
    tailleTitre: pointsHauteur * 0.042,
    zoneVignette: { x: 0.08 * L, y: 0.23 * H, largeur: 0.84 * L, hauteur: 0.46 * H },
    tableau: { ...tableau, taille: pointsHauteur * 0.019, colonnes },
    couleurs: {
      titre: COULEURS_PLANCHE.bordBandeau,
      texteTitre: '#ffffff',
      entete: COULEURS_PLANCHE.bordBandeau,
      texteEntete: '#ffffff',
      valeurs: '#dde4f0',
      texteValeurs: COULEURS_PLANCHE.texte,
    },
  }
}

// ——— Écriture du fichier ———

// Une planche rendue en image (data URL PNG ou JPEG) et sa taille en pixels.
export type ImageRendue = { donnees: string; largeur: number; hauteur: number }

// Ce qu'on sait du document, pour ses propriétés (titre, sujet).
export type InfosDocument = { titre: string; sujet: string }

// Le fichier se construit page après page, au fil du rendu des images (qui
// peuvent alors être libérées), puis s'écrit d'un coup.
export type Redacteur = {
  garde: (g: PageDeGarde, vignette: ImageRendue) => void
  planche: (p: PlancheAExporter, image: ImageRendue) => void
  terminer: () => Promise<ArrayBuffer>
}

// ——— Nom du fichier ———

// « <nom du synoptique>.pptx », sans les caractères interdits dans un nom de
// fichier (Windows compris), ni points ou espaces en fin de nom.
export function nomFichierExport(nom: string, format: FormatExport): string {
  const propre = nom
    .replace(/\s+/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .trim()
    .slice(0, 150)
    .replace(/[\s.]+$/, '')
  return `${propre || 'synoptique'}.${format}`
}
