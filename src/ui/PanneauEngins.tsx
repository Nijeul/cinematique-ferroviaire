import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { parCategorie, type TypeEngin } from '../plan/catalogue.ts'
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
  type Engin,
  type Groupe,
  type Rame,
  type ReferenceEngin,
} from '../plan/engins.ts'
import { COULEURS } from './couleurs.ts'
import { ChampCouleur } from './PanneauCalques.tsx'
import { stylesPanneau as styles } from './styles.ts'
import { TOUCHES_IMAGE, type EditeurImage } from './useEditeurImage.ts'

// Panneau des engins de l'image courante d'un synoptique : le type d'engin
// ou la rame à poser quand l'outil est choisi, puis le calque « Engins » de
// l'image — visible, verrouillé, la liste de ses engins et de ses rames avec
// leurs propriétés (numéro, couleur, angle, composition, sens).

const enTete: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 }

function Section({ titre, children, testid }: { titre: string; children: ReactNode; testid?: string }) {
  return (
    <section style={styles.section} data-testid={testid}>
      <h2 style={styles.titre}>{titre}</h2>
      {children}
    </section>
  )
}

// Une ligne de liste : cliquer la ligne choisit l'engin ou la rame sur l'image.
function Ligne(props: { editeur: EditeurImage; refEngin: ReferenceEngin; children: ReactNode }) {
  const { editeur, refEngin, children } = props
  const choisie = editeur.selection?.genre === refEngin.genre && editeur.selection.id === refEngin.id
  const element = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (choisie) element.current?.scrollIntoView({ block: 'nearest' })
  }, [choisie])
  return (
    <li
      ref={element}
      onClick={() => editeur.choisir(refEngin)}
      data-testid={`ligne-${refEngin.genre}`}
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

function BoutonSupprimer({ editeur, refEngin, nom }: { editeur: EditeurImage; refEngin: ReferenceEngin; nom: string }) {
  return (
    <button
      style={{ ...styles.petitBouton, color: COULEURS.erreur }}
      title="Retirer de cette image (Suppr)"
      aria-label={`Supprimer ${nom}`}
      onClick={(e) => {
        e.stopPropagation()
        editeur.supprimer(refEngin)
      }}
    >
      ✕
    </button>
  )
}

// « Description (légende) » : écrite après le nom dans la légende de l'image.
function ChampDescription(props: { valeur: string; nom: string; changer: (description: string) => void }) {
  return (
    <label style={{ ...styles.sousLigne, flexWrap: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
      <span style={{ flexShrink: 0 }}>Description (légende)</span>
      <input
        type="text"
        value={props.valeur}
        placeholder="facultative (« déblais »…)"
        aria-label={`Description de ${props.nom} dans la légende`}
        style={{ ...styles.champ, flex: 1, fontSize: 12 }}
        onChange={(e) => props.changer(e.target.value)}
      />
    </label>
  )
}

function Pastille({ couleur }: { couleur: string }) {
  return <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: couleur, border: `1px solid ${COULEURS.texte}`, flexShrink: 0 }} />
}

// Outil Engin : le type à poser, dans la liste du catalogue du chantier.
export function ChoixType({ editeur }: { editeur: EditeurImage }) {
  const { catalogue, typeChoisi } = editeur
  return (
    <Section titre="Engin à poser" testid="engin-a-poser">
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

export function RameAPoser({ editeur }: { editeur: EditeurImage }) {
  return (
    <Section titre="Rame à poser" testid="rame-a-poser">
      <Composition groupes={editeur.composition} changer={editeur.setComposition} catalogue={editeur.catalogue} />
      <p style={styles.discret}>Puis cliquez sur une voie : la rame se pose centrée sur le point cliqué, la tête côté {editeur.planche.extremites.gauche}.</p>
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

function LigneEngin({ editeur, engin }: { editeur: EditeurImage; engin: Engin }) {
  const { planche: projet, modifier } = editeur
  const position = engin.position
  const voie = position.genre === 'voie' ? projet.voies.find((v) => v.id === position.voieId) : undefined
  const s = silhouetteEngin(projet, engin)
  return (
    <Ligne editeur={editeur} refEngin={{ genre: 'engin', id: engin.id }}>
      <div style={enTete}>
        <ChampCouleur
          valeur={engin.couleur}
          libelle={`Couleur de ${engin.type.modele}`}
          changer={(couleur) => modifier((p) => modifierEngin(p, engin.id, { couleur }), `couleur:${engin.id}`)}
        />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
          <strong>{engin.type.modele}</strong> <span style={{ color: COULEURS.discret, fontSize: 12 }}>{engin.type.categorie}</span>
        </span>
        <BoutonSupprimer editeur={editeur} refEngin={{ genre: 'engin', id: engin.id }} nom={engin.type.modele} />
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
      <ChampDescription
        valeur={engin.description}
        nom={engin.type.modele}
        changer={(description) => modifier((p) => modifierEngin(p, engin.id, { description }), `description:${engin.id}`)}
      />
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

function LigneRame({ editeur, rame }: { editeur: EditeurImage; rame: Rame }) {
  const { planche: projet, modifier } = editeur
  const choisie = editeur.selection?.genre === 'rame' && editeur.selection.id === rame.id
  const voie = projet.voies.find((v) => v.id === rame.voieId)
  const s = silhouetteRame(projet, rame)
  const cote = coteTete(projet, rame)
  return (
    <Ligne editeur={editeur} refEngin={{ genre: 'rame', id: rame.id }}>
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
        <BoutonSupprimer editeur={editeur} refEngin={{ genre: 'rame', id: rame.id }} nom={rame.nom} />
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
      <ChampDescription
        valeur={rame.description}
        nom={rame.nom}
        changer={(description) => modifier((p) => modifierRame(p, rame.id, { description }), `description:${rame.id}`)}
      />
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

export function CalqueEngins({ editeur }: { editeur: EditeurImage }) {
  const { planche, calque, synoptique: s, index } = editeur
  const nombre = planche.engins.length + planche.rames.length
  return (
    <section style={styles.section} data-testid="calque-engins">
      <h2 style={styles.titre}>
        Engins de l'image {index + 1}
        {nombre > 0 && <span style={{ fontWeight: 400 }}> · {nombre}</span>}
      </h2>
      <p style={{ ...styles.discret, marginTop: 0 }} data-testid="echelle-synoptique">
        {s.echelle ? (
          <>Échelle : {descriptionEchelle(s.echelle, s.largeur)}</>
        ) : (
          <strong style={{ color: COULEURS.avertissement }}>Échelle non définie</strong>
        )}
      </p>
      <div style={{ ...styles.ligne, gap: 16 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={calque.visible}
            aria-label="Calque Engins visible"
            onChange={(e) => editeur.changerCalque({ visible: e.target.checked })}
          />
          Visible
        </label>
        <label
          style={{ display: 'flex', gap: 6, alignItems: 'center' }}
          title="Les engins ne se choisissent plus et ne se modifient plus, pour ne pas les bouger par mégarde"
        >
          <input
            type="checkbox"
            checked={calque.verrouille}
            aria-label="Calque Engins verrouillé"
            onChange={(e) => editeur.changerCalque({ verrouille: e.target.checked })}
          />
          Verrouillé
        </label>
      </div>
      {nombre === 0 && (
        <p style={styles.discret}>
          {s.echelle
            ? `Aucun engin sur cette image : outils « Engin » (${TOUCHES_IMAGE.engin}) et « Rame » (${TOUCHES_IMAGE.rame}).`
            : "Aucun engin : calez d'abord l'échelle du synoptique (bandeau jaune en haut)."}
        </p>
      )}
      <fieldset disabled={calque.verrouille} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
        <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }} data-testid="liste-engins">
          {planche.rames.map((rame) => (
            <LigneRame key={rame.id} editeur={editeur} rame={rame} />
          ))}
          {planche.engins.map((engin) => (
            <LigneEngin key={engin.id} editeur={editeur} engin={engin} />
          ))}
        </ul>
      </fieldset>
      <p style={styles.discret}>
        Chaque image a ses propres engins : poser, déplacer ou retirer ici ne change pas les autres images. « + Nouvelle image » recopie
        ceux-ci ; il ne reste qu'à déplacer ce qui bouge.
      </p>
    </section>
  )
}
