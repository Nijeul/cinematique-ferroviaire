import { chantierRecupere, identifiantChantierLibre, migrerChantier, NOM_CHANTIER_RECUPERE, type Chantier } from '../plan/chantier.ts'
import { lireAncienneSauvegarde, oublierAncienneSauvegarde } from './navigateur.ts'

// Les chantiers sont gardés dans le navigateur, dans IndexedDB : les fonds de
// plan sont lourds et localStorage (quelques Mo) est trop petit. Chaque accès
// peut échouer (navigation privée, stockage désactivé, disque plein) : les
// erreurs sortent d'ici avec un message en français prêt à afficher.

const BASE = 'cinematique-ferroviaire'
const MAGASIN = 'chantiers'

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
    const demande = indexedDB.open(BASE, 1)
    demande.onupgradeneeded = () => demande.result.createObjectStore(MAGASIN, { keyPath: 'id' })
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
async function operation<T>(mode: IDBTransactionMode, faire: (magasin: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  try {
    const base = await ouvrir()
    return await new Promise<T>((resoudre, rejeter) => {
      const transaction = base.transaction(MAGASIN, mode)
      const demande = faire(transaction.objectStore(MAGASIN))
      transaction.oncomplete = () => resoudre(demande.result)
      transaction.onerror = () => rejeter(transaction.error ?? demande.error)
      transaction.onabort = () => rejeter(transaction.error ?? demande.error)
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

export const enregistrerChantier = async (c: Chantier): Promise<void> => {
  await operation('readwrite', (m) => m.put(c))
}

export const supprimerChantierStocke = async (id: string): Promise<void> => {
  await operation('readwrite', (m) => m.delete(id))
}

// Premier lancement de l'étape 4 : le plan de la sauvegarde automatique des
// étapes 2 et 3 devient le « Chantier récupéré ». Renvoie le message à
// afficher (une seule fois : l'ancienne sauvegarde est ensuite effacée).
export async function reprendreAncienneSauvegarde(): Promise<string | null> {
  const ancienne = lireAncienneSauvegarde()
  if (!ancienne) return null
  const existants = await listerChantiers()
  const chantier = chantierRecupere(identifiantChantierLibre(existants.map((c) => c.id)), ancienne.projet, new Date().toISOString())
  await enregistrerChantier(chantier)
  oublierAncienneSauvegarde()
  const fond = ancienne.fondManquant
    ? ` Son fond « ${ancienne.projet.fond?.nomFichier} » n'avait pas pu être gardé : réimportez-le dans le plan.`
    : ''
  return `Votre plan « ${ancienne.projet.nom} » a été rangé dans un chantier nommé « ${NOM_CHANTIER_RECUPERE} ».${fond}`
}
