import PptxGenJS from 'pptxgenjs'
import { ajusterDansPage, DIAPOSITIVE, POLICE_EXPORT, type InfosDocument, type PageDeGarde, type Redacteur, type ZoneTexte } from '../plan/export.ts'

// Écriture du fichier PowerPoint (.pptx) avec pptxgenjs, chargé à la demande
// (import dynamique depuis l'interface) : il ne pèse pas sur l'ouverture de
// l'application. Une diapositive 16/9 par image : l'image de la planche, et
// par-dessus, en mode « Textes modifiables », les zones de texte natives du
// bandeau, du créneau, de l'encart PHASAGE et des commentaires, à leur place. La page de garde
// a son cartouche en tableau PowerPoint natif. Aucun accès au navigateur ici :
// les images arrivent déjà rendues (data URL), ce qui permet de tester sous Node.

const POLICE_PPTX = POLICE_EXPORT.powerpoint

const couleur = (c: string): string => c.replace('#', '').toUpperCase()
const LANGUE = 'fr-FR'

// Les paragraphes d'une zone en « runs » pptxgenjs : un paragraphe par ligne
// du créneau ou par étape du PHASAGE ; un retour à la ligne tapé dans une
// étape ouvre un paragraphe de plus. (Le saut de ligne dans un même
// paragraphe, `softBreakBefore`, écrit un XML que PowerPoint peut refuser.)
function runs(zone: ZoneTexte): PptxGenJS.TextProps[] {
  const lignes = zone.paragraphes.flatMap((p) => p.texte.split('\n').map((texte) => ({ texte, gras: p.gras })))
  return lignes.map((l, i) => ({ text: l.texte, options: { bold: l.gras, breakLine: i < lignes.length - 1 } }))
}

function ajouterZone(diapo: PptxGenJS.Slide, zone: ZoneTexte): void {
  diapo.addText(runs(zone), {
    objectName: zone.nom,
    x: zone.x,
    y: zone.y,
    w: zone.largeur,
    h: zone.hauteur,
    fill: zone.fond ? { color: couleur(zone.fond) } : undefined,
    line: zone.bord ? { color: couleur(zone.bord.couleur), width: zone.bord.epaisseur } : undefined,
    fontFace: POLICE_PPTX,
    fontSize: arrondi(zone.taille),
    color: couleur(zone.couleur),
    align: zone.alignement === 'centre' ? 'center' : 'left',
    valign: zone.vertical === 'milieu' ? 'middle' : 'top',
    // pptxgenjs lit les marges dans l'ordre gauche, droite, bas, haut.
    margin: [zone.marges.gauche, zone.marges.droite, zone.marges.bas, zone.marges.haut],
    lineSpacing: arrondi(zone.interligne),
    paraSpaceBefore: 0,
    paraSpaceAfter: 0,
    fit: 'none',
    wrap: true,
    isTextBox: true,
    lang: LANGUE,
  })
}

// Tailles de texte au dixième de point (PowerPoint n'en garde pas plus).
const arrondi = (v: number): number => Math.round(v * 10) / 10

function ajouterGarde(pptx: PptxGenJS, g: PageDeGarde, vignette: { donnees: string; largeur: number; hauteur: number }): void {
  const diapo = pptx.addSlide()
  diapo.addText(
    g.lignesTitre.map((texte, i) => ({ text: texte, options: { breakLine: i < g.lignesTitre.length - 1 } })),
    {
      objectName: 'titre',
      x: g.titre.x,
      y: g.titre.y,
      w: g.titre.largeur,
      h: g.titre.hauteur,
      fill: { color: couleur(g.couleurs.titre) },
      color: couleur(g.couleurs.texteTitre),
      fontFace: POLICE_PPTX,
      fontSize: arrondi(g.tailleTitre),
      bold: true,
      align: 'center',
      valign: 'middle',
      fit: 'none',
      lang: LANGUE,
    },
  )
  const place = ajusterDansPage(vignette, g.zoneVignette, 0)
  diapo.addImage({
    data: vignette.donnees,
    x: g.zoneVignette.x + place.x,
    y: g.zoneVignette.y + place.y,
    w: place.largeur,
    h: place.hauteur,
    altText: 'Vignette de la première image',
  })
  const t = g.tableau
  const bord = { type: 'solid' as const, pt: 1.5, color: 'FFFFFF' }
  const cellule = (texte: string, entete: boolean): PptxGenJS.TableCell => ({
    text: texte,
    options: {
      bold: true,
      fill: { color: couleur(entete ? g.couleurs.entete : g.couleurs.valeurs) },
      color: couleur(entete ? g.couleurs.texteEntete : g.couleurs.texteValeurs),
    },
  })
  diapo.addTable(
    [t.colonnes.map((c) => cellule(c.libelle, true)), t.colonnes.map((c) => cellule(c.valeur, false))],
    {
      objectName: 'cartouche',
      x: t.x,
      y: t.y,
      w: t.largeur,
      colW: t.colonnes.map((c) => c.largeur),
      rowH: [t.hauteurEntete, t.hauteurValeurs],
      fontFace: POLICE_PPTX,
      fontSize: arrondi(t.taille),
      align: 'center',
      valign: 'middle',
      border: bord,
      margin: 0.04,
      lang: LANGUE,
    },
  )
}

export function redacteurPptx(infos: InfosDocument): Redacteur {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'SYNOPTIQUE_16_9', width: DIAPOSITIVE.largeur, height: DIAPOSITIVE.hauteur })
  pptx.layout = 'SYNOPTIQUE_16_9'
  pptx.title = infos.titre
  pptx.subject = infos.sujet
  pptx.company = ''
  pptx.author = 'Cinématique ferroviaire'
  return {
    garde: (g, vignette) => ajouterGarde(pptx, g, vignette),
    planche: (p, image) => {
      const diapo = pptx.addSlide()
      diapo.addImage({ data: image.donnees, x: p.cible.x, y: p.cible.y, w: p.cible.largeur, h: p.cible.hauteur, altText: `Planche ${p.index + 1}` })
      for (const zone of p.zones) ajouterZone(diapo, zone)
    },
    terminer: async () => (await pptx.write({ outputType: 'arraybuffer', compression: true })) as ArrayBuffer,
  }
}
