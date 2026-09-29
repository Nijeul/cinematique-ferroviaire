import { useEffect, useId, useState, type ReactNode } from 'react'
import { ecrireAdresse, type Route } from '../plan/adresse.ts'
import { formaterHoraire, lireInstant } from '../plan/temps.ts'
import { COULEURS } from './couleurs.ts'
import { styleBouton, styleBoutonDanger, styleChamp } from './styles.ts'
import type { Message } from './useEditeur.ts'

// Morceaux d'interface communs aux écrans : barre du haut avec le fil
// d'Ariane, fenêtre par-dessus l'écran, confirmation, messages, champs.

export type Etape = { libelle: string; route?: Route }

// Barre du haut : nom de l'application, fil d'Ariane « Accueil › chantier ›
// plan », et à droite l'état de l'enregistrement dans le navigateur.
export function BarreNavigation({ chemin, etat, action }: { chemin: Etape[]; etat?: ReactNode; action?: ReactNode }) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 14px',
        background: COULEURS.texte,
        color: '#ffffff',
        fontSize: 14,
        minHeight: 22,
      }}
    >
      <a href="#/" style={{ color: '#ffffff', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
        Cinématique ferroviaire
      </a>
      <span style={{ width: 1, alignSelf: 'stretch', background: '#56606b' }} />
      <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 6, listStyle: 'none', margin: 0, padding: 0, minWidth: 0 }} data-testid="fil-ariane">
        {chemin.map((etape, i) => (
          <li key={i} style={{ display: 'flex', gap: 6, minWidth: 0 }}>
            {i > 0 && <span style={{ color: '#9aa4ae' }}>›</span>}
            {etape.route && i < chemin.length - 1 ? (
              <a href={ecrireAdresse(etape.route)} style={{ color: '#cfe0f2' }}>
                {etape.libelle}
              </a>
            ) : (
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etape.libelle}</strong>
            )}
          </li>
        ))}
      </ol>
      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#c3cad2', whiteSpace: 'nowrap' }} data-testid="etat-enregistrement">
        {etat}
      </span>
      {action}
    </nav>
  )
}

// Fenêtre posée au-dessus de l'écran ; Échap ou « Annuler » la ferme.
export function Fenetre(props: { titre: string; fermer: () => void; largeur?: number; children: ReactNode }) {
  const { titre, fermer, largeur = 460, children } = props
  const idTitre = useId()
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [fermer])
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28, 36, 48, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        style={{
          width: largeur,
          maxWidth: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          padding: '16px 20px',
          boxSizing: 'border-box',
        }}
      >
        <h2 id={idTitre} style={{ margin: '0 0 12px', fontSize: 17 }}>
          {titre}
        </h2>
        {children}
      </div>
    </div>
  )
}

export function BoutonsFenetre({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>{children}</div>
}

// Confirmation avant une action qu'on ne peut pas annuler.
export function Confirmation(props: { titre: string; texte: ReactNode; action: string; confirmer: () => void; annuler: () => void }) {
  return (
    <Fenetre titre={props.titre} fermer={props.annuler}>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{props.texte}</div>
      <BoutonsFenetre>
        <button style={styleBouton()} onClick={props.annuler} autoFocus>
          Annuler
        </button>
        <button style={{ ...styleBoutonDanger, fontWeight: 600, borderColor: COULEURS.erreur }} onClick={props.confirmer}>
          {props.action}
        </button>
      </BoutonsFenetre>
    </Fenetre>
  )
}

// Message sous la barre du haut (information ou erreur), avec sa croix.
export function BandeauMessage({ message, fermer }: { message: Message | null; fermer: () => void }) {
  if (!message) return null
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '7px 14px',
        fontSize: 13,
        background: '#ffffff',
        borderBottom: `1px solid ${COULEURS.bordure}`,
        color: message.genre === 'erreur' ? COULEURS.erreur : COULEURS.texte,
      }}
    >
      <div style={{ flex: 1 }}>
        {message.texte}
        {message.details && (
          <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
            {message.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      <button style={{ ...styleBouton(), padding: '1px 7px', fontSize: 12 }} onClick={fermer} aria-label="Fermer le message">
        ✕
      </button>
    </div>
  )
}

// Champ de renommage : Entrée ou clic ailleurs valide, Échap abandonne.
export function ChampRenommer(props: { valeur: string; libelle: string; valider: (nom: string) => void; abandonner: () => void }) {
  const [texte, setTexte] = useState(props.valeur)
  const valider = () => {
    const nom = texte.trim()
    if (nom === '' || nom === props.valeur) props.abandonner()
    else props.valider(nom)
  }
  return (
    <input
      type="text"
      value={texte}
      aria-label={props.libelle}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setTexte(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') valider()
        if (e.key === 'Escape') {
          e.stopPropagation()
          props.abandonner()
        }
      }}
      onBlur={valider}
      style={{ ...styleChamp, fontSize: 14, fontWeight: 600, width: '100%', boxSizing: 'border-box' }}
    />
  )
}

// Champ date et heure. `changer` reçoit la saisie et renvoie un message
// d'erreur si elle est refusée : la saisie reste alors affichée avec le
// message, sans rien modifier. À côté, l'heure au format du métier.
export function ChampInstant(props: { libelle: string; valeur: string; changer: (texte: string) => string | null }) {
  const [brouillon, setBrouillon] = useState(props.valeur)
  const [precedente, setPrecedente] = useState(props.valeur)
  const [erreur, setErreur] = useState<string | null>(null)
  // Valeur changée d'ailleurs (Annuler…) : le champ la reprend.
  if (props.valeur !== precedente) {
    setPrecedente(props.valeur)
    setBrouillon(props.valeur)
    setErreur(null)
  }
  const lisible = lireInstant(brouillon) !== null ? formaterHoraire(brouillon, 0) : ''
  return (
    <div style={{ margin: '6px 0' }}>
      <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 8px', fontSize: 13 }}>
        <span style={{ width: 40, flexShrink: 0 }}>{props.libelle}</span>
        <input
          type="datetime-local"
          value={brouillon}
          aria-label={props.libelle}
          aria-invalid={erreur !== null}
          style={{ ...styleChamp, flexShrink: 0, borderColor: erreur ? COULEURS.erreur : COULEURS.bordure }}
          onChange={(e) => {
            setBrouillon(e.target.value)
            setErreur(props.changer(e.target.value))
          }}
        />
        <strong style={{ fontSize: 13, whiteSpace: 'nowrap', minWidth: 88 }}>{lisible}</strong>
      </label>
      {erreur && <p style={{ margin: '4px 0 0 48px', fontSize: 12, color: COULEURS.erreur }}>{erreur}</p>}
    </div>
  )
}

// Une ligne de liste (chantier, plan, synoptique) : titre, détails, actions.
export function LigneListe(props: { titre: ReactNode; details: ReactNode; actions: ReactNode; testid?: string }) {
  return (
    <li
      data-testid={props.testid}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        margin: '6px 0',
        background: '#ffffff',
        border: `1px solid ${COULEURS.bordure}`,
        borderRadius: 6,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{props.titre}</div>
        <div style={{ fontSize: 12, color: COULEURS.discret, marginTop: 3 }}>{props.details}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>{props.actions}</div>
    </li>
  )
}

// Page à contenu centré (accueil, chantier), sous la barre du haut.
export function Page({ children }: { children: ReactNode }) {
  return <main style={{ maxWidth: 980, margin: '0 auto', padding: '20px 24px 40px' }}>{children}</main>
}
