import type { DonneesEnLigne } from '../plan/fondsEnLigne.ts'
import type { EnteteEnLigne, GenreErreur } from '../plan/synchro.ts'

// Ce que l'application demande à la mémoire en ligne. Seul `supabase.ts`
// sait parler à Supabase : le reste de l'application (et les tests) ne
// connaît que cette interface.

export type Utilisateur = { id: string; email: string }

export type Membre = { email: string; invitePar: string | null; inviteLe: string }

// Erreur venue du serveur, déjà classée, avec un message en français.
export class ErreurEnLigne extends Error {
  readonly genre: GenreErreur
  constructor(genre: GenreErreur, message: string) {
    super(message)
    this.genre = genre
  }
}

export type Evenement = 'connexion' | 'deconnexion' | 'nouveauMotDePasse'

export type ResultatInscription = { genre: 'connecte' } | { genre: 'confirmation' }

export interface DepotEnLigne {
  // ——— Comptes ———
  utilisateur(): Promise<Utilisateur | null>
  connecter(email: string, motDePasse: string): Promise<Utilisateur>
  creerCompte(email: string, motDePasse: string, retour: string): Promise<ResultatInscription>
  motDePasseOublie(email: string, retour: string): Promise<void>
  changerMotDePasse(motDePasse: string): Promise<void>
  deconnecter(): Promise<void>
  surEvenement(rappel: (e: Evenement) => void): () => void

  // ——— Équipe ———
  // Vide si le compte connecté n'est pas membre.
  listerMembres(): Promise<Membre[]>
  inviter(email: string): Promise<void>
  retirer(email: string): Promise<void>

  // ——— Chantiers ———
  listerChantiers(): Promise<EnteteEnLigne[]>
  enteteChantier(id: string): Promise<EnteteEnLigne | null>
  lireChantier(id: string): Promise<{ entete: EnteteEnLigne; donnees: DonneesEnLigne } | null>
  // 'existe' : un chantier de même identifiant est déjà en ligne.
  creerChantier(entete: Omit<EnteteEnLigne, 'version' | 'modifieLe' | 'modifiePar'>, donnees: DonneesEnLigne): Promise<EnteteEnLigne | 'existe'>
  // N'écrit que si la version en ligne est encore `versionAttendue` ; sinon 'conflit'.
  ecrireChantier(
    entete: Omit<EnteteEnLigne, 'version' | 'modifieLe' | 'modifiePar'>,
    donnees: DonneesEnLigne,
    versionAttendue: number,
  ): Promise<EnteteEnLigne | 'conflit'>
  supprimerChantier(id: string): Promise<void>
  // Envoi de dernière minute en quittant la page, sans attendre de réponse ;
  // false s'il n'a pas pu partir (trop gros, pas de session).
  ecrireEnPartant(
    entete: Omit<EnteteEnLigne, 'version' | 'modifieLe' | 'modifiePar'>,
    donnees: DonneesEnLigne,
    versionAttendue: number,
  ): boolean

  // ——— Fonds ———
  envoyerFond(chemin: string, type: string, octets: Uint8Array): Promise<void>
  // null : le fichier n'existe pas en ligne.
  lireFond(chemin: string): Promise<Uint8Array | null>
  listerFonds(dossier: string): Promise<{ chemin: string; creeLe: string | null }[]>
  supprimerFonds(chemins: string[]): Promise<void>
}
