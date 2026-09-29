import { useState, type ReactNode } from 'react'
import type { CoteDepart } from '../plan/etatsZones.ts'
import {
  ajouterEtape,
  deplacerEtape,
  lignesCreneau,
  modifierCreneau,
  modifierEtape,
  numeroEtapePropose,
  supprimerEtape,
} from '../plan/planche.ts'
import type { HeuresCreneau, Synoptique } from '../plan/synoptique.ts'
import { COULEURS } from './couleurs.ts'
import { ApercuEtat } from './DessinEtats.tsx'
import { styleChamp, stylesPanneau as styles } from './styles.ts'
import type { EditeurImage } from './useEditeurImage.ts'

// Panneaux de l'image courante d'un synoptique, en plus des engins : l'état
// de la zone choisie (palette des états, avancement partiel), le créneau
// horaire (titre, heures affichées) et l'encart PHASAGE (étapes numérotées).

function Section({ titre, children, testid }: { titre: ReactNode; children: ReactNode; testid?: string }) {
  return (
    <section style={styles.section} data-testid={testid}>
      <h2 style={styles.titre}>{titre}</h2>
      {children}
    </section>
  )
}

// Enregistre un nouvel état du synoptique ; `cle` : voir l'historique.
type Modifier = (suivant: Synoptique, cle?: string | null) => void

// ——— Zone choisie ———

export function PanneauZone({ editeur }: { editeur: EditeurImage }) {
  const { zone, etatZone, etatsVoie, planche } = editeur
  if (!zone || !etatZone) return null
  const avancement = etatZone.avancement
  const extremites = planche.extremites
  // Les deux bouts de la zone tels qu'on les voit : gauche (Nord) et droite (Sud).
  const nomCote = (cote: CoteDepart) => (cote === 'gauche' ? `◀ ${extremites.gauche || 'gauche'}` : `${extremites.droite || 'droite'} ▶`)
  return (
    <Section titre={<>Zone « {zone.nom} »</>} testid="panneau-zone">
      <p style={styles.discret}>
        Zone du plan figé : elle ne se déplace pas, seul son état change dans cette image. Touches <strong>1</strong> à <strong>{Math.min(9, etatsVoie.length)}</strong> : choisir l'état.
      </p>
      <div style={{ fontSize: 12, fontWeight: 600, margin: '8px 0 4px' }}>{avancement ? 'État de la partie faite' : 'État de la zone'}</div>
      <div role="radiogroup" aria-label="État de la zone" style={{ display: 'grid', gap: 4 }} data-testid="palette-etats">
        {etatsVoie.map((etat, i) => {
          const choisi = etat.id === etatZone.etat.id
          return (
            <button
              key={etat.id}
              role="radio"
              aria-checked={choisi}
              data-etat={etat.nom}
              onClick={() => editeur.choisirEtat(etat.id)}
              title={i < 9 ? `Touche ${i + 1}` : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                font: 'inherit',
                fontSize: 13,
                textAlign: 'left',
                borderRadius: 5,
                border: `${choisi ? 2 : 1}px solid ${choisi ? COULEURS.selection : COULEURS.bordure}`,
                background: choisi ? '#e8f0f9' : '#ffffff',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 14, color: COULEURS.discret, fontSize: 12 }}>{i < 9 ? i + 1 : ''}</span>
              <ApercuEtat etat={etat} couleurZone={zone.couleur} />
              <span style={{ flex: 1, fontWeight: choisi ? 700 : 400 }}>{etat.nom}</span>
            </button>
          )
        })}
      </div>

      <label style={{ ...styles.ligne, marginTop: 10, fontWeight: 600 }}>
        <input type="checkbox" checked={avancement !== null} onChange={(e) => editeur.changerAvancement(e.target.checked)} />
        En partie
      </label>
      {avancement && (
        <div style={{ padding: '6px 8px', background: '#ffffff', border: `1px solid ${COULEURS.bordure}`, borderRadius: 6 }} data-testid="avancement">
          <label style={styles.ligne}>
            <span style={{ width: 60 }}>Fait</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={avancement.pourcentage}
              aria-label="Pourcentage fait"
              style={{ flex: 1 }}
              onChange={(e) => editeur.reglerAvancement({ pourcentage: Number(e.target.value) }, `avancement:${zone.id}`)}
            />
            <input
              type="number"
              min={0}
              max={100}
              value={avancement.pourcentage}
              aria-label="Pourcentage fait (nombre)"
              style={{ ...styles.champ, width: 52, textAlign: 'right' }}
              onChange={(e) => {
                if (e.target.value !== '') editeur.reglerAvancement({ pourcentage: Number(e.target.value) }, `avancement:${zone.id}`)
              }}
            />
            %
          </label>
          <div style={styles.ligne} role="radiogroup" aria-label="Côté de départ">
            <span style={{ width: 60 }}>Depuis</span>
            {(['gauche', 'droite'] as const).map((cote) => (
              <label key={cote} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="radio"
                  name={`depuis-${zone.id}`}
                  checked={avancement.depuis === cote}
                  onChange={() => editeur.reglerAvancement({ depuis: cote })}
                />
                {nomCote(cote)}
              </label>
            ))}
          </div>
          <label style={styles.ligne}>
            <span style={{ width: 60 }}>Le reste</span>
            <select
              value={avancement.reste.id}
              aria-label="État du reste"
              style={{ ...styles.champ, flex: 1 }}
              onChange={(e) => editeur.reglerAvancement({ reste: e.target.value })}
            >
              {etatsVoie.map((etat) => (
                <option key={etat.id} value={etat.id}>
                  {etat.nom}
                </option>
              ))}
            </select>
            <ApercuEtat etat={avancement.reste} couleurZone={zone.couleur} />
          </label>
          <p style={{ ...styles.discret, color: COULEURS.texte }} data-testid="resume-avancement">
            <strong>{etatZone.etat.nom}</strong> sur {avancement.pourcentage} % depuis {nomCote(avancement.depuis).replace(/[◀▶]/g, '').trim()}, le
            reste <strong>{avancement.reste.nom}</strong>.
          </p>
        </div>
      )}
    </Section>
  )
}

// ——— Créneau horaire ———

const HEURES: { valeur: HeuresCreneau; libelle: string }[] = [
  { valeur: 'plage', libelle: 'Début et fin' },
  { valeur: 'debut', libelle: 'Début seul' },
  { valeur: 'aucune', libelle: 'Aucune (le titre seul)' },
]

export function PanneauCreneau({ synoptique: s, index, modifier }: { synoptique: Synoptique; index: number; modifier: Modifier }) {
  const image = s.images[index]
  const { titre, heures } = lignesCreneau(s.t0, image)
  return (
    <Section titre={`Créneau de l'image ${index + 1}`} testid="panneau-creneau">
      <label style={{ display: 'block', fontSize: 13 }}>
        Titre <span style={{ color: COULEURS.discret, fontSize: 12 }}>(facultatif : « Phase avant travaux »…)</span>
        <textarea
          value={image.titre}
          rows={2}
          aria-label="Titre du créneau"
          style={{ ...styleChamp, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, resize: 'vertical' }}
          onChange={(e) => modifier(modifierCreneau(s, index, { titre: e.target.value }), `titre:${image.id}`)}
        />
      </label>
      <label style={{ ...styles.ligne, marginTop: 8 }}>
        <span style={{ flexShrink: 0 }}>Heures affichées</span>
        <select
          value={image.heures}
          aria-label="Heures affichées"
          style={{ ...styles.champ, flex: 1 }}
          onChange={(e) => modifier(modifierCreneau(s, index, { heures: e.target.value as HeuresCreneau }))}
        >
          {HEURES.map((h) => (
            <option key={h.valeur} value={h.valeur}>
              {h.libelle}
            </option>
          ))}
        </select>
      </label>
      {image.heures === 'aucune' && titre.length === 0 && (
        <p style={styles.discret}>Sans titre, le créneau affiche toujours les heures.</p>
      )}
      <p style={styles.discret} data-testid="apercu-creneau">
        Sur l'image : <strong style={{ color: COULEURS.texte }}>{[...titre, heures.join(' ')].filter((t) => t !== '').join(' · ')}</strong>
      </p>
    </Section>
  )
}

// ——— Encart PHASAGE ———

// Numéro d'une étape : validé en quittant le champ ; refusé, il reste rouge.
function ChampNumero(props: { valeur: number; libelle: string; valider: (n: number) => string | null }) {
  const [texte, setTexte] = useState(String(props.valeur))
  const [precedente, setPrecedente] = useState(props.valeur)
  const [erreur, setErreur] = useState<string | null>(null)
  if (props.valeur !== precedente) {
    setPrecedente(props.valeur)
    setTexte(String(props.valeur))
    setErreur(null)
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={texte}
      aria-label={props.libelle}
      aria-invalid={erreur !== null}
      title={erreur ?? undefined}
      style={{ ...styles.champ, width: 38, textAlign: 'right', borderColor: erreur ? COULEURS.erreur : COULEURS.bordure }}
      onChange={(e) => {
        setTexte(e.target.value)
        setErreur(props.valider(Number(e.target.value.trim() === '' ? NaN : e.target.value)))
      }}
    />
  )
}

export function PanneauPhasage({ synoptique: s, index, modifier }: { synoptique: Synoptique; index: number; modifier: Modifier }) {
  const image = s.images[index]
  const propose = numeroEtapePropose(s, index)
  return (
    <Section titre={`Phasage de l'image ${index + 1}`} testid="panneau-phasage">
      {image.phasage.length === 0 && (
        <p style={styles.discret}>Encart vide : il ne s'affiche pas sur l'image. Chaque image a ses propres étapes.</p>
      )}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {image.phasage.map((etape, i) => (
          <li key={`${image.id}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, margin: '6px 0' }} data-testid="etape-phasage">
            <ChampNumero
              valeur={etape.numero}
              libelle={`Numéro de l'étape ${i + 1}`}
              valider={(numero) => {
                const r = modifierEtape(s, index, i, { numero })
                if (r.ok) modifier(r.valeur, `numero:${image.id}:${i}`)
                return r.ok ? null : r.erreur
              }}
            />
            <span style={{ paddingTop: 4, color: COULEURS.discret }}>–</span>
            <textarea
              value={etape.libelle}
              rows={2}
              placeholder="Libellé de l'étape"
              aria-label={`Libellé de l'étape ${i + 1}`}
              style={{ ...styleChamp, flex: 1, resize: 'vertical', minHeight: 34 }}
              onChange={(e) => {
                const r = modifierEtape(s, index, i, { libelle: e.target.value })
                if (r.ok) modifier(r.valeur, `libelle:${image.id}:${i}`)
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button style={styles.petitBouton} disabled={i === 0} onClick={() => modifier(deplacerEtape(s, index, i, -1))} aria-label="Monter l'étape" title="Monter">
                ↑
              </button>
              <button
                style={styles.petitBouton}
                disabled={i === image.phasage.length - 1}
                onClick={() => modifier(deplacerEtape(s, index, i, 1))}
                aria-label="Descendre l'étape"
                title="Descendre"
              >
                ↓
              </button>
            </div>
            <button
              style={{ ...styles.petitBouton, color: COULEURS.erreur }}
              onClick={() => modifier(supprimerEtape(s, index, i))}
              aria-label={`Supprimer l'étape ${etape.numero}`}
              title="Supprimer l'étape"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
      <button
        style={{ ...styles.petitBouton, marginTop: 4, fontSize: 13, padding: '4px 10px' }}
        onClick={() => modifier(ajouterEtape(s, index).synoptique)}
        title="Le numéro proposé suit le plus grand numéro des images précédentes"
      >
        + Étape {propose}
      </button>
    </Section>
  )
}
