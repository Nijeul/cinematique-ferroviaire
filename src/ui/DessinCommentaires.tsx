import { miseEnPageCommentaire, type Cadre, type Commentaire } from '../plan/commentaires.ts'
import { COULEURS } from './couleurs.ts'

// Les commentaires d'une image : un texte dans un cadre blanc bordé de sa
// couleur (ou, sans cadre, avec un liseré blanc), par-dessus le plan, les
// engins et les flèches, pour rester lisibles.

export function DessinCommentaire(props: { commentaire: Commentaire; plan: Cadre; choisi: boolean; zoom: number }) {
  const { commentaire: c, plan, choisi, zoom } = props
  const m = miseEnPageCommentaire(c, plan)
  const b = m.boite
  return (
    <g data-testid="commentaire" data-texte={c.texte}>
      {c.encadre && (
        <rect x={b.x} y={b.y} width={b.largeur} height={b.hauteur} fill="#ffffff" stroke={c.couleur} strokeWidth={m.taille * 0.08} />
      )}
      {choisi && (
        <rect
          x={b.x - 4 / zoom}
          y={b.y - 4 / zoom}
          width={b.largeur + 8 / zoom}
          height={b.hauteur + 8 / zoom}
          fill="none"
          stroke={COULEURS.selection}
          strokeWidth={1.8 / zoom}
          strokeDasharray={`${5 / zoom} ${3 / zoom}`}
        />
      )}
      {m.lignes.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          fontSize={m.taille}
          fontWeight={c.gras ? 700 : 400}
          fill={c.couleur}
          style={{ userSelect: 'none', whiteSpace: 'pre' }}
          {...(c.encadre ? {} : { stroke: '#ffffff', strokeWidth: m.taille * 0.22, paintOrder: 'stroke', strokeLinejoin: 'round' as const })}
        >
          {l.texte}
        </text>
      ))}
    </g>
  )
}

export function DessinCommentaires(props: {
  commentaires: Commentaire[]
  plan: Cadre
  visible: boolean
  zoom: number
  choisi?: string | null
}) {
  if (!props.visible || props.commentaires.length === 0) return null
  return (
    <g data-testid="commentaires">
      {props.commentaires.map((c) => (
        <DessinCommentaire key={c.id} commentaire={c} plan={props.plan} choisi={c.id === props.choisi} zoom={props.zoom} />
      ))}
    </g>
  )
}
