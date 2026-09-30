import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { lireConfiguration, messageConfiguration } from './enligne/configuration.ts'
import type { DepotEnLigne, Utilisateur } from './enligne/depot.ts'
import { ecrireAdresse, lireAdresse, type Route } from './plan/adresse.ts'
import { nomFichierChantier, serialiserChantier } from './plan/fichierChantier.ts'
import { classerErreur, MESSAGE_HORS_LIGNE, MESSAGE_PAUSE, texteConflit, type Panne } from './plan/synchro.ts'
import { Accueil } from './ui/Accueil.tsx'
import { BarriereErreur } from './ui/BarriereErreur.tsx'
import { BarreNavigation, Fenetre, Page } from './ui/commun.tsx'
import { ContexteCompte, type Compte } from './ui/contexteCompte.ts'
import { COULEURS } from './ui/couleurs.ts'
import { EcranChantier } from './ui/EcranChantier.tsx'
import { EcranConnexion, EcranNonMembre, EcranNouveauMotDePasse } from './ui/EcranConnexion.tsx'
import { EcranEquipe } from './ui/EcranEquipe.tsx'
import { EcranPlan } from './ui/EcranPlan.tsx'
import { EcranSynoptique } from './ui/EcranSynoptique.tsx'
import { creerMemoireEnLigne, creerMemoireLocale, type Memoire } from './ui/memoire.ts'
import { telecharger } from './ui/navigateur.ts'
import { reprendreAncienneSauvegarde } from './ui/stockage.ts'
import { POLICE, styleBouton, styleBoutonPrincipal } from './ui/styles.ts'
import { useChantier, type Enregistrement } from './ui/useChantier.ts'
import type { Message } from './ui/useEditeur.ts'

// L'application : d'abord la connexion (mémoire en ligne dans Supabase), puis
// un écran par adresse (#/chantier/…/plan/…), pour que le bouton Précédent du
// navigateur et le rechargement de la page fonctionnent. Accueil → chantier →
// plan ou synoptique ; accueil → équipe. Sans Supabase (site non configuré,
// serveur en pause), on travaille dans ce navigateur seulement.

const abonner = (rappel: () => void) => {
  window.addEventListener('hashchange', rappel)
  return () => window.removeEventListener('hashchange', rappel)
}
const lireHash = () => window.location.hash

const aller = (route: Route) => {
  window.location.hash = ecrireAdresse(route)
}

const TRAVAIL_ICI =
  "Vous travaillez dans ce navigateur seulement : la mémoire en ligne n'est pas joignable. Vos chantiers modifiés ici seront mis en ligne à votre prochaine connexion."

type Session =
  | { genre: 'demarrage' }
  | { genre: 'connexion'; depot: DepotEnLigne; alerte: string | null }
  | { genre: 'nouveauMotDePasse'; depot: DepotEnLigne }
  | { genre: 'nonMembre'; depot: DepotEnLigne; utilisateur: Utilisateur }
  | { genre: 'pret'; memoire: Memoire; depot: DepotEnLigne | null; utilisateur: Utilisateur | null }

function EtatEnregistrement({ enregistrement, enLigne }: { enregistrement: Enregistrement; enLigne: boolean }) {
  switch (enregistrement.genre) {
    case 'enCours':
      return <>Enregistrement…</>
    case 'horsLigne':
      // Version courte dans la barre ; le message entier est dans la bulle du bas.
      return (
        <span style={{ color: '#ffd98a', fontWeight: 600 }} title={MESSAGE_HORS_LIGNE}>
          Hors ligne — enregistré dans ce navigateur
        </span>
      )
    case 'conflit':
      return <span style={{ color: '#ffd98a', fontWeight: 600 }}>Modifié ailleurs en même temps : à trancher</span>
    case 'erreur':
      return <span style={{ color: '#ffb4b4', fontWeight: 600 }}>{enLigne ? 'Non enregistré en ligne' : 'Non enregistré dans le navigateur'}</span>
    case 'ok':
      return <>{enLigne ? '✓ Enregistré en ligne' : '✓ Enregistré dans ce navigateur'}</>
  }
}

function Introuvable({ chemin, texte, retour }: { chemin: string; texte: string; retour: Route }) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: POLICE, color: COULEURS.texte }}>
      <BarreNavigation chemin={[{ libelle: 'Accueil', route: { ecran: 'accueil' } }, { libelle: chemin }]} />
      <Page>
        <p style={{ fontSize: 15 }}>{texte}</p>
        <a href={ecrireAdresse(retour)}>{retour.ecran === 'accueil' ? "Revenir à l'accueil" : 'Revenir au chantier'}</a>
      </Page>
    </div>
  )
}

const styleBulle = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  maxWidth: 720,
  margin: 0,
  padding: '8px 14px',
  fontSize: 13,
  lineHeight: 1.45,
  fontFamily: POLICE,
  borderRadius: 6,
  zIndex: 20,
} as const

type RouteChantier = Exclude<Route, { ecran: 'accueil' } | { ecran: 'equipe' }>

function EspaceChantier({ route, memoire, moi }: { route: RouteChantier; memoire: Memoire; moi: string | null }) {
  const { chantier, charge, erreurLecture, modifier, enregistrement, avis, avisLu, revision, garderLaMienne, rechargerEnLigne } = useChantier(
    route.chantierId,
    memoire,
  )
  const etat = <EtatEnregistrement enregistrement={enregistrement} enLigne={memoire.enLigne} />
  const alerte =
    enregistrement.genre === 'erreur' ? (
      <p role="alert" style={{ ...styleBulle, bottom: 16, color: '#ffffff', background: COULEURS.erreur }}>
        {enregistrement.texte}
      </p>
    ) : enregistrement.genre === 'horsLigne' ? (
      <p role="status" data-testid="bulle-hors-ligne" style={{ ...styleBulle, bottom: 16, color: COULEURS.texte, background: '#fdf6e3', border: '1px solid #e2c77d' }}>
        {MESSAGE_HORS_LIGNE}.
      </p>
    ) : null

  if (!charge) return <p style={{ fontFamily: POLICE, color: COULEURS.discret, padding: 24 }}>Ouverture du chantier…</p>
  if (erreurLecture) return <Introuvable chemin="Chantier" texte={erreurLecture} retour={{ ecran: 'accueil' }} />
  if (!chantier) {
    return <Introuvable chemin="Chantier" texte="Ce chantier n'existe pas, ou plus." retour={{ ecran: 'accueil' }} />
  }
  const versChantier: Route = { ecran: 'chantier', chantierId: chantier.id }

  let ecran
  if (route.ecran === 'chantier') {
    ecran = <EcranChantier key={revision} chantier={chantier} modifierChantier={modifier} aller={aller} etat={etat} />
  } else if (route.ecran === 'plan') {
    const plan = chantier.plans.find((p) => p.id === route.planId)
    if (!plan) return <Introuvable chemin={chantier.nom} texte={`Ce plan n'existe plus dans le chantier « ${chantier.nom} ».`} retour={versChantier} />
    ecran = <EcranPlan key={`${plan.id}-${revision}`} chantier={chantier} plan={plan} modifierChantier={modifier} aller={aller} etat={etat} />
  } else {
    const synoptique = chantier.synoptiques.find((s) => s.id === route.synoptiqueId)
    if (!synoptique) {
      return <Introuvable chemin={chantier.nom} texte={`Ce synoptique n'existe plus dans le chantier « ${chantier.nom} ».`} retour={versChantier} />
    }
    ecran = (
      <EcranSynoptique
        key={`${synoptique.id}-${revision}`}
        chantier={chantier}
        synoptique={synoptique}
        imageInitiale={route.image}
        modifierChantier={modifier}
        etat={etat}
      />
    )
  }
  return (
    <>
      {ecran}
      {alerte}
      {enregistrement.genre === 'conflit' && (
        <div style={{ fontFamily: POLICE, color: COULEURS.texte }}>
          <Fenetre titre="Ce chantier a été modifié en même temps" fermer={() => undefined} largeur={520}>
            <div data-testid="fenetre-conflit" style={{ fontSize: 14, lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 8px' }}>{texteConflit(enregistrement.conflit.par, enregistrement.conflit.le, moi, new Date())}</p>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Recharger sa version</strong> : vous retrouvez le chantier tel qu'enregistré en ligne ; vos modifications faites ici depuis sont
                abandonnées.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Garder la mienne</strong> : votre version remplace la sienne pour toute l'équipe.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
              <button
                style={{ ...styleBouton(), fontSize: 12 }}
                title="Un fichier avec votre version, par précaution, avant de choisir"
                onClick={() => telecharger(nomFichierChantier(`${chantier.nom} (ma version)`), serialiserChantier(chantier))}
              >
                Exporter ma version…
              </button>
              <span style={{ display: 'flex', gap: 8 }}>
                <button style={styleBouton()} onClick={rechargerEnLigne}>
                  Recharger sa version
                </button>
                <button style={styleBoutonPrincipal} onClick={garderLaMienne}>
                  Garder la mienne
                </button>
              </span>
            </div>
          </Fenetre>
        </div>
      )}
      {avis.length > 0 && (
        <div
          role="status"
          data-testid="avis-migration"
          style={{
            position: 'fixed',
            left: '50%',
            top: 52,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            maxWidth: 720,
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.45,
            fontFamily: POLICE,
            color: COULEURS.texte,
            background: '#e8f0f9',
            border: `1px solid ${COULEURS.selection}`,
            borderRadius: 6,
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            zIndex: 20,
          }}
        >
          <div>
            {avis.map((texte) => (
              <p key={texte} style={{ margin: '2px 0' }}>
                {texte}
              </p>
            ))}
          </div>
          <button
            onClick={avisLu}
            aria-label="Fermer le message"
            style={{ font: 'inherit', border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: COULEURS.discret }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}

// Compte connecté et membre de l'équipe : mémoire en ligne, reprise des
// chantiers de ce navigateur et envois en attente.
async function ouvrirSession(depot: DepotEnLigne, utilisateur: Utilisateur): Promise<{ session: Session; message: string | null }> {
  try {
    const membres = await depot.listerMembres()
    if (membres.length === 0) return { session: { genre: 'nonMembre', depot, utilisateur }, message: null }
  } catch (e) {
    const genre = classerErreur(e as Panne, navigator.onLine)
    if (genre === 'session') return { session: { genre: 'connexion', depot, alerte: 'Votre connexion a expiré : reconnectez-vous.' }, message: null }
    // Hors ligne ou serveur en pause : on travaille sur les copies du navigateur ; l'accueil le dit.
    return { session: { genre: 'pret', memoire: creerMemoireEnLigne(depot), depot, utilisateur }, message: null }
  }
  const memoire = creerMemoireEnLigne(depot)
  const message = await memoire.synchroniserTout().catch(() => null)
  return { session: { genre: 'pret', memoire, depot, utilisateur }, message }
}

export default function App() {
  const route = lireAdresse(useSyncExternalStore(abonner, lireHash))
  const [session, setSession] = useState<Session>({ genre: 'demarrage' })
  const [messageDepart, setMessageDepart] = useState<Message | null>(null)

  const afficher = useCallback((r: { session: Session; message: string | null }) => {
    setSession(r.session)
    if (r.message) setMessageDepart({ genre: 'info', texte: r.message })
  }, [])

  // Au lancement : reprise de la sauvegarde des étapes 2 et 3, puis connexion.
  useEffect(() => {
    let actif = true
    const demarrer = async () => {
      let texteAncien: string | null = null
      try {
        texteAncien = await reprendreAncienneSauvegarde()
      } catch (e) {
        if (actif) setMessageDepart({ genre: 'erreur', texte: `Votre plan des étapes précédentes n'a pas pu être rangé dans un chantier. ${(e as Error).message}` })
      }
      if (texteAncien && actif) setMessageDepart({ genre: 'info', texte: texteAncien })
      const lecture = lireConfiguration(import.meta.env as Record<string, unknown>)
      if (!lecture.ok) {
        if (actif) setSession({ genre: 'pret', memoire: creerMemoireLocale(messageConfiguration(lecture.raison)), depot: null, utilisateur: null })
        return
      }
      let depot: DepotEnLigne
      try {
        const { creerDepotSupabase } = await import('./enligne/supabase.ts')
        depot = await creerDepotSupabase(lecture.configuration)
      } catch {
        if (actif) setSession({ genre: 'pret', memoire: creerMemoireLocale(TRAVAIL_ICI), depot: null, utilisateur: null })
        return
      }
      let utilisateur: Utilisateur | null
      try {
        utilisateur = await depot.utilisateur()
      } catch (e) {
        const genre = classerErreur(e as Panne, navigator.onLine)
        if (actif) setSession({ genre: 'connexion', depot, alerte: genre === 'injoignable' || genre === 'horsLigne' ? MESSAGE_PAUSE : null })
        return
      }
      if (!utilisateur) {
        if (actif) setSession({ genre: 'connexion', depot, alerte: null })
        return
      }
      const r = await ouvrirSession(depot, utilisateur)
      if (actif) afficher(r)
    }
    void demarrer()
    return () => {
      actif = false
    }
  }, [afficher])

  // Lien « nouveau mot de passe » reçu par e-mail, déconnexion d'un autre onglet.
  const depot = session.genre === 'demarrage' ? null : session.depot
  useEffect(() => {
    if (!depot) return
    const oublier = depot.surEvenement((e) => {
      if (e === 'nouveauMotDePasse') setSession({ genre: 'nouveauMotDePasse', depot })
      if (e === 'deconnexion') setSession({ genre: 'connexion', depot, alerte: null })
    })
    return () => {
      oublier()
    }
  }, [depot])

  const connecte = useCallback(
    (u: Utilisateur) => {
      if (!depot) return
      setSession({ genre: 'demarrage' })
      void ouvrirSession(depot, u).then(afficher)
    },
    [depot, afficher],
  )

  const deconnecter = useCallback(() => {
    if (!depot) return
    void depot.deconnecter().finally(() => {
      setSession({ genre: 'connexion', depot, alerte: null })
      aller({ ecran: 'accueil' })
    })
  }, [depot])

  const utilisateur = session.genre === 'pret' ? session.utilisateur : null
  const compte = useMemo<Compte | null>(() => (utilisateur ? { email: utilisateur.email, deconnecter } : null), [utilisateur, deconnecter])

  const messageLu = useCallback(() => setMessageDepart(null), [])

  switch (session.genre) {
    case 'demarrage':
      return <p style={{ fontFamily: POLICE, color: COULEURS.discret, padding: 24 }}>Ouverture…</p>
    case 'connexion':
      return (
        <EcranConnexion
          key={session.alerte ?? ''}
          depot={session.depot}
          alerte={session.alerte}
          connecte={connecte}
          travaillerIci={() => setSession({ genre: 'pret', memoire: creerMemoireLocale(TRAVAIL_ICI), depot: null, utilisateur: null })}
        />
      )
    case 'nouveauMotDePasse':
      return (
        <EcranNouveauMotDePasse
          depot={session.depot}
          termine={() => {
            setSession({ genre: 'demarrage' })
            void session.depot.utilisateur().then((u) => (u ? ouvrirSession(session.depot, u).then(afficher) : setSession({ genre: 'connexion', depot: session.depot, alerte: null })))
          }}
        />
      )
    case 'nonMembre':
      return <EcranNonMembre email={session.utilisateur.email} reessayer={() => connecte(session.utilisateur)} deconnecter={deconnecter} />
  }

  const { memoire } = session
  // Un écran qui plante affiche un message et le détail de l'erreur, jamais
  // une page blanche.
  return (
    <ContexteCompte.Provider value={compte}>
      <BarriereErreur route={route}>
        {route.ecran === 'accueil' ? (
          <Accueil key="accueil" aller={aller} memoire={memoire} moi={utilisateur?.email ?? null} messageInitial={messageDepart} messageLu={messageLu} />
        ) : route.ecran === 'equipe' ? (
          session.depot && utilisateur ? (
            <EcranEquipe depot={session.depot} moi={utilisateur.email} plusMembre={() => connecte(utilisateur)} />
          ) : (
            <Introuvable chemin="Équipe" texte="L'équipe n'existe qu'avec la mémoire en ligne, qui n'est pas disponible pour le moment." retour={{ ecran: 'accueil' }} />
          )
        ) : (
          <EspaceChantier key={route.chantierId} route={route} memoire={memoire} moi={utilisateur?.email ?? null} />
        )}
      </BarriereErreur>
    </ContexteCompte.Provider>
  )
}
