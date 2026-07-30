import type { Projet } from '../domain/projet.ts'
import { cibleCapture } from './capture.ts'
import { dessinerCartouche, dessinerIncrustations } from './incrustation.ts'

// Planches : une image par créneau (ou par changement d'opération), avec
// cartouche et encart phasage — l'équivalent du jeu de planches actuel,
// exportable en PDF ou en PPTX pour rester dans la chaîne documentaire.

export type Planche = { dataUrl: string; t: number }

export type OptionsPlanches = {
  projet: Projet
  // 'creneau' : un pas fixe (pasCreneau) ; 'operations' : à chaque début ou
  // fin d'opération.
  decoupage: 'creneau' | 'operations'
  fixerT: (t: number) => void
  surProgression: (fraction: number) => void
  annulation: { demandee: boolean }
}

const prochaineImage = (): Promise<void> =>
  new Promise((resoudre) => requestAnimationFrame(() => requestAnimationFrame(() => resoudre())))

export function instantsDesPlanches(projet: Projet, decoupage: 'creneau' | 'operations'): number[] {
  if (decoupage === 'operations') {
    const bornes = new Set<number>([0, projet.temps.dureeMinutes])
    for (const op of projet.operations) {
      bornes.add(op.tDebut)
      bornes.add(op.tFin)
    }
    return [...bornes].filter((t) => t >= 0 && t <= projet.temps.dureeMinutes).sort((a, b) => a - b)
  }
  const instants: number[] = []
  for (let t = 0; t <= projet.temps.dureeMinutes; t += projet.temps.pasCreneau) instants.push(t)
  return instants
}

export async function capturerPlanches(options: OptionsPlanches): Promise<Planche[]> {
  const { projet, decoupage, fixerT, surProgression, annulation } = options
  const source = cibleCapture.canvas
  if (!source) throw new Error('scène 3D introuvable')
  const reduction = Math.min(1, 1920 / source.width)
  const toile = document.createElement('canvas')
  toile.width = Math.round(source.width * reduction)
  toile.height = Math.round(source.height * reduction)
  const contexte = toile.getContext('2d')
  if (!contexte) throw new Error('canvas 2D indisponible')

  const instants = instantsDesPlanches(projet, decoupage)
  const planches: Planche[] = []
  for (let i = 0; i < instants.length; i++) {
    if (annulation.demandee) break
    const t = instants[i]
    fixerT(t)
    await prochaineImage()
    contexte.drawImage(source, 0, 0, toile.width, toile.height)
    dessinerIncrustations(contexte, projet, t)
    dessinerCartouche(contexte, projet, t, i + 1, instants.length)
    planches.push({ dataUrl: toile.toDataURL('image/jpeg', 0.85), t })
    surProgression((i + 1) / instants.length)
  }
  return planches
}

export async function exporterPDF(planches: Planche[]): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const largeurPage = document.internal.pageSize.getWidth()
  const hauteurPage = document.internal.pageSize.getHeight()
  planches.forEach((planche, i) => {
    if (i > 0) document.addPage()
    document.addImage(planche.dataUrl, 'JPEG', 0, 0, largeurPage, hauteurPage)
  })
  document.save('planches.pdf')
}

export async function exporterPPTX(planches: Planche[], projet: Projet): Promise<void> {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const presentation = new PptxGenJS()
  presentation.defineLayout({ name: 'large', width: 13.33, height: 7.5 })
  presentation.layout = 'large'
  presentation.title = projet.meta.document ?? projet.meta.chantier
  for (const planche of planches) {
    const diapositive = presentation.addSlide()
    diapositive.addImage({ data: planche.dataUrl, x: 0, y: 0, w: 13.33, h: 7.5 })
  }
  await presentation.writeFile({ fileName: 'planches.pptx' })
}
