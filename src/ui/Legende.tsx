import { useState } from 'react'
import {
  COULEURS_BALLAST,
  COULEURS_GEOMETRIE,
  COULEURS_RAILS,
  COULEURS_SOUS_COUCHE,
  COULEURS_TRAVERSES,
} from '../render/couleurs.ts'

// Légende des couleurs d'état : la couleur porte l'information, la légende
// dit laquelle — même vocabulaire que FORMAT.md, jamais paraphrasé.

const LIBELLES: Record<string, string> = {
  poses: 'posés',
  tronconnes: 'tronçonnés',
  desclisses: 'desclissés',
  deposes_en_extremite: 'déposés en extrémité',
  neufs_poses: 'neufs posés',
  anciennes: 'anciennes',
  deposees: 'déposées',
  neuves_reparties: 'neuves réparties',
  neuves_posees: 'neuves posées',
  ancien: 'ancien',
  deballaste: 'déballasté',
  neuf_repandu: 'neuf répandu',
  regale: 'régalé',
  deversee: 'déversée',
  lissee: 'lissée',
  compactee: 'compactée',
  calee: 'calée',
  bourree: 'bourrée',
  reglee: 'réglée',
  soudee: 'soudée',
}

function Rangee({ titre, entrees }: { titre: string; entrees: [string, string][] }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <strong>{titre}</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
        {entrees.map(([valeur, couleur]) => (
          <span key={valeur} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 14,
                height: 14,
                background: couleur,
                border: '1px solid #8b9299',
                display: 'inline-block',
              }}
            />
            {LIBELLES[valeur] ?? valeur}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Legende() {
  const [ouverte, setOuverte] = useState(false)
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 72,
        maxWidth: 420,
        padding: '8px 12px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.92)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        color: '#1c2430',
      }}
    >
      <button onClick={() => setOuverte(!ouverte)} style={{ cursor: 'pointer' }}>
        {ouverte ? 'Masquer la légende' : 'Légende'}
      </button>
      {ouverte && (
        <div style={{ marginTop: 8 }}>
          <Rangee titre="Rails" entrees={Object.entries(COULEURS_RAILS)} />
          <Rangee titre="Traverses" entrees={Object.entries(COULEURS_TRAVERSES)} />
          <Rangee
            titre="Ballast"
            entrees={Object.entries(COULEURS_BALLAST).map(([v, r]) => [v, r.couleur])}
          />
          <Rangee
            titre="Sous-couche"
            entrees={Object.entries(COULEURS_SOUS_COUCHE).map(([v, r]) => [v, r.couleur])}
          />
          <Rangee titre="Géométrie (pastille)" entrees={Object.entries(COULEURS_GEOMETRIE)} />
        </div>
      )}
    </div>
  )
}
