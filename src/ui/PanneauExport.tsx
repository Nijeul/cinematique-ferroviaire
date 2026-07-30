import { useRef, useState } from 'react'
import { capturerPlanches, exporterPDF, exporterPPTX } from '../export/planches.ts'
import { exporterMP4, exporterWebM, supporteWebCodecs } from '../export/video.ts'
import { useApplication } from './store.ts'

// Export vidéo : MP4 image par image quand le navigateur le permet, sinon
// WebM en temps réel — l'utilisateur est prévenu clairement.
export function PanneauExport({
  boutonsSupplementaires,
}: {
  boutonsSupplementaires?: React.ReactNode
}) {
  const projet = useApplication((etat) => etat.projet)
  const fixerT = useApplication((etat) => etat.fixerT)
  const [ouvert, setOuvert] = useState(false)
  const [minutesParSeconde, setMinutesParSeconde] = useState(60)
  const [decoupage, setDecoupage] = useState<'creneau' | 'operations'>('creneau')
  const [enCours, setEnCours] = useState(false)
  const [progression, setProgression] = useState(0)
  const [message, setMessage] = useState('')
  const annulation = useRef({ demandee: false })

  if (!projet) return null
  const mp4Possible = supporteWebCodecs()

  const lancer = async () => {
    annulation.current = { demandee: false }
    setEnCours(true)
    setMessage(mp4Possible ? 'Export MP4 image par image…' : 'Export WebM en temps réel…')
    try {
      const options = {
        projet,
        minutesParSeconde,
        imagesParSeconde: 25,
        fixerT,
        surProgression: setProgression,
        annulation: annulation.current,
      }
      if (mp4Possible) await exporterMP4(options)
      else await exporterWebM(options)
      setMessage(annulation.current.demandee ? 'Export annulé.' : 'Export terminé, fichier téléchargé.')
    } catch (erreur) {
      setMessage(`Échec de l'export : ${(erreur as Error).message}`)
    } finally {
      setEnCours(false)
    }
  }

  const lancerPlanches = async (format: 'pdf' | 'pptx') => {
    annulation.current = { demandee: false }
    setEnCours(true)
    setMessage('Capture des planches…')
    try {
      const planches = await capturerPlanches({
        projet,
        decoupage,
        fixerT,
        surProgression: setProgression,
        annulation: annulation.current,
      })
      if (!annulation.current.demandee) {
        setMessage(format === 'pdf' ? 'Assemblage du PDF…' : 'Assemblage du PPTX…')
        if (format === 'pdf') await exporterPDF(planches)
        else await exporterPPTX(planches, projet)
        setMessage('Planches exportées, fichier téléchargé.')
      } else {
        setMessage('Export annulé.')
      }
    } catch (erreur) {
      setMessage(`Échec de l'export : ${(erreur as Error).message}`)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 56,
        right: 12,
        width: ouvert ? 320 : 'auto',
        padding: '8px 12px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.9)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        color: '#1c2430',
      }}
    >
      <button onClick={() => setOuvert(!ouvert)} style={{ cursor: 'pointer' }}>
        {ouvert ? 'Fermer' : 'Exporter…'}
      </button>
      {ouvert && (
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          {!mp4Possible && (
            <div style={{ color: '#8a5a2d' }}>
              Ce navigateur ne sait pas produire de MP4 (Safari, Firefox) : l'export se fera en
              WebM, en temps réel. Pour un MP4, utilisez Chrome ou Edge.
            </div>
          )}
          <label>
            Vitesse : 1 s de vidéo =
            <input
              type="number"
              min={1}
              value={minutesParSeconde}
              onChange={(evenement) => setMinutesParSeconde(Number(evenement.target.value))}
              style={{ width: 64, margin: '0 4px' }}
            />
            min de chantier (durée ≈ {Math.ceil(projet.temps.dureeMinutes / minutesParSeconde)} s)
          </label>
          {enCours ? (
            <div>
              <progress value={progression} max={1} style={{ width: '100%' }} />
              <button
                onClick={() => (annulation.current.demandee = true)}
                style={{ cursor: 'pointer' }}
              >
                Annuler
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => void lancer()} style={{ cursor: 'pointer', fontWeight: 700 }}>
                Exporter la vidéo ({mp4Possible ? 'MP4' : 'WebM'})
              </button>
              <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #d5dade' }} />
              <label>
                Planches :
                <select
                  value={decoupage}
                  onChange={(evenement) =>
                    setDecoupage(evenement.target.value as 'creneau' | 'operations')
                  }
                  style={{ marginLeft: 6 }}
                >
                  <option value="creneau">une par créneau de {projet.temps.pasCreneau} min</option>
                  <option value="operations">une par changement d'opération</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void lancerPlanches('pdf')} style={{ cursor: 'pointer' }}>
                  Exporter en PDF
                </button>
                <button onClick={() => void lancerPlanches('pptx')} style={{ cursor: 'pointer' }}>
                  Exporter en PPTX
                </button>
              </div>
            </>
          )}
          {boutonsSupplementaires}
          {message && <em>{message}</em>}
        </div>
      )}
    </div>
  )
}
