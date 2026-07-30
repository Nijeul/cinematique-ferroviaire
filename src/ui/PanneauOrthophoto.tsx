import { useRef, useState } from 'react'
import { useApplication } from './store.ts'

// Import d'une orthophoto : une image, ou une page d'un PDF rendue en image
// (pdf.js). Calage par deux points : cliquer deux repères sur l'aperçu, puis
// donner leurs coordonnées en mètres dans le système du site.

type ImageImportee = { dataUrl: string; largeurPx: number; hauteurPx: number }

async function lireFichier(fichier: File, page: number): Promise<ImageImportee> {
  if (fichier.type === 'application/pdf' || fichier.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
    const document = await pdfjs.getDocument({ data: await fichier.arrayBuffer() }).promise
    const pageChoisie = await document.getPage(Math.min(Math.max(page, 1), document.numPages))
    const vue = pageChoisie.getViewport({ scale: 2 })
    const toile = window.document.createElement('canvas')
    toile.width = Math.ceil(vue.width)
    toile.height = Math.ceil(vue.height)
    const contexte = toile.getContext('2d')
    if (!contexte) throw new Error('canvas indisponible')
    await pageChoisie.render({ canvas: toile, canvasContext: contexte, viewport: vue }).promise
    return { dataUrl: toile.toDataURL('image/jpeg', 0.9), largeurPx: toile.width, hauteurPx: toile.height }
  }
  const dataUrl = await new Promise<string>((resoudre, rejeter) => {
    const lecteur = new FileReader()
    lecteur.onload = () => resoudre(lecteur.result as string)
    lecteur.onerror = () => rejeter(new Error('lecture du fichier impossible'))
    lecteur.readAsDataURL(fichier)
  })
  const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
    const element = new Image()
    element.onload = () => resoudre(element)
    element.onerror = () => rejeter(new Error('image illisible'))
    element.src = dataUrl
  })
  return { dataUrl, largeurPx: image.naturalWidth, hauteurPx: image.naturalHeight }
}

const styleChamp = { width: 72, marginLeft: 4 }

export function PanneauOrthophoto() {
  const orthophoto = useApplication((etat) => etat.orthophoto)
  const fixerOrthophoto = useApplication((etat) => etat.fixerOrthophoto)
  const [ouvert, setOuvert] = useState(false)
  const [page, setPage] = useState(1)
  const [image, setImage] = useState<ImageImportee | null>(null)
  const [points, setPoints] = useState<[number, number][]>([])
  const [monde, setMonde] = useState<[string, string, string, string]>(['0', '0', '100', '0'])
  const [message, setMessage] = useState('')
  const apercuRef = useRef<HTMLImageElement>(null)

  const surFichier = async (fichier: File | undefined) => {
    if (!fichier) return
    try {
      setMessage('Lecture du fichier…')
      setImage(await lireFichier(fichier, page))
      setPoints([])
      setMessage('Cliquez deux points de repère sur l’aperçu.')
    } catch (erreur) {
      setMessage(`Échec : ${(erreur as Error).message}`)
    }
  }

  const surClicApercu = (evenement: React.MouseEvent<HTMLImageElement>) => {
    const apercu = apercuRef.current
    if (!apercu || !image || points.length >= 2) return
    const cadre = apercu.getBoundingClientRect()
    const px = ((evenement.clientX - cadre.left) / cadre.width) * image.largeurPx
    const py = ((evenement.clientY - cadre.top) / cadre.height) * image.hauteurPx
    setPoints([...points, [px, py]])
  }

  const appliquer = () => {
    if (!image || points.length < 2) return
    const valeurs = monde.map(Number)
    if (valeurs.some(Number.isNaN)) {
      setMessage('Coordonnées en mètres invalides.')
      return
    }
    fixerOrthophoto({
      image: image.dataUrl,
      largeurPx: image.largeurPx,
      hauteurPx: image.hauteurPx,
      ancrages: [
        { pixel: points[0], monde: [valeurs[0], valeurs[1]] },
        { pixel: points[1], monde: [valeurs[2], valeurs[3]] },
      ],
    })
    setMessage('Orthophoto calée et posée au sol.')
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: ouvert ? 340 : 'auto',
        padding: '10px 14px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.9)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        color: '#1c2430',
      }}
    >
      <button onClick={() => setOuvert(!ouvert)} style={{ cursor: 'pointer' }}>
        {ouvert ? 'Fermer' : 'Orthophoto…'}
      </button>
      {ouvert && (
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          <label>
            Fichier (image ou PDF) :
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(evenement) => void surFichier(evenement.target.files?.[0])}
            />
          </label>
          <label>
            Page du PDF :
            <input
              type="number"
              min={1}
              value={page}
              onChange={(evenement) => setPage(Number(evenement.target.value))}
              style={styleChamp}
            />
          </label>
          {image && (
            <div style={{ position: 'relative' }}>
              <img
                ref={apercuRef}
                src={image.dataUrl}
                onClick={surClicApercu}
                style={{ width: '100%', cursor: points.length < 2 ? 'crosshair' : 'default' }}
                alt="Aperçu de l'orthophoto"
              />
              {points.map(([px, py], i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${(px / image.largeurPx) * 100}%`,
                    top: `${(py / image.hauteurPx) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    color: '#c22',
                    fontWeight: 700,
                  }}
                >
                  ✛{i + 1}
                </span>
              ))}
            </div>
          )}
          {image && points.length >= 2 && (
            <>
              <div>
                Point 1 en mètres — X :
                <input value={monde[0]} onChange={(e) => setMonde([e.target.value, monde[1], monde[2], monde[3]])} style={styleChamp} />
                Y :
                <input value={monde[1]} onChange={(e) => setMonde([monde[0], e.target.value, monde[2], monde[3]])} style={styleChamp} />
              </div>
              <div>
                Point 2 en mètres — X :
                <input value={monde[2]} onChange={(e) => setMonde([monde[0], monde[1], e.target.value, monde[3]])} style={styleChamp} />
                Y :
                <input value={monde[3]} onChange={(e) => setMonde([monde[0], monde[1], monde[2], e.target.value])} style={styleChamp} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={appliquer} style={{ cursor: 'pointer' }}>Caler et poser au sol</button>
                <button onClick={() => setPoints([])} style={{ cursor: 'pointer' }}>Reprendre les points</button>
              </div>
            </>
          )}
          {orthophoto && (
            <button onClick={() => fixerOrthophoto(null)} style={{ cursor: 'pointer' }}>
              Retirer l’orthophoto
            </button>
          )}
          {message && <em>{message}</em>}
        </div>
      )}
    </div>
  )
}
