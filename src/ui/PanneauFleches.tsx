import type { CSSProperties, ReactNode } from 'react'
import { modifierFleche, typeFlecheParId, type Fleche, type TypeFleche } from '../plan/fleches.ts'
import { COULEURS } from './couleurs.ts'
import { ApercuFleche } from './DessinFleches.tsx'
import { stylesPanneau as styles } from './styles.ts'
import { TOUCHES_IMAGE, type EditeurImage } from './useEditeurImage.ts'

// Panneaux des flèches de l'image courante d'un synoptique : le type à tracer
// quand l'outil Flèche est choisi, la flèche choisie (type, libellé), et le
// calque « Flèches » de l'image — visible, verrouillé, la liste de ses flèches.

function Section({ titre, children, testid }: { titre: ReactNode; children: ReactNode; testid?: string }) {
  return (
    <section style={styles.section} data-testid={testid}>
      <h2 style={styles.titre}>{titre}</h2>
      {children}
    </section>
  )
}

const boutonType = (choisi: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  margin: '2px 0',
  padding: '4px 8px',
  font: 'inherit',
  fontSize: 13,
  textAlign: 'left',
  borderRadius: 5,
  border: `1px solid ${choisi ? COULEURS.selection : COULEURS.bordure}`,
  background: choisi ? '#e8f0f9' : '#ffffff',
  cursor: 'pointer',
})

// Outil Flèche : le type à tracer, dans la liste du chantier.
export function ChoixTypeFleche({ editeur }: { editeur: EditeurImage }) {
  const { typesFleches, typeFleche } = editeur
  return (
    <Section titre="Flèche à tracer" testid="fleche-a-tracer">
      {typesFleches.length === 0 && <p style={styles.discret}>Liste vide : ajoutez des types de flèches dans la page du chantier.</p>}
      <div role="radiogroup" aria-label="Type de flèche à tracer">
        {typesFleches.map((type) => {
          const choisi = typeFleche?.id === type.id
          return (
            <button
              key={type.id}
              role="radio"
              aria-checked={choisi}
              data-testid="type-fleche"
              style={boutonType(choisi)}
              onClick={() => editeur.setTypeFleche(type.id)}
            >
              <ApercuFleche type={type} />
              <span style={{ flex: 1, fontWeight: choisi ? 700 : 400 }}>{type.nom}</span>
            </button>
          )
        })}
      </div>
      <p style={styles.discret}>
        Un clic par point : le départ, chaque coude, la fin (la pointe). Double-clic ou <strong>Entrée</strong> pour finir,{' '}
        <strong>Maj</strong> : horizontal, vertical ou 45°, <strong>Suppr</strong> : retirer le dernier point, <strong>Échap</strong> : annuler.
      </p>
    </Section>
  )
}

// La flèche choisie : son type (on peut en changer), son libellé.
export function PanneauFleche({ editeur }: { editeur: EditeurImage }) {
  const { fleche, typesFleches, calqueFleches } = editeur
  if (!fleche) return null
  const type = typeFlecheParId(typesFleches, fleche.typeId)
  const modifier = (champs: Partial<Pick<Fleche, 'typeId' | 'libelle'>>, cle: string | null = null) =>
    editeur.modifierFleches((liste) => modifierFleche(liste, fleche.id, champs), cle)
  return (
    <Section titre={<>Flèche « {type?.nom ?? '?'} »</>} testid="panneau-fleche">
      <fieldset disabled={calqueFleches.verrouille} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
        <label style={styles.ligne}>
          <span style={{ width: 60, flexShrink: 0 }}>Type</span>
          {type && <ApercuFleche type={type} />}
          <select
            value={fleche.typeId}
            aria-label="Type de la flèche"
            style={{ ...styles.champ, flex: 1 }}
            onChange={(e) => modifier({ typeId: e.target.value })}
          >
            {typesFleches.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.ligne}>
          <span style={{ width: 60, flexShrink: 0 }}>Libellé</span>
          <input
            type="text"
            value={fleche.libelle}
            placeholder="facultatif (« vers base arrière »…)"
            aria-label="Libellé de la flèche"
            style={{ ...styles.champ, flex: 1 }}
            onChange={(e) => modifier({ libelle: e.target.value }, `libelle:${fleche.id}`)}
          />
        </label>
        <p style={styles.discret}>
          {fleche.points.length} points. Glissez un point rond pour le déplacer (Maj : horizontal, vertical, 45°), ou le trait pour déplacer
          toute la flèche.
        </p>
        <button
          style={{ ...styles.petitBouton, color: COULEURS.erreur, marginTop: 4 }}
          onClick={() => editeur.supprimerFleche(fleche.id)}
          title="Retirer de cette image (Suppr)"
        >
          Supprimer la flèche
        </button>
      </fieldset>
    </Section>
  )
}

function LigneFleche({ editeur, fleche, type }: { editeur: EditeurImage; fleche: Fleche; type: TypeFleche | undefined }) {
  const choisie = editeur.fleche?.id === fleche.id
  return (
    <li
      onClick={() => editeur.choisirFleche(fleche.id)}
      data-testid="ligne-fleche"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        margin: '4px 0',
        borderRadius: 6,
        border: `1px solid ${choisie ? COULEURS.selection : COULEURS.bordure}`,
        background: choisie ? '#e8f0f9' : '#fff',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {type && <ApercuFleche type={type} largeur={44} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>{type?.nom ?? '?'}</strong>
        {fleche.libelle.trim() && <span style={{ color: COULEURS.discret }}> · {fleche.libelle.trim()}</span>}
      </span>
      <button
        style={{ ...styles.petitBouton, color: COULEURS.erreur }}
        title="Retirer de cette image (Suppr)"
        aria-label={`Supprimer la flèche ${type?.nom ?? ''}`}
        onClick={(e) => {
          e.stopPropagation()
          editeur.supprimerFleche(fleche.id)
        }}
      >
        ✕
      </button>
    </li>
  )
}

export function CalqueFleches({ editeur }: { editeur: EditeurImage }) {
  const { planche, calqueFleches: calque, index, typesFleches } = editeur
  const nombre = planche.fleches.length
  return (
    <section style={styles.section} data-testid="calque-fleches">
      <h2 style={styles.titre}>
        Flèches de l'image {index + 1}
        {nombre > 0 && <span style={{ fontWeight: 400 }}> · {nombre}</span>}
      </h2>
      <div style={{ ...styles.ligne, gap: 16 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={calque.visible}
            aria-label="Calque Flèches visible"
            onChange={(e) => editeur.changerCalqueFleches({ visible: e.target.checked })}
          />
          Visible
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }} title="Les flèches ne se choisissent plus et ne se modifient plus">
          <input
            type="checkbox"
            checked={calque.verrouille}
            aria-label="Calque Flèches verrouillé"
            onChange={(e) => editeur.changerCalqueFleches({ verrouille: e.target.checked })}
          />
          Verrouillé
        </label>
      </div>
      {nombre === 0 && <p style={styles.discret}>Aucune flèche sur cette image : outil « Flèche » ({TOUCHES_IMAGE.fleche}).</p>}
      <fieldset disabled={calque.verrouille} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
        <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }} data-testid="liste-fleches">
          {planche.fleches.map((f) => (
            <LigneFleche key={f.id} editeur={editeur} fleche={f} type={typeFlecheParId(typesFleches, f.typeId)} />
          ))}
        </ul>
      </fieldset>
      <p style={styles.discret}>
        « + Nouvelle image » recopie les flèches, comme les engins : il ne reste qu'à déplacer ce qui change. Couleurs et épaisseurs : page
        du chantier, section « Flèches ».
      </p>
    </section>
  )
}
