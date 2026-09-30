import { identifiantChantierUnique, type Chantier } from '../plan/chantier.ts'
import {
  decoderDataUrl,
  encoderDataUrl,
  extraireFonds,
  fondsInutiles,
  imagesDuChantier,
  referencesDe,
  reinjecterFonds,
  typeDuChemin,
} from '../plan/fondsEnLigne.ts'
import {
  copieDeCeNavigateur,
  decider,
  enteteLocale,
  identifiantEnLigneValide,
  lignesAccueil,
  memeContenu,
  MESSAGE_PAUSE,
  messageReprise,
  type EnteteEnLigne,
  type GenreErreur,
  type LigneAccueil,
  type MetaSynchro,
} from '../plan/synchro.ts'
import { ErreurEnLigne, type DepotEnLigne } from '../enligne/depot.ts'
import {
  ecrireFiche,
  enregistrerChantier,
  enregistrerVersionEnLigne,
  lireChantierStocke,
  lireCopieLocale,
  lireFiche,
  listerChantiers,
  listerFiches,
  noterEnvoi,
  supprimerChantierStocke,
} from './stockage.ts'

// La mémoire des chantiers vue par les écrans : en ligne (Supabase) avec la
// copie de secours du navigateur, ou seulement le navigateur (site sans
// Supabase, serveur injoignable). Les écrans ne savent pas lequel.

export type Conflit = { par: string | null; le: string; version: number }

export type Envoi =
  | { genre: 'ok' }
  | { genre: 'horsLigne' }
  | { genre: 'conflit'; conflit: Conflit }
  | { genre: 'erreur'; texte: string; cause: GenreErreur }

export type Ouverture = {
  chantier: Chantier
  // À dire une fois : mise à jour du chantier, fonds introuvables, copie gardée.
  avis: string[]
  conflit: Conflit | null
  horsLigne: boolean
  // Des modifications de ce navigateur attendent d'être envoyées.
  aEnvoyer: boolean
}

export interface Memoire {
  enLigne: boolean
  lister(): Promise<{ lignes: LigneAccueil[]; alerte: string | null }>
  ouvrir(id: string): Promise<Ouverture | null>
  // Copie de secours dans le navigateur (tout de suite).
  garder(c: Chantier): Promise<void>
  // Envoi en ligne (quelques secondes après la dernière modification).
  envoyer(c: Chantier): Promise<Envoi>
  envoyerEnPartant(c: Chantier): void
  garderLaMienne(c: Chantier, versionEnLigne: number): Promise<Envoi>
  reprendreVersionEnLigne(id: string): Promise<Ouverture>
  // Garder puis envoyer (actions de l'accueil).
  enregistrer(c: Chantier): Promise<Envoi>
  supprimer(id: string): Promise<void>
  // Reprise des chantiers du navigateur et envois en attente ; message à afficher.
  synchroniserTout(): Promise<string | null>
}

const enligne = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

// ——— Dans ce navigateur seulement ———

export function creerMemoireLocale(alerte: string | null): Memoire {
  return {
    enLigne: false,
    async lister() {
      const locaux = await listerChantiers()
      return { lignes: locaux.map((c) => ({ ...enteteLocale(c), pasEncoreEnLigne: false })).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe)), alerte }
    },
    async ouvrir(id) {
      const lu = await lireChantierStocke(id)
      return lu ? { ...lu, conflit: null, horsLigne: false, aEnvoyer: false } : null
    },
    garder: enregistrerChantier,
    envoyer: async () => ({ genre: 'ok' }),
    envoyerEnPartant: () => undefined,
    garderLaMienne: async () => ({ genre: 'ok' }),
    async reprendreVersionEnLigne(id) {
      const o = await this.ouvrir(id)
      if (!o) throw new Error("Ce chantier n'existe plus dans ce navigateur.")
      return o
    },
    async enregistrer(c) {
      await enregistrerChantier(c)
      return { genre: 'ok' }
    },
    supprimer: supprimerChantierStocke,
    synchroniserTout: async () => null,
  }
}

// ——— En ligne ———

// Empreintes des images (SHA-256 du texte de la data URL), calculées une
// fois par image : une image déjà en ligne ne se renvoie pas.
const empreintes = new Map<string, string>()

async function empreintesDe(images: string[]): Promise<Map<string, string>> {
  if (empreintes.size > 64) empreintes.clear()
  for (const image of images) {
    if (empreintes.has(image)) continue
    const somme = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(image))
    empreintes.set(image, [...new Uint8Array(somme)].map((o) => o.toString(16).padStart(2, '0')).join(''))
  }
  return new Map(images.map((i) => [i, empreintes.get(i)!]))
}

const extraire = async (c: Chantier) => extraireFonds(c, await empreintesDe(imagesDuChantier(c)))

// Même calcul, sans attendre : possible seulement si toutes les empreintes
// sont déjà connues (envoi en quittant la page).
function extraireTout(c: Chantier) {
  const images = imagesDuChantier(c)
  if (!images.every((i) => empreintes.has(i))) return null
  return extraireFonds(c, new Map(images.map((i) => [i, empreintes.get(i)!])))
}

const enteteDe = (c: Chantier) => ({ id: c.id, nom: c.nom, nbPlans: c.plans.length, nbSynoptiques: c.synoptiques.length })

const FICHE_NEUVE = (id: string): MetaSynchro => ({ id, base: null, aEnvoyer: true, fonds: [] })

// La copie de secours peut manquer (stockage du navigateur refusé) : la
// mémoire en ligne marche quand même.
const sansEchec = <T>(lecture: Promise<T>, defaut: T): Promise<T> => lecture.catch(() => defaut)

const reseau = (e: unknown): e is ErreurEnLigne => e instanceof ErreurEnLigne && (e.genre === 'horsLigne' || e.genre === 'injoignable')

// Les fichiers inutiles ne sont effacés qu'un jour après leur envoi (voir fondsInutiles).
const DELAI_NETTOYAGE = 24 * 3600 * 1000

export function creerMemoireEnLigne(depot: DepotEnLigne): Memoire {
  // Un seul envoi à la fois par chantier : deux envois partis de la même
  // version se prendraient l'un l'autre pour un conflit.
  const files = new Map<string, Promise<unknown>>()
  const enFile = <T>(id: string, faire: () => Promise<T>): Promise<T> => {
    const suite = (files.get(id) ?? Promise.resolve()).then(faire, faire)
    files.set(
      id,
      suite.catch(() => undefined),
    )
    return suite
  }
  const nettoyes = new Set<string>()
  // Fiches connues en mémoire, pour l'envoi en quittant la page.
  const fiches = new Map<string, MetaSynchro>()

  // Version en ligne récupérée : images reprises de la copie du navigateur
  // quand elles y sont (même empreinte), téléchargées sinon.
  async function telecharger(id: string, local: Chantier | null): Promise<Ouverture> {
    const lu = await depot.lireChantier(id)
    if (!lu) throw new Error("Ce chantier n'existe plus en ligne.")
    const refs = referencesDe(lu.donnees)
    const images = new Map<string, string>()
    if (local) for (const [image, e] of await empreintesDe(imagesDuChantier(local))) images.set(e, image)
    for (const r of refs) {
      if (images.has(r.empreinte)) continue
      const octets = await depot.lireFond(r.chemin)
      if (octets) {
        const image = encoderDataUrl(typeDuChemin(r.chemin), octets)
        images.set(r.empreinte, image)
        empreintes.set(image, r.empreinte)
      }
    }
    const relu = reinjecterFonds(lu.donnees, images)
    if (!relu.ok) throw new Error(`La version en ligne de ce chantier est illisible : ${relu.erreurs.join(' ')}`)
    const fiche: MetaSynchro = { id, base: lu.entete.version, aEnvoyer: false, fonds: refs.map((r) => r.chemin) }
    await enregistrerVersionEnLigne(relu.chantier, fiche)
    fiches.set(id, fiche)
    const avis = [...relu.avis]
    if (relu.manquants.length > 0) {
      avis.push(
        `${relu.manquants.length > 1 ? `${relu.manquants.length} fonds de plan sont introuvables` : 'Un fond de plan est introuvable'} en ligne : réimportez-le dans le plan concerné.`,
      )
    }
    return { chantier: relu.chantier, avis, conflit: null, horsLigne: false, aEnvoyer: false }
  }

  // Les fonds qui ne servent plus (fond remplacé) sont effacés une fois par
  // séance, sans bloquer.
  function nettoyer(id: string, gardes: string[]) {
    if (nettoyes.has(id)) return
    nettoyes.add(id)
    depot
      .listerFonds(id)
      .then((fichiers) => depot.supprimerFonds(fondsInutiles(fichiers, new Set(gardes), Date.now(), DELAI_NETTOYAGE)))
      .catch(() => nettoyes.delete(id))
  }

  const conflitDe = (e: EnteteEnLigne): Envoi => ({ genre: 'conflit', conflit: { par: e.modifiePar, le: e.modifieLe, version: e.version } })

  async function envoyerMaintenant(c: Chantier): Promise<Envoi> {
    if (!enligne()) return { genre: 'horsLigne' }
    if (!identifiantEnLigneValide(c.id)) return { genre: 'erreur', texte: `Identifiant de chantier refusé en ligne (« ${c.id} »).`, cause: 'autre' }
    try {
      const fiche = (await sansEchec(lireFiche(c.id), null)) ?? fiches.get(c.id) ?? FICHE_NEUVE(c.id)
      const { donnees, fichiers } = await extraire(c)
      const dejaLa = new Set(fiche.fonds)
      for (const f of fichiers) {
        if (dejaLa.has(f.chemin)) continue
        const binaire = decoderDataUrl(f.image)
        if (binaire) await depot.envoyerFond(f.chemin, binaire.type, binaire.octets)
      }
      const chemins = fichiers.map((f) => f.chemin)
      const resultat = fiche.base === null ? await depot.creerChantier(enteteDe(c), donnees) : await depot.ecrireChantier(enteteDe(c), donnees, fiche.base)
      if (resultat === 'conflit' || resultat === 'existe') {
        const lu = await depot.lireChantier(c.id)
        if (!lu) {
          // Supprimé en ligne entre-temps : on le remet, rien ne se perd.
          const cree = await depot.creerChantier(enteteDe(c), donnees)
          if (cree === 'existe') return { genre: 'erreur', texte: 'Le chantier a changé en ligne pendant l’envoi : réessayez.', cause: 'autre' }
          await noter(c, cree.version, chemins)
          return { genre: 'ok' }
        }
        // Même contenu (envoi parti en quittant la page, autre onglet) : pas de conflit.
        if (memeContenu(donnees, lu.donnees)) {
          await noter(c, lu.entete.version, referencesDe(lu.donnees).map((r) => r.chemin))
          return { genre: 'ok' }
        }
        return conflitDe(lu.entete)
      }
      await noter(c, resultat.version, chemins)
      nettoyer(c.id, chemins)
      return { genre: 'ok' }
    } catch (e) {
      if (e instanceof ErreurEnLigne) {
        if (e.genre === 'horsLigne') return { genre: 'horsLigne' }
        return { genre: 'erreur', texte: e.genre === 'injoignable' ? MESSAGE_PAUSE : e.message, cause: e.genre }
      }
      return { genre: 'erreur', texte: `Enregistrement en ligne impossible : ${(e as Error).message}`, cause: 'autre' }
    }
  }

  async function noter(c: Chantier, version: number, chemins: string[]) {
    fiches.set(c.id, { id: c.id, base: version, aEnvoyer: false, fonds: chemins })
    await sansEchec(noterEnvoi(c.id, version, chemins, c.modifieLe), undefined)
  }

  const envoyer = (c: Chantier) => enFile(c.id, () => envoyerMaintenant(c))

  const memoire: Memoire = {
    enLigne: true,

    async lister() {
      const [locaux, lesFiches] = await Promise.all([sansEchec(listerChantiers(), []), sansEchec(listerFiches(), [])])
      const parId = new Map(lesFiches.map((f) => [f.id, f]))
      const avecFiches = locaux.map((chantier) => ({ chantier, meta: parId.get(chantier.id) ?? null }))
      try {
        return { lignes: lignesAccueil(await depot.listerChantiers(), avecFiches), alerte: null }
      } catch (e) {
        if (!reseau(e)) throw e
        const lignes = avecFiches
          .map(({ chantier, meta }) => ({ ...enteteLocale(chantier), pasEncoreEnLigne: meta === null || meta.base === null }))
          .sort((a, b) => b.modifieLe.localeCompare(a.modifieLe))
        const alerte =
          e.genre === 'horsLigne'
            ? 'Hors ligne : voici les chantiers gardés dans ce navigateur. Les modifications seront envoyées dès le retour de la connexion.'
            : `${MESSAGE_PAUSE} Voici les chantiers gardés dans ce navigateur.`
        return { lignes, alerte }
      }
    },

    async ouvrir(id) {
      const [local, fiche] = await Promise.all([sansEchec(lireChantierStocke(id), null), sansEchec(lireFiche(id), null)])
      if (fiche) fiches.set(id, fiche)
      const hors = (): Ouverture | null => (local ? { ...local, conflit: null, horsLigne: true, aEnvoyer: fiche?.aEnvoyer ?? true } : null)
      let entete: EnteteEnLigne | null
      try {
        entete = await depot.enteteChantier(id)
      } catch (e) {
        if (!reseau(e)) throw e
        if (local) return hors()
        throw new Error(
          e.genre === 'horsLigne'
            ? "Ce chantier n'est pas encore dans ce navigateur, et il n'y a pas de connexion : ouvrez-le quand la connexion sera revenue."
            : `Ce chantier n'est pas encore dans ce navigateur. ${MESSAGE_PAUSE}`,
          { cause: e },
        )
      }
      const decision = decider(local ? (fiche ?? FICHE_NEUVE(id)) : null, entete)
      const tel = (aEnvoyer: boolean): Ouverture => ({ ...local!, conflit: null, horsLigne: false, aEnvoyer })
      switch (decision) {
        case 'rien':
          return null
        case 'aJour':
          return tel(false)
        case 'envoyer':
          return tel(true)
        case 'recreer':
          await ecrireFiche({ ...(fiche ?? FICHE_NEUVE(id)), base: null, aEnvoyer: true })
          return tel(true)
        case 'supprimerLocal':
          await supprimerChantierStocke(id)
          return null
        case 'recuperer': {
          const o = await telecharger(id, local?.chantier ?? null)
          return { ...o, avis: [...(local?.avis ?? []), ...o.avis] }
        }
        case 'conflit':
        case 'comparer': {
          const lu = await depot.lireChantier(id)
          if (!lu) return tel(true)
          const { donnees } = await extraire(local!.chantier)
          if (memeContenu(donnees, lu.donnees)) {
            await ecrireFiche({ id, base: lu.entete.version, aEnvoyer: false, fonds: referencesDe(lu.donnees).map((r) => r.chemin) })
            return tel(false)
          }
          if (decision === 'conflit') return { ...tel(true), conflit: { par: lu.entete.modifiePar, le: lu.entete.modifieLe, version: lu.entete.version } }
          // Jamais relié à la version en ligne : la version de ce navigateur devient une copie.
          const nom = await garderCopie(local!.chantier)
          const o = await telecharger(id, local!.chantier)
          return { ...o, avis: [...o.avis, `Ce chantier existait déjà en ligne avec un autre contenu : la version en ligne est affichée, et celle de ce navigateur est gardée sous le nom « ${nom} ».`] }
        }
      }
    },

    garder: enregistrerChantier,
    envoyer,

    envoyerEnPartant(c) {
      const fiche = fiches.get(c.id)
      if (!fiche || fiche.base === null) return
      const extrait = extraireTout(c)
      if (!extrait || !extrait.fichiers.every((f) => fiche.fonds.includes(f.chemin))) return
      depot.ecrireEnPartant(enteteDe(c), extrait.donnees, fiche.base)
    },

    garderLaMienne: (c, version) =>
      enFile(c.id, async () => {
        const fiche = (await sansEchec(lireFiche(c.id), null)) ?? fiches.get(c.id) ?? FICHE_NEUVE(c.id)
        fiches.set(c.id, { ...fiche, base: version, aEnvoyer: true })
        await sansEchec(ecrireFiche({ ...fiche, base: version, aEnvoyer: true }), undefined)
        return envoyerMaintenant(c)
      }),

    reprendreVersionEnLigne: (id) =>
      enFile(id, async () => {
        const local = await lireCopieLocale(id)
        return telecharger(id, local)
      }),

    async enregistrer(c) {
      await enregistrerChantier(c)
      return envoyer(c)
    },

    async supprimer(id) {
      await depot.supprimerChantier(id)
      // Les fichiers de ses fonds partent avec lui. Si leur suppression
      // échoue (coupure), ils restent sans gêner personne.
      try {
        await depot.supprimerFonds((await depot.listerFonds(id)).map((f) => f.chemin))
      } catch {
        // Fichiers orphelins : seulement de la place perdue.
      }
      await supprimerChantierStocke(id)
      fiches.delete(id)
    },

    async synchroniserTout() {
      if (!enligne()) return null
      const [locaux, lesFiches, enLigne] = await Promise.all([listerChantiers(), listerFiches(), depot.listerChantiers()])
      const parId = new Map(lesFiches.map((f) => [f.id, f]))
      const enLigneParId = new Map(enLigne.map((e) => [e.id, e]))
      let misEnLigne = 0
      const copies: string[] = []
      for (const c of locaux) {
        const fiche = parId.get(c.id) ?? null
        try {
          switch (decider(fiche ?? FICHE_NEUVE(c.id), enLigneParId.get(c.id) ?? null)) {
            case 'envoyer': {
              const r = await envoyer(c)
              if (r.genre === 'ok' && (fiche === null || fiche.base === null)) misEnLigne++
              break
            }
            case 'recreer':
              await ecrireFiche({ ...fiche!, base: null, aEnvoyer: true })
              await envoyer(c)
              break
            case 'supprimerLocal':
              await supprimerChantierStocke(c.id)
              break
            case 'comparer': {
              const lu = await depot.lireChantier(c.id)
              if (!lu) break
              const { donnees } = await extraire(c)
              if (memeContenu(donnees, lu.donnees)) {
                await ecrireFiche({ id: c.id, base: lu.entete.version, aEnvoyer: false, fonds: referencesDe(lu.donnees).map((r) => r.chemin) })
              } else {
                copies.push(await garderCopie(c))
                await telecharger(c.id, c)
              }
              break
            }
            default:
              break
          }
        } catch (e) {
          if (reseau(e)) break
        }
      }
      return messageReprise(misEnLigne, copies)
    },
  }

  // La version de ce navigateur, gardée comme un autre chantier et mise en ligne.
  async function garderCopie(c: Chantier): Promise<string> {
    const [locaux, enLigne] = await Promise.all([listerChantiers(), depot.listerChantiers()])
    const ids = [...locaux.map((x) => x.id), ...enLigne.map((x) => x.id)]
    const noms = [...locaux.map((x) => x.nom), ...enLigne.map((x) => x.nom)]
    const copie = copieDeCeNavigateur(c, identifiantChantierUnique(ids), noms)
    await enregistrerChantier(copie)
    await envoyer(copie)
    return copie.nom
  }

  return memoire
}
