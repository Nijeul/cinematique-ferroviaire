import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { parCategorie } from '../plan/catalogue.ts'
import { descriptionEchelle, formaterMetres } from '../plan/echelle.ts'
import {
  ajouterGroupe,
  avertissementDepassement,
  changerNombre,
  composerRame,
  coteTete,
  deplacerGroupe,
  groupeDe,
  groupesDeVehicules,
  inverserRame,
  longueurRame,
  modifierEngin,
  modifierRame,
  NOMBRE_MAX_GROUPE,
  retirerGroupe,
  silhouetteEngin,
  silhouetteRame,
  texteComposition,
  tournerEngin,
  vehiculesDeGroupes,
  type Groupe,
} from '../plan/engins.ts'
import { libelleSens } from '../plan/dessin.ts'
import type { Genre } from '../plan/detection.ts'
import { modifierCalque, modifierCalqueFond, modifierExtremites, modifierVoie, retirerFond } from '../plan/edition.ts'
import { inverserAppareil, jumeau, modifierAppareil, modifierCadre, modifierTexte, modifierZone } from '../plan/elements.ts'
import { bornerPage } from '../plan/fond.ts'
import {
  EPAISSEUR_MAX,
  EPAISSEUR_MIN,
  TAILLE_TEXTE_MAX,
  TAILLE_TEXTE_MIN,
  type Engin,
  type NomCalque,
  type Rame,
  type TypeEngin,
} from '../plan/projet.ts'
import { COULEURS } from './couleurs.ts'
import { TOUCHE_ECHELLE, TOUCHES, type Editeur } from './useEditeur.ts'

// Panneau latéral : le plan (nom, échelle, extrémités du plan), l'engin ou la
// rame à poser quand l'outil est choisi, un calque par type d'élément — Fond,
// Cadres, Voies, Zones, Appareils, Engins, Textes — chacun avec sa liste et
// les propriétés de ses éléments, et l'aide des raccourcis.

const styles = {
  section: { borderBottom: `1px solid ${COULEURS.bordure}`, padding: '10px 14px' },
  titre: { margin: '0 0 6px', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: COULEURS.discret },
  ligne: { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0', fontSize: 13 },
  discret: { fontSize: 12, color: COULEURS.discret, margin: '4px 0' },
  champ: { font: 'inherit', fontSize: 13, padding: '3px 6px', border: `1px solid ${COULEURS.bordure}`, borderRadius: 4, minWidth: 0 },
  petitBouton: { font: 'inherit', fontSize: 12, padding: '2px 8px', border: `1px solid ${COULEURS.bordure}`, borderRadius: 4, background: '#fff', cursor: 'pointer' },
  couleur: { width: 30, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 },
  sousLigne: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, margin: '6px 0 0', color: COULEURS.discret, fontSize: 12 },
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
    <details open style={styles.section}>
      <summary style={{ ...styles.titre, cursor: 'pointer' }}>Calque « Fond »</summary>
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
      <div style={{ ...styles.ligne, gap: 16 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }} title="Empêche de remplacer le fond ou d'en changer la page par mégarde">
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
      </div>
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
    </details>
  )
}

// Un calque d'éléments : titre repliable avec le nombre d'éléments, cases
// Visible et Verrouillé, puis la liste (désactivée si verrouillé).
function CalqueElements(props: {
  editeur: Editeur
  nom: NomCalque
  titre: string
  nombre: number
  vide: string
  children: ReactNode
}) {
  const { editeur, nom, titre, nombre, vide, children } = props
  const calque = editeur.projet.calques[nom]
  return (
    <details open style={styles.section} data-testid={`calque-${nom}`}>
      <summary style={{ ...styles.titre, cursor: 'pointer' }}>
        Calque « {titre} »{nombre > 0 && <span style={{ fontWeight: 400 }}> · {nombre}</span>}
      </summary>
      <div style={{ ...styles.ligne, gap: 16 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={calque.visible}
            aria-label={`Calque ${titre} visible`}
            onChange={(e) => {
              const visible = e.target.checked
              editeur.modifier((p) => modifierCalque(p, nom, { visible }))
            }}
          />
          Visible
        </label>
        <label
          style={{ display: 'flex', gap: 6, alignItems: 'center' }}
          title="Les éléments ne se choisissent plus et ne se modifient plus, pour ne pas les bouger par mégarde"
        >
          <input
            type="checkbox"
            checked={calque.verrouille}
            aria-label={`Calque ${titre} verrouillé`}
            onChange={(e) => {
              const verrouille = e.target.checked
              editeur.modifier((p) => modifierCalque(p, nom, { verrouille }))
            }}
          />
          Verrouillé
        </label>
      </div>
      {nombre === 0 && <p style={styles.discret}>{vide}</p>}
      <fieldset disabled={calque.verrouille} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
        <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }} data-testid={`liste-${nom}`}>
          {children}
        </ul>
      </fieldset>
    </details>
  )
}

// Une ligne de liste : cliquer la ligne choisit l'élément sur le plan.
function Ligne(props: { editeur: Editeur; genre: Genre; id: string; children: ReactNode }) {
  const { editeur, genre, id, children } = props
  const choisie = editeur.selection?.genre === genre && editeur.selection.id === id
  const element = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (choisie) element.current?.scrollIntoView({ block: 'nearest' })
  }, [choisie])
  return (
    <li
      ref={element}
      onClick={() => editeur.choisir(genre, id)}
      style={{
        padding: '6px 8px',
        margin: '4px 0',
        borderRadius: 6,
        border: `1px solid ${choisie ? COULEURS.selection : COULEURS.bordure}`,
        background: choisie ? '#e8f0f9' : '#fff',
        cursor: 'pointer',
      }}
    >
      {children}
    </li>
  )
}

function ChampCouleur({ valeur, libelle, changer }: { valeur: string; libelle: string; changer: (c: string) => void }) {
  return (
    <input
      type="color"
      value={valeur}
      aria-label={libelle}
      title={libelle}
      style={styles.couleur}
      onChange={(e) => changer(e.target.value)}
    />
  )
}

function BoutonSupprimer({ editeur, genre, id, nom }: { editeur: Editeur; genre: Genre; id: string; nom: string }) {
  return (
    <button
      style={{ ...styles.petitBouton, color: COULEURS.erreur }}
      title="Supprimer (Suppr)"
      aria-label={`Supprimer ${nom}`}
      onClick={(e) => {
        e.stopPropagation()
        editeur.supprimer({ genre, id })
      }}
    >
      ✕
    </button>
  )
}

const enTete: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 }

function CalqueVoies({ editeur }: { editeur: Editeur }) {
  const { projet, modifier } = editeur
  return (
    <CalqueElements editeur={editeur} nom="voies" titre="Voies" nombre={projet.voies.length} vide="Aucune voie : prenez l'outil « Voie ».">
      {projet.voies.map((voie) => (
        <Ligne key={voie.id} editeur={editeur} genre="voie" id={voie.id}>
          <div style={enTete}>
            <ChampCouleur
              valeur={voie.couleur}
              libelle={`Couleur de ${voie.nom}`}
              changer={(couleur) => modifier((p) => modifierVoie(p, voie.id, { couleur }), `couleur:${voie.id}`)}
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
            <BoutonSupprimer editeur={editeur} genre="voie" id={voie.id} nom={voie.nom} />
          </div>
          <div style={styles.sousLigne}>
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
        </Ligne>
      ))}
    </CalqueElements>
  )
}

function CalqueZones({ editeur }: { editeur: Editeur }) {
  const { projet, modifier } = editeur
  return (
    <CalqueElements
      editeur={editeur}
      nom="zones"
      titre="Zones"
      nombre={projet.zones.length}
      vide="Aucune zone : outil « Zone », un clic au début sur une voie, un clic à la fin."
    >
      {projet.zones.map((zone) => (
        <Ligne key={zone.id} editeur={editeur} genre="zone" id={zone.id}>
          <div style={enTete}>
            <ChampCouleur
              valeur={zone.couleur}
              libelle={`Couleur de ${zone.nom}`}
              changer={(couleur) => modifier((p) => modifierZone(p, zone.id, { couleur }), `couleur:${zone.id}`)}
            />
            <input
              type="text"
              value={zone.nom}
              aria-label="Nom de la zone"
              title="Tapez la longueur dans le nom, par exemple « RVB 50 m »"
              style={{ ...styles.champ, flex: 1, fontWeight: 600 }}
              onChange={(e) => {
                const nom = e.target.value
                modifier((p) => modifierZone(p, zone.id, { nom }), `nom:${zone.id}`)
              }}
            />
            <BoutonSupprimer editeur={editeur} genre="zone" id={zone.id} nom={zone.nom} />
          </div>
          <div style={styles.sousLigne}>sur « {projet.voies.find((v) => v.id === zone.voieId)?.nom} »</div>
        </Ligne>
      ))}
    </CalqueElements>
  )
}

function CalqueAppareils({ editeur }: { editeur: Editeur }) {
  const { projet, modifier } = editeur
  const nomVoie = (id: string) => projet.voies.find((v) => v.id === id)?.nom ?? '?'
  return (
    <CalqueElements
      editeur={editeur}
      nom="appareils"
      titre="Appareils"
      nombre={projet.appareils.length}
      vide="Aucun appareil : outil « Appareil (BS) » ou « Communication »."
    >
      {projet.appareils.map((appareil) => {
        const autre = jumeau(projet, appareil)
        return (
          <Ligne key={appareil.id} editeur={editeur} genre="appareil" id={appareil.id}>
            <div style={enTete}>
              <input
                type="text"
                value={appareil.nom}
                aria-label="Nom de l'appareil"
                style={{ ...styles.champ, flex: 1, fontWeight: 600 }}
                onChange={(e) => {
                  const nom = e.target.value
                  modifier((p) => modifierAppareil(p, appareil.id, { nom }), `nom:${appareil.id}`)
                }}
              />
              <BoutonSupprimer editeur={editeur} genre="appareil" id={appareil.id} nom={appareil.nom} />
            </div>
            <div style={styles.sousLigne}>
              <strong style={{ color: COULEURS.texte }} data-testid="sens-appareil">
                {libelleSens(projet, appareil)}
              </strong>
            </div>
            <div style={styles.sousLigne}>
              pointe sur « {nomVoie(appareil.pointe.voieId)} », talon vers « {nomVoie(appareil.talon.voieId)} »
            </div>
            <div style={styles.sousLigne}>
              {autre ? (
                <span>Communication avec « {autre.nom} »</span>
              ) : (
                <button
                  style={styles.petitBouton}
                  title="La pointe passe à l'autre bout du biais"
                  onClick={(e) => {
                    e.stopPropagation()
                    modifier((p) => inverserAppareil(p, appareil.id))
                  }}
                >
                  ⇄ Inverser le sens
                </button>
              )}
            </div>
          </Ligne>
        )
      })}
    </CalqueElements>
  )
}

// ——— Engins ———

function Pastille({ couleur }: { couleur: string }) {
  return <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: couleur, border: `1px solid ${COULEURS.texte}`, flexShrink: 0 }} />
}

// Outil Engin : le type à poser, dans la liste du catalogue du chantier.
function ChoixType({ editeur }: { editeur: Editeur }) {
  const { catalogue, typeChoisi } = editeur
  return (
    <Section titre="Engin à poser">
      {catalogue.length === 0 && <p style={styles.discret}>Catalogue vide : ajoutez des types dans la page du chantier.</p>}
      <div style={{ maxHeight: 300, overflowY: 'auto' }} data-testid="choix-type">
        {parCategorie(catalogue).map((groupe) => (
          <div key={groupe.categorie} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COULEURS.discret, textTransform: 'uppercase', letterSpacing: 0.3 }}>{groupe.categorie}</div>
            {groupe.types.map((type) => {
              const choisi = typeChoisi?.id === type.id
              return (
                <button
                  key={type.id}
                  aria-pressed={choisi}
                  data-testid="type-engin"
                  onClick={() => editeur.setTypeChoisi(type.id)}
                  style={{
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
                  }}
                >
                  <Pastille couleur={type.couleur} />
                  <span style={{ flex: 1, fontWeight: choisi ? 700 : 400 }}>{type.modele}</span>
                  <span style={{ color: COULEURS.discret, fontSize: 12 }}>{formaterMetres(type.longueur)}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </Section>
  )
}

// Composition d'une rame : groupes de véhicules identiques (« 10 × R39 »),
// qu'on ajoute, retire, déplace et dont on change le nombre.
function Composition(props: { groupes: Groupe[]; changer: (g: Groupe[]) => void; catalogue: TypeEngin[]; auMoinsUn?: boolean }) {
  const { groupes, changer, catalogue } = props
  const [ajout, setAjout] = useState(catalogue[0]?.id ?? '')
  const [nombre, setNombre] = useState('1')
  const vehicules = vehiculesDeGroupes(groupes)
  const typeAjout = catalogue.find((t) => t.id === ajout) ?? catalogue[0]
  return (
    <div data-testid="composition">
      {groupes.length === 0 && <p style={styles.discret}>Aucun véhicule : ajoutez-en ci-dessous (la locomotive d'abord).</p>}
      <ol style={{ listStyle: 'none', margin: '4px 0', padding: 0 }}>
        {groupes.map((g, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '3px 0', fontSize: 13 }} data-testid="groupe">
            <Pastille couleur={g.type.couleur} />
            <input
              type="number"
              min={1}
              max={NOMBRE_MAX_GROUPE}
              value={g.nombre}
              aria-label={`Nombre de ${g.type.modele}`}
              style={{ ...styles.champ, width: 46, fontSize: 12 }}
              onChange={(e) => {
                if (e.target.value !== '') changer(changerNombre(groupes, i, Number(e.target.value)))
              }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              × <strong>{g.type.modele}</strong> <span style={{ color: COULEURS.discret, fontSize: 12 }}>{formaterMetres(g.type.longueur)}</span>
            </span>
            <button style={styles.petitBouton} disabled={i === 0} onClick={() => changer(deplacerGroupe(groupes, i, -1))} title="Vers la tête" aria-label="Monter">
              ↑
            </button>
            <button
              style={styles.petitBouton}
              disabled={i === groupes.length - 1}
              onClick={() => changer(deplacerGroupe(groupes, i, 1))}
              title="Vers la queue"
              aria-label="Descendre"
            >
              ↓
            </button>
            <button
              style={{ ...styles.petitBouton, color: COULEURS.erreur }}
              disabled={props.auMoinsUn && groupes.length <= 1}
              onClick={() => changer(retirerGroupe(groupes, i))}
              aria-label={`Retirer ${g.type.modele}`}
              title="Retirer"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
      {catalogue.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <input
            type="number"
            min={1}
            max={NOMBRE_MAX_GROUPE}
            value={nombre}
            aria-label="Nombre de véhicules à ajouter"
            style={{ ...styles.champ, width: 46, fontSize: 12 }}
            onChange={(e) => setNombre(e.target.value)}
          />
          <span style={{ fontSize: 13 }}>×</span>
          <select
            value={typeAjout?.id}
            aria-label="Véhicule à ajouter"
            style={{ ...styles.champ, flex: 1, fontSize: 12 }}
            onChange={(e) => setAjout(e.target.value)}
          >
            {parCategorie(catalogue).map((groupe) => (
              <optgroup key={groupe.categorie} label={groupe.categorie}>
                {groupe.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.modele} — {formaterMetres(t.longueur)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            style={styles.petitBouton}
            onClick={() => {
              const n = Math.round(Number(nombre))
              if (typeAjout && n >= 1) changer(ajouterGroupe(groupes, groupeDe(typeAjout, Math.min(NOMBRE_MAX_GROUPE, n))))
            }}
          >
            + Ajouter
          </button>
        </div>
      )}
      {vehicules.length > 0 && (
        <p style={{ ...styles.ligne, margin: '8px 0 0' }} data-testid="longueur-composition">
          <span>
            Longueur totale : <strong>{formaterMetres(longueurRame(vehicules))}</strong> · {vehicules.length} véhicule{vehicules.length > 1 ? 's' : ''}
          </span>
        </p>
      )}
    </div>
  )
}

function RameAPoser({ editeur }: { editeur: Editeur }) {
  return (
    <Section titre="Rame à poser">
      <Composition groupes={editeur.composition} changer={editeur.setComposition} catalogue={editeur.catalogue} />
      <p style={styles.discret}>Puis cliquez sur une voie : la rame se pose centrée sur le point cliqué, la tête côté {editeur.projet.extremites.gauche}.</p>
    </Section>
  )
}

function AvertissementDepassement({ texte }: { texte: string | null }) {
  if (!texte) return null
  return (
    <p style={{ ...styles.sousLigne, color: COULEURS.erreur, fontWeight: 600 }} role="alert" data-testid="depassement">
      ⚠ {texte}
    </p>
  )
}

function LigneEngin({ editeur, engin }: { editeur: Editeur; engin: Engin }) {
  const { projet, modifier } = editeur
  const position = engin.position
  const voie = position.genre === 'voie' ? projet.voies.find((v) => v.id === position.voieId) : undefined
  const s = silhouetteEngin(projet, engin)
  return (
    <Ligne editeur={editeur} genre="engin" id={engin.id}>
      <div style={enTete}>
        <ChampCouleur
          valeur={engin.couleur}
          libelle={`Couleur de ${engin.type.modele}`}
          changer={(couleur) => modifier((p) => modifierEngin(p, engin.id, { couleur }), `couleur:${engin.id}`)}
        />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
          <strong>{engin.type.modele}</strong> <span style={{ color: COULEURS.discret, fontSize: 12 }}>{engin.type.categorie}</span>
        </span>
        <BoutonSupprimer editeur={editeur} genre="engin" id={engin.id} nom={engin.type.modele} />
      </div>
      <div style={styles.sousLigne}>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          N°
          <input
            type="text"
            value={engin.numero}
            maxLength={6}
            aria-label={`Numéro de ${engin.type.modele}`}
            title="Numéro ou court libellé dans la pastille (« 3 », « P4 ») ; vide : pas de pastille"
            style={{ ...styles.champ, width: 44, fontSize: 12 }}
            onChange={(e) => {
              const numero = e.target.value
              modifier((p) => modifierEngin(p, engin.id, { numero }), `numero:${engin.id}`)
            }}
          />
        </label>
        <span>
          {formaterMetres(engin.type.longueur).replace(/ m$/, '')} × {formaterMetres(engin.type.largeur)}
        </span>
      </div>
      <div style={styles.sousLigne}>
        {engin.position.genre === 'voie' ? (
          <span>sur « {voie?.nom} »</span>
        ) : (
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            hors voie · Angle
            <input
              type="number"
              step={5}
              value={Math.round(engin.position.angle * 10) / 10}
              aria-label={`Angle de ${engin.type.modele}`}
              title="En degrés, sens des aiguilles d'une montre ; 0 = horizontal"
              style={{ ...styles.champ, width: 58, fontSize: 12 }}
              onChange={(e) => {
                const angle = Number(e.target.value)
                if (e.target.value !== '' && Number.isFinite(angle)) modifier((p) => tournerEngin(p, engin.id, angle), `angle:${engin.id}`)
              }}
            />
            °
          </label>
        )}
      </div>
      <AvertissementDepassement texte={avertissementDepassement(`« ${engin.type.modele} »`, voie, s?.depassement ?? 0)} />
    </Ligne>
  )
}

function LigneRame({ editeur, rame }: { editeur: Editeur; rame: Rame }) {
  const { projet, modifier } = editeur
  const choisie = editeur.selection?.genre === 'rame' && editeur.selection.id === rame.id
  const voie = projet.voies.find((v) => v.id === rame.voieId)
  const s = silhouetteRame(projet, rame)
  const cote = coteTete(projet, rame)
  return (
    <Ligne editeur={editeur} genre="rame" id={rame.id}>
      <div style={enTete}>
        <ChampCouleur
          valeur={rame.couleur}
          libelle={`Couleur de la pastille de ${rame.nom}`}
          changer={(couleur) => modifier((p) => modifierRame(p, rame.id, { couleur }), `couleur:${rame.id}`)}
        />
        <input
          type="text"
          value={rame.nom}
          aria-label="Nom de la rame"
          style={{ ...styles.champ, flex: 1, fontWeight: 600 }}
          onChange={(e) => {
            const nom = e.target.value
            modifier((p) => modifierRame(p, rame.id, { nom }), `nom:${rame.id}`)
          }}
        />
        <BoutonSupprimer editeur={editeur} genre="rame" id={rame.id} nom={rame.nom} />
      </div>
      <div style={styles.sousLigne}>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          N°
          <input
            type="text"
            value={rame.numero}
            maxLength={6}
            aria-label={`Numéro de ${rame.nom}`}
            title="Numéro ou court libellé dans la pastille ; vide : pas de pastille"
            style={{ ...styles.champ, width: 44, fontSize: 12 }}
            onChange={(e) => {
              const numero = e.target.value
              modifier((p) => modifierRame(p, rame.id, { numero }), `numero:${rame.id}`)
            }}
          />
        </label>
        <span>
          <strong style={{ color: COULEURS.texte }} data-testid="longueur-rame">
            {formaterMetres(longueurRame(rame.vehicules))}
          </strong>{' '}
          · {rame.vehicules.length} véhicules
        </span>
      </div>
      <div style={styles.sousLigne}>sur « {voie?.nom} »</div>
      <div style={styles.sousLigne}>{texteComposition(rame.vehicules)}</div>
      <AvertissementDepassement texte={avertissementDepassement(`La rame « ${rame.nom} »`, voie, s?.depassement ?? 0)} />
      {choisie && (
        <div onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
          <div style={styles.sousLigne}>
            {cote && (
              <span data-testid="sens-rame">
                Tête ({rame.vehicules[0].type.modele}) côté <strong style={{ color: COULEURS.texte }}>{cote}</strong>
              </span>
            )}
            <button style={styles.petitBouton} onClick={() => modifier((p) => inverserRame(p, rame.id))} title="La rame reste en place, la tête passe à l'autre bout">
              ⇄ Inverser le sens
            </button>
          </div>
          <Composition
            groupes={groupesDeVehicules(rame.vehicules)}
            changer={(g) => modifier((p) => composerRame(p, rame.id, vehiculesDeGroupes(g)), `composition:${rame.id}`)}
            catalogue={editeur.catalogue}
            auMoinsUn
          />
          <details style={{ marginTop: 6, fontSize: 12 }}>
            <summary style={{ cursor: 'pointer', color: COULEURS.discret }}>Détail des {rame.vehicules.length} véhicules, de la tête à la queue</summary>
            <ol style={{ margin: '4px 0 0', paddingLeft: 22 }} data-testid="detail-vehicules">
              {rame.vehicules.map((v, i) => (
                <li key={i}>
                  {v.type.modele} — {formaterMetres(v.type.longueur)}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </Ligne>
  )
}

function CalqueEngins({ editeur }: { editeur: Editeur }) {
  const { projet } = editeur
  return (
    <CalqueElements
      editeur={editeur}
      nom="engins"
      titre="Engins"
      nombre={projet.engins.length + projet.rames.length}
      vide={projet.echelle ? 'Aucun engin : outils « Engin » et « Rame ».' : "Calez d'abord l'échelle du plan pour poser des engins à la bonne taille."}
    >
      {projet.rames.map((rame) => (
        <LigneRame key={rame.id} editeur={editeur} rame={rame} />
      ))}
      {projet.engins.map((engin) => (
        <LigneEngin key={engin.id} editeur={editeur} engin={engin} />
      ))}
    </CalqueElements>
  )
}

function CalqueCadres({ editeur }: { editeur: Editeur }) {
  const { projet, modifier } = editeur
  return (
    <CalqueElements
      editeur={editeur}
      nom="cadres"
      titre="Cadres"
      nombre={projet.cadres.length}
      vide="Aucun cadre : outil « Cadre », glissez pour tracer un rectangle (stockage, base arrière, pont…)."
    >
      {projet.cadres.map((cadre) => (
        <Ligne key={cadre.id} editeur={editeur} genre="cadre" id={cadre.id}>
          <div style={enTete}>
            <ChampCouleur
              valeur={cadre.couleur}
              libelle={`Couleur de ${cadre.nom}`}
              changer={(couleur) => modifier((p) => modifierCadre(p, cadre.id, { couleur }), `couleur:${cadre.id}`)}
            />
            <input
              type="text"
              value={cadre.nom}
              aria-label="Nom du cadre"
              style={{ ...styles.champ, flex: 1, fontWeight: 600 }}
              onChange={(e) => {
                const nom = e.target.value
                modifier((p) => modifierCadre(p, cadre.id, { nom }), `nom:${cadre.id}`)
              }}
            />
            <BoutonSupprimer editeur={editeur} genre="cadre" id={cadre.id} nom={cadre.nom} />
          </div>
          <div style={styles.sousLigne}>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={cadre.pointille}
                onChange={(e) => {
                  const pointille = e.target.checked
                  modifier((p) => modifierCadre(p, cadre.id, { pointille }))
                }}
              />
              Pointillés
            </label>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={cadre.rempli}
                onChange={(e) => {
                  const rempli = e.target.checked
                  modifier((p) => modifierCadre(p, cadre.id, { rempli }))
                }}
              />
              Remplissage léger
            </label>
          </div>
        </Ligne>
      ))}
    </CalqueElements>
  )
}

function CalqueTextes({ editeur }: { editeur: Editeur }) {
  const { projet, modifier } = editeur
  return (
    <CalqueElements
      editeur={editeur}
      nom="textes"
      titre="Textes"
      nombre={projet.textes.length}
      vide="Aucun texte : outil « Texte », cliquez sur le plan puis tapez ici."
    >
      {projet.textes.map((texte) => (
        <Ligne key={texte.id} editeur={editeur} genre="texte" id={texte.id}>
          <div style={enTete}>
            <ChampCouleur
              valeur={texte.couleur}
              libelle="Couleur du texte"
              changer={(couleur) => modifier((p) => modifierTexte(p, texte.id, { couleur }), `couleur:${texte.id}`)}
            />
            <input
              type="text"
              value={texte.texte}
              aria-label="Texte"
              ref={(champ) => {
                // Texte qu'on vient de poser : le champ est prêt à la frappe.
                // Un tour plus tard, sinon le clic sur le plan, pas encore
                // terminé, reprendrait aussitôt le focus.
                if (champ && editeur.texteAFocaliser === texte.id) {
                  editeur.texteFocalise()
                  setTimeout(() => {
                    champ.focus()
                    champ.select()
                  }, 0)
                }
              }}
              style={{ ...styles.champ, flex: 1, fontWeight: texte.gras ? 700 : 400 }}
              onChange={(e) => {
                const valeur = e.target.value
                modifier((p) => modifierTexte(p, texte.id, { texte: valeur }), `texte:${texte.id}`)
              }}
            />
            <BoutonSupprimer editeur={editeur} genre="texte" id={texte.id} nom={texte.texte} />
          </div>
          <div style={styles.sousLigne}>
            <span>Taille</span>
            <input
              type="number"
              min={TAILLE_TEXTE_MIN}
              max={TAILLE_TEXTE_MAX}
              value={texte.taille}
              aria-label="Taille du texte"
              style={{ ...styles.champ, width: 58, fontSize: 12 }}
              onChange={(e) => {
                const taille = Number(e.target.value)
                if (e.target.value !== '' && taille > 0) {
                  modifier((p) => modifierTexte(p, texte.id, { taille }), `taille:${texte.id}`)
                }
              }}
            />
            <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={texte.gras}
                onChange={(e) => {
                  const gras = e.target.checked
                  modifier((p) => modifierTexte(p, texte.id, { gras }))
                }}
              />
              Gras
            </label>
          </div>
        </Ligne>
      ))}
    </CalqueElements>
  )
}

function Aide() {
  const lignes: [string, string][] = [
    [`Voie (${TOUCHES.voie})`, 'un clic par point ; double-clic ou Entrée pour finir ; Échap annule'],
    ['Maj', 'segment horizontal, vertical ou à 45°'],
    [`Zone (${TOUCHES.zone})`, 'clic sur une voie au début, clic sur la même voie à la fin'],
    [`Appareil (BS) (${TOUCHES.bs})`, 'clic sur la voie directe à la pointe, puis sur la voie déviée côté talon'],
    [`Communication (${TOUCHES.communication})`, 'clic sur la première voie, puis sur la seconde : deux BS talon contre talon'],
    [`Cadre (${TOUCHES.cadre})`, 'glisser pour tracer un rectangle'],
    [`Texte (${TOUCHES.texte})`, 'clic sur le plan, puis taper le texte dans le panneau'],
    [`Échelle… (${TOUCHE_ECHELLE})`, 'caler l’échelle : deux repères sur le plan et leur distance réelle'],
    [`Engin (${TOUCHES.engin})`, 'choisir le type dans le panneau ; clic sur une voie (il la suit) ou hors voie (libre, poignée ronde pour tourner)'],
    [`Rame (${TOUCHES.rame})`, 'composer la rame dans le panneau, puis clic sur une voie'],
    [`Sélection (${TOUCHES.selection})`, "clic sur un élément ; glisser l'élément ou ses poignées"],
    ['Suppr', "supprime l'élément choisi (ou le point choisi d'une voie)"],
    ['Molette', 'zoom autour du curseur'],
    [`Main (${TOUCHES.main}), Espace ou clic molette`, 'déplacer la vue'],
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
        width: 320,
        flexShrink: 0,
        overflowY: 'auto',
        background: COULEURS.panneau,
        borderLeft: `1px solid ${COULEURS.bordure}`,
      }}
    >
      {editeur.outil === 'engin' && <ChoixType editeur={editeur} />}
      {editeur.outil === 'rame' && <RameAPoser editeur={editeur} />}
      <Section titre="Plan">
        <input
          type="text"
          value={projet.nom}
          aria-label="Nom du plan"
          style={{ ...styles.champ, width: '100%', boxSizing: 'border-box', fontWeight: 600 }}
          onChange={(e) => {
            const nom = e.target.value
            modifier((p) => ({ ...p, nom }), 'nom-projet')
          }}
        />
        <p style={{ ...styles.discret, marginTop: 8 }} data-testid="echelle-plan">
          {projet.echelle ? (
            <>
              Échelle : {descriptionEchelle(projet.echelle, projet.largeur)}
            </>
          ) : (
            <strong style={{ color: COULEURS.avertissement }}>Échelle non définie</strong>
          )}
        </p>
        <p style={{ ...styles.discret, marginTop: 10 }}>Extrémités du plan (sens des appareils) :</p>
        <div style={{ ...styles.ligne, gap: 6 }}>
          <span title="Extrémité gauche du plan">◀</span>
          <input
            type="text"
            value={projet.extremites.gauche}
            aria-label="Extrémité gauche"
            style={{ ...styles.champ, flex: 1, width: 0 }}
            onChange={(e) => {
              const gauche = e.target.value
              modifier((p) => modifierExtremites(p, { gauche }), 'extremite-gauche')
            }}
          />
          <input
            type="text"
            value={projet.extremites.droite}
            aria-label="Extrémité droite"
            style={{ ...styles.champ, flex: 1, width: 0, textAlign: 'right' }}
            onChange={(e) => {
              const droite = e.target.value
              modifier((p) => modifierExtremites(p, { droite }), 'extremite-droite')
            }}
          />
          <span title="Extrémité droite du plan">▶</span>
        </div>
      </Section>
      <CalqueFond editeur={editeur} />
      <CalqueCadres editeur={editeur} />
      <CalqueVoies editeur={editeur} />
      <CalqueZones editeur={editeur} />
      <CalqueAppareils editeur={editeur} />
      <CalqueEngins editeur={editeur} />
      <CalqueTextes editeur={editeur} />
      <Aide />
    </aside>
  )
}
