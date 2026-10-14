import { useEffect, useLayoutEffect, useRef } from 'react'
import { actionToucheEdition, type ChampEdition } from '../plan/textesPlanche.ts'
import { COULEURS } from './couleurs.ts'
import { POLICE_PLANCHE } from './styles.ts'

// Le champ de saisie d'un texte de la planche, ouvert à sa place sur l'image
// (double-clic) : commentaire, libellé de flèche, bandeau de titre, titre du
// créneau ou étape du PHASAGE. Même taille, police et couleur que le texte
// dessiné, sur le fond de son cadre ; le champ suit le texte en cours (la
// planche est mise en page avec lui). Entrée valide, Maj+Entrée va à la ligne
// (sauf sur une seule ligne), Échap annule, cliquer ailleurs valide. Les
// raccourcis de l'écran ne se déclenchent pas pendant la frappe (le champ a le
// focus), et les clics dans le champ ne vont pas à l'image.
export function ChampSurPlanche(props: {
  champ: ChampEdition
  texte: string
  zoom: number
  libelle: string
  changer: (texte: string) => void
  valider: () => void
  annuler: () => void
}) {
  const { champ: c, zoom } = props
  const zone = useRef<HTMLTextAreaElement>(null)
  const numero = useRef<HTMLSpanElement>(null)
  // Ouvert une fois par édition (l'image le recrée à chaque ouverture).
  useEffect(() => {
    const t = zone.current
    if (!t) return
    t.focus()
    t.select()
  }, [])
  // Le texte de l'étape commence juste après son numéro (mesuré dans la page) ;
  // les lignes suivantes repartent au bord, comme dans l'encart.
  const { prefixe, taille } = c
  useLayoutEffect(() => {
    const t = zone.current
    if (!t) return
    t.style.textIndent = prefixe && numero.current ? `${numero.current.offsetWidth}px` : '0px'
  }, [prefixe, taille])
  const b = c.boite
  const bord = 2 / zoom
  const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation()
  const police = {
    margin: 0,
    fontFamily: POLICE_PLANCHE,
    fontStyle: 'normal',
    fontSize: c.taille,
    lineHeight: `${c.interligne}px`,
    fontWeight: c.gras ? 700 : 400,
    color: c.couleur,
  } as const
  return (
    <foreignObject
      x={b.x - bord}
      y={b.y - bord}
      width={b.largeur + 2 * bord}
      height={b.hauteur + 2 * bord}
      transform={c.rotation ? `rotate(${c.rotation.angle} ${c.rotation.x} ${c.rotation.y})` : undefined}
      data-testid="edition-texte"
      onPointerDown={arreter}
      onPointerMove={arreter}
      onPointerUp={arreter}
      onDoubleClick={arreter}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <textarea
          ref={zone}
          value={props.texte}
          aria-label={props.libelle}
          spellCheck={false}
          style={{
            ...police,
            display: 'block',
            boxSizing: 'border-box',
            width: '100%',
            height: '100%',
            padding: `${c.retrait.y}px ${c.retrait.x}px`,
            textAlign: c.centre ? 'center' : 'left',
            background: c.fond,
            border: `${bord}px solid ${COULEURS.selection}`,
            borderRadius: 0,
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            whiteSpace: c.coupe ? 'pre-wrap' : 'pre',
          }}
          onChange={(e) => props.changer(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            const action = actionToucheEdition(e.key, e.shiftKey, c.multiligne)
            if (action === 'valider' || action === 'annuler') {
              e.preventDefault()
              if (action === 'valider') props.valider()
              else props.annuler()
            }
          }}
          // Validé ou annulé une seule fois : l'image y veille (la perte du
          // focus qui suit Entrée ou Échap ne compte pas).
          onBlur={() => props.valider()}
        />
        {c.prefixe && (
          // Le numéro de l'étape, fixe, devant le texte qu'on tape.
          <span
            ref={numero}
            aria-hidden="true"
            style={{ ...police, position: 'absolute', left: bord + c.retrait.x, top: bord + c.retrait.y, pointerEvents: 'none', whiteSpace: 'pre' }}
          >
            {c.prefixe}
          </span>
        )}
      </div>
    </foreignObject>
  )
}
