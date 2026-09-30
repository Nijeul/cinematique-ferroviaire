import { useEffect, useRef } from 'react'
import { actionToucheEdition, miseEnPageCommentaire, type Cadre, type Commentaire } from '../plan/commentaires.ts'
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
  // Commentaire en cours d'édition sur l'image : son champ le remplace.
  masque?: string | null
}) {
  if (!props.visible || props.commentaires.length === 0) return null
  return (
    <g data-testid="commentaires">
      {props.commentaires.filter((c) => c.id !== props.masque).map((c) => (
        <DessinCommentaire key={c.id} commentaire={c} plan={props.plan} choisi={c.id === props.choisi} zoom={props.zoom} />
      ))}
    </g>
  )
}

// Édition d'un commentaire à sa place sur l'image (double-clic) : un champ de
// texte de la même taille, police et couleur, qui grandit avec le texte.
// Entrée valide, Maj+Entrée va à la ligne, Échap annule, cliquer ailleurs
// valide. Les raccourcis de l'écran ne se déclenchent pas pendant la frappe
// (le champ a le focus), et les clics dans le champ ne vont pas à l'image.
export function EditionCommentaire(props: {
  commentaire: Commentaire
  texte: string
  plan: Cadre
  zoom: number
  changer: (texte: string) => void
  valider: () => void
  annuler: () => void
}) {
  const { commentaire: c, plan, zoom } = props
  const champ = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const t = champ.current
    if (!t) return
    t.focus()
    t.select()
  }, [c.id])
  const m = miseEnPageCommentaire({ ...c, texte: props.texte }, plan)
  const b = m.boite
  const bord = 2 / zoom
  // Validé ou annulé une seule fois : l'image y veille (la perte du focus qui
  // suit Entrée ou Échap ne compte pas).
  const terminer = (action: 'valider' | 'annuler') => (action === 'valider' ? props.valider() : props.annuler())
  const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation()
  return (
    <foreignObject
      x={b.x - bord}
      y={b.y - bord}
      width={b.largeur + m.taille * 1.5 + 2 * bord}
      height={b.hauteur + m.interligne * 0.5 + 2 * bord}
      data-testid="edition-commentaire"
      onPointerDown={arreter}
      onPointerMove={arreter}
      onPointerUp={arreter}
      onDoubleClick={arreter}
    >
      <textarea
        ref={champ}
        value={props.texte}
        aria-label="Texte du commentaire, sur l’image"
        spellCheck={false}
        style={{
          display: 'block',
          boxSizing: 'border-box',
          width: '100%',
          height: '100%',
          margin: 0,
          padding: `${m.retrait * 0.7}px ${m.retrait}px`,
          font: 'inherit',
          fontSize: m.taille,
          lineHeight: `${m.interligne}px`,
          fontWeight: c.gras ? 700 : 400,
          color: c.couleur,
          background: '#ffffff',
          border: `${bord}px solid ${COULEURS.selection}`,
          borderRadius: 0,
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          whiteSpace: 'pre',
        }}
        onChange={(e) => props.changer(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          const action = actionToucheEdition(e.key, e.shiftKey)
          if (action === 'valider' || action === 'annuler') {
            e.preventDefault()
            terminer(action)
          }
        }}
        onBlur={() => terminer('valider')}
      />
    </foreignObject>
  )
}
