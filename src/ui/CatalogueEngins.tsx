import { useState, type CSSProperties } from 'react'
import { couleurDeCategorie, LARGEUR_PAR_DEFAUT_M, parCategorie, type ChampsType, type TypeEngin } from '../plan/catalogue.ts'
import { ajouterTypeChantier, modifierTypeChantier, supprimerTypeChantier, synoptiquesDuType, type Chantier } from '../plan/chantier.ts'
import { formaterNombre, lireNombre } from '../plan/echelle.ts'
import { COULEURS } from './couleurs.ts'
import { styleBouton, styleBoutonPrincipal, styleChamp, styleDiscret, styleTitreSection } from './styles.ts'
import type { Message } from './useEditeur.ts'

// Section « Catalogue d'engins » de la page du chantier : les types qu'on
// pose dans les images des synoptiques, groupés par catégorie. On modifie catégorie, modèle,
// longueur, largeur et couleur ; on ajoute et on supprime des types (PEM LEM,
// TTX, régaleuse… à ajouter avec leurs vraies dimensions).

const cellule: CSSProperties = { padding: '3px 6px', borderBottom: `1px solid ${COULEURS.bordure}`, fontSize: 13 }
const entete: CSSProperties = { ...cellule, textAlign: 'left', fontSize: 12, color: COULEURS.discret, fontWeight: 600 }

// Champ texte validé en quittant le champ (ou Entrée) ; Échap revient à la
// valeur enregistrée. Une valeur refusée garde le champ en rouge.
export function Champ(props: { valeur: string; libelle: string; largeur: number; nombre?: boolean; valider: (texte: string) => boolean }) {
  const [texte, setTexte] = useState(props.valeur)
  const [precedente, setPrecedente] = useState(props.valeur)
  const [refuse, setRefuse] = useState(false)
  if (props.valeur !== precedente) {
    setPrecedente(props.valeur)
    setTexte(props.valeur)
    setRefuse(false)
  }
  const valider = () => {
    if (texte === props.valeur) return
    setRefuse(!props.valider(texte))
  }
  return (
    <input
      type="text"
      inputMode={props.nombre ? 'decimal' : undefined}
      value={texte}
      aria-label={props.libelle}
      aria-invalid={refuse}
      style={{
        ...styleChamp,
        width: props.largeur,
        textAlign: props.nombre ? 'right' : 'left',
        borderColor: refuse ? COULEURS.erreur : COULEURS.bordure,
      }}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setTexte(props.valeur)
          setRefuse(false)
        }
      }}
    />
  )
}

function FormulaireAjout(props: { catalogue: TypeEngin[]; ajouter: (t: Omit<TypeEngin, 'id'>) => string | null }) {
  const [categorie, setCategorie] = useState('')
  const [modele, setModele] = useState('')
  const [longueur, setLongueur] = useState('')
  const [largeur, setLargeur] = useState(String(LARGEUR_PAR_DEFAUT_M))
  const [couleur, setCouleur] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const couleurProposee = couleur ?? couleurDeCategorie(props.catalogue, categorie)
  const envoyer = () => {
    const l = lireNombre(longueur)
    const w = lireNombre(largeur)
    const e = props.ajouter({ categorie, modele, longueur: l ?? NaN, largeur: w ?? NaN, couleur: couleurProposee })
    setErreur(e)
    if (!e) {
      setModele('')
      setLongueur('')
      setCouleur(null)
    }
  }
  return (
    <div style={{ marginTop: 10, padding: '8px 10px', background: '#ffffff', border: `1px dashed ${COULEURS.bordure}`, borderRadius: 6 }} data-testid="ajout-type">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <strong>Ajouter un type :</strong>
        <input
          type="text"
          list="categories-engins"
          value={categorie}
          placeholder="Catégorie"
          aria-label="Catégorie du nouveau type"
          style={{ ...styleChamp, width: 120 }}
          onChange={(e) => setCategorie(e.target.value)}
        />
        <datalist id="categories-engins">
          {parCategorie(props.catalogue).map((g) => (
            <option key={g.categorie} value={g.categorie} />
          ))}
        </datalist>
        <input
          type="text"
          value={modele}
          placeholder="Modèle"
          aria-label="Modèle du nouveau type"
          style={{ ...styleChamp, width: 130 }}
          onChange={(e) => setModele(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          L
          <input
            type="text"
            inputMode="decimal"
            value={longueur}
            placeholder="?"
            aria-label="Longueur du nouveau type en mètres"
            style={{ ...styleChamp, width: 60, textAlign: 'right' }}
            onChange={(e) => setLongueur(e.target.value)}
          />
          m
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          l
          <input
            type="text"
            inputMode="decimal"
            value={largeur}
            aria-label="Largeur du nouveau type en mètres"
            style={{ ...styleChamp, width: 50, textAlign: 'right' }}
            onChange={(e) => setLargeur(e.target.value)}
          />
          m
        </label>
        <input
          type="color"
          value={couleurProposee}
          aria-label="Couleur du nouveau type"
          style={{ width: 30, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
          onChange={(e) => setCouleur(e.target.value)}
        />
        <button style={styleBoutonPrincipal} onClick={envoyer}>
          Ajouter
        </button>
      </div>
      {erreur && (
        <p role="alert" style={{ ...styleDiscret, color: COULEURS.erreur }}>
          {erreur}
        </p>
      )}
    </div>
  )
}

export function CatalogueEngins(props: { chantier: Chantier; modifierChantier: (transformer: (c: Chantier) => Chantier) => void }) {
  const { chantier, modifierChantier } = props
  const catalogue = chantier.catalogue
  // Messages affichés dans la section, là où l'on travaille.
  const [avis, message] = useState<Message | null>(null)

  // Applique une modification ; false (et un message) si elle est refusée.
  const modifier = (type: TypeEngin, champs: ChampsType): boolean => {
    const r = modifierTypeChantier(chantier, type.id, champs)
    if (!r.ok) {
      message({ genre: 'erreur', texte: `« ${type.modele} » : ${r.erreur}` })
      return false
    }
    modifierChantier((c) => {
      const suivant = modifierTypeChantier(c, type.id, champs)
      return suivant.ok ? suivant.valeur : c
    })
    const synoptiques = synoptiquesDuType(chantier, type.id)
    if (synoptiques > 0 && (champs.longueur !== undefined || champs.largeur !== undefined || champs.couleur !== undefined)) {
      message({
        genre: 'info',
        texte: `« ${type.modele} » modifié : les prochains engins posés auront ces valeurs. Ceux déjà posés dans ${
          synoptiques > 1 ? `${synoptiques} synoptiques` : 'un synoptique'
        } gardent les leurs (copies figées).`,
      })
    }
    return true
  }

  const ajouter = (t: Omit<TypeEngin, 'id'>): string | null => {
    const r = ajouterTypeChantier(chantier, t)
    if (!r.ok) return r.erreur
    modifierChantier((c) => {
      const suivant = ajouterTypeChantier(c, t)
      return suivant.ok ? suivant.valeur.chantier : c
    })
    message({ genre: 'info', texte: `« ${t.modele.trim()} » ajouté au catalogue, catégorie « ${t.categorie.trim()} ».` })
    return null
  }

  const supprimer = (type: TypeEngin) => {
    const synoptiques = synoptiquesDuType(chantier, type.id)
    modifierChantier((c) => supprimerTypeChantier(c, type.id))
    message({
      genre: 'info',
      texte: `« ${type.modele} » retiré du catalogue.${synoptiques > 0 ? ' Les engins déjà posés dans les synoptiques restent, avec leurs dimensions.' : ''}`,
    })
  }

  return (
    <section style={{ marginTop: 28 }} data-testid="section-catalogue">
      <h2 style={styleTitreSection}>Catalogue d'engins</h2>
      <p style={styleDiscret}>
        Les engins qu'on pose dans les images des synoptiques de ce chantier, à l'échelle. Longueur et largeur en mètres ; la couleur
        est celle de la catégorie. Modifier un type vaut pour les prochains engins posés : ceux déjà posés dans les synoptiques
        gardent leurs valeurs (copies figées).
      </p>
      <table style={{ borderCollapse: 'collapse', background: '#ffffff', border: `1px solid ${COULEURS.bordure}`, borderRadius: 6 }} data-testid="table-catalogue">
        <thead>
          <tr>
            <th style={entete}>Couleur</th>
            <th style={entete}>Catégorie</th>
            <th style={entete}>Modèle</th>
            <th style={{ ...entete, textAlign: 'right' }}>Longueur (m)</th>
            <th style={{ ...entete, textAlign: 'right' }}>Largeur (m)</th>
            <th style={entete} title="Nombre de synoptiques où ce type est posé">
              Synoptiques
            </th>
            <th style={entete} />
          </tr>
        </thead>
        <tbody>
          {parCategorie(catalogue).flatMap((groupe) =>
            groupe.types.map((type, i) => (
              <tr key={type.id} data-testid="ligne-type" style={i === 0 ? { borderTop: `2px solid ${COULEURS.bordure}` } : undefined}>
                <td style={cellule}>
                  <input
                    type="color"
                    value={type.couleur}
                    aria-label={`Couleur de ${type.modele}`}
                    style={{ width: 30, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                    onChange={(e) => modifier(type, { couleur: e.target.value })}
                  />
                </td>
                <td style={cellule}>
                  <Champ valeur={type.categorie} libelle={`Catégorie de ${type.modele}`} largeur={120} valider={(t) => modifier(type, { categorie: t.trim() })} />
                </td>
                <td style={cellule}>
                  <Champ valeur={type.modele} libelle={`Modèle ${type.modele}`} largeur={140} valider={(t) => modifier(type, { modele: t.trim() })} />
                </td>
                <td style={cellule}>
                  <Champ
                    valeur={formaterNombre(type.longueur)}
                    libelle={`Longueur de ${type.modele}`}
                    largeur={70}
                    nombre
                    valider={(t) => modifier(type, { longueur: lireNombre(t) ?? NaN })}
                  />
                </td>
                <td style={cellule}>
                  <Champ
                    valeur={formaterNombre(type.largeur)}
                    libelle={`Largeur de ${type.modele}`}
                    largeur={60}
                    nombre
                    valider={(t) => modifier(type, { largeur: lireNombre(t) ?? NaN })}
                  />
                </td>
                <td style={{ ...cellule, color: COULEURS.discret, textAlign: 'center' }}>{synoptiquesDuType(chantier, type.id) || ''}</td>
                <td style={cellule}>
                  <button
                    style={{ ...styleBouton(), color: COULEURS.erreur, padding: '2px 8px' }}
                    aria-label={`Supprimer ${type.modele} du catalogue`}
                    title="Retirer ce type du catalogue (les engins déjà posés restent)"
                    onClick={() => supprimer(type)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      {avis && (
        <p
          role={avis.genre === 'erreur' ? 'alert' : 'status'}
          data-testid="message-catalogue"
          style={{ ...styleDiscret, color: avis.genre === 'erreur' ? COULEURS.erreur : COULEURS.texte, fontSize: 13 }}
        >
          {avis.texte}
        </p>
      )}
      {catalogue.length === 0 && <p style={{ fontSize: 14, color: COULEURS.discret }}>Catalogue vide : ajoutez un type ci-dessous.</p>}
      <FormulaireAjout catalogue={catalogue} ajouter={ajouter} />
    </section>
  )
}
