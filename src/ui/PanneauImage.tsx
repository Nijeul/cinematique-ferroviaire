import { useState, type ReactNode } from 'react'
import { PAS_COUPES_PAR_DEFAUT, texteCoupes } from '../plan/coupes.ts'
import { formaterNombre, lireNombre } from '../plan/echelle.ts'
import type { CoteDepart } from '../plan/etatsZones.ts'
import { entreesLegende, masquerLigneLegende, modifierAfficherLegende, texteEntree, type ListesChantier } from '../plan/legende.ts'
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
import { afficherToutesLesZones, afficherZone, texteZonesAffichees, zonesDuSynoptique } from '../plan/zonesAffichees.ts'
import { COULEURS } from './couleurs.ts'
import { ApercuEtat } from './DessinEtats.tsx'
import { styleChamp, stylesPanneau as styles } from './styles.ts'
import type { EditeurImage } from './useEditeurImage.ts'

// Panneaux de l'image courante d'un synoptique, en plus des engins et des
// flèches : l'état de la zone choisie (palette des états, avancement
// partiel), le créneau horaire (titre, heures affichées), l'encart PHASAGE
// (étapes numérotées) et la légende (affichée ou non, lignes masquées).

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
      <CoupesDeLaZone editeur={editeur} />
    </Section>
  )
}

// ——— Coupes de tronçonnage de la zone choisie ———

// Écart entre deux coupes, en mètres : appliqué à chaque frappe s'il est
// valable ; refusé, le champ reste rouge avec l'explication.
function ChampPas(props: { valeur: number; valider: (pas: number) => string | null }) {
  const [texte, setTexte] = useState(formaterNombre(props.valeur))
  const [precedente, setPrecedente] = useState(props.valeur)
  const [erreur, setErreur] = useState<string | null>(null)
  if (props.valeur !== precedente) {
    setPrecedente(props.valeur)
    setTexte(formaterNombre(props.valeur))
    setErreur(null)
  }
  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        value={texte}
        aria-label="Écart entre deux coupes (m)"
        aria-invalid={erreur !== null}
        title={erreur ?? undefined}
        style={{ ...styles.champ, width: 52, textAlign: 'right', borderColor: erreur ? COULEURS.erreur : COULEURS.bordure }}
        onChange={(e) => {
          setTexte(e.target.value)
          const n = lireNombre(e.target.value)
          setErreur(n === null ? 'Tapez un nombre de mètres.' : props.valider(n))
        }}
      />
      {erreur && (
        <span role="alert" style={{ color: COULEURS.erreur, fontSize: 12, flexBasis: '100%' }}>
          {erreur}
        </span>
      )}
    </>
  )
}

function CoupesDeLaZone({ editeur }: { editeur: EditeurImage }) {
  const { zone, planche } = editeur
  if (!zone) return null
  const pas = planche.coupes[zone.id] ?? null
  // Une erreur (synoptique sans échelle…) s'affiche dans le bandeau de message.
  const signaler = (erreur: string | null) => {
    if (erreur) editeur.setMessage({ genre: 'erreur', texte: erreur })
  }
  return (
    <div style={{ marginTop: 10 }} data-testid="coupes-zone">
      <label style={{ ...styles.ligne, fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={pas !== null}
          aria-label="Coupes de tronçonnage"
          onChange={(e) => signaler(editeur.reglerCoupesZone(e.target.checked ? PAS_COUPES_PAR_DEFAUT : null))}
        />
        Coupes de tronçonnage
      </label>
      {pas !== null && (
        <div style={{ ...styles.ligne, flexWrap: 'wrap' }}>
          <span>Une coupe tous les</span>
          <ChampPas valeur={pas} valider={(n) => editeur.reglerCoupesZone(n, `coupes:${zone.id}`)} />
          <span>m</span>
        </div>
      )}
      <p style={styles.discret}>
        {pas !== null
          ? `Traits en travers de la voie, depuis le bout ${planche.extremites.gauche ? `côté ${planche.extremites.gauche}` : 'gauche'} de la zone, à l'échelle du synoptique ; « ${texteCoupes(pas)} » dans la légende.`
          : 'Montre les panneaux découpés (6 m par défaut) sur cette image.'}
      </p>
    </div>
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

// ——— Légende ———

const GENRES_LEGENDE = { engin: 'Engin', rame: 'Rame', etat: 'État', fleche: 'Flèche', coupes: 'Coupes', exploitation: 'Voie' } as const

export function PanneauLegende(props: { synoptique: Synoptique; index: number; listes: ListesChantier; modifier: Modifier }) {
  const { synoptique: s, index, modifier } = props
  const image = s.images[index]
  const entrees = entreesLegende(s, index, props.listes)
  const masquees = new Set(image.legendeMasquee)
  return (
    <Section titre={`Légende de l'image ${index + 1}`} testid="panneau-legende">
      <label style={{ ...styles.ligne, fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={s.afficherLegende}
          aria-label="Afficher la légende"
          onChange={(e) => modifier(modifierAfficherLegende(s, e.target.checked))}
        />
        Afficher la légende <span style={{ fontWeight: 400, color: COULEURS.discret, fontSize: 12 }}>(sur toutes les images)</span>
      </label>
      <p style={styles.discret}>
        Construite d'après ce que montre l'image : engins numérotés et leur description, rames, états de la voie, flèches. Décochez une
        ligne pour la masquer sur cette image seulement.
      </p>
      {entrees.length === 0 && <p style={styles.discret}>Rien à légender sur cette image : la légende ne s'affiche pas.</p>}
      <fieldset disabled={!s.afficherLegende} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0, opacity: s.afficherLegende ? 1 : 0.5 }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="lignes-legende">
          {entrees.map((e) => (
            <li key={e.cle} style={{ margin: '3px 0' }}>
              <label style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13 }} data-testid="ligne-panneau-legende">
                <input
                  type="checkbox"
                  checked={!masquees.has(e.cle)}
                  aria-label={`Afficher « ${texteEntree(e)} » dans la légende`}
                  onChange={(ev) => modifier(masquerLigneLegende(s, index, e.cle, !ev.target.checked))}
                />
                <span style={{ color: COULEURS.discret, fontSize: 11, width: 36, flexShrink: 0 }}>{GENRES_LEGENDE[e.genre]}</span>
                <span style={{ flex: 1, minWidth: 0, textDecoration: masquees.has(e.cle) ? 'line-through' : undefined }}>{texteEntree(e)}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </Section>
  )
}

// ——— Zones affichées du synoptique ———

// Les zones de travaux du plan figé, chacune avec sa case « affichée ». Une
// zone décochée disparaît de toutes les images du synoptique (tracé, nom,
// état, coupes, légende, exports) ; son état et ses coupes sont gardés.
export function PanneauZonesAffichees(props: { synoptique: Synoptique; modifier: Modifier }) {
  const { synoptique: s, modifier } = props
  const zones = zonesDuSynoptique(s)
  return (
    <Section
      titre={
        <>
          Zones affichées <span style={{ fontWeight: 400, textTransform: 'none' }}>· {texteZonesAffichees(s)}</span>
        </>
      }
      testid="panneau-zones-affichees"
    >
      {zones.length === 0 ? (
        <p style={styles.discret}>Le plan de ce synoptique n'a pas de zone de travaux.</p>
      ) : (
        <>
          <div style={{ ...styles.ligne, gap: 6 }}>
            <button style={styles.petitBouton} disabled={zones.every((z) => z.affichee)} onClick={() => modifier(afficherToutesLesZones(s, true))}>
              Tout afficher
            </button>
            <button style={styles.petitBouton} disabled={zones.every((z) => !z.affichee)} onClick={() => modifier(afficherToutesLesZones(s, false))}>
              Tout masquer
            </button>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="liste-zones-affichees">
            {zones.map(({ zone, voie, affichee }) => (
              <li key={zone.id} style={{ margin: '3px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} data-testid="ligne-zone-affichee" data-zone={zone.nom}>
                  <input
                    type="checkbox"
                    checked={affichee}
                    aria-label={`Afficher la zone « ${zone.nom} »`}
                    onChange={(e) => modifier(afficherZone(s, zone.id, e.target.checked))}
                  />
                  <span style={{ width: 14, height: 10, flexShrink: 0, background: zone.couleur, opacity: affichee ? 1 : 0.35, border: `1px solid ${COULEURS.bordure}` }} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: affichee ? undefined : COULEURS.discret,
                      textDecoration: affichee ? undefined : 'line-through',
                    }}
                  >
                    {zone.nom || 'Zone sans nom'}
                  </span>
                  {voie !== '' && <span style={{ color: COULEURS.discret, fontSize: 12, flexShrink: 0 }}>{voie}</span>}
                </label>
              </li>
            ))}
          </ul>
          <p style={styles.discret}>
            Pour toutes les images de ce synoptique. Une zone décochée disparaît de l'image, de la planche, de la légende et des exports ;
            son état et ses coupes sont gardés et reviennent quand on la recoche.
          </p>
        </>
      )}
    </Section>
  )
}
