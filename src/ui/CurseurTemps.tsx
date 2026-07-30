import { useApplication } from './store.ts'
import { formaterInstant } from './temps.ts'

// Curseur temporel : déplacer le curseur change l'aspect des zones.
// La lecture animée (vitesses, pause) arrive au lot 9.
export function CurseurTemps() {
  const projet = useApplication((etat) => etat.projet)
  const t = useApplication((etat) => etat.t)
  const fixerT = useApplication((etat) => etat.fixerT)
  if (!projet) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 16px',
        borderRadius: 6,
        background: 'rgba(255, 255, 255, 0.88)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        color: '#1c2430',
      }}
    >
      <strong style={{ minWidth: 110 }}>{formaterInstant(projet.temps.t0, t)}</strong>
      <input
        type="range"
        min={0}
        max={projet.temps.dureeMinutes}
        step={5}
        value={t}
        onChange={(evenement) => fixerT(Number(evenement.target.value))}
        style={{ flex: 1 }}
        aria-label="Instant du chantier"
      />
      <span style={{ minWidth: 130, textAlign: 'right' }}>
        t = {t} min / {projet.temps.dureeMinutes}
      </span>
    </div>
  )
}
