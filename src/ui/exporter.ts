import type { Chantier } from '../plan/chantier.ts'
import {
  imagesChoisies,
  nomFichierExport,
  pageDeGarde,
  planchesAExporter,
  tailleDePage,
  tailleRendu,
  type ImageRendue,
  type OptionsExport,
  type Redacteur,
} from '../plan/export.ts'
import {
  animationActive,
  cleDessous,
  NOTE_INTERMEDIAIRE,
  nommerObjets,
  poseEnPouces,
  scenesDeLaSuite,
  suiteDiapositives,
  transitionsDeLaSuite,
  type Depart,
} from '../plan/exportAnime.ts'
import { listesDe, type ListesChantier } from '../plan/legende.ts'
import { miseEnPage } from '../plan/planche.ts'
import type { Synoptique } from '../plan/synoptique.ts'
import { telecharger } from './navigateur.ts'
import { rendrePlanche, rendreSprite } from './rendrePlanche.tsx'

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
  const listes = listesDe(chantier)
  if (options.format === 'pptx' && animationActive(options.animation, choix.valeur.length)) {
    return exporterAnime({ ...p, listes, indices: choix.valeur })
  }
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

// PowerPoint animé : chaque diapositive de la suite (principales et
// intermédiaires) est rendue en couches (dessous, dessus) entre lesquelles
// se posent les engins et les rames, chacun en petite image. Les rendus
// déjà faits sont gardés : le dessus d'une image sert à toutes ses
// intermédiaires, le dessous ne change que si une zone avance, et une caisse
// d'engin ne se rend qu'une fois.
async function exporterAnime(p: {
  chantier: Chantier
  synoptique: Synoptique
  options: OptionsExport
  signal: AbortSignal
  avancer: (a: Avancement) => void
  listes: ListesChantier
  indices: number[]
}): Promise<{ nomFichier: string; pages: number }> {
  const { chantier, synoptique: s, options, signal, avancer, listes, indices } = p
  const verifier = () => {
    if (signal.aborted) throw new ExportAnnule()
  }
  avancer({ fait: 0, total: 1, texte: 'Calcul des trajets…' })
  await respirer()
  const transitions = transitionsDeLaSuite(s, indices, listes.etatsVoie)
  const suite = suiteDiapositives(s, indices, listes.etatsVoie, options.animation, transitions)
  const scenes = scenesDeLaSuite(s, suite, listes.etatsVoie, transitions)
  const noms = nommerObjets(scenes)
  const total = scenes.length + (options.pageDeGarde ? 1 : 0) + 1
  let fait = 0

  avancer({ fait, total, texte: 'Chargement de l’outil PowerPoint…' })
  const fichier = await redacteur(options, { titre: s.nom, sujet: `${s.cartouche.typeDocument.trim() || 'Synoptique'} — ${chantier.nom}` })
  const ecrire = fichier.diapositive
  if (!ecrire) throw new Error('L’outil PowerPoint ne sait pas écrire de diapositive animée.')

  const departPrincipal: Depart = options.animation.mode === 'auto' ? { genre: 'auto', apresMs: Math.round(options.animation.pause * 1000) } : { genre: 'clic' }
  if (options.pageDeGarde) {
    verifier()
    avancer({ fait, total, texte: 'Page de garde…' })
    await respirer()
    const vignette = await rendrePlanche(s, indices[0], listes, { cote: COTE_VIGNETTE, textesAPart: false })
    fichier.garde(pageDeGarde(tailleDePage(options), { chantier: chantier.nom, synoptique: s.nom }, s.cartouche), vignette, {
      morphoseMs: null,
      depart: departPrincipal,
    })
    fait++
  }

  const textesAPart = options.textes === 'modifiables'
  const dessous = new Map<string, Promise<ImageRendue>>()
  const dessus = new Map<number, Promise<ImageRendue>>()
  const sprites = new Map<string, Promise<ImageRendue>>()
  const garder = <K, V>(cache: Map<K, Promise<V>>, cle: K, faire: () => Promise<V>): Promise<V> => {
    if (!cache.has(cle)) cache.set(cle, faire())
    return cache.get(cle)!
  }
  const etapesParTransition = new Map<string, number>()
  for (const e of suite) if (e.depuis !== e.vers) etapesParTransition.set(`${e.depuis}>${e.vers}`, (etapesParTransition.get(`${e.depuis}>${e.vers}`) ?? 0) + 1)
  const rang = new Map<string, number>()

  for (const [i, scene] of scenes.entries()) {
    verifier()
    const { etape, image } = scene
    const cleTransition = `${etape.depuis}>${etape.vers}`
    if (etape.depuis === etape.vers) avancer({ fait, total, texte: `Image ${etape.image + 1}…` })
    else {
      rang.set(cleTransition, (rang.get(cleTransition) ?? 0) + 1)
      avancer({
        fait,
        total,
        texte: `Transition ${etape.depuis + 1} → ${etape.vers + 1} (étape ${rang.get(cleTransition)} sur ${etapesParTransition.get(cleTransition)})…`,
      })
    }
    await respirer()
    verifier()
    const mise = miseEnPage(s, etape.image, listes)
    const planche = planchesAExporter(s, [etape.image], listes, options)[0]
    const pixelsParUnite = tailleRendu(mise.planche).largeur / mise.planche.largeur
    const cleBas = cleDessous(etape, image)
    const imageDessous = await garder(dessous, cleBas, () =>
      rendrePlanche(s, etape.image, listes, { textesAPart, couche: 'dessous', contenuCarte: image.contenu }),
    )
    const imageDessus = await garder(dessus, etape.image, () => rendrePlanche(s, etape.image, listes, { textesAPart, couche: 'dessus' }))
    const objets = []
    for (const [j, o] of scene.objets.entries()) {
      const rendu = await garder(sprites, o.cleSprite, () => rendreSprite(o, pixelsParUnite))
      const pose = poseEnPouces(o, mise.planche, planche.cible)
      objets.push({ ...rendu, nom: noms[i][j], x: pose.x, y: pose.y, w: pose.largeur, h: pose.hauteur, rotation: pose.rotation })
    }
    ecrire({
      cible: planche.cible,
      dessous: { ...imageDessous, nom: `!!dessous-${[...dessous.keys()].indexOf(cleBas) + 1}` },
      objets,
      dessus: { ...imageDessus, nom: `!!dessus-${etape.image}` },
      zones: planche.zones,
      transition: etape.transition,
      note: etape.genre === 'intermediaire' ? NOTE_INTERMEDIAIRE : null,
    })
    fait++
  }
  verifier()
  avancer({ fait, total, texte: 'Écriture du fichier…' })
  await respirer()
  const octets = await fichier.terminer()
  verifier()
  const nomFichier = nomFichierExport(s.nom, options.format)
  telecharger(nomFichier, new Blob([octets], { type: TYPES_FICHIER.pptx }))
  avancer({ fait: total, total, texte: 'Terminé.' })
  return { nomFichier, pages: scenes.length + (options.pageDeGarde ? 1 : 0) }
}
