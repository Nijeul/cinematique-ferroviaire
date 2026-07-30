import { useApplication } from './store.ts'

const LIBELLES_TYPE: Record<string, string> = {
  orthographique_inclinee: 'générale',
  cadree: 'cadrée',
  suivi: 'suivi',
}

// Changement de vue en lecture : la vue libre à la souris, puis les vues
// déclarées dans le fichier .cinef.
export function SelecteurVues() {
  const projet = useApplication((etat) => etat.projet)
  const vueActive = useApplication((etat) => etat.vueActive)
  const fixerVue = useApplication((etat) => etat.fixerVue)
  if (!projet) return null

  const bouton = (id: string, libelle: string) => (
    <button
      key={id}
      onClick={() => fixerVue(id)}
      style={{
        cursor: 'pointer',
        padding: '4px 10px',
        borderRadius: 4,
        border: '1px solid #9aa4ad',
        background: vueActive === id ? '#33506b' : '#ffffff',
        color: vueActive === id ? '#ffffff' : '#1c2430',
      }}
    >
      {libelle}
    </button>
  )

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 6,
        padding: 6,
        borderRadius: 6,
        background: 'rgba(255,255,255,0.85)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
      }}
    >
      {bouton('libre', 'Vue libre')}
      {projet.vues.map((vue) =>
        bouton(vue.id, `${vue.id} (${LIBELLES_TYPE[vue.type] ?? vue.type})`),
      )}
    </div>
  )
}
