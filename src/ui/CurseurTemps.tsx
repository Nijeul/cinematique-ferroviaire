import { useApplication } from './store.ts'
import { formaterInstant } from './temps.ts'

const VITESSES = [
  { valeur: 15, libelle: '×15' },
  { valeur: 30, libelle: '×30' },
  { valeur: 60, libelle: '×60' },
  { valeur: 120, libelle: '×120' },
  { valeur: 300, libelle: '×300' },
]

// Barre de lecture : lecture/pause, vitesses, curseur, pas par créneau,
// horloge Ve/Sa 01h30. Le modèle reste en minutes ; l'horloge n'est qu'un
// affichage.
export function CurseurTemps() {
  const projet = useApplication((etat) => etat.projet)
  const t = useApplication((etat) => etat.t)
  const lecture = useApplication((etat) => etat.lecture)
  const vitesse = useApplication((etat) => etat.vitesse)
  const fixerT = useApplication((etat) => etat.fixerT)
  const basculerLecture = useApplication((etat) => etat.basculerLecture)
  const fixerVitesse = useApplication((etat) => etat.fixerVitesse)
  if (!projet) return null

  const pas = projet.temps.pasCreneau
  const auCreneau = (valeur: number) =>
    fixerT(Math.min(Math.max(Math.round(valeur / pas) * pas, 0), projet.temps.dureeMinutes))

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 6,
        background: 'rgba(255, 255, 255, 0.9)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        color: '#1c2430',
      }}
    >
      <button
        onClick={basculerLecture}
        style={{ cursor: 'pointer', fontSize: 16, width: 42 }}
        aria-label={lecture ? 'Pause' : 'Lecture'}
      >
        {lecture ? '⏸' : '▶'}
      </button>
      <button onClick={() => auCreneau(t - pas)} style={{ cursor: 'pointer' }} aria-label="Créneau précédent">
        −{pas}′
      </button>
      <button onClick={() => auCreneau(t + pas)} style={{ cursor: 'pointer' }} aria-label="Créneau suivant">
        +{pas}′
      </button>
      <select
        value={vitesse}
        onChange={(evenement) => fixerVitesse(Number(evenement.target.value))}
        aria-label="Vitesse de lecture"
      >
        {VITESSES.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
      <strong style={{ minWidth: 118, fontSize: 16 }}>
        {formaterInstant(projet.temps.t0, t)}
      </strong>
      <input
        type="range"
        min={0}
        max={projet.temps.dureeMinutes}
        step={1}
        value={t}
        onChange={(evenement) => fixerT(Number(evenement.target.value))}
        style={{ flex: 1 }}
        aria-label="Instant du chantier"
      />
      <span style={{ minWidth: 140, textAlign: 'right' }}>
        t = {Math.round(t)} min / {projet.temps.dureeMinutes}
      </span>
    </div>
  )
}
