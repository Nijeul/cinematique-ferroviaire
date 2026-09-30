import { jsPDF } from 'jspdf'
import { ajusterDansPage, POINTS_PAR_POUCE, type InfosDocument, type PageDeGarde, type Redacteur, type Taille } from '../plan/export.ts'

// Écriture du fichier PDF avec jsPDF, chargé à la demande (import dynamique
// depuis l'interface). Une page par image : la planche en image, centrée et
// ajustée sans déformation. La page de garde est dessinée en vectoriel :
// titre, vignette, cartouche en tableau. Aucun accès au navigateur ici : les
// images arrivent déjà rendues (data URL), ce qui permet de tester sous Node.

// Police standard des PDF (Helvetica), présente dans toutes les liseuses.
const POLICE = 'helvetica'
// Hauteur d'une ligne de texte, en tailles de texte.
const INTERLIGNE = 1.2

const formatImage = (donnees: string): 'PNG' | 'JPEG' => (donnees.startsWith('data:image/png') ? 'PNG' : 'JPEG')

// Lignes de texte centrées dans un rectangle (horizontalement et
// verticalement), coupées à sa largeur moins `retrait`.
function texteCentre(doc: jsPDF, lignes: string[], r: { x: number; y: number; largeur: number; hauteur: number }, taille: number, retrait: number): void {
  doc.setFontSize(taille)
  const coupees = lignes.flatMap((l) => doc.splitTextToSize(l, Math.max(0.1, r.largeur - 2 * retrait)) as string[])
  const hauteurLigne = (taille * INTERLIGNE) / POINTS_PAR_POUCE
  const haut = r.y + (r.hauteur - coupees.length * hauteurLigne) / 2
  coupees.forEach((l, i) => {
    doc.text(l, r.x + r.largeur / 2, haut + (i + 0.78) * hauteurLigne, { align: 'center' })
  })
}

function dessinerGarde(doc: jsPDF, g: PageDeGarde, vignette: { donnees: string; largeur: number; hauteur: number }): void {
  doc.setFont(POLICE, 'bold')
  doc.setFillColor(g.couleurs.titre)
  doc.rect(g.titre.x, g.titre.y, g.titre.largeur, g.titre.hauteur, 'F')
  doc.setTextColor(g.couleurs.texteTitre)
  texteCentre(doc, g.lignesTitre, g.titre, g.tailleTitre, g.titre.hauteur * 0.1)

  const place = ajusterDansPage(vignette, g.zoneVignette, 0)
  doc.addImage(vignette.donnees, formatImage(vignette.donnees), g.zoneVignette.x + place.x, g.zoneVignette.y + place.y, place.largeur, place.hauteur)

  // Cartouche : cases séparées d'un filet blanc, comme dans PowerPoint.
  const t = g.tableau
  const filet = 0.01
  const retrait = 0.05
  for (const c of t.colonnes) {
    const entete = { x: c.x + filet, y: t.y + filet, largeur: c.largeur - 2 * filet, hauteur: t.hauteurEntete - 2 * filet }
    const valeur = { ...entete, y: t.y + t.hauteurEntete + filet, hauteur: t.hauteurValeurs - 2 * filet }
    doc.setFillColor(g.couleurs.entete)
    doc.rect(entete.x, entete.y, entete.largeur, entete.hauteur, 'F')
    doc.setFillColor(g.couleurs.valeurs)
    doc.rect(valeur.x, valeur.y, valeur.largeur, valeur.hauteur, 'F')
    doc.setTextColor(g.couleurs.texteEntete)
    texteCentre(doc, [c.libelle], entete, t.taille, retrait)
    doc.setTextColor(g.couleurs.texteValeurs)
    if (c.valeur !== '') texteCentre(doc, c.valeur.split('\n'), valeur, t.taille, retrait)
  }
}

export function redacteurPdf(page: Taille, infos: InfosDocument): Redacteur {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [page.largeur, page.hauteur], compress: true })
  doc.setProperties({ title: infos.titre, subject: infos.sujet, creator: 'Cinématique ferroviaire' })
  doc.setLanguage('fr')
  let pages = 0
  // La première page existe déjà ; les suivantes s'ajoutent.
  const nouvellePage = () => {
    if (pages > 0) doc.addPage([page.largeur, page.hauteur], 'landscape')
    pages++
  }
  return {
    garde: (g, vignette) => {
      nouvellePage()
      dessinerGarde(doc, g, vignette)
    },
    planche: (p, image) => {
      nouvellePage()
      doc.addImage(image.donnees, formatImage(image.donnees), p.cible.x, p.cible.y, p.cible.largeur, p.cible.hauteur, undefined, 'FAST')
    },
    terminer: async () => doc.output('arraybuffer'),
  }
}
