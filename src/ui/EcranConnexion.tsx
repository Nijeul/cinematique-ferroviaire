import { useState, type FormEvent, type ReactNode } from 'react'
import type { DepotEnLigne, Utilisateur } from '../enligne/depot.ts'
import { adresseValide, classerErreur, messageCompte, type Panne } from '../plan/synchro.ts'
import { COULEURS } from './couleurs.ts'
import { POLICE, styleBouton, styleBoutonPrincipal, styleChamp } from './styles.ts'

// Écrans d'avant l'application : connexion (avec création de compte et mot
// de passe oublié), choix d'un nouveau mot de passe (lien reçu par e-mail),
// et compte qui n'est pas membre de l'équipe.

type Avis = { genre: 'info' | 'erreur'; texte: string } | null

const LONGUEUR_MIN = 8

function Cadre({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: POLICE, color: COULEURS.texte, background: COULEURS.autourDuPlan }}>
      <div style={{ padding: '9px 14px', background: COULEURS.texte, color: '#ffffff', fontSize: 14, fontWeight: 700 }}>Cinématique ferroviaire</div>
      <main style={{ display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
        <section
          style={{
            width: 400,
            maxWidth: '100%',
            background: '#ffffff',
            border: `1px solid ${COULEURS.bordure}`,
            borderRadius: 8,
            padding: '22px 26px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            boxSizing: 'border-box',
          }}
        >
          <h1 style={{ margin: '0 0 14px', fontSize: 20 }}>{titre}</h1>
          {children}
        </section>
      </main>
    </div>
  )
}

function Message({ avis }: { avis: Avis }) {
  if (!avis) return null
  const erreur = avis.genre === 'erreur'
  return (
    <p
      role={erreur ? 'alert' : 'status'}
      data-testid="message-connexion"
      style={{
        margin: '14px 0 0',
        padding: '8px 10px',
        fontSize: 13,
        lineHeight: 1.45,
        borderRadius: 5,
        color: erreur ? COULEURS.erreur : COULEURS.texte,
        background: erreur ? '#fbeaea' : '#e8f0f9',
        border: `1px solid ${erreur ? '#e3b5b7' : '#b9cfe6'}`,
      }}
    >
      {avis.texte}
    </p>
  )
}

const styleLibelle = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, marginBottom: 10 } as const
const styleGrandChamp = { ...styleChamp, fontSize: 15, padding: '7px 9px' }

export function EcranConnexion(props: {
  depot: DepotEnLigne
  alerte: string | null
  connecte: (u: Utilisateur) => void
  travaillerIci: () => void
}) {
  const { depot } = props
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [avis, setAvis] = useState<Avis>(props.alerte ? { genre: 'erreur', texte: props.alerte } : null)
  const [serveurAbsent, setServeurAbsent] = useState(props.alerte !== null)
  const [occupe, setOccupe] = useState(false)

  const retour = window.location.origin

  const executer = async (faire: () => Promise<void>) => {
    setOccupe(true)
    setAvis(null)
    try {
      await faire()
      setServeurAbsent(false)
    } catch (e) {
      const panne = e as Panne
      const genre = classerErreur(panne, navigator.onLine)
      setServeurAbsent(genre === 'injoignable' || genre === 'horsLigne')
      setAvis({ genre: 'erreur', texte: messageCompte(panne, navigator.onLine) })
    } finally {
      setOccupe(false)
    }
  }

  const verifierAdresse = (): boolean => {
    if (adresseValide(email)) return true
    setAvis({ genre: 'erreur', texte: 'Tapez votre adresse e-mail (par exemple prenom.nom@entreprise.fr).' })
    return false
  }

  const seConnecter = (e: FormEvent) => {
    e.preventDefault()
    if (!verifierAdresse()) return
    if (motDePasse === '') {
      setAvis({ genre: 'erreur', texte: 'Tapez votre mot de passe.' })
      return
    }
    void executer(async () => props.connecte(await depot.connecter(email, motDePasse)))
  }

  const creerCompte = () => {
    if (!verifierAdresse()) return
    if (motDePasse.length < LONGUEUR_MIN) {
      setAvis({ genre: 'erreur', texte: `Choisissez un mot de passe d'au moins ${LONGUEUR_MIN} caractères, puis cliquez sur « Créer mon compte ».` })
      return
    }
    void executer(async () => {
      const r = await depot.creerCompte(email, motDePasse, retour)
      if (r.genre === 'connecte') {
        const u = await depot.utilisateur()
        if (u) props.connecte(u)
        return
      }
      setAvis({
        genre: 'info',
        texte: `Compte créé. Un e-mail de confirmation vient d'être envoyé à ${email.trim()} : cliquez sur le lien qu'il contient, puis revenez ici pour vous connecter.`,
      })
    })
  }

  const oubli = () => {
    if (!verifierAdresse()) return
    void executer(async () => {
      await depot.motDePasseOublie(email, retour)
      setAvis({
        genre: 'info',
        texte: `Si un compte existe pour ${email.trim()}, un e-mail vient de lui être envoyé : cliquez sur le lien pour choisir un nouveau mot de passe.`,
      })
    })
  }

  return (
    <Cadre titre="Connexion">
      <p style={{ margin: '0 0 16px', fontSize: 13, color: COULEURS.discret, lineHeight: 1.5 }}>
        Les chantiers de l'équipe sont enregistrés en ligne. Connectez-vous pour les retrouver sur n'importe quel ordinateur.
      </p>
      <form onSubmit={seConnecter} noValidate>
        <label style={styleLibelle}>
          Adresse e-mail
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={styleGrandChamp} autoFocus />
        </label>
        <label style={styleLibelle}>
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            style={styleGrandChamp}
          />
        </label>
        <button type="submit" disabled={occupe} style={{ ...styleBoutonPrincipal, width: '100%', fontSize: 15, padding: '8px 12px', marginTop: 4 }}>
          {occupe ? 'Un instant…' : 'Se connecter'}
        </button>
      </form>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <button type="button" disabled={occupe} onClick={creerCompte} style={styleBouton()}>
          Créer mon compte
        </button>
        <button
          type="button"
          disabled={occupe}
          onClick={oubli}
          style={{ font: 'inherit', fontSize: 13, border: 'none', background: 'none', color: COULEURS.selection, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
        >
          Mot de passe oublié
        </button>
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 12, color: COULEURS.discret, lineHeight: 1.45 }}>
        Première visite ? Tapez l'adresse à laquelle un membre de l'équipe vous a invité, choisissez un mot de passe, puis « Créer mon compte ».
      </p>
      <Message avis={avis} />
      {serveurAbsent && (
        <button type="button" onClick={props.travaillerIci} style={{ ...styleBouton(), marginTop: 10, width: '100%' }} data-testid="travailler-ici">
          Travailler dans ce navigateur seulement
        </button>
      )}
    </Cadre>
  )
}

export function EcranNouveauMotDePasse(props: { depot: DepotEnLigne; termine: () => void }) {
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [avis, setAvis] = useState<Avis>(null)
  const [occupe, setOccupe] = useState(false)

  const valider = async (e: FormEvent) => {
    e.preventDefault()
    if (motDePasse.length < LONGUEUR_MIN) return setAvis({ genre: 'erreur', texte: `Au moins ${LONGUEUR_MIN} caractères.` })
    if (motDePasse !== confirmation) return setAvis({ genre: 'erreur', texte: 'Les deux mots de passe ne sont pas identiques.' })
    setOccupe(true)
    try {
      await props.depot.changerMotDePasse(motDePasse)
      props.termine()
    } catch (err) {
      setAvis({ genre: 'erreur', texte: messageCompte(err as Panne, navigator.onLine) })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <Cadre titre="Nouveau mot de passe">
      <form onSubmit={(e) => void valider(e)} noValidate>
        <label style={styleLibelle}>
          Nouveau mot de passe
          <input type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} style={styleGrandChamp} autoFocus />
        </label>
        <label style={styleLibelle}>
          Le même, encore une fois
          <input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} style={styleGrandChamp} />
        </label>
        <button type="submit" disabled={occupe} style={{ ...styleBoutonPrincipal, width: '100%', fontSize: 15, padding: '8px 12px' }}>
          Enregistrer le mot de passe
        </button>
      </form>
      <Message avis={avis} />
    </Cadre>
  )
}

export function EcranNonMembre(props: { email: string; reessayer: () => void; deconnecter: () => void }) {
  return (
    <Cadre titre="Accès refusé">
      <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5 }} data-testid="non-membre">
        Le compte <strong>{props.email}</strong> n'est pas (ou plus) membre de l'équipe : il ne peut voir aucun chantier.
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.5, color: COULEURS.discret }}>
        Demandez à un membre de l'équipe de vous inviter avec cette adresse (page « Équipe »), puis cliquez sur « Réessayer ».
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={styleBoutonPrincipal} onClick={props.reessayer}>
          Réessayer
        </button>
        <button style={styleBouton()} onClick={props.deconnecter}>
          Se déconnecter
        </button>
      </div>
    </Cadre>
  )
}
