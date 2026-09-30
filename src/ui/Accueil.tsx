import { useCallback, useEffect, useRef, useState } from 'react'
import { ecrireAdresse, type Route } from '../plan/adresse.ts'
import {
  ajouterPlan,
  creerChantier,
  identifiantChantierUnique,
  nomLibre,
  renommerChantier,
  textePlans,
  texteSynoptiques,
  toucher,
  type Chantier,
} from '../plan/chantier.ts'
import { lireChantier, lirePlanImporte, nomFichierChantier, serialiserChantier } from '../plan/fichierChantier.ts'
import { avisEnginsRetires } from '../plan/lecture.ts'
import type { Projet } from '../plan/projet.ts'
import { detailsLigne, identifiantEnLigneValide, texteConflit, type LigneAccueil } from '../plan/synchro.ts'
import { BandeauMessage, BarreNavigation, BoutonsFenetre, ChampRenommer, Confirmation, Fenetre, LigneListe, Page } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import type { Envoi, Memoire } from './memoire.ts'
import { lireFichierTexte, telecharger } from './navigateur.ts'
import { POLICE, styleAvertissement, styleBouton, styleBoutonDanger, styleBoutonPrincipal, styleChamp, styleTitreSection } from './styles.ts'
import type { Message } from './useEditeur.ts'

// Page d'accueil : la liste des chantiers (en ligne, partagés avec l'équipe ;
// ou gardés dans ce navigateur quand la mémoire en ligne n'est pas
// disponible), et l'échange par fichiers (exporter / importer un chantier,
// importer un plan).

const NOUVEAU = '__nouveau__'

export function Accueil(props: {
  aller: (route: Route) => void
  memoire: Memoire
  moi: string | null
  messageInitial: Message | null
  messageLu: () => void
}) {
  const { aller, memoire, moi } = props
  const [chantiers, setChantiers] = useState<LigneAccueil[] | null>(null)
  const [alerte, setAlerte] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(props.messageInitial)
  const [renommage, setRenommage] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<LigneAccueil | null>(null)
  // Plan lu, en attente du choix de son chantier ; `avis` : engins retirés du plan.
  const [aImporter, setAImporter] = useState<{ projet: Projet; avis: string | null } | null>(null)
  const planAImporter = aImporter?.projet ?? null
  const [destination, setDestination] = useState(NOUVEAU)
  const choixChantier = useRef<HTMLInputElement>(null)
  const choixPlan = useRef<HTMLInputElement>(null)

  const erreur = (texte: string, details?: string[]) => setMessage({ genre: 'erreur', texte, details })

  const recharger = useCallback(async () => {
    try {
      const { lignes, alerte } = await memoire.lister()
      setChantiers(lignes)
      setAlerte(alerte)
    } catch (e) {
      setChantiers([])
      erreur((e as Error).message)
    }
  }, [memoire])

  // Le message du lancement (reprise de l'ancienne sauvegarde) ne s'affiche qu'une fois.
  const { messageLu } = props
  useEffect(() => {
    messageLu()
  }, [messageLu])

  useEffect(() => {
    // Lecture asynchrone : la liste arrive après le premier affichage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recharger()
  }, [recharger])

  // Ce que l'envoi en ligne n'a pas pu faire, dit après l'action.
  const suiteEnvoi = (r: Envoi): string => {
    if (r.genre === 'horsLigne') return ' Hors ligne : il sera mis en ligne dès le retour de la connexion.'
    if (r.genre === 'conflit') return ` ${texteConflit(r.conflit.par, r.conflit.le, moi, new Date())} Ouvrez-le pour choisir la version à garder.`
    if (r.genre === 'erreur') return ` ${r.texte}`
    return ''
  }

  // Enregistre (navigateur, puis en ligne) et relit la liste ; null (et un
  // message) si le navigateur refuse.
  const ecrire = async (c: Chantier): Promise<string | null> => {
    try {
      const r = await memoire.enregistrer(c)
      await recharger()
      return suiteEnvoi(r)
    } catch (e) {
      erreur((e as Error).message)
      return null
    }
  }

  // Le chantier entier (fonds compris), pour le renommer, l'exporter ou y importer un plan.
  const ouvrir = async (id: string): Promise<Chantier | null> => {
    try {
      const o = await memoire.ouvrir(id)
      if (!o) erreur("Ce chantier n'existe plus.")
      return o?.chantier ?? null
    } catch (e) {
      erreur((e as Error).message)
      return null
    }
  }

  const liste = chantiers ?? []
  const maintenantAffiche = new Date()
  const idLibre = () => identifiantChantierUnique(liste.map((c) => c.id))
  const maintenant = () => new Date().toISOString()

  const nouveauChantier = async () => {
    const c = creerChantier(idLibre(), nomLibre(liste.map((x) => x.nom), 'Nouveau chantier'), maintenant())
    const suite = await ecrire(c)
    if (suite !== null) {
      setRenommage(c.id)
      setMessage({ genre: 'info', texte: `Chantier créé : tapez son nom, puis Entrée.${suite}` })
    }
  }

  const renommer = async (id: string, nom: string) => {
    setRenommage(null)
    const c = await ouvrir(id)
    if (!c) return
    const suite = await ecrire(toucher(renommerChantier(c, nom), maintenant()))
    if (suite !== null) setMessage(suite ? { genre: 'info', texte: `Chantier renommé.${suite}` } : null)
  }

  const exporter = async (id: string) => {
    const c = await ouvrir(id)
    if (c) telecharger(nomFichierChantier(c.nom), serialiserChantier(c))
  }

  const supprimer = async (c: LigneAccueil) => {
    setASupprimer(null)
    try {
      await memoire.supprimer(c.id)
      await recharger()
      setMessage({ genre: 'info', texte: `Chantier « ${c.nom} » supprimé.` })
    } catch (e) {
      erreur((e as Error).message)
    }
  }

  const importerChantier = async (fichier: File) => {
    const texte = await lireFichierTexte(fichier)
    const lu = texte === null ? { ok: false as const, erreurs: ["Le fichier n'a pas pu être lu."] } : lireChantier(texte)
    if (!lu.ok) {
      erreur(`« ${fichier.name} » ne peut pas être importé :`, lu.erreurs)
      return
    }
    // Un chantier déjà présent n'est jamais écrasé : l'import devient un autre chantier.
    const dejaLa = liste.some((c) => c.id === lu.chantier.id)
    const c = dejaLa
      ? { ...lu.chantier, id: idLibre(), nom: nomLibre(liste.map((x) => x.nom), `${lu.chantier.nom} (importé)`) }
      : identifiantEnLigneValide(lu.chantier.id)
        ? lu.chantier
        : { ...lu.chantier, id: idLibre() }
    const suite = await ecrire(c)
    if (suite !== null) {
      setMessage({
        genre: 'info',
        texte: `Chantier « ${c.nom} » importé : ${textePlans(c.plans.length)}, ${texteSynoptiques(c.synoptiques.length)}.${
          dejaLa ? ' Un chantier du même nom existait déjà : il est conservé à côté.' : ''
        }${lu.avis.length > 0 ? ` ${lu.avis.join(' ')}` : ''}${suite}`,
      })
    }
  }

  const choisirPlan = async (fichier: File) => {
    const texte = await lireFichierTexte(fichier)
    const lu = texte === null ? { ok: false as const, erreurs: ["Le fichier n'a pas pu être lu."] } : lirePlanImporte(texte)
    if (!lu.ok) {
      erreur(`« ${fichier.name} » ne peut pas être importé :`, lu.erreurs)
      return
    }
    setDestination(NOUVEAU)
    setAImporter({ projet: lu.projet, avis: avisEnginsRetires(lu.projet.nom, lu.retires) })
  }

  const importerPlan = async () => {
    const projet = planAImporter
    const avis = aImporter?.avis
    if (!projet) return
    setAImporter(null)
    const cible =
      destination === NOUVEAU ? creerChantier(idLibre(), nomLibre(liste.map((x) => x.nom), projet.nom || 'Nouveau chantier'), maintenant()) : await ouvrir(destination)
    if (!cible) return
    const c = toucher(ajouterPlan(cible, projet).chantier, maintenant())
    const suite = await ecrire(c)
    if (suite !== null) setMessage({ genre: 'info', texte: `Plan « ${projet.nom} » importé dans le chantier « ${c.nom} ».${avis ? ` ${avis}` : ''}${suite}` })
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: POLICE, color: COULEURS.texte }}>
      <BarreNavigation chemin={[{ libelle: 'Accueil' }]} />
      <BandeauMessage message={message} fermer={() => setMessage(null)} />
      <Page>
        <h1 style={{ margin: '0 0 6px', fontSize: 24 }}>{memoire.enLigne ? 'Chantiers de l’équipe' : 'Vos chantiers'}</h1>
        {memoire.enLigne ? (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: COULEURS.discret, maxWidth: 720, lineHeight: 1.5 }} data-testid="rappel-stockage">
            Les chantiers sont <strong>enregistrés en ligne</strong> et partagés avec toute l'équipe (page « Équipe ») ; une copie de secours reste
            dans ce navigateur. « Exporter » donne en plus un fichier avec tout le chantier, fonds de plan compris.
          </p>
        ) : (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: COULEURS.discret, maxWidth: 720, lineHeight: 1.5 }} data-testid="rappel-stockage">
            Les chantiers sont gardés <strong>dans ce navigateur, sur cet ordinateur</strong>. Pour les transmettre ou ne pas les perdre,
            exportez-les (bouton « Exporter ») : le fichier contient tout le chantier, fonds de plan compris.
          </p>
        )}
        {alerte && (
          <p role="alert" data-testid="alerte-memoire" style={{ ...styleAvertissement, fontSize: 13, lineHeight: 1.5, padding: '8px 10px', margin: '0 0 14px', maxWidth: 760 }}>
            {alerte}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <button style={styleBoutonPrincipal} onClick={() => void nouveauChantier()}>
            + Nouveau chantier
          </button>
          <button style={styleBouton()} onClick={() => choixChantier.current?.click()} title="Fichier exporté (…chantier.json)">
            Importer un chantier…
          </button>
          <button style={styleBouton()} onClick={() => choixPlan.current?.click()} title="Fichier de plan enregistré aux étapes précédentes (…cinematique.json)">
            Importer un plan…
          </button>
          {memoire.enLigne && (
            <button style={{ ...styleBouton(), marginLeft: 'auto' }} onClick={() => aller({ ecran: 'equipe' })}>
              Équipe…
            </button>
          )}
          <input
            ref={choixChantier}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="choix-chantier"
            onChange={(e) => {
              const fichier = e.target.files?.[0]
              e.target.value = ''
              if (fichier) void importerChantier(fichier)
            }}
          />
          <input
            ref={choixPlan}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="choix-plan"
            onChange={(e) => {
              const fichier = e.target.files?.[0]
              e.target.value = ''
              if (fichier) void choisirPlan(fichier)
            }}
          />
        </div>
        <h2 style={{ ...styleTitreSection, marginTop: 18 }}>Chantiers</h2>
        {chantiers === null && <p style={{ fontSize: 14, color: COULEURS.discret }}>Lecture des chantiers…</p>}
        {chantiers?.length === 0 && (
          <p style={{ fontSize: 14, color: COULEURS.discret }}>
            {memoire.enLigne ? 'Aucun chantier en ligne' : 'Aucun chantier dans ce navigateur'} : créez-en un, ou importez un fichier.
          </p>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="liste-chantiers">
          {liste.map((c) => {
            const route: Route = { ecran: 'chantier', chantierId: c.id }
            return (
              <LigneListe
                key={c.id}
                testid="ligne-chantier"
                titre={
                  renommage === c.id ? (
                    <ChampRenommer valeur={c.nom} libelle="Nouveau nom du chantier" valider={(nom) => void renommer(c.id, nom)} abandonner={() => setRenommage(null)} />
                  ) : (
                    <a href={ecrireAdresse(route)} style={{ color: COULEURS.texte }}>
                      {c.nom || 'Chantier sans nom'}
                    </a>
                  )
                }
                details={
                  <>
                    {detailsLigne(c, maintenantAffiche)}
                    {memoire.enLigne && c.pasEncoreEnLigne && (
                      <strong style={{ color: COULEURS.avertissement }} data-testid="pas-en-ligne">
                        {' '}
                        · pas encore en ligne (gardé dans ce navigateur)
                      </strong>
                    )}
                  </>
                }
                actions={
                  <>
                    <button style={styleBouton()} onClick={() => aller(route)}>
                      Ouvrir
                    </button>
                    <button style={styleBouton()} onClick={() => setRenommage(c.id)}>
                      Renommer
                    </button>
                    <button
                      style={styleBouton()}
                      onClick={() => void exporter(c.id)}
                      title="Un fichier avec tout le chantier (plans, synoptiques, fonds)"
                    >
                      Exporter
                    </button>
                    <button style={styleBoutonDanger} onClick={() => setASupprimer(c)}>
                      Supprimer
                    </button>
                  </>
                }
              />
            )
          })}
        </ul>
      </Page>
      {aSupprimer && (
        <Confirmation
          titre={`Supprimer le chantier « ${aSupprimer.nom} » ?`}
          texte={
            <>
              <p style={{ margin: '0 0 8px' }}>
                Sera perdu : <strong>{`${textePlans(aSupprimer.nbPlans)} et ${texteSynoptiques(aSupprimer.nbSynoptiques)}, fonds de plan compris.`}</strong>
              </p>
              <p style={{ margin: 0, color: COULEURS.erreur }}>
                {memoire.enLigne
                  ? "Cette suppression est définitive, pour toute l'équipe. Exportez d'abord le chantier si vous voulez en garder une copie."
                  : "Cette suppression est définitive. Exportez d'abord le chantier si vous voulez en garder une copie."}
              </p>
            </>
          }
          action="Supprimer définitivement"
          confirmer={() => void supprimer(aSupprimer)}
          annuler={() => setASupprimer(null)}
        />
      )}
      {planAImporter && (
        <Fenetre titre={`Importer le plan « ${planAImporter.nom} »`} fermer={() => setAImporter(null)}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            Dans quel chantier ?
            <select value={destination} onChange={(e) => setDestination(e.target.value)} style={styleChamp} aria-label="Chantier de destination">
              <option value={NOUVEAU}>Un nouveau chantier</option>
              {liste.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          <BoutonsFenetre>
            <button style={styleBouton()} onClick={() => setAImporter(null)}>
              Annuler
            </button>
            <button style={styleBoutonPrincipal} onClick={() => void importerPlan()}>
              Importer
            </button>
          </BoutonsFenetre>
        </Fenetre>
      )}
    </div>
  )
}
