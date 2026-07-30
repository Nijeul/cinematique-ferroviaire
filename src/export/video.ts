import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import type { Projet } from '../domain/projet.ts'
import { cibleCapture } from './capture.ts'
import { dessinerIncrustations } from './incrustation.ts'

// Export vidéo. Chemin principal : WebCodecs + mp4-muxer, image par image —
// possible parce que etatAt(t) est pure : chaque image est calculée à son
// instant exact, indépendamment de la précédente. WebCodecs n'existe ni sur
// Safari ni sur Firefox : repli WebM via MediaRecorder, en temps réel.

export type OptionsVideo = {
  projet: Projet
  // Minutes de chantier par seconde de vidéo.
  minutesParSeconde: number
  imagesParSeconde: number
  fixerT: (t: number) => void
  surProgression: (fraction: number) => void
  annulation: { demandee: boolean }
}

export const supporteWebCodecs = (): boolean =>
  typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'

const prochaineImage = (): Promise<void> =>
  new Promise((resoudre) => requestAnimationFrame(() => requestAnimationFrame(() => resoudre())))

function preparerComposition(): {
  toile: HTMLCanvasElement
  contexte: CanvasRenderingContext2D
  source: HTMLCanvasElement
} {
  const source = cibleCapture.canvas
  if (!source) throw new Error('scène 3D introuvable')
  const reduction = Math.min(1, 1920 / source.width)
  const toile = document.createElement('canvas')
  toile.width = Math.floor((source.width * reduction) / 2) * 2
  toile.height = Math.floor((source.height * reduction) / 2) * 2
  const contexte = toile.getContext('2d')
  if (!contexte) throw new Error('canvas 2D indisponible')
  return { toile, contexte, source }
}

function telecharger(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(url)
}

// Export MP4 image par image, frame-accurate.
export async function exporterMP4(options: OptionsVideo): Promise<void> {
  const { projet, minutesParSeconde, imagesParSeconde, fixerT, surProgression, annulation } = options
  const { toile, contexte, source } = preparerComposition()
  const nombreImages = Math.ceil(
    (projet.temps.dureeMinutes / minutesParSeconde) * imagesParSeconde,
  )

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: toile.width, height: toile.height },
    fastStart: 'in-memory',
  })
  const encodeur = new VideoEncoder({
    output: (morceau, meta) => muxer.addVideoChunk(morceau, meta),
    error: (erreur) => {
      throw erreur
    },
  })
  encodeur.configure({
    codec: 'avc1.4d0028',
    width: toile.width,
    height: toile.height,
    bitrate: 9_000_000,
    framerate: imagesParSeconde,
  })

  for (let image = 0; image <= nombreImages; image++) {
    if (annulation.demandee) {
      encodeur.close()
      return
    }
    const t = Math.min((image / imagesParSeconde) * minutesParSeconde, projet.temps.dureeMinutes)
    fixerT(t)
    await prochaineImage()
    contexte.drawImage(source, 0, 0, toile.width, toile.height)
    dessinerIncrustations(contexte, projet, t)
    const trame = new VideoFrame(toile, {
      timestamp: Math.round((image * 1e6) / imagesParSeconde),
      duration: Math.round(1e6 / imagesParSeconde),
    })
    encodeur.encode(trame, { keyFrame: image % 150 === 0 })
    trame.close()
    if (encodeur.encodeQueueSize > 8) await encodeur.flush()
    surProgression(image / nombreImages)
  }
  await encodeur.flush()
  muxer.finalize()
  telecharger(
    new Blob([muxer.target.buffer], { type: 'video/mp4' }),
    'cinematique.mp4',
  )
}

// Repli WebM en temps réel pour les navigateurs sans WebCodecs.
export async function exporterWebM(options: OptionsVideo): Promise<void> {
  const { projet, minutesParSeconde, imagesParSeconde, fixerT, surProgression, annulation } = options
  const { toile, contexte, source } = preparerComposition()
  const flux = toile.captureStream(imagesParSeconde)
  const enregistreur = new MediaRecorder(flux, {
    mimeType: 'video/webm',
    videoBitsPerSecond: 9_000_000,
  })
  const morceaux: Blob[] = []
  enregistreur.ondataavailable = (evenement) => morceaux.push(evenement.data)
  const fin = new Promise<void>((resoudre) => {
    enregistreur.onstop = () => resoudre()
  })
  enregistreur.start()

  const nombreImages = Math.ceil(
    (projet.temps.dureeMinutes / minutesParSeconde) * imagesParSeconde,
  )
  for (let image = 0; image <= nombreImages; image++) {
    if (annulation.demandee) break
    const t = Math.min((image / imagesParSeconde) * minutesParSeconde, projet.temps.dureeMinutes)
    fixerT(t)
    await prochaineImage()
    contexte.drawImage(source, 0, 0, toile.width, toile.height)
    dessinerIncrustations(contexte, projet, t)
    surProgression(image / nombreImages)
  }
  enregistreur.stop()
  await fin
  if (!annulation.demandee) {
    telecharger(new Blob(morceaux, { type: 'video/webm' }), 'cinematique.webm')
  }
}
