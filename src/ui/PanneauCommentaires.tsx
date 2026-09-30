import { useEffect, useRef, type ReactNode } from 'react'
import { modifierCommentaire, TAILLES_COMMENTAIRE, type ChampsCommentaire, type Commentaire } from '../plan/commentaires.ts'
import { COULEURS } from './couleurs.ts'
import { ChampCouleur } from './PanneauCalques.tsx'
import { stylesPanneau as styles } from './styles.ts'
import { TOUCHES_IMAGE, type EditeurImage } from './useEditeurImage.ts'

// Panneaux des commentaires de l'image courante d'un synoptique : le
// commentaire choisi (texte sur une ou plusieurs lignes, taille, couleur,
// gras, cadre) et le calque « Commentaires » — visible, verrouillé, la liste
// des commentaires de l'image.

function Section({ titre, children, testid }: { titre: ReactNode; children: ReactNode; testid?: string }) {
  return (
    <section style={styles.section} data-testid={testid}>
      <h2 style={styles.titre}>{titre}</h2>
      {children}
    </section>
  )
}

const premiereLigne = (c: Commentaire): string => c.texte.split('\n')[0].trim() || '(vide)'

export function PanneauCommentaire({ editeur }: { editeur: EditeurImage }) {
  const { commentaire, calqueCommentaires } = editeur
  const champ = useRef<HTMLTextAreaElement>(null)
  const id = commentaire?.id ?? null
  // Un commentaire qu'on vient de poser : son texte est prêt à être tapé.
  useEffect(() => {
    if (id && champ.current && champ.current.value === 'Commentaire') champ.current.select()
  }, [id])
  if (!commentaire) return null
  const modifier = (champs: ChampsCommentaire, cle: string | null = null) =>
    editeur.modifierCommentaires((liste) => modifierCommentaire(liste, commentaire.id, champs), cle)
  return (
    <Section titre="Commentaire choisi" testid="panneau-commentaire">
      <fieldset disabled={calqueCommentaires.verrouille} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
        <textarea
          ref={champ}
          value={commentaire.texte}
          rows={3}
          aria-label="Texte du commentaire"
          placeholder="« RCT en place », « Enraillement sur platelage V2 »…"
          style={{ ...styles.champ, display: 'block', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          onChange={(e) => modifier({ texte: e.target.value }, `texte:${commentaire.id}`)}
        />
        <div style={styles.ligne}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Taille
            <select
              value={String(commentaire.taille)}
              aria-label="Taille du commentaire"
              style={styles.champ}
              onChange={(e) => modifier({ taille: Number(e.target.value) })}
            >
              {!TAILLES_COMMENTAIRE.some((t) => t.valeur === commentaire.taille) && <option value={String(commentaire.taille)}>Autre</option>}
              {TAILLES_COMMENTAIRE.map((t) => (
                <option key={t.valeur} value={String(t.valeur)}>
                  {t.libelle}
                </option>
              ))}
            </select>
          </label>
          <ChampCouleur valeur={commentaire.couleur} libelle="Couleur du commentaire" changer={(couleur) => modifier({ couleur }, `couleur:${commentaire.id}`)} />
        </div>
        <div style={{ ...styles.ligne, gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={commentaire.gras} aria-label="Commentaire en gras" onChange={(e) => modifier({ gras: e.target.checked })} />
            Gras
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Cadre blanc bordé de la couleur du texte">
            <input type="checkbox" checked={commentaire.encadre} aria-label="Commentaire encadré" onChange={(e) => modifier({ encadre: e.target.checked })} />
            Encadré
          </label>
        </div>
        <p style={styles.discret}>Glissez le commentaire sur l'image pour le placer ; double-cliquez dessus pour modifier son texte sur place. Il sort en zone de texte modifiable dans l'export PowerPoint.</p>
        <button
          style={{ ...styles.petitBouton, color: COULEURS.erreur, marginTop: 4 }}
          onClick={() => editeur.supprimerCommentaire(commentaire.id)}
          title="Retirer de cette image (Suppr)"
        >
          Supprimer le commentaire
        </button>
      </fieldset>
    </Section>
  )
}

export function CalqueCommentaires({ editeur }: { editeur: EditeurImage }) {
  const { planche, calqueCommentaires: calque, index } = editeur
  const nombre = planche.commentaires.length
  return (
    <section style={styles.section} data-testid="calque-commentaires">
      <h2 style={styles.titre}>
        Commentaires de l'image {index + 1}
        {nombre > 0 && <span style={{ fontWeight: 400 }}> · {nombre}</span>}
      </h2>
      <div style={{ ...styles.ligne, gap: 16 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={calque.visible}
            aria-label="Calque Commentaires visible"
            onChange={(e) => editeur.changerCalqueCommentaires({ visible: e.target.checked })}
          />
          Visible
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }} title="Les commentaires ne se choisissent plus et ne se modifient plus">
          <input
            type="checkbox"
            checked={calque.verrouille}
            aria-label="Calque Commentaires verrouillé"
            onChange={(e) => editeur.changerCalqueCommentaires({ verrouille: e.target.checked })}
          />
          Verrouillé
        </label>
      </div>
      {nombre === 0 && (
        <p style={styles.discret}>
          Aucun commentaire sur cette image : outil « Texte » ({TOUCHES_IMAGE.texte}), puis un clic sur l'image. Pour ce qui n'a pas de symbole :
          RCT, platelage…
        </p>
      )}
      <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }} data-testid="liste-commentaires">
        {planche.commentaires.map((c) => {
          const choisi = editeur.commentaire?.id === c.id
          return (
            <li
              key={c.id}
              onClick={() => editeur.choisirCommentaire(c.id)}
              data-testid="ligne-commentaire"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                margin: '4px 0',
                borderRadius: 6,
                border: `1px solid ${choisi ? COULEURS.selection : COULEURS.bordure}`,
                background: choisi ? '#e8f0f9' : '#fff',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c.couleur, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{premiereLigne(c)}</span>
              <button
                style={{ ...styles.petitBouton, color: COULEURS.erreur }}
                disabled={calque.verrouille}
                title="Retirer de cette image (Suppr)"
                aria-label={`Supprimer le commentaire ${premiereLigne(c)}`}
                onClick={(e) => {
                  e.stopPropagation()
                  editeur.supprimerCommentaire(c.id)
                }}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>
      <p style={styles.discret}>« + Nouvelle image » recopie les commentaires : il ne reste qu'à changer ce qui change.</p>
    </section>
  )
}
