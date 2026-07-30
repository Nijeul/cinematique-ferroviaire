import { useRef, useState } from 'react'
import { useApplication } from '../ui/store.ts'
import { EditeurSite } from './EditeurSite.tsx'
import { enregistrerProjet, lireFichierTexte } from './fichier.ts'
import { nouveauProjetVide } from './outils.ts'

// Panneau d'édition : fichier (nouveau, ouvrir, enregistrer), onglets Site
// et Opérations, avertissements de cohérence pendant la saisie.
export function PanneauEdition({
  ongletsSupplementaires = [],
}: {
  ongletsSupplementaires?: { titre: string; contenu: React.ReactNode }[]
}) {
  const projet = useApplication((etat) => etat.projet)
  const nomFichier = useApplication((etat) => etat.nomFichier)
  const avertissements = useApplication((etat) => etat.avertissements)
  const editionOuverte = useApplication((etat) => etat.editionOuverte)
  const basculerEdition = useApplication((etat) => etat.basculerEdition)
  const remplacerProjet = useApplication((etat) => etat.remplacerProjet)
  const chargerTexte = useApplication((etat) => etat.chargerTexte)
  const [onglet, setOnglet] = useState(0)
  const entreeFichier = useRef<HTMLInputElement>(null)

  if (!editionOuverte) {
    return (
      <button
        onClick={basculerEdition}
        style={{
          position: 'absolute',
          top: 92,
          left: 12,
          cursor: 'pointer',
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid #9aa4ad',
          background: 'rgba(255,255,255,0.9)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Édition…
      </button>
    )
  }

  const onglets = [
    { titre: 'Site', contenu: projet ? <EditeurSite projet={projet} /> : null },
    ...ongletsSupplementaires,
  ]

  return (
    <div
      style={{
        position: 'absolute',
        top: 92,
        left: 12,
        width: 470,
        maxHeight: 'calc(100vh - 180px)',
        overflowY: 'auto',
        padding: '10px 14px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.95)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        color: '#1c2430',
        border: '1px solid #b9c0c8',
      }}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <button onClick={basculerEdition} style={{ cursor: 'pointer' }}>Fermer</button>
        <button onClick={() => remplacerProjet(nouveauProjetVide())} style={{ cursor: 'pointer' }}>
          Nouveau chantier
        </button>
        <button onClick={() => entreeFichier.current?.click()} style={{ cursor: 'pointer' }}>
          Ouvrir…
        </button>
        <input
          ref={entreeFichier}
          type="file"
          accept=".cinef,application/json"
          style={{ display: 'none' }}
          onChange={async (evenement) => {
            const fichier = evenement.target.files?.[0]
            if (fichier) chargerTexte(await lireFichierTexte(fichier), fichier.name)
            evenement.target.value = ''
          }}
        />
        {projet && (
          <button onClick={() => enregistrerProjet(projet, nomFichier)} style={{ cursor: 'pointer' }}>
            Enregistrer
          </button>
        )}
      </div>

      {avertissements.length > 0 && (
        <div style={{ color: '#8a5a2d', marginBottom: 8 }}>
          <strong>À corriger :</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {avertissements.slice(0, 8).map((avertissement) => (
              <li key={avertissement}>{avertissement}</li>
            ))}
            {avertissements.length > 8 && <li>… et {avertissements.length - 8} autres.</li>}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {onglets.map((definition, i) => (
          <button
            key={definition.titre}
            onClick={() => setOnglet(i)}
            style={{
              cursor: 'pointer',
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid #9aa4ad',
              background: onglet === i ? '#33506b' : '#ffffff',
              color: onglet === i ? '#ffffff' : '#1c2430',
            }}
          >
            {definition.titre}
          </button>
        ))}
      </div>
      {onglets[Math.min(onglet, onglets.length - 1)]?.contenu}
    </div>
  )
}
