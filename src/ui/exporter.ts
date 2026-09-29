import type { Chantier } from '../plan/chantier.ts'
import {
  imagesChoisies,
  nomFichierExport,
  pageDeGarde,
  planchesAExporter,
  tailleDePage,
  type OptionsExport,
  type Redacteur,
} from '../plan/export.ts'
import type { ListesChantier } from '../plan/legende.ts'
import type { Synoptique } from '../plan/synoptique.ts'
import { telecharger } from './navigateur.ts'
import { rendrePlanche } from './rendrePlanche.tsx'

// L'export d'un synoptique, image après image : chaque planche est rendue en
// image puis ajoutée au fichier (et son rendu libéré), avec l'avancement à
// afficher et la possibilité d'annuler entre deux images. pptxgenjs et jsPDF
// ne sont chargés qu'ici, au premier export. Le chantier n'est jamais modifié.

export type Avancement = { fait: number; total: number; texte: string }

// Levée entre deux images quand l'utilisateur a cliqué « Annuler l'export ».
class ExportAnnule extends Error {}

const TYPES_FICHIER = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
} as const

// La vignette de la page de garde : plus petite que les planches.
const COTE_VIGNETTE = 1600

// Laisse le navigateur afficher l'avancement (et prendre en compte Annuler).
const respirer = () => new Promise<void>((resoudre) => setTimeout(resoudre, 0))

async function redacteur(options: OptionsExport, infos: { titre: string; sujet: string }): Promise<Redacteur> {
  if (options.format === 'pptx') return (await import('../export/ecrirePptx.ts')).redacteurPptx(infos)
  return (await import('../export/ecrirePdf.ts')).redacteurPdf(tailleDePage(options), infos)
}

export async function exporterSynoptique(p: {
  chantier: Chantier
  synoptique: Synoptique
  courante: number
  options: OptionsExport
  signal: AbortSignal
  avancer: (a: Avancement) => void
}): Promise<{ nomFichier: string; pages: number }> {
  const { chantier, synoptique: s, options, signal, avancer } = p
  const choix = imagesChoisies(s.images.length, p.courante, options.images)
  if (!choix.ok) throw new Error(choix.erreur)
  const listes: ListesChantier = { etatsVoie: chantier.etatsVoie, typesFleches: chantier.typesFleches, catalogue: chantier.catalogue }
  const planches = planchesAExporter(s, choix.valeur, listes, options)
  // Chaque image, la page de garde, et l'écriture du fichier.
  const total = planches.length + (options.pageDeGarde ? 1 : 0) + 1
  let fait = 0
  const verifier = () => {
    if (signal.aborted) throw new ExportAnnule()
  }

  avancer({ fait, total, texte: options.format === 'pptx' ? 'Chargement de l’outil PowerPoint…' : 'Chargement de l’outil PDF…' })
  const fichier = await redacteur(options, { titre: s.nom, sujet: `${s.cartouche.typeDocument.trim() || 'Synoptique'} — ${chantier.nom}` })

  if (options.pageDeGarde) {
    verifier()
    avancer({ fait, total, texte: 'Page de garde…' })
    await respirer()
    const vignette = await rendrePlanche(s, choix.valeur[0], listes, { cote: COTE_VIGNETTE, textesAPart: false })
    fichier.garde(pageDeGarde(tailleDePage(options), { chantier: chantier.nom, synoptique: s.nom }, s.cartouche), vignette)
    fait++
  }
  for (const [i, planche] of planches.entries()) {
    verifier()
    avancer({ fait, total, texte: `Image ${planche.index + 1} (${i + 1} sur ${planches.length})…` })
    await respirer()
    verifier()
    fichier.planche(planche, await rendrePlanche(s, planche.index, listes, { textesAPart: planche.textesAPart }))
    fait++
  }
  verifier()
  avancer({ fait, total, texte: 'Écriture du fichier…' })
  await respirer()
  const octets = await fichier.terminer()
  verifier()
  const nomFichier = nomFichierExport(s.nom, options.format)
  telecharger(nomFichier, new Blob([octets], { type: TYPES_FICHIER[options.format] }))
  avancer({ fait: total, total, texte: 'Terminé.' })
  return { nomFichier, pages: planches.length + (options.pageDeGarde ? 1 : 0) }
}
