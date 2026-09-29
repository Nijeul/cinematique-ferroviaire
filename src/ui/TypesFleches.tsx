import { useState, type CSSProperties } from 'react'
import {
  ajouterTypeFlecheChantier,
  deplacerTypeFlecheChantier,
  imagesDuTypeFleche,
  modifierTypeFlecheChantier,
  supprimerTypeFlecheChantier,
  texteImages,
  type Chantier,
} from '../plan/chantier.ts'
import { formaterNombre, lireNombre } from '../plan/echelle.ts'
import type { ChampsTypeFleche, Pointes, StyleTrait, TypeFleche } from '../plan/fleches.ts'
import { Champ } from './CatalogueEngins.tsx'
import { Confirmation } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import { ApercuFleche } from './DessinFleches.tsx'
import { styleBouton, styleBoutonPrincipal, styleChamp, styleDiscret, styleTitreSection } from './styles.ts'
import type { Message } from './useEditeur.ts'

// Section « Flèches » de la page du chantier : les types de flèches qu'on
// trace dans les images des synoptiques (sens de travail, avancement du TTX,
// cheminement, chemin de roule…), dans l'ordre de la légende. On modifie le
// nom, la couleur, l'épaisseur, le trait et les pointes ; on ajoute, on
// réordonne, on supprime (les flèches de ce type sont retirées des images).

const cellule: CSSProperties = { padding: '3px 6px', borderBottom: `1px solid ${COULEURS.bordure}`, fontSize: 13 }
const entete: CSSProperties = { ...cellule, textAlign: 'left', fontSize: 12, color: COULEURS.discret, fontWeight: 600 }
const petit: CSSProperties = { ...styleBouton(), padding: '2px 7px' }

const TRAITS: { valeur: StyleTrait; libelle: string }[] = [
  { valeur: 'plein', libelle: 'Plein' },
  { valeur: 'pointilles', libelle: 'Pointillés' },
  { valeur: 'double', libelle: 'Double trait' },
]

const POINTES: { valeur: Pointes; libelle: string }[] = [
  { valeur: 'fin', libelle: 'Au bout' },
  { valeur: 'deux', libelle: 'Aux deux bouts' },
  { valeur: 'aucune', libelle: 'Aucune' },
]

type ASupprimer = { type: TypeFleche; images: number }

export function TypesFleches(props: { chantier: Chantier; modifierChantier: (transformer: (c: Chantier) => Chantier) => void }) {
  const { chantier, modifierChantier } = props
  const liste = chantier.typesFleches
  const [avis, setAvis] = useState<Message | null>(null)
  const [nouveau, setNouveau] = useState('')
  const [aSupprimer, setASupprimer] = useState<ASupprimer | null>(null)

  const modifier = (type: TypeFleche, champs: ChampsTypeFleche): boolean => {
    const r = modifierTypeFlecheChantier(chantier, type.id, champs)
    if (!r.ok) {
      setAvis({ genre: 'erreur', texte: `« ${type.nom} » : ${r.erreur}` })
      return false
    }
    modifierChantier((c) => {
      const suivant = modifierTypeFlecheChantier(c, type.id, champs)
      return suivant.ok ? suivant.valeur : c
    })
    setAvis(null)
    return true
  }

  const ajouter = () => {
    const r = ajouterTypeFlecheChantier(chantier, nouveau)
    if (!r.ok) {
      setAvis({ genre: 'erreur', texte: r.erreur })
      return
    }
    modifierChantier((c) => {
      const suivant = ajouterTypeFlecheChantier(c, nouveau)
      return suivant.ok ? suivant.valeur.chantier : c
    })
    setAvis({ genre: 'info', texte: `Type « ${nouveau.trim()} » ajouté en fin de liste : choisissez sa couleur, son épaisseur, son trait et ses pointes.` })
    setNouveau('')
  }

  const supprimer = (type: TypeFleche) => {
    setASupprimer(null)
    const images = imagesDuTypeFleche(chantier, type.id)
    modifierChantier((c) => supprimerTypeFlecheChantier(c, type.id))
    setAvis({
      genre: 'info',
      texte: `Type « ${type.nom} » supprimé.${images > 0 ? ` Ses flèches ont été retirées de ${texteImages(images)}.` : ''}`,
    })
  }

  const demanderSuppression = (type: TypeFleche) => {
    const images = imagesDuTypeFleche(chantier, type.id)
    if (images === 0) supprimer(type)
    else setASupprimer({ type, images })
  }

  return (
    <section style={{ marginTop: 28 }} data-testid="section-fleches">
      <h2 style={styleTitreSection}>Flèches</h2>
      <p style={styleDiscret}>
        Les flèches qu'on trace dans les images des synoptiques, dans l'ordre où elles apparaissent dans la légende. Modifier un type
        change toutes les images qui l'utilisent. L'épaisseur est en points : une voie en fait 8.
      </p>
      <table style={{ borderCollapse: 'collapse', background: '#ffffff', border: `1px solid ${COULEURS.bordure}` }} data-testid="table-fleches">
        <thead>
          <tr>
            <th style={entete}>Aperçu</th>
            <th style={entete}>Nom</th>
            <th style={entete}>Couleur</th>
            <th style={entete}>Épaisseur</th>
            <th style={entete}>Trait</th>
            <th style={entete}>Pointe</th>
            <th style={entete} title="Images qui ont une flèche de ce type">
              Images
            </th>
            <th style={entete} />
          </tr>
        </thead>
        <tbody>
          {liste.map((type, i) => (
            <tr key={type.id} data-testid="ligne-type-fleche" data-type={type.nom}>
              <td style={cellule}>
                <ApercuFleche type={type} largeur={72} hauteur={22} />
              </td>
              <td style={cellule}>
                <Champ valeur={type.nom} libelle={`Nom du type ${type.nom}`} largeur={170} valider={(t) => modifier(type, { nom: t })} />
              </td>
              <td style={cellule}>
                <input
                  type="color"
                  value={type.couleur}
                  aria-label={`Couleur de ${type.nom}`}
                  style={{ width: 30, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                  onChange={(e) => modifier(type, { couleur: e.target.value })}
                />
              </td>
              <td style={cellule}>
                <Champ
                  valeur={formaterNombre(type.epaisseur)}
                  libelle={`Épaisseur de ${type.nom}`}
                  largeur={52}
                  nombre
                  valider={(t) => {
                    const n = lireNombre(t)
                    if (n === null) {
                      setAvis({ genre: 'erreur', texte: `« ${type.nom} » : l'épaisseur est un nombre de points (une voie en fait 8).` })
                      return false
                    }
                    return modifier(type, { epaisseur: n })
                  }}
                />
              </td>
              <td style={cellule}>
                <select
                  value={type.trait}
                  aria-label={`Trait de ${type.nom}`}
                  style={styleChamp}
                  onChange={(e) => modifier(type, { trait: e.target.value as StyleTrait })}
                >
                  {TRAITS.map((t) => (
                    <option key={t.valeur} value={t.valeur}>
                      {t.libelle}
                    </option>
                  ))}
                </select>
              </td>
              <td style={cellule}>
                <select
                  value={type.pointes}
                  aria-label={`Pointe de ${type.nom}`}
                  style={styleChamp}
                  onChange={(e) => modifier(type, { pointes: e.target.value as Pointes })}
                >
                  {POINTES.map((p) => (
                    <option key={p.valeur} value={p.valeur}>
                      {p.libelle}
                    </option>
                  ))}
                </select>
              </td>
              <td style={{ ...cellule, color: COULEURS.discret, textAlign: 'center' }}>{imagesDuTypeFleche(chantier, type.id) || ''}</td>
              <td style={{ ...cellule, whiteSpace: 'nowrap' }}>
                <button
                  style={{ ...petit, opacity: i > 0 ? 1 : 0.35 }}
                  disabled={i === 0}
                  aria-label={`Monter ${type.nom}`}
                  title="Plus haut dans la légende"
                  onClick={() => modifierChantier((c) => deplacerTypeFlecheChantier(c, type.id, -1))}
                >
                  ↑
                </button>{' '}
                <button
                  style={{ ...petit, opacity: i < liste.length - 1 ? 1 : 0.35 }}
                  disabled={i === liste.length - 1}
                  aria-label={`Descendre ${type.nom}`}
                  title="Plus bas dans la légende"
                  onClick={() => modifierChantier((c) => deplacerTypeFlecheChantier(c, type.id, 1))}
                >
                  ↓
                </button>{' '}
                <button
                  style={{ ...petit, color: COULEURS.erreur }}
                  aria-label={`Supprimer le type ${type.nom}`}
                  title="Supprimer ce type (ses flèches sont retirées des images)"
                  onClick={() => demanderSuppression(type)}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {avis && (
        <p
          role={avis.genre === 'erreur' ? 'alert' : 'status'}
          data-testid="message-fleches"
          style={{ ...styleDiscret, color: avis.genre === 'erreur' ? COULEURS.erreur : COULEURS.texte, fontSize: 13 }}
        >
          {avis.texte}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }} data-testid="ajout-type-fleche">
        <strong>Ajouter un type :</strong>
        <input
          type="text"
          value={nouveau}
          placeholder="Nom (« Évacuation »…)"
          aria-label="Nom du nouveau type de flèche"
          style={{ ...styleChamp, width: 200 }}
          onChange={(e) => setNouveau(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') ajouter()
          }}
        />
        <button style={styleBoutonPrincipal} onClick={ajouter}>
          Ajouter
        </button>
      </div>
      {aSupprimer && (
        <Confirmation
          titre={`Supprimer le type « ${aSupprimer.type.nom} » ?`}
          texte={
            <>
              <p style={{ margin: '0 0 8px' }} data-testid="texte-confirmation-fleche">
                Ce type de flèche est utilisé dans <strong>{texteImages(aSupprimer.images)}</strong>. Les flèches de ce type seront retirées
                de ces images.
              </p>
              <p style={{ margin: 0, color: COULEURS.erreur }}>Cette suppression est définitive.</p>
            </>
          }
          action="Supprimer le type"
          confirmer={() => supprimer(aSupprimer.type)}
          annuler={() => setASupprimer(null)}
        />
      )}
    </section>
  )
}
