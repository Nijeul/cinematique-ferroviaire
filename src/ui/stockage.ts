import { chantierRecupere, identifiantChantierUnique, migrerChantier, NOM_CHANTIER_RECUPERE, type Chantier } from '../plan/chantier.ts'
import type { MetaSynchro } from '../plan/synchro.ts'
import { lireAncienneSauvegarde, oublierAncienneSauvegarde } from './navigateur.ts'

// Copie de secours des chantiers, dans le navigateur (IndexedDB : les fonds de
// plan sont lourds et localStorage, quelques Mo, est trop petit). Depuis
// l'étape 9, la mémoire de référence est en ligne ; chaque chantier gardé ici
// a sa fiche de synchronisation (magasin `synchro` : version en ligne dont la
// copie est partie, modifications pas encore envoyées). Chaque accès peut
// échouer (navigation privée, stockage désactivé, disque plein) : les erreurs
// sortent d'ici avec un message en français prêt à afficher.

const BASE = 'cinematique-ferroviaire'
const MAGASIN = 'chantiers'
const SYNCHRO = 'synchro'

const MESSAGE_INDISPONIBLE =
  'Ce navigateur refuse de garder les chantiers (navigation privée ou stockage désactivé). ' +
  "Ouvrez l'application dans une fenêtre normale ; si un chantier est ouvert, exportez-le pour ne rien perdre."
const MESSAGE_PLEIN =
  "Plus de place dans le navigateur pour garder ce chantier : exportez-le, puis supprimez des chantiers qui ne servent plus."

class ErreurStockage extends Error {}

const enErreur = (e: unknown): ErreurStockage =>
  e instanceof ErreurStockage
    ? e
    : new ErreurStockage((e as { name?: string } | null)?.name === 'QuotaExceededError' ? MESSAGE_PLEIN : MESSAGE_INDISPONIBLE)

let ouverture: Promise<IDBDatabase> | null = null

function ouvrir(): Promise<IDBDatabase> {
  ouverture ??= new Promise<IDBDatabase>((resoudre, rejeter) => {
    const demande = indexedDB.open(BASE, 2)
    demande.onupgradeneeded = () => {
      const base = demande.result
      if (!base.objectStoreNames.contains(MAGASIN)) base.createObjectStore(MAGASIN, { keyPath: 'id' })
      if (!base.objectStoreNames.contains(SYNCHRO)) base.createObjectStore(SYNCHRO, { keyPath: 'id' })
    }
    demande.onsuccess = () => resoudre(demande.result)
    demande.onerror = () => rejeter(demande.error)
    demande.onblocked = () => rejeter(new ErreurStockage(MESSAGE_INDISPONIBLE))
  }).catch((e) => {
    ouverture = null
    throw e
  })
  return ouverture
}

// Une opération sur le magasin, terminée quand la transaction est écrite.
async function operation<T>(mode: IDBTransactionMode, faire: (magasin: IDBObjectStore) => IDBRequest<T>, magasin = MAGASIN): Promise<T> {
  try {
    const base = await ouvrir()
    return await new Promise<T>((resoudre, rejeter) => {
      const transaction = base.transaction(magasin, mode)
      const demande = faire(transaction.objectStore(magasin))
      transaction.oncomplete = () => resoudre(demande.result)
      transaction.onerror = () => rejeter(transaction.error ?? demande.error)
      transaction.onabort = () => rejeter(transaction.error ?? demande.error)
    })
  } catch (e) {
    throw enErreur(e)
  }
}

// Plusieurs lectures et écritures sur les deux magasins, d'un seul tenant :
// le chantier et sa fiche ne se contredisent jamais.
async function transaction(faire: (chantiers: IDBObjectStore, synchro: IDBObjectStore) => void): Promise<void> {
  try {
    const base = await ouvrir()
    await new Promise<void>((resoudre, rejeter) => {
      const t = base.transaction([MAGASIN, SYNCHRO], 'readwrite')
      faire(t.objectStore(MAGASIN), t.objectStore(SYNCHRO))
      t.oncomplete = () => resoudre()
      t.onerror = () => rejeter(t.error)
      t.onabort = () => rejeter(t.error)
    })
  } catch (e) {
    throw enErreur(e)
  }
}

// Les chantiers gardés par les étapes précédentes reçoivent à la lecture ce
// qui leur manque (catalogue d'engins, plans et synoptiques sans échelle).
export const listerChantiers = async (): Promise<Chantier[]> =>
  (await operation('readonly', (m) => m.getAll() as IDBRequest<Chantier[]>)).map((c) => migrerChantier(c).chantier)

// Un chantier ouvert, avec les avis de sa mise à jour : des engins retirés de
// ses plans. Le chantier corrigé est aussitôt réenregistré, pour que l'avis
// ne s'affiche qu'une fois.
export const lireChantierStocke = async (id: string): Promise<{ chantier: Chantier; avis: string[] } | null> => {
  const c = (await operation('readonly', (m) => m.get(id))) as Chantier | undefined
  if (!c) return null
  const migre = migrerChantier(c)
  if (migre.avis.length > 0) await enregistrerChantier(migre.chantier)
  return migre
}

const FICHE_NEUVE = (id: string): MetaSynchro => ({ id, base: null, aEnvoyer: true, fonds: [] })

// Une modification faite dans ce navigateur : le chantier est gardé, et noté
// « à envoyer » (sa fiche garde la version en ligne dont il est parti).
export const enregistrerChantier = (c: Chantier): Promise<void> =>
  transaction((chantiers, synchro) => {
    chantiers.put(c)
    const lecture = synchro.get(c.id)
    lecture.onsuccess = () => {
      const fiche = (lecture.result as MetaSynchro | undefined) ?? FICHE_NEUVE(c.id)
      if (!fiche.aEnvoyer) synchro.put({ ...fiche, aEnvoyer: true })
      else if (!lecture.result) synchro.put(fiche)
    }
  })

// La version en ligne, gardée telle quelle : rien à envoyer.
export const enregistrerVersionEnLigne = (c: Chantier, fiche: MetaSynchro): Promise<void> =>
  transaction((chantiers, synchro) => {
    chantiers.put(c)
    synchro.put(fiche)
  })

// Après un envoi réussi de la version datée `modifieLe` : la fiche prend la
// nouvelle version en ligne ; « à envoyer » ne s'efface que si le chantier
// n'a pas été modifié entre-temps.
export const noterEnvoi = (id: string, version: number, fonds: string[], modifieLe: string): Promise<void> =>
  transaction((chantiers, synchro) => {
    const lecture = chantiers.get(id)
    lecture.onsuccess = () => {
      const actuel = lecture.result as Chantier | undefined
      synchro.put({ id, base: version, aEnvoyer: actuel !== undefined && actuel.modifieLe !== modifieLe, fonds })
    }
  })

export const ecrireFiche = async (fiche: MetaSynchro): Promise<void> => {
  await operation('readwrite', (m) => m.put(fiche), SYNCHRO)
}

export const lireFiche = async (id: string): Promise<MetaSynchro | null> =>
  ((await operation('readonly', (m) => m.get(id), SYNCHRO)) as MetaSynchro | undefined) ?? null

export const listerFiches = async (): Promise<MetaSynchro[]> => (await operation('readonly', (m) => m.getAll(), SYNCHRO)) as MetaSynchro[]

// Lecture brute, sans migration ni réenregistrement (pour la synchronisation).
export const lireCopieLocale = async (id: string): Promise<Chantier | null> => {
  const c = (await operation('readonly', (m) => m.get(id))) as Chantier | undefined
  return c ? migrerChantier(c).chantier : null
}

export const supprimerChantierStocke = (id: string): Promise<void> =>
  transaction((chantiers, synchro) => {
    chantiers.delete(id)
    synchro.delete(id)
  })

// Premier lancement de l'étape 4 : le plan de la sauvegarde automatique des
// étapes 2 et 3 devient le « Chantier récupéré ». Renvoie le message à
// afficher (une seule fois : l'ancienne sauvegarde est ensuite effacée).
export async function reprendreAncienneSauvegarde(): Promise<string | null> {
  const ancienne = lireAncienneSauvegarde()
  if (!ancienne) return null
  const existants = await listerChantiers()
  const chantier = chantierRecupere(identifiantChantierUnique(existants.map((c) => c.id)), ancienne.projet, new Date().toISOString())
  await enregistrerChantier(chantier)
  oublierAncienneSauvegarde()
  const fond = ancienne.fondManquant
    ? ` Son fond « ${ancienne.projet.fond?.nomFichier} » n'avait pas pu être gardé : réimportez-le dans le plan.`
    : ''
  return `Votre plan « ${ancienne.projet.nom} » a été rangé dans un chantier nommé « ${NOM_CHANTIER_RECUPERE} ».${fond}`
}
