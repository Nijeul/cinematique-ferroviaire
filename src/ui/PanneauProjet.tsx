import { useApplication } from './store.ts'

// Affiche le fichier chargé et son état de validation. En cas de fichier
// invalide, les erreurs — déjà en français — sont listées telles quelles.
export function PanneauProjet() {
  const projet = useApplication((etat) => etat.projet)
  const erreurs = useApplication((etat) => etat.erreurs)
  const nomFichier = useApplication((etat) => etat.nomFichier)

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
      {erreurs.length > 0 ? (
        <>
          <strong style={{ color: '#a4282d' }}>Fichier .cinef invalide — {nomFichier}</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {erreurs.map((erreur) => (
              <li key={erreur}>{erreur}</li>
            ))}
          </ul>
        </>
      ) : projet ? (
        <>
          <strong>{projet.meta.chantier}</strong>
          <div>
            {nomFichier} — {projet.operations.length} opérations,{' '}
            {projet.site.zones.length} zones, {projet.site.appareils.length} appareils,{' '}
            {projet.ressources.length} ressources.
          </div>
        </>
      ) : null}
    </div>
  )
}
