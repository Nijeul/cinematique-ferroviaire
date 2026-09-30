import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { DepotEnLigne, Membre } from '../enligne/depot.ts'
import { adresseValide, momentLisible } from '../plan/synchro.ts'
import { BandeauMessage, BarreNavigation, Confirmation, LigneListe, Page } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import { POLICE, styleBouton, styleBoutonDanger, styleBoutonPrincipal, styleChamp, styleTitreSection } from './styles.ts'
import type { Message } from './useEditeur.ts'

// Page « Équipe » : les membres (tous voient et modifient tous les chantiers),
// l'invitation d'un collègue et le retrait d'un membre. Le serveur refuse de
// retirer le dernier membre.

export function EcranEquipe(props: { depot: DepotEnLigne; moi: string; plusMembre: () => void }) {
  const { depot, moi, plusMembre } = props
  const [membres, setMembres] = useState<Membre[] | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [email, setEmail] = useState('')
  const [aRetirer, setARetirer] = useState<Membre | null>(null)
  const [occupe, setOccupe] = useState(false)

  const recharger = useCallback(async () => {
    try {
      const liste = await depot.listerMembres()
      if (liste.length === 0) plusMembre()
      else setMembres(liste)
    } catch (e) {
      setMembres([])
      setMessage({ genre: 'erreur', texte: (e as Error).message })
    }
  }, [depot, plusMembre])

  useEffect(() => {
    // Lecture asynchrone : la liste arrive après le premier affichage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recharger()
  }, [recharger])

  const inviter = async (e: FormEvent) => {
    e.preventDefault()
    const adresse = email.trim().toLowerCase()
    if (!adresseValide(adresse)) {
      setMessage({ genre: 'erreur', texte: 'Tapez une adresse e-mail valide (par exemple prenom.nom@entreprise.fr).' })
      return
    }
    setOccupe(true)
    try {
      await depot.inviter(adresse)
      setEmail('')
      setMessage({
        genre: 'info',
        texte: `${adresse} est invité. Dites-lui d'ouvrir ${window.location.origin} et de cliquer sur « Créer mon compte » avec cette adresse.`,
      })
      await recharger()
    } catch (err) {
      setMessage({ genre: 'erreur', texte: (err as Error).message })
    } finally {
      setOccupe(false)
    }
  }

  const retirer = async (m: Membre) => {
    setARetirer(null)
    try {
      await depot.retirer(m.email)
      setMessage({ genre: 'info', texte: `${m.email} ne fait plus partie de l'équipe.` })
      await recharger()
    } catch (err) {
      setMessage({ genre: 'erreur', texte: (err as Error).message })
    }
  }

  const liste = membres ?? []
  const seul = liste.length <= 1
  const maintenant = new Date()

  return (
    <div style={{ minHeight: '100vh', fontFamily: POLICE, color: COULEURS.texte }}>
      <BarreNavigation chemin={[{ libelle: 'Accueil', route: { ecran: 'accueil' } }, { libelle: 'Équipe' }]} />
      <BandeauMessage message={message} fermer={() => setMessage(null)} />
      <Page>
        <h1 style={{ margin: '0 0 6px', fontSize: 24 }}>Équipe</h1>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: COULEURS.discret, maxWidth: 720, lineHeight: 1.5 }}>
          Chaque membre voit et modifie tous les chantiers de l'équipe. Seules les adresses invitées ici peuvent créer un compte.
        </p>

        <h2 style={styleTitreSection}>Inviter un collègue</h2>
        <form onSubmit={(e) => void inviter(e)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} noValidate>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@entreprise.fr"
            aria-label="Inviter un collègue (e-mail)"
            style={{ ...styleChamp, fontSize: 14, padding: '6px 9px', width: 320 }}
          />
          <button type="submit" disabled={occupe} style={styleBoutonPrincipal}>
            Inviter
          </button>
        </form>
        <p style={{ margin: '8px 0 22px', fontSize: 13, lineHeight: 1.5, maxWidth: 720 }} data-testid="consigne-invite">
          Ensuite, votre collègue ouvre <strong>{window.location.origin}</strong> et clique sur « Créer mon compte » avec cette adresse
          (aucun e-mail d'invitation n'est envoyé : prévenez-le vous-même).
        </p>

        <h2 style={styleTitreSection}>Membres ({liste.length})</h2>
        {membres === null && <p style={{ fontSize: 14, color: COULEURS.discret }}>Lecture de l'équipe…</p>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="liste-membres">
          {liste.map((m) => (
            <LigneListe
              key={m.email}
              testid="ligne-membre"
              titre={
                <>
                  {m.email}
                  {m.email === moi && <span style={{ fontWeight: 400, color: COULEURS.discret }}> (vous)</span>}
                </>
              }
              details={m.invitePar ? `invité par ${m.invitePar} ${momentLisible(m.inviteLe, maintenant)}` : `membre depuis ${momentLisible(m.inviteLe, maintenant)}`}
              actions={
                <button
                  style={seul ? { ...styleBouton(), color: COULEURS.discret, cursor: 'not-allowed' } : styleBoutonDanger}
                  disabled={seul}
                  title={seul ? "L'équipe doit garder au moins un membre." : undefined}
                  onClick={() => setARetirer(m)}
                >
                  Retirer
                </button>
              }
            />
          ))}
        </ul>
      </Page>
      {aRetirer && (
        <Confirmation
          titre={`Retirer ${aRetirer.email} de l'équipe ?`}
          texte={
            aRetirer.email === moi ? (
              <p style={{ margin: 0 }}>
                C'est <strong>votre propre compte</strong> : vous ne verrez plus aucun chantier, jusqu'à ce qu'un membre vous invite de nouveau.
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                Cette personne ne pourra plus voir ni modifier les chantiers. Les chantiers restent ; on peut l'inviter de nouveau plus tard.
              </p>
            )
          }
          action="Retirer de l'équipe"
          confirmer={() => void retirer(aRetirer)}
          annuler={() => setARetirer(null)}
        />
      )}
    </div>
  )
}
