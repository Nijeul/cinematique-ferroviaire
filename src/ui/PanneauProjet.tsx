import { useMemo } from 'react'
import { chargerProjet } from '../domain/chargement.ts'
import contenuOcp1Sud from '../../fixtures/ocp1-sud.cinef?raw'

// Preuve visible du lot 1 : le fichier .cinef de référence est chargé et
// validé au démarrage, et le résultat est affiché. En cas de fichier
// invalide, les erreurs apparaissent en clair au même endroit.
export function PanneauProjet() {
  const resultat = useMemo(() => chargerProjet(contenuOcp1Sud), [])

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        maxWidth: 420,
        padding: '10px 14px',
        borderRadius: 6,
        background: 'rgba(255, 255, 255, 0.88)',
        color: '#1c2430',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      {resultat.ok ? (
        <>
          <strong>{resultat.projet.meta.chantier}</strong>
          <div>
            Fichier .cinef valide — {resultat.projet.operations.length} opérations,{' '}
            {resultat.projet.site.zones.length} zones, {resultat.projet.site.appareils.length}{' '}
            appareils, {resultat.projet.ressources.length} ressources.
          </div>
        </>
      ) : (
        <>
          <strong style={{ color: '#a4282d' }}>Fichier .cinef invalide</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {resultat.erreurs.map((erreur) => (
              <li key={erreur}>{erreur}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
