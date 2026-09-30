import { nomLibre, textePlans, texteSynoptiques, type Chantier } from './chantier.ts'

// La mémoire en ligne (Supabase) et la copie de secours du navigateur
// (IndexedDB) : les décisions de synchronisation, les textes à afficher et
// le classement des erreurs, sans réseau ni navigateur.
//
// Chaque chantier gardé dans le navigateur a une fiche de synchronisation :
// la version en ligne dont sa copie est partie (`base`, null s'il n'a jamais
// été en ligne depuis ce navigateur) et s'il a été modifié depuis sans être
// envoyé (`aEnvoyer`). Côté serveur, la version augmente à chaque
// enregistrement.

export type MetaSynchro = {
  id: string
  base: number | null
  aEnvoyer: boolean
  // Chemins des fonds que la version `base` utilise (déjà en ligne).
  fonds: string[]
}

// Ce que la liste en ligne dit d'un chantier, sans ses données.
export type EnteteEnLigne = {
  id: string
  nom: string
  version: number
  modifieLe: string
  modifiePar: string | null
  nbPlans: number
  nbSynoptiques: number
}

export type Decision =
  // Ni dans le navigateur ni en ligne.
  | 'rien'
  // La copie du navigateur est la version en ligne.
  | 'aJour'
  // Modifié dans le navigateur, personne n'a touché la version en ligne : on envoie.
  | 'envoyer'
  // Un collègue a enregistré une version plus récente, rien à envoyer : on la récupère.
  | 'recuperer'
  // Modifié ici ET en ligne depuis : on demande (sauf si les contenus sont identiques).
  | 'conflit'
  // Présent des deux côtés sans lien connu (reprise d'un navigateur) : on compare.
  | 'comparer'
  // Supprimé en ligne alors qu'on l'a modifié ici : on le remet en ligne, rien ne se perd.
  | 'recreer'
  // Supprimé en ligne, rien de nouveau ici : la copie de secours part aussi.
  | 'supprimerLocal'

export function decider(local: Pick<MetaSynchro, 'base' | 'aEnvoyer'> | null, enLigne: Pick<EnteteEnLigne, 'version'> | null): Decision {
  if (!local) return enLigne ? 'recuperer' : 'rien'
  if (local.base === null) return enLigne ? 'comparer' : 'envoyer'
  if (!enLigne) return local.aEnvoyer ? 'recreer' : 'supprimerLocal'
  if (enLigne.version === local.base) return local.aEnvoyer ? 'envoyer' : 'aJour'
  return local.aEnvoyer ? 'conflit' : 'recuperer'
}

// Texte JSON aux clés triées : deux objets égaux donnent le même texte, quel
// que soit l'ordre des clés (la base les réordonne).
export function canonique(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(',')}]`
  if (typeof valeur === 'object' && valeur !== null) {
    const cles = Object.keys(valeur).filter((k) => (valeur as Record<string, unknown>)[k] !== undefined).sort()
    return `{${cles.map((k) => `${JSON.stringify(k)}:${canonique((valeur as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(valeur) ?? 'null'
}

// Même chantier, à la date de modification près.
export function memeContenu(a: unknown, b: unknown): boolean {
  const sansDate = (v: unknown) => (typeof v === 'object' && v !== null && !Array.isArray(v) ? { ...v, modifieLe: undefined } : v)
  return canonique(sansDate(a)) === canonique(sansDate(b))
}

export const SUFFIXE_COPIE = ' (copie de ce navigateur)'

// Reprise : la version de ce navigateur d'un chantier qui existe aussi en
// ligne avec un autre contenu devient un autre chantier, pour ne rien perdre.
export const copieDeCeNavigateur = (c: Chantier, id: string, nomsPris: string[]): Chantier => ({
  ...c,
  id,
  nom: nomLibre(nomsPris, `${c.nom}${SUFFIXE_COPIE}`),
})

// Message après la reprise des chantiers d'un navigateur.
export function messageReprise(misEnLigne: number, copies: string[]): string | null {
  const parties: string[] = []
  if (misEnLigne === 1) parties.push('1 chantier de ce navigateur a été mis en ligne.')
  if (misEnLigne > 1) parties.push(`${misEnLigne} chantiers de ce navigateur ont été mis en ligne.`)
  if (copies.length > 0) {
    const noms = copies.map((n) => `« ${n} »`).join(', ')
    parties.push(
      copies.length === 1
        ? `Un chantier existait déjà en ligne avec un autre contenu : la version en ligne est gardée, et celle de ce navigateur est enregistrée sous le nom ${noms}.`
        : `Des chantiers existaient déjà en ligne avec un autre contenu : les versions en ligne sont gardées, et celles de ce navigateur sont enregistrées sous les noms ${noms}.`,
    )
  }
  return parties.length > 0 ? parties.join(' ') : null
}

const deuxChiffres = (n: number) => String(n).padStart(2, '0')

// « aujourd'hui à 14h32 », « hier à 09h05 », « le 28/09/2026 à 14h32 » (heure locale).
export function momentLisible(iso: string, maintenant: Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'à une date inconnue'
  const heure = `à ${deuxChiffres(d.getHours())}h${deuxChiffres(d.getMinutes())}`
  const jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const ecart = Math.round((jour(maintenant) - jour(d)) / 86_400_000)
  if (ecart === 0) return `aujourd'hui ${heure}`
  if (ecart === 1) return `hier ${heure}`
  return `le ${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} ${heure}`
}

const auteur = (par: string | null, moi: string | null): string => {
  if (!par) return 'quelqu’un'
  return moi && par.toLowerCase() === moi.toLowerCase() ? 'vous, depuis une autre fenêtre ou un autre ordinateur,' : par
}

export const texteConflit = (par: string | null, le: string, moi: string | null, maintenant: Date): string =>
  `Ce chantier a été modifié par ${auteur(par, moi)} ${momentLisible(le, maintenant)}, pendant que vous le modifiiez ici.`

// « 2 plans · 1 synoptique · modifié par x@y aujourd'hui à 14h32 »
export function detailsLigne(l: { nbPlans: number; nbSynoptiques: number; modifieLe: string; modifiePar: string | null }, maintenant: Date): string {
  const par = l.modifiePar ? ` par ${l.modifiePar}` : ''
  return `${textePlans(l.nbPlans)} · ${texteSynoptiques(l.nbSynoptiques)} · modifié${par} ${momentLisible(l.modifieLe, maintenant)}`
}

// Une ligne de l'accueil : un chantier en ligne, ou un chantier de ce
// navigateur pas encore envoyé (créé hors ligne, ou en attente).
export type LigneAccueil = EnteteEnLigne & { pasEncoreEnLigne: boolean }

export function lignesAccueil(enLigne: EnteteEnLigne[], locaux: { chantier: Chantier; meta: MetaSynchro | null }[]): LigneAccueil[] {
  const ids = new Set(enLigne.map((e) => e.id))
  const enAttente = locaux
    .filter(({ chantier, meta }) => !ids.has(chantier.id) && (meta === null || meta.base === null))
    .map(({ chantier }) => ({ ...enteteLocale(chantier), pasEncoreEnLigne: true }))
  return [...enLigne.map((e) => ({ ...e, pasEncoreEnLigne: false })), ...enAttente].sort((a, b) => b.modifieLe.localeCompare(a.modifieLe))
}

// L'en-tête d'un chantier du navigateur (mode « dans ce navigateur »).
export const enteteLocale = (c: Chantier): EnteteEnLigne => ({
  id: c.id,
  nom: c.nom,
  version: 0,
  modifieLe: c.modifieLe,
  modifiePar: null,
  nbPlans: c.plans.length,
  nbSynoptiques: c.synoptiques.length,
})

// Identifiant accepté par la base (lettres, chiffres, tiret, soulignement).
export const identifiantEnLigneValide = (id: string): boolean => /^[A-Za-z0-9_-]{1,100}$/.test(id)

export const adresseValide = (email: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())

// ——— Erreurs ———

export type Panne = { status?: number | string; code?: string; message?: string; name?: string }

export type GenreErreur =
  // Le navigateur n'a pas de connexion.
  | 'horsLigne'
  // Le serveur ne répond pas alors que la connexion marche : projet en pause (offre gratuite) ou panne.
  | 'injoignable'
  // Session expirée ou refusée : il faut se reconnecter.
  | 'session'
  // Le serveur refuse : compte qui n'est pas (ou plus) membre de l'équipe.
  | 'droits'
  | 'autre'

const RESEAU = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_network|err_internet/i

export function classerErreur(e: Panne, navigateurEnLigne: boolean): GenreErreur {
  const status = Number(e.status ?? NaN)
  // Attention : Auth range aussi les erreurs 500 dans « AuthRetryableFetchError »
  // (avec leur statut) ; seul le statut 0 veut dire « pas de réponse ».
  const reseau = status === 0 || RESEAU.test(e.message ?? '') || e.name === 'TypeError'
  if (reseau) return navigateurEnLigne ? 'injoignable' : 'horsLigne'
  if (status === 540 || status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 530)) return 'injoignable'
  if (status === 401 || e.code === 'PGRST301' || e.code === 'PGRST303' || /jwt expired/i.test(e.message ?? '')) return 'session'
  if (status === 403 || e.code === '42501') return 'droits'
  return 'autre'
}

export const MESSAGE_HORS_LIGNE = 'Hors ligne — enregistré dans ce navigateur seulement, envoi dès le retour de la connexion'

export const MESSAGE_PAUSE =
  "Le serveur en ligne ne répond pas. S'il n'a pas servi depuis plus de 7 jours, le projet Supabase gratuit s'est mis en pause : " +
  'ouvrez supabase.com/dashboard, choisissez le projet « cinematique-ferroviaire », cliquez sur « Restore project » (relancer), ' +
  'puis rechargez cette page dans quelques minutes. En attendant, vos modifications sont gardées dans ce navigateur.'

export const MESSAGE_NON_CONFIGURE =
  "La mémoire en ligne n'est pas configurée sur ce site (adresse et clé publique Supabase absentes) : les chantiers sont gardés " +
  'dans ce navigateur seulement. Le responsable du site doit renseigner VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans ' +
  'les réglages du projet Vercel (Settings › Environment Variables), puis redéployer.'

export function messageErreurEnLigne(genre: GenreErreur, detail?: string): string {
  switch (genre) {
    case 'horsLigne':
      return MESSAGE_HORS_LIGNE
    case 'injoignable':
      return MESSAGE_PAUSE
    case 'session':
      return 'Votre connexion a expiré : reconnectez-vous (vos modifications sont gardées dans ce navigateur).'
    case 'droits':
      return "Le serveur refuse l'enregistrement : votre compte n'est peut-être plus membre de l'équipe. Vos modifications sont gardées dans ce navigateur."
    case 'autre':
      return `Enregistrement en ligne impossible${detail ? ` (${detail})` : ''}. Vos modifications sont gardées dans ce navigateur.`
  }
}

export const MESSAGE_NON_INVITE = "Cette adresse n'a pas été invitée. Demandez à un membre de l'équipe de vous inviter."

// Message d'une erreur de connexion, de création de compte ou de mot de passe.
export function messageCompte(e: Panne, navigateurEnLigne: boolean): string {
  const texte = `${e.code ?? ''} ${e.message ?? ''}`
  // Création refusée par la base (adresse non invitée) : Auth ne transmet
  // qu'un message générique, en erreur 500.
  if (/invit|database error saving new user/i.test(texte)) return MESSAGE_NON_INVITE
  const genre = classerErreur(e, navigateurEnLigne)
  if (genre === 'horsLigne') return 'Pas de connexion internet : impossible de se connecter pour le moment.'
  if (genre === 'injoignable') return MESSAGE_PAUSE
  if (/invalid_credentials|invalid login credentials/i.test(texte)) return 'Adresse ou mot de passe incorrect.'
  if (/email_not_confirmed|email not confirmed/i.test(texte)) {
    return "Cette adresse n'est pas encore confirmée : cliquez sur le lien reçu par e-mail, puis reconnectez-vous."
  }
  if (/user_already_exists|already registered|email_exists/i.test(texte)) {
    return 'Un compte existe déjà avec cette adresse : utilisez « Se connecter », ou « Mot de passe oublié ».'
  }
  if (/weak_password|password should/i.test(texte)) return 'Mot de passe trop faible : au moins 8 caractères, avec des lettres et des chiffres.'
  if (/same_password/i.test(texte)) return "Le nouveau mot de passe doit être différent de l'ancien."
  if (/rate_limit|rate limit|too many/i.test(texte) || Number(e.status) === 429) return 'Trop de tentatives : réessayez dans quelques minutes.'
  if (/email_address_not_authorized|not authorized|sending .*email|confirmation email|recovery email/i.test(texte)) {
    return (
      "L'e-mail n'a pas pu être envoyé : le service d'e-mails du projet Supabase n'écrit qu'aux membres de l'organisation Supabase " +
      "tant qu'un serveur d'envoi (SMTP) n'est pas réglé. Prévenez le responsable du site."
    )
  }
  if (/email_address_invalid|invalid.*email|unable to validate email/i.test(texte)) return 'Adresse e-mail invalide.'
  return `L'opération n'a pas abouti${e.message ? ` (${e.message})` : ''}.`
}
