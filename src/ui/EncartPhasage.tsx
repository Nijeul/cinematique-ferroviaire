import { etatAtMemoise } from '../state/etatAt.ts'
import { useApplication } from './store.ts'

// Encart « PHASAGE » : les opérations actives à l'instant courant, avec leur
// numéro et leur libellé, régénérées automatiquement — l'équivalent de
// l'encart des planches actuelles.
export function EncartPhasage() {
  const projet = useApplication((etat) => etat.projet)
  const t = useApplication((etat) => etat.t)
  if (!projet) return null

  const actives = new Set(etatAtMemoise(projet, t).operations)
  const operations = projet.operations
    .filter((op) => actives.has(op.id))
    .sort((a, b) => a.numero - b.numero || a.id.localeCompare(b.id))

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 72,
        width: 340,
        maxHeight: '42vh',
        overflowY: 'auto',
        padding: '10px 14px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.92)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        color: '#1c2430',
        border: '1px solid #b9c0c8',
      }}
    >
      <div style={{ fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>PHASAGE</div>
      {operations.length === 0 ? (
        <em>Aucune opération en cours.</em>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {operations.map((op) => (
              <tr key={op.id} style={{ verticalAlign: 'top' }}>
                <td style={{ fontWeight: 700, paddingRight: 8, whiteSpace: 'nowrap' }}>
                  {op.numero}
                  {op.optionnelle ? ' *' : ''}
                </td>
                <td style={{ paddingBottom: 4 }}>{op.libelle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
