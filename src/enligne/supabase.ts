import type { SupabaseClient } from '@supabase/supabase-js'
import type { DonneesEnLigne } from '../plan/fondsEnLigne.ts'
import { classerErreur, messageErreurEnLigne, type EnteteEnLigne, type Panne } from '../plan/synchro.ts'
import type { Configuration } from './configuration.ts'
import { ErreurEnLigne, type DepotEnLigne, type Evenement, type Membre, type Utilisateur } from './depot.ts'

// La mémoire en ligne avec Supabase : comptes (Auth), tables `membres` et
// `chantiers` (règles d'accès côté serveur : seuls les membres de l'équipe
// lisent et écrivent), et stockage privé `fonds` pour les images de fond.
// La bibliothèque est chargée à la demande, en parallèle du premier écran.

const BUCKET = 'fonds'
const COLONNES = 'id,nom,version,modifie_le,modifie_par,nb_plans,nb_synoptiques'
// Taille maximale d'un envoi « en partant » (limite des navigateurs : 64 Ko).
const LIMITE_EN_PARTANT = 60_000

type LigneChantier = {
  id: string
  nom: string
  version: number
  modifie_le: string
  modifie_par: string | null
  nb_plans: number
  nb_synoptiques: number
}

const entete = (l: LigneChantier): EnteteEnLigne => ({
  id: l.id,
  nom: l.nom,
  version: l.version,
  modifieLe: l.modifie_le,
  modifiePar: l.modifie_par,
  nbPlans: l.nb_plans,
  nbSynoptiques: l.nb_synoptiques,
})

const ligne = (e: Omit<EnteteEnLigne, 'version' | 'modifieLe' | 'modifiePar'>, donnees: DonneesEnLigne) => ({
  id: e.id,
  nom: e.nom,
  nb_plans: e.nbPlans,
  nb_synoptiques: e.nbSynoptiques,
  donnees,
})

const navigateurEnLigne = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

// Toute erreur du serveur devient une ErreurEnLigne classée, message en français.
function echec(e: unknown): ErreurEnLigne {
  if (e instanceof ErreurEnLigne) return e
  const panne = (typeof e === 'object' && e !== null ? e : { message: String(e) }) as Panne
  const genre = classerErreur(panne, navigateurEnLigne())
  return new ErreurEnLigne(genre, messageErreurEnLigne(genre, panne.message))
}

// Erreur d'Auth : on garde code, statut et message pour le message en français.
function echecCompte(e: unknown): Error & Panne {
  const p = (typeof e === 'object' && e !== null ? e : { message: String(e) }) as Panne
  return Object.assign(new Error(p.message ?? 'Erreur'), { status: p.status, code: p.code, name: p.name ?? 'Error' })
}

export async function creerDepotSupabase(config: Configuration): Promise<DepotEnLigne> {
  const { createClient } = await import('@supabase/supabase-js')
  const client: SupabaseClient = createClient(config.url, config.cle, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  })

  // Jeton de la session en cours, gardé pour l'envoi « en partant » (qui ne
  // peut rien attendre).
  let jeton: string | null = null
  const rappels = new Set<(e: Evenement) => void>()
  // Le lien « mot de passe oublié » est lu dès le chargement, avant que
  // l'application écoute : l'événement est gardé pour le premier qui écoute.
  let nouveauMotDePasseEnAttente = false
  client.auth.onAuthStateChange((evenement, session) => {
    jeton = session?.access_token ?? null
    const e: Evenement | null =
      evenement === 'PASSWORD_RECOVERY' ? 'nouveauMotDePasse' : evenement === 'SIGNED_OUT' ? 'deconnexion' : evenement === 'SIGNED_IN' ? 'connexion' : null
    if (e === 'nouveauMotDePasse' && rappels.size === 0) nouveauMotDePasseEnAttente = true
    if (e) for (const r of rappels) setTimeout(() => r(e), 0)
  })

  const utilisateurDe = (u: { id: string; email?: string | null } | null | undefined): Utilisateur | null =>
    u ? { id: u.id, email: (u.email ?? '').toLowerCase() } : null

  return {
    async utilisateur() {
      const { data, error } = await client.auth.getSession()
      if (error) throw echecCompte(error)
      jeton = data.session?.access_token ?? null
      return utilisateurDe(data.session?.user)
    },

    async connecter(email, motDePasse) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password: motDePasse })
      if (error) throw echecCompte(error)
      jeton = data.session?.access_token ?? null
      return utilisateurDe(data.user)!
    },

    async creerCompte(email, motDePasse, retour) {
      const { data, error } = await client.auth.signUp({ email: email.trim(), password: motDePasse, options: { emailRedirectTo: retour } })
      if (error) throw echecCompte(error)
      return data.session ? { genre: 'connecte' } : { genre: 'confirmation' }
    },

    async motDePasseOublie(email, retour) {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: retour })
      if (error) throw echecCompte(error)
    },

    async changerMotDePasse(motDePasse) {
      const { error } = await client.auth.updateUser({ password: motDePasse })
      if (error) throw echecCompte(error)
    },

    async deconnecter() {
      // « local » : se déconnecte de ce navigateur même hors ligne.
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) throw echecCompte(error)
      jeton = null
    },

    surEvenement(rappel) {
      rappels.add(rappel)
      if (nouveauMotDePasseEnAttente) {
        nouveauMotDePasseEnAttente = false
        setTimeout(() => rappel('nouveauMotDePasse'), 0)
      }
      return () => rappels.delete(rappel)
    },

    async listerMembres() {
      const { data, error } = await client.from('membres').select('email,invite_par,invite_le').order('invite_le')
      if (error) throw echec(error)
      return (data as { email: string; invite_par: string | null; invite_le: string }[]).map(
        (m): Membre => ({ email: m.email, invitePar: m.invite_par, inviteLe: m.invite_le }),
      )
    },

    async inviter(email) {
      const { error } = await client.from('membres').insert({ email: email.trim().toLowerCase() })
      if (error?.code === '23505') throw new ErreurEnLigne('autre', 'Cette adresse fait déjà partie de l’équipe.')
      if (error?.code === '23514') throw new ErreurEnLigne('autre', 'Adresse e-mail invalide.')
      if (error) throw echec(error)
    },

    async retirer(email) {
      const { error } = await client.from('membres').delete().eq('email', email)
      if (error?.code === 'P0001') throw new ErreurEnLigne('autre', 'Impossible de retirer le dernier membre de l’équipe.')
      if (error) throw echec(error)
    },

    async listerChantiers() {
      const { data, error } = await client.from('chantiers').select(COLONNES).order('modifie_le', { ascending: false })
      if (error) throw echec(error)
      return (data as LigneChantier[]).map(entete)
    },

    async enteteChantier(id) {
      const { data, error } = await client.from('chantiers').select(COLONNES).eq('id', id).maybeSingle()
      if (error) throw echec(error)
      return data ? entete(data as LigneChantier) : null
    },

    async lireChantier(id) {
      const { data, error } = await client.from('chantiers').select(`${COLONNES},donnees`).eq('id', id).maybeSingle()
      if (error) throw echec(error)
      if (!data) return null
      const l = data as LigneChantier & { donnees: DonneesEnLigne }
      return { entete: entete(l), donnees: l.donnees }
    },

    async creerChantier(e, donnees) {
      const { data, error } = await client.from('chantiers').insert(ligne(e, donnees)).select(COLONNES).single()
      if (error?.code === '23505') return 'existe'
      if (error) throw echec(error)
      return entete(data as LigneChantier)
    },

    async ecrireChantier(e, donnees, versionAttendue) {
      const { data, error } = await client.from('chantiers').update(ligne(e, donnees)).eq('id', e.id).eq('version', versionAttendue).select(COLONNES)
      if (error) throw echec(error)
      const lignes = data as LigneChantier[]
      return lignes.length === 1 ? entete(lignes[0]) : 'conflit'
    },

    async supprimerChantier(id) {
      const { error } = await client.from('chantiers').delete().eq('id', id)
      if (error) throw echec(error)
    },

    ecrireEnPartant(e, donnees, versionAttendue) {
      if (!jeton) return false
      const corps = JSON.stringify(ligne(e, donnees))
      if (new TextEncoder().encode(corps).length > LIMITE_EN_PARTANT) return false
      try {
        void fetch(`${config.url}/rest/v1/chantiers?id=eq.${encodeURIComponent(e.id)}&version=eq.${versionAttendue}`, {
          method: 'PATCH',
          keepalive: true,
          headers: { apikey: config.cle, Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: corps,
        }).catch(() => undefined)
        return true
      } catch {
        return false
      }
    },

    async envoyerFond(chemin, type, octets) {
      const { error } = await client.storage.from(BUCKET).upload(chemin, octets, { contentType: type, upsert: false, cacheControl: '31536000' })
      // Déjà en ligne (même empreinte = même contenu) : rien à faire.
      if (error && !/already exists|duplicate/i.test(error.message) && (error as { statusCode?: string }).statusCode !== '409') throw echec(error)
    },

    async lireFond(chemin) {
      const { data, error } = await client.storage.from(BUCKET).download(chemin)
      if (error) {
        const e = error as { status?: number; statusCode?: string; message: string }
        if (e.status === 404 || e.statusCode === '404' || /not found|no such/i.test(e.message)) return null
        throw echec(error)
      }
      return new Uint8Array(await data.arrayBuffer())
    },

    async listerFonds(dossier) {
      const { data, error } = await client.storage.from(BUCKET).list(dossier, { limit: 1000 })
      if (error) throw echec(error)
      return data.filter((f) => f.id !== null).map((f) => ({ chemin: `${dossier}/${f.name}`, creeLe: f.created_at }))
    },

    async supprimerFonds(chemins) {
      if (chemins.length === 0) return
      const { error } = await client.storage.from(BUCKET).remove(chemins)
      if (error) throw echec(error)
    },
  }
}
