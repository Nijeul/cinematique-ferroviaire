import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ecrireAdresse, lireAdresse, type Route } from './plan/adresse.ts'
import { Accueil } from './ui/Accueil.tsx'
import { BarreNavigation, Page } from './ui/commun.tsx'
import { COULEURS } from './ui/couleurs.ts'
import { EcranChantier } from './ui/EcranChantier.tsx'
import { EcranPlan } from './ui/EcranPlan.tsx'
import { EcranSynoptique } from './ui/EcranSynoptique.tsx'
import { reprendreAncienneSauvegarde } from './ui/stockage.ts'
import { POLICE } from './ui/styles.ts'
import { useChantier, type Enregistrement } from './ui/useChantier.ts'
import type { Message } from './ui/useEditeur.ts'

// L'application : un écran par adresse (#/chantier/…/plan/…), pour que le
// bouton Précédent du navigateur et le rechargement de la page fonctionnent.
// Accueil → chantier → plan (éditeur des étapes 2 et 3) ou synoptique.

const abonner = (rappel: () => void) => {
  window.addEventListener('hashchange', rappel)
  return () => window.removeEventListener('hashchange', rappel)
}
const lireHash = () => window.location.hash

const aller = (route: Route) => {
  window.location.hash = ecrireAdresse(route)
}

function EtatEnregistrement({ enregistrement }: { enregistrement: Enregistrement }) {
  if (enregistrement.genre === 'enCours') return <>Enregistrement…</>
  if (enregistrement.genre === 'erreur') return <span style={{ color: '#ffb4b4', fontWeight: 600 }}>Non enregistré dans le navigateur</span>
  return <>✓ Enregistré dans ce navigateur</>
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

function EspaceChantier({ route }: { route: Exclude<Route, { ecran: 'accueil' }> }) {
  const { chantier, charge, erreurLecture, modifier, enregistrement, avis, avisLu } = useChantier(route.chantierId)
  const etat = <EtatEnregistrement enregistrement={enregistrement} />
  const alerte =
    enregistrement.genre === 'erreur' ? (
      <p
        role="alert"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 16,
          transform: 'translateX(-50%)',
          maxWidth: 640,
          margin: 0,
          padding: '8px 14px',
          fontSize: 13,
          fontFamily: POLICE,
          color: '#ffffff',
          background: COULEURS.erreur,
          borderRadius: 6,
          zIndex: 20,
        }}
      >
        {enregistrement.texte}
      </p>
    ) : null

  if (!charge) return <p style={{ fontFamily: POLICE, color: COULEURS.discret, padding: 24 }}>Ouverture du chantier…</p>
  if (erreurLecture) return <Introuvable chemin="Chantier" texte={erreurLecture} retour={{ ecran: 'accueil' }} />
  if (!chantier) {
    return <Introuvable chemin="Chantier" texte="Ce chantier n'existe pas, ou plus, dans ce navigateur." retour={{ ecran: 'accueil' }} />
  }
  const versChantier: Route = { ecran: 'chantier', chantierId: chantier.id }

  let ecran
  if (route.ecran === 'chantier') {
    ecran = <EcranChantier chantier={chantier} modifierChantier={modifier} aller={aller} etat={etat} />
  } else if (route.ecran === 'plan') {
    const plan = chantier.plans.find((p) => p.id === route.planId)
    if (!plan) return <Introuvable chemin={chantier.nom} texte={`Ce plan n'existe plus dans le chantier « ${chantier.nom} ».`} retour={versChantier} />
    ecran = <EcranPlan key={plan.id} chantier={chantier} plan={plan} modifierChantier={modifier} aller={aller} etat={etat} />
  } else {
    const synoptique = chantier.synoptiques.find((s) => s.id === route.synoptiqueId)
    if (!synoptique) {
      return <Introuvable chemin={chantier.nom} texte={`Ce synoptique n'existe plus dans le chantier « ${chantier.nom} ».`} retour={versChantier} />
    }
    ecran = (
      <EcranSynoptique
        key={synoptique.id}
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

export default function App() {
  const route = lireAdresse(useSyncExternalStore(abonner, lireHash))
  // Au lancement : reprise de la sauvegarde automatique des étapes 2 et 3.
  const [pret, setPret] = useState(false)
  const [messageDepart, setMessageDepart] = useState<Message | null>(null)
  useEffect(() => {
    reprendreAncienneSauvegarde().then(
      (texte) => {
        setMessageDepart(texte ? { genre: 'info', texte } : null)
        setPret(true)
      },
      (e: Error) => {
        setMessageDepart({ genre: 'erreur', texte: `Votre plan des étapes précédentes n'a pas pu être rangé dans un chantier. ${e.message}` })
        setPret(true)
      },
    )
  }, [])

  const messageLu = useCallback(() => setMessageDepart(null), [])

  if (!pret) return null
  if (route.ecran === 'accueil') {
    return <Accueil aller={aller} messageInitial={messageDepart} messageLu={messageLu} />
  }
  return <EspaceChantier key={route.chantierId} route={route} />
}
