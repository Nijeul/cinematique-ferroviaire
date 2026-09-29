import { useRef, useState, type ReactNode } from 'react'
import { ecrireAdresse, type Route } from '../plan/adresse.ts'
import {
  ajouterPlan,
  copierPlan,
  nomPlanPropose,
  renommerPlan,
  renommerSynoptique,
  resumePlan,
  supprimerPlan,
  supprimerSynoptique,
  textePlans,
  texteImages,
  texteSynoptiques,
  type Chantier,
} from '../plan/chantier.ts'
import { lirePlanImporte, nomFichierChantier, serialiserChantier } from '../plan/fichierChantier.ts'
import { avisEnginsRetires } from '../plan/lecture.ts'
import type { Projet } from '../plan/projet.ts'
import { formaterDuree, formaterPlage } from '../plan/temps.ts'
import { AssistantNouveauPlan } from './AssistantNouveauPlan.tsx'
import { CatalogueEngins } from './CatalogueEngins.tsx'
import { EtatsVoie } from './EtatsVoie.tsx'
import { BandeauMessage, BarreNavigation, ChampRenommer, Confirmation, LigneListe, Page } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import { lireFichierTexte, telecharger } from './navigateur.ts'
import { POLICE, styleBouton, styleBoutonDanger, styleBoutonPrincipal, styleDiscret, styleTitreSection } from './styles.ts'
import type { Message } from './useEditeur.ts'

// Écran d'un chantier : ses plans (un par phase), ses synoptiques, les états
// de la voie de ses zones de travaux et son catalogue d'engins.

type ASupprimer = { genre: 'plan' | 'synoptique'; id: string; nom: string; texte: string }

export function EcranChantier(props: {
  chantier: Chantier
  modifierChantier: (transformer: (c: Chantier) => Chantier) => void
  aller: (route: Route) => void
  etat: ReactNode
}) {
  const { chantier, modifierChantier, aller } = props
  const [renommage, setRenommage] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<ASupprimer | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [assistant, setAssistant] = useState(false)
  const choixPlan = useRef<HTMLInputElement>(null)

  // Fin de l'assistant « Nouveau plan » : le plan (avec son échelle) est créé et ouvert.
  const creerPlan = (projet: Projet) => {
    const { id } = ajouterPlan(chantier, projet)
    modifierChantier((c) => ajouterPlan(c, projet).chantier)
    setAssistant(false)
    aller({ ecran: 'plan', chantierId: chantier.id, planId: id })
  }

  const copier = (planId: string) => {
    const { chantier: suivant, id } = copierPlan(chantier, planId)
    modifierChantier((c) => copierPlan(c, planId).chantier)
    setRenommage(id)
    setMessage({ genre: 'info', texte: `Copie créée : « ${suivant.plans.find((p) => p.id === id)?.projet.nom} ». Donnez-lui son nom de phase.` })
  }

  const importerPlan = async (fichier: File) => {
    const texte = await lireFichierTexte(fichier)
    const lu = texte === null ? { ok: false as const, erreurs: [`Le fichier « ${fichier.name} » n'a pas pu être lu.`] } : lirePlanImporte(texte)
    if (!lu.ok) {
      setMessage({ genre: 'erreur', texte: `« ${fichier.name} » ne peut pas être importé :`, details: lu.erreurs })
      return
    }
    modifierChantier((c) => ajouterPlan(c, lu.projet).chantier)
    const avis = avisEnginsRetires(lu.projet.nom, lu.retires)
    setMessage({ genre: 'info', texte: `Plan « ${lu.projet.nom} » importé dans ce chantier.${avis ? ` ${avis}` : ''}` })
  }

  const supprimer = (cible: ASupprimer) => {
    setASupprimer(null)
    modifierChantier((c) => (cible.genre === 'plan' ? supprimerPlan(c, cible.id) : supprimerSynoptique(c, cible.id)))
    setMessage({ genre: 'info', texte: `${cible.genre === 'plan' ? 'Plan' : 'Synoptique'} « ${cible.nom} » supprimé.` })
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: POLICE, color: COULEURS.texte }}>
      <BarreNavigation chemin={[{ libelle: 'Accueil', route: { ecran: 'accueil' } }, { libelle: chantier.nom }]} etat={props.etat} />
      <BandeauMessage message={message} fermer={() => setMessage(null)} />
      <Page>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, flex: 1 }}>{chantier.nom}</h1>
          <button
            style={styleBouton()}
            onClick={() => telecharger(nomFichierChantier(chantier.nom), serialiserChantier(chantier))}
            title="Un fichier avec tout le chantier (plans, synoptiques, fonds), pour le transmettre ou le mettre à l'abri"
          >
            Exporter le chantier
          </button>
        </div>
        <p style={{ ...styleDiscret, marginBottom: 20 }}>
          {textePlans(chantier.plans.length)} · {texteSynoptiques(chantier.synoptiques.length)}
        </p>

        <section style={{ marginBottom: 28 }} data-testid="section-plans">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ ...styleTitreSection, flex: 1, margin: 0 }}>Plans</h2>
            <button style={styleBoutonPrincipal} onClick={() => setAssistant(true)} title="Nom, fond de plan, puis échelle">
              + Nouveau plan
            </button>
            <button style={styleBouton()} onClick={() => choixPlan.current?.click()} title="Fichier de plan enregistré (…cinematique.json)">
              Importer un plan…
            </button>
            <input
              ref={choixPlan}
              type="file"
              accept=".json,application/json"
              hidden
              data-testid="choix-plan"
              onChange={(e) => {
                const fichier = e.target.files?.[0]
                e.target.value = ''
                if (fichier) void importerPlan(fichier)
              }}
            />
          </div>
          <p style={styleDiscret}>Un plan par phase (définitive, provisoire, transitoire…). « Copier » part d'un plan existant pour une nouvelle phase.</p>
          {chantier.plans.length === 0 && (
            <p style={{ fontSize: 14, color: COULEURS.discret }}>Aucun plan : créez-en un, ou importez un fichier de plan.</p>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {chantier.plans.map((plan) => {
              const route: Route = { ecran: 'plan', chantierId: chantier.id, planId: plan.id }
              return (
                <LigneListe
                  key={plan.id}
                  testid="ligne-plan"
                  titre={
                    renommage === plan.id ? (
                      <ChampRenommer
                        valeur={plan.projet.nom}
                        libelle="Nouveau nom du plan"
                        valider={(nom) => {
                          modifierChantier((c) => renommerPlan(c, plan.id, nom))
                          setRenommage(null)
                        }}
                        abandonner={() => setRenommage(null)}
                      />
                    ) : (
                      <a href={ecrireAdresse(route)} style={{ color: COULEURS.texte }}>
                        {plan.projet.nom || 'Plan sans nom'}
                      </a>
                    )
                  }
                  details={resumePlan(plan.projet)}
                  actions={
                    <>
                      <button style={styleBouton()} onClick={() => aller(route)}>
                        Ouvrir
                      </button>
                      <button style={styleBouton()} onClick={() => setRenommage(plan.id)}>
                        Renommer
                      </button>
                      <button style={styleBouton()} onClick={() => copier(plan.id)} title="Nouveau plan, copie de celui-ci (phase provisoire…)">
                        Copier
                      </button>
                      <button
                        style={styleBoutonDanger}
                        onClick={() =>
                          setASupprimer({
                            genre: 'plan',
                            id: plan.id,
                            nom: plan.projet.nom,
                            texte: `Tout ce qui est tracé sur ce plan et son fond seront perdus. Les synoptiques déjà créés depuis ce plan sont conservés.`,
                          })
                        }
                      >
                        Supprimer
                      </button>
                    </>
                  }
                />
              )
            })}
          </ul>
        </section>

        <section data-testid="section-synoptiques">
          <h2 style={styleTitreSection}>Synoptiques</h2>
          <p style={styleDiscret}>Pour créer un synoptique, ouvrez un plan puis cliquez « Nouveau synoptique… ».</p>
          {chantier.synoptiques.length === 0 && <p style={{ fontSize: 14, color: COULEURS.discret }}>Aucun synoptique pour l'instant.</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {chantier.synoptiques.map((s) => {
              const route: Route = { ecran: 'synoptique', chantierId: chantier.id, synoptiqueId: s.id, image: 1 }
              return (
                <LigneListe
                  key={s.id}
                  testid="ligne-synoptique"
                  titre={
                    renommage === s.id ? (
                      <ChampRenommer
                        valeur={s.nom}
                        libelle="Nouveau nom du synoptique"
                        valider={(nom) => {
                          modifierChantier((c) => renommerSynoptique(c, s.id, nom))
                          setRenommage(null)
                        }}
                        abandonner={() => setRenommage(null)}
                      />
                    ) : (
                      <a href={ecrireAdresse(route)} style={{ color: COULEURS.texte }}>
                        {s.nom || 'Synoptique sans nom'}
                      </a>
                    )
                  }
                  details={
                    <>
                      <strong style={{ color: COULEURS.texte }}>{formaterPlage(s.t0, 0, s.fin)}</strong> ({formaterDuree(s.fin)}) ·{' '}
                      {texteImages(s.images.length)} · depuis le plan « {s.origine.nomPlan} »{s.cadrage ? ', cadré sur une partie' : ''}
                    </>
                  }
                  actions={
                    <>
                      <button style={styleBouton()} onClick={() => aller(route)}>
                        Ouvrir
                      </button>
                      <button style={styleBouton()} onClick={() => setRenommage(s.id)}>
                        Renommer
                      </button>
                      <button
                        style={styleBoutonDanger}
                        onClick={() =>
                          setASupprimer({ genre: 'synoptique', id: s.id, nom: s.nom, texte: `Ses ${texteImages(s.images.length)} seront perdues.` })
                        }
                      >
                        Supprimer
                      </button>
                    </>
                  }
                />
              )
            })}
          </ul>
        </section>

        <EtatsVoie chantier={chantier} modifierChantier={modifierChantier} />
        <CatalogueEngins chantier={chantier} modifierChantier={modifierChantier} />
      </Page>
      {assistant && <AssistantNouveauPlan nomPropose={nomPlanPropose(chantier)} creer={creerPlan} fermer={() => setAssistant(false)} />}
      {aSupprimer && (
        <Confirmation
          titre={`Supprimer le ${aSupprimer.genre} « ${aSupprimer.nom} » ?`}
          texte={
            <>
              <p style={{ margin: '0 0 8px' }}>{aSupprimer.texte}</p>
              <p style={{ margin: 0, color: COULEURS.erreur }}>Cette suppression est définitive.</p>
            </>
          }
          action="Supprimer définitivement"
          confirmer={() => supprimer(aSupprimer)}
          annuler={() => setASupprimer(null)}
        />
      )}
    </div>
  )
}
