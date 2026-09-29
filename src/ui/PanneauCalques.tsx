import { useRef, type CSSProperties, type ReactNode } from 'react'
import { modifierCalqueFond, modifierCalqueVoies, modifierVoie, retirerFond, supprimerVoie } from '../plan/edition.ts'
import { bornerPage } from '../plan/fond.ts'
import { EPAISSEUR_MAX, EPAISSEUR_MIN } from '../plan/projet.ts'
import { COULEURS } from './couleurs.ts'
import type { Editeur } from './useEditeur.ts'

// Panneau latéral : nom du projet, calque « Fond », calque « Voies » avec la
// liste des voies (nom, couleur, épaisseur), et l'aide des raccourcis.

const styles = {
  section: { borderBottom: `1px solid ${COULEURS.bordure}`, padding: '12px 14px' },
  titre: { margin: '0 0 8px', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: COULEURS.discret },
  ligne: { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0', fontSize: 13 },
  discret: { fontSize: 12, color: COULEURS.discret, margin: '4px 0' },
  champ: { font: 'inherit', fontSize: 13, padding: '3px 6px', border: `1px solid ${COULEURS.bordure}`, borderRadius: 4, minWidth: 0 },
  petitBouton: { font: 'inherit', fontSize: 12, padding: '2px 8px', border: `1px solid ${COULEURS.bordure}`, borderRadius: 4, background: '#fff', cursor: 'pointer' },
} satisfies Record<string, CSSProperties>

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.titre}>{titre}</h2>
      {children}
    </section>
  )
}

function ChoixPage({ editeur }: { editeur: Editeur }) {
  const { projet, pdf } = editeur
  const minuterie = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const champ = useRef<HTMLInputElement>(null)
  const fond = projet.fond
  if (!fond?.nombrePages) return null
  const page = fond.page ?? 1
  const verrouille = projet.calques.fond.verrouille
  if (!pdf || pdf.nomFichier !== fond.nomFichier) {
    return (
      <p style={styles.discret}>
        Page {page} / {fond.nombrePages}. Pour changer de page, réimportez le PDF.
      </p>
    )
  }
  // La page demandée est ramenée dans le document, et le champ affiche
  // aussitôt la page réellement retenue (9 sur un PDF de 2 pages → 2).
  const aller = (n: number) => {
    clearTimeout(minuterie.current)
    const retenue = bornerPage(n, pdf.nombrePages)
    if (champ.current) champ.current.value = String(retenue)
    void editeur.changerPage(retenue)
  }
  return (
    <div style={styles.ligne} data-testid="choix-page">
      <span>Page</span>
      <button style={styles.petitBouton} disabled={verrouille || page <= 1} onClick={() => aller(page - 1)} title="Page précédente">
        ◀
      </button>
      <input
        key={page}
        ref={champ}
        type="number"
        min={1}
        max={pdf.nombrePages}
        defaultValue={page}
        disabled={verrouille}
        aria-label="Numéro de page"
        style={{ ...styles.champ, width: 56 }}
        onChange={(e) => {
          const valeur = Number(e.currentTarget.value)
          clearTimeout(minuterie.current)
          if (e.currentTarget.value !== '') minuterie.current = setTimeout(() => aller(valeur), 500)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') aller(Number(e.currentTarget.value))
        }}
        onBlur={(e) => {
          if (e.currentTarget.value === '') e.currentTarget.value = String(page)
        }}
      />
      <span>/ {pdf.nombrePages}</span>
      <button
        style={styles.petitBouton}
        disabled={verrouille || page >= pdf.nombrePages}
        onClick={() => aller(page + 1)}
        title="Page suivante"
      >
        ▶
      </button>
    </div>
  )
}

function CalqueFond({ editeur }: { editeur: Editeur }) {
  const { projet, modifier } = editeur
  const calque = projet.calques.fond
  const fond = projet.fond
  return (
    <Section titre="Calque « Fond »">
      {fond ? (
        <>
          <p style={{ ...styles.ligne, fontWeight: 600, wordBreak: 'break-all' }}>{fond.nomFichier}</p>
          <p style={styles.discret}>
            {fond.largeur} × {fond.hauteur} pixels
          </p>
          <ChoixPage editeur={editeur} />
        </>
      ) : (
        <p style={styles.discret}>Aucun fond : utilisez « Importer un fond… » en haut.</p>
      )}
      <label style={styles.ligne}>
        <input
          type="checkbox"
          checked={calque.visible}
          onChange={(e) => {
            const coche = e.target.checked
            modifier((p) => modifierCalqueFond(p, { visible: coche }))
          }}
        />
        Visible
      </label>
      <label style={styles.ligne}>
        <span style={{ width: 58 }}>Opacité</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(calque.opacite * 100)}
          aria-label="Opacité du fond"
          style={{ flex: 1 }}
          onChange={(e) => {
            const opacite = Number(e.target.value) / 100
            modifier((p) => modifierCalqueFond(p, { opacite }), 'opacite-fond')
          }}
        />
        <span style={{ width: 44, textAlign: 'right', whiteSpace: 'nowrap' }}>{Math.round(calque.opacite * 100)} %</span>
      </label>
      <label style={styles.ligne} title="Empêche de remplacer le fond ou d'en changer la page par mégarde">
        <input
          type="checkbox"
          checked={calque.verrouille}
          onChange={(e) => {
            const coche = e.target.checked
            modifier((p) => modifierCalqueFond(p, { verrouille: coche }))
          }}
        />
        Verrouillé
      </label>
      {fond && (
        <button
          style={styles.petitBouton}
          disabled={calque.verrouille}
          onClick={() => {
            editeur.retirerFondPdf()
            modifier(retirerFond)
          }}
        >
          Retirer le fond
        </button>
      )}
    </Section>
  )
}

function CalqueVoies({ editeur }: { editeur: Editeur }) {
  const { projet, modifier, selection } = editeur
  return (
    <Section titre="Calque « Voies »">
      <label style={styles.ligne}>
        <input
          type="checkbox"
          checked={projet.calques.voies.visible}
          onChange={(e) => {
            const coche = e.target.checked
            modifier((p) => modifierCalqueVoies(p, { visible: coche }))
          }}
        />
        Visible
      </label>
      {projet.voies.length === 0 && <p style={styles.discret}>Aucune voie : prenez l'outil « Tracer une voie ».</p>}
      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }} data-testid="liste-voies">
        {projet.voies.map((voie) => {
          const choisie = voie.id === selection?.voieId
          return (
            <li
              key={voie.id}
              onClick={() => editeur.setSelection({ voieId: voie.id, point: null })}
              style={{
                padding: '6px 8px',
                margin: '4px 0',
                borderRadius: 6,
                border: `1px solid ${choisie ? COULEURS.selection : COULEURS.bordure}`,
                background: choisie ? '#e8f0f9' : '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={voie.couleur}
                  aria-label={`Couleur de ${voie.nom}`}
                  title="Couleur de la voie"
                  style={{ width: 30, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                  onChange={(e) => {
                    const couleur = e.target.value
                    modifier((p) => modifierVoie(p, voie.id, { couleur }), `couleur:${voie.id}`)
                  }}
                />
                <input
                  type="text"
                  value={voie.nom}
                  aria-label="Nom de la voie"
                  style={{ ...styles.champ, flex: 1, fontWeight: 600 }}
                  onChange={(e) => {
                    const nom = e.target.value
                    modifier((p) => modifierVoie(p, voie.id, { nom }), `nom:${voie.id}`)
                  }}
                />
                <button
                  style={{ ...styles.petitBouton, color: COULEURS.erreur }}
                  title="Supprimer la voie"
                  aria-label={`Supprimer ${voie.nom}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    modifier((p) => supprimerVoie(p, voie.id))
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ ...styles.ligne, margin: '6px 0 0', color: COULEURS.discret, fontSize: 12 }}>
                <span>Épaisseur</span>
                <input
                  type="number"
                  min={EPAISSEUR_MIN}
                  max={EPAISSEUR_MAX}
                  value={voie.epaisseur}
                  aria-label="Épaisseur de la voie"
                  style={{ ...styles.champ, width: 58, fontSize: 12 }}
                  onChange={(e) => {
                    const valeur = Number(e.target.value)
                    if (e.target.value !== '' && valeur > 0) {
                      modifier((p) => modifierVoie(p, voie.id, { epaisseur: valeur }), `epaisseur:${voie.id}`)
                    }
                  }}
                />
                <span>· {voie.points.length} points</span>
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function Aide() {
  const lignes: [string, string][] = [
    ['Tracer une voie (T)', 'un clic par point ; double-clic ou Entrée pour finir ; Échap annule'],
    ['Maj', 'segment horizontal, vertical ou à 45°'],
    ['Sélection (S)', 'clic sur une voie, puis glisser ses points'],
    ['Suppr', 'supprime le point choisi, sinon la voie'],
    ['Molette', 'zoom autour du curseur'],
    ['Main (M), Espace ou clic molette', 'déplacer la vue'],
    ['Ctrl+Z / Ctrl+Y', 'annuler / rétablir'],
  ]
  return (
    <details open style={{ ...styles.section, borderBottom: 'none' }}>
      <summary style={{ ...styles.titre, cursor: 'pointer' }}>Aide</summary>
      <dl style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>
        {lignes.map(([touche, effet]) => (
          <div key={touche} style={{ marginBottom: 5 }}>
            <dt style={{ fontWeight: 700, display: 'inline' }}>{touche}</dt>
            <dd style={{ display: 'inline', margin: 0, color: COULEURS.discret }}> — {effet}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

export function PanneauCalques({ editeur }: { editeur: Editeur }) {
  const { projet, modifier } = editeur
  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        overflowY: 'auto',
        background: COULEURS.panneau,
        borderLeft: `1px solid ${COULEURS.bordure}`,
      }}
    >
      <Section titre="Projet">
        <input
          type="text"
          value={projet.nom}
          aria-label="Nom du projet"
          style={{ ...styles.champ, width: '100%', boxSizing: 'border-box', fontWeight: 600 }}
          onChange={(e) => {
            const nom = e.target.value
            modifier((p) => ({ ...p, nom }), 'nom-projet')
          }}
        />
      </Section>
      <CalqueFond editeur={editeur} />
      <CalqueVoies editeur={editeur} />
      <Aide />
    </aside>
  )
}
