import type { CSSProperties } from 'react'
import { COULEURS } from './couleurs.ts'

// Styles partagés par tous les écrans : sobres, ceux de l'éditeur des étapes
// 2 et 3.

export const POLICE = 'system-ui, -apple-system, "Segoe UI", sans-serif'

export const styleBouton = (actif = false): CSSProperties => ({
  font: 'inherit',
  fontSize: 13,
  padding: '5px 8px',
  borderRadius: 5,
  border: `1px solid ${actif ? COULEURS.selection : COULEURS.bordure}`,
  background: actif ? COULEURS.selection : '#ffffff',
  color: actif ? '#ffffff' : COULEURS.texte,
  fontWeight: actif ? 600 : 400,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

// Bouton de l'action principale d'un écran (« Nouveau synoptique »…).
export const styleBoutonPrincipal: CSSProperties = { ...styleBouton(true), padding: '6px 12px' }

export const styleBoutonDanger: CSSProperties = { ...styleBouton(), color: COULEURS.erreur }

export const styleChamp: CSSProperties = {
  font: 'inherit',
  fontSize: 13,
  padding: '4px 7px',
  border: `1px solid ${COULEURS.bordure}`,
  borderRadius: 4,
  minWidth: 0,
  background: '#ffffff',
  color: COULEURS.texte,
}

export const styleTitreSection: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: COULEURS.discret,
}

export const styleDiscret: CSSProperties = { fontSize: 12, color: COULEURS.discret, margin: '4px 0' }

export const styleAvertissement: CSSProperties = {
  margin: '4px 0',
  padding: '5px 8px',
  fontSize: 12,
  borderRadius: 4,
  color: COULEURS.avertissement,
  background: '#fdf6e3',
}
