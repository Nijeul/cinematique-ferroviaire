import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { bornerPage, echelleRendu, typeDeFond } from '../plan/fond.ts'
import type { Fond } from '../plan/projet.ts'

// Lecture du fond de plan : une image telle quelle, ou une page de PDF rendue
// en image par pdf.js. Le PDF reste ouvert en mémoire pour pouvoir changer de
// page à tout moment sans redemander le fichier.

export type PdfOuvert = { document: PDFDocumentProxy; nomFichier: string; nombrePages: number }

async function chargerPdfjs() {
  // Chargé à la demande : pdf.js est lourd et ne sert qu'à l'import.
  // Version « legacy » : la version standard exige un navigateur très
  // récent et échoue sur un Chrome/Edge de quelques mois.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
  return pdfjs
}

export async function ouvrirPdf(fichier: File): Promise<PdfOuvert> {
  const pdfjs = await chargerPdfjs()
  const document = await pdfjs.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise
  return { document, nomFichier: fichier.name, nombrePages: document.numPages }
}

// Libère le PDF (et son travailleur pdf.js) quand il ne sert plus.
export function fermerPdf(pdf: PdfOuvert | null): void {
  if (pdf) void pdf.document.loadingTask.destroy()
}

export async function rendrePage(pdf: PdfOuvert, pageDemandee: number): Promise<Fond> {
  const numero = bornerPage(pageDemandee, pdf.nombrePages)
  const page = await pdf.document.getPage(numero)
  const taille = page.getViewport({ scale: 1 })
  const vue = page.getViewport({ scale: echelleRendu(taille.width, taille.height) })
  const toile = document.createElement('canvas')
  toile.width = Math.ceil(vue.width)
  toile.height = Math.ceil(vue.height)
  const contexte = toile.getContext('2d')
  if (!contexte) throw new Error('Le navigateur refuse de dessiner la page.')
  await page.render({ canvas: toile, canvasContext: contexte, viewport: vue }).promise
  const fond: Fond = {
    image: toile.toDataURL('image/jpeg', 0.92),
    largeur: toile.width,
    hauteur: toile.height,
    nomFichier: pdf.nomFichier,
    page: numero,
    nombrePages: pdf.nombrePages,
  }
  // Libère la mémoire de la toile et de la page tout de suite.
  toile.width = 0
  toile.height = 0
  page.cleanup()
  return fond
}

export async function lireImage(fichier: File): Promise<Fond> {
  const image = await new Promise<string>((resoudre, rejeter) => {
    const lecteur = new FileReader()
    lecteur.onload = () => resoudre(String(lecteur.result))
    lecteur.onerror = () => rejeter(new Error('Lecture du fichier impossible.'))
    lecteur.readAsDataURL(fichier)
  })
  const element = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
    const img = new Image()
    img.onload = () => resoudre(img)
    img.onerror = () => rejeter(new Error("L'image est illisible."))
    img.src = image
  })
  return {
    image,
    largeur: element.naturalWidth,
    hauteur: element.naturalHeight,
    nomFichier: fichier.name,
    page: null,
    nombrePages: null,
  }
}

// Fichier choisi comme fond : une image, ou la page 1 d'un PDF (gardé ouvert
// pour changer de page). Erreur en français si ce n'est ni l'un ni l'autre.
export async function ouvrirFond(fichier: File): Promise<{ fond: Fond; pdf: PdfOuvert | null }> {
  const type = typeDeFond(fichier.name, fichier.type)
  if (!type) throw new Error("ce n'est ni une image (PNG, JPG) ni un PDF.")
  if (type === 'image') return { fond: await lireImage(fichier), pdf: null }
  const pdf = await ouvrirPdf(fichier)
  try {
    return { fond: await rendrePage(pdf, 1), pdf }
  } catch (e) {
    fermerPdf(pdf)
    throw e
  }
}
