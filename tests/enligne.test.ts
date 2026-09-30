import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lireConfiguration, messageConfiguration } from '../src/enligne/configuration.ts'
import { ecrireAdresse, lireAdresse } from '../src/plan/adresse.ts'
import { identifiantChantierUnique, type Chantier } from '../src/plan/chantier.ts'
import { cleEcran, retoursApresErreur } from '../src/plan/erreur.ts'
import { FORMAT_CHANTIER, lireChantier, serialiserChantier, VERSION_CHANTIER } from '../src/plan/fichierChantier.ts'
import {
  cheminFond,
  decoderDataUrl,
  encoderDataUrl,
  extraireFonds,
  fondsInutiles,
  imagesDuChantier,
  referencesDe,
  reinjecterFonds,
  typeDataUrl,
  typeDuChemin,
} from '../src/plan/fondsEnLigne.ts'
import type { Fond } from '../src/plan/projet.ts'
import {
  adresseValide,
  canonique,
  classerErreur,
  copieDeCeNavigateur,
  decider,
  detailsLigne,
  identifiantEnLigneValide,
  lignesAccueil,
  memeContenu,
  MESSAGE_NON_INVITE,
  MESSAGE_PAUSE,
  messageCompte,
  messageErreurEnLigne,
  messageReprise,
  momentLisible,
  texteConflit,
  type EnteteEnLigne,
} from '../src/plan/synchro.ts'

// Étape 9 — mémoire en ligne : tout ce qui se décide sans réseau. L'accès à
// Supabase lui-même (src/enligne/supabase.ts) est derrière une interface et
// n'est pas appelé ici.

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')

// Une vraie image PNG de 1 × 1 pixel, et une seconde image (JPEG) quelconque.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='

const fond = (image: string, nomFichier: string): Fond => ({ image, largeur: 1600, hauteur: 900, nomFichier, page: null, nombrePages: null })

// Le chantier d'exemple, avec des fonds : le plan 1 et le synoptique 1
// partagent la même image (copie figée), le plan 2 en a une autre.
function chantierAvecFonds(): Chantier {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  const c = lu.chantier
  return {
    ...c,
    plans: c.plans.map((p, i) => ({ ...p, projet: { ...p.projet, fond: fond(i === 0 ? PNG : JPEG, i === 0 ? 'plan.png' : 'plan.jpg') } })),
    synoptiques: c.synoptiques.map((s, i) => ({ ...s, fond: i === 0 ? fond(PNG, 'plan.png') : null })),
  }
}

const EMPREINTES = new Map([
  [PNG, 'a'.repeat(64)],
  [JPEG, 'b'.repeat(64)],
])

describe('fonds en ligne : images en fichiers, références dans le chantier', () => {
  it('reconnaît une image en data URL et la redonne au caractère près', () => {
    expect(typeDataUrl(PNG)).toBe('image/png')
    expect(typeDataUrl(JPEG)).toBe('image/jpeg')
    expect(typeDataUrl('data:text/plain;base64,QQ==')).toBeNull()
    expect(typeDataUrl('')).toBeNull()
    const binaire = decoderDataUrl(PNG)!
    expect(binaire.type).toBe('image/png')
    expect([...binaire.octets.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(encoderDataUrl(binaire.type, binaire.octets)).toBe(PNG)
    expect(encoderDataUrl('image/jpeg', decoderDataUrl(JPEG)!.octets)).toBe(JPEG)
    expect(decoderDataUrl('data:image/png;base64,@@@')).toBeNull()
  })

  it('encode aussi une grande image (plusieurs tranches)', () => {
    const octets = new Uint8Array(200_000).map((_, i) => (i * 7) % 256)
    const image = encoderDataUrl('image/png', octets)
    expect(decoderDataUrl(image)!.octets).toEqual(octets)
  })

  it('range chaque fichier sous le chantier, nommé par son empreinte', () => {
    expect(cheminFond('chantier-1', 'abc', 'image/png')).toBe('chantier-1/abc.png')
    expect(cheminFond('chantier-1', 'abc', 'image/jpeg')).toBe('chantier-1/abc.jpg')
    expect(typeDuChemin('chantier-1/abc.jpg')).toBe('image/jpeg')
    expect(typeDuChemin('chantier-1/abc.png')).toBe('image/png')
  })

  it('compte une seule fois une image utilisée par un plan et son synoptique', () => {
    expect(imagesDuChantier(chantierAvecFonds())).toEqual([PNG, JPEG])
  })

  it('retire les images du chantier et ne les envoie qu’une fois', () => {
    const c = chantierAvecFonds()
    const { donnees, fichiers } = extraireFonds(c, EMPREINTES)
    expect(fichiers).toEqual([
      { empreinte: 'a'.repeat(64), chemin: `chantier-1/${'a'.repeat(64)}.png`, image: PNG },
      { empreinte: 'b'.repeat(64), chemin: `chantier-1/${'b'.repeat(64)}.jpg`, image: JPEG },
    ])
    const texte = JSON.stringify(donnees)
    expect(texte).not.toContain('data:image')
    expect(donnees.format).toBe(FORMAT_CHANTIER)
    expect(donnees.version).toBe(VERSION_CHANTIER)
    expect(referencesDe(donnees).map((r) => r.chemin)).toEqual(fichiers.map((f) => f.chemin))
    // Le chantier d'origine n'est pas touché.
    expect(c.plans[0].projet.fond?.image).toBe(PNG)
  })

  it('remet les images en place : le chantier revient identique', () => {
    const c = chantierAvecFonds()
    const { donnees } = extraireFonds(c, EMPREINTES)
    // La base réordonne les clés : on relit un JSON dont les clés sont triées.
    const relu = reinjecterFonds(JSON.parse(canonique(donnees)), new Map([...EMPREINTES].map(([image, e]) => [e, image])))
    expect(relu.ok).toBe(true)
    expect(relu.manquants).toEqual([])
    const texte = (x: Chantier) => canonique(JSON.parse(serialiserChantier(x)))
    if (relu.ok) expect(texte(relu.chantier)).toBe(texte(c))
  })

  it('laisse vide un fond introuvable, et le signale', () => {
    const { donnees } = extraireFonds(chantierAvecFonds(), EMPREINTES)
    const relu = reinjecterFonds(donnees, new Map([['a'.repeat(64), PNG]]))
    expect(relu.ok).toBe(true)
    expect(relu.manquants.map((m) => m.empreinte)).toEqual(['b'.repeat(64)])
    if (relu.ok) {
      expect(relu.chantier.plans[1].projet.fond?.image).toBe('')
      expect(relu.chantier.synoptiques[0].fond?.image).toBe(PNG)
    }
  })

  it('refuse des données illisibles avec un message en français', () => {
    const relu = reinjecterFonds({ format: FORMAT_CHANTIER, version: VERSION_CHANTIER, id: 'x' }, new Map())
    expect(relu.ok).toBe(false)
  })

  it('n’efface que les fichiers qui ne servent plus depuis plus d’un jour', () => {
    const jour = 24 * 3600 * 1000
    const maintenant = Date.parse('2026-09-30T12:00:00Z')
    const fichiers = [
      { chemin: 'c/garde.png', creeLe: '2026-09-01T00:00:00Z' },
      { chemin: 'c/vieux.png', creeLe: '2026-09-01T00:00:00Z' },
      { chemin: 'c/recent.png', creeLe: '2026-09-30T11:00:00Z' },
      { chemin: 'c/sans-date.png', creeLe: null },
    ]
    expect(fondsInutiles(fichiers, new Set(['c/garde.png']), maintenant, jour)).toEqual(['c/vieux.png'])
  })
})

describe('synchronisation : qui est plus récent, conflit, à envoyer, à récupérer', () => {
  const v = (version: number) => ({ version })

  it('décide d’après la version en ligne et les modifications de ce navigateur', () => {
    expect(decider(null, null)).toBe('rien')
    expect(decider(null, v(3))).toBe('recuperer')
    expect(decider({ base: null, aEnvoyer: true }, null)).toBe('envoyer')
    expect(decider({ base: null, aEnvoyer: true }, v(1))).toBe('comparer')
    expect(decider({ base: 3, aEnvoyer: false }, v(3))).toBe('aJour')
    expect(decider({ base: 3, aEnvoyer: true }, v(3))).toBe('envoyer')
    expect(decider({ base: 3, aEnvoyer: false }, v(5))).toBe('recuperer')
    expect(decider({ base: 3, aEnvoyer: true }, v(5))).toBe('conflit')
    expect(decider({ base: 3, aEnvoyer: true }, null)).toBe('recreer')
    expect(decider({ base: 3, aEnvoyer: false }, null)).toBe('supprimerLocal')
  })

  it('compare deux contenus quel que soit l’ordre des clés, sans la date', () => {
    expect(canonique({ b: 1, a: [{ d: 2, c: null }] })).toBe('{"a":[{"c":null,"d":2}],"b":1}')
    expect(memeContenu({ a: 1, b: { c: 2 }, modifieLe: 'x' }, { b: { c: 2 }, a: 1, modifieLe: 'y' })).toBe(true)
    expect(memeContenu({ a: 1 }, { a: 2 })).toBe(false)
    const { donnees } = extraireFonds(chantierAvecFonds(), EMPREINTES)
    expect(memeContenu(donnees, JSON.parse(canonique(donnees)))).toBe(true)
  })

  it('garde la version de ce navigateur sous un autre nom', () => {
    const c = chantierAvecFonds()
    const copie = copieDeCeNavigateur(c, 'chantier-autre', [c.nom])
    expect(copie.id).toBe('chantier-autre')
    expect(copie.nom).toBe(`${c.nom} (copie de ce navigateur)`)
    expect(copie.plans).toBe(c.plans)
    expect(copieDeCeNavigateur(c, 'z', [c.nom, `${c.nom} (copie de ce navigateur)`]).nom).toBe(`${c.nom} (copie de ce navigateur) 2`)
  })

  it('annonce la reprise des chantiers du navigateur', () => {
    expect(messageReprise(0, [])).toBeNull()
    expect(messageReprise(1, [])).toBe('1 chantier de ce navigateur a été mis en ligne.')
    expect(messageReprise(3, [])).toBe('3 chantiers de ce navigateur ont été mis en ligne.')
    expect(messageReprise(0, ['OCP (copie de ce navigateur)'])).toContain('« OCP (copie de ce navigateur) »')
  })

  it('dit qui a modifié le chantier, et quand', () => {
    const maintenant = new Date(2026, 8, 30, 16, 0)
    expect(momentLisible(new Date(2026, 8, 30, 14, 32).toISOString(), maintenant)).toBe("aujourd'hui à 14h32")
    expect(momentLisible(new Date(2026, 8, 29, 9, 5).toISOString(), maintenant)).toBe('hier à 09h05')
    expect(momentLisible(new Date(2026, 8, 2, 7, 0).toISOString(), maintenant)).toBe('le 02/09/2026 à 07h00')
    const le = new Date(2026, 8, 30, 14, 32).toISOString()
    expect(texteConflit('paul@exemple.fr', le, 'moi@exemple.fr', maintenant)).toBe(
      "Ce chantier a été modifié par paul@exemple.fr aujourd'hui à 14h32, pendant que vous le modifiiez ici.",
    )
    expect(texteConflit('Moi@Exemple.fr', le, 'moi@exemple.fr', maintenant)).toContain('par vous, depuis une autre fenêtre')
    expect(detailsLigne({ nbPlans: 2, nbSynoptiques: 1, modifieLe: le, modifiePar: 'paul@exemple.fr' }, maintenant)).toBe(
      "2 plans · 1 synoptique · modifié par paul@exemple.fr aujourd'hui à 14h32",
    )
  })

  it('liste les chantiers en ligne et ceux de ce navigateur pas encore envoyés', () => {
    const c = chantierAvecFonds()
    const enLigne: EnteteEnLigne[] = [
      { id: 'chantier-1', nom: 'En ligne', version: 2, modifieLe: '2026-09-30T10:00:00Z', modifiePar: 'a@b.fr', nbPlans: 1, nbSynoptiques: 0 },
    ]
    const nouveau = { ...c, id: 'chantier-neuf', nom: 'Créé hors ligne', modifieLe: '2026-09-30T11:00:00Z' }
    const lignes = lignesAccueil(enLigne, [
      { chantier: c, meta: { id: c.id, base: 2, aEnvoyer: true, fonds: [] } },
      { chantier: nouveau, meta: null },
    ])
    expect(lignes.map((l) => [l.nom, l.pasEncoreEnLigne])).toEqual([
      ['Créé hors ligne', true],
      ['En ligne', false],
    ])
  })

  it('n’accepte en ligne que des identifiants simples', () => {
    expect(identifiantEnLigneValide('chantier-1')).toBe(true)
    expect(identifiantEnLigneValide('chantier-k3f9x2qa')).toBe(true)
    expect(identifiantEnLigneValide('chantier/à é')).toBe(false)
    expect(identifiantEnLigneValide('')).toBe(false)
  })

  it('donne à chaque nouveau chantier un identifiant unique pour toute l’équipe', () => {
    const suite = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    let i = 0
    const id = identifiantChantierUnique([], () => suite[i++ % suite.length])
    expect(id).toMatch(/^chantier-[0-9a-z]{8}$/)
    expect(identifiantEnLigneValide(id)).toBe(true)
    // Toujours le même tirage, déjà pris : on retombe sur un numéro libre.
    expect(identifiantChantierUnique([id], () => 0.1)).not.toBe(id)
  })
})

describe('erreurs de la mémoire en ligne, en français', () => {
  it('distingue hors ligne, serveur injoignable (pause), session et droits', () => {
    expect(classerErreur({ message: 'TypeError: Failed to fetch' }, false)).toBe('horsLigne')
    expect(classerErreur({ message: 'TypeError: Failed to fetch' }, true)).toBe('injoignable')
    expect(classerErreur({ name: 'AuthRetryableFetchError', status: 0 }, true)).toBe('injoignable')
    expect(classerErreur({ status: 540, message: 'Project paused' }, true)).toBe('injoignable')
    expect(classerErreur({ status: 503 }, true)).toBe('injoignable')
    expect(classerErreur({ status: 401, message: 'JWT expired' }, true)).toBe('session')
    expect(classerErreur({ code: '42501', message: 'new row violates row-level security policy' }, true)).toBe('droits')
    expect(classerErreur({ code: '23505' }, true)).toBe('autre')
    expect(messageErreurEnLigne('injoignable')).toBe(MESSAGE_PAUSE)
    expect(MESSAGE_PAUSE).toContain('Restore project')
    expect(messageErreurEnLigne('horsLigne')).toBe('Hors ligne — enregistré dans ce navigateur seulement, envoi dès le retour de la connexion')
  })

  it('explique les refus de connexion et de création de compte', () => {
    expect(messageCompte({ status: 500, code: 'unexpected_failure', message: 'Database error saving new user' }, true)).toBe(MESSAGE_NON_INVITE)
    // Tel que la bibliothèque d'Auth le transmet vraiment (erreur 500 « à réessayer »).
    expect(messageCompte({ name: 'AuthRetryableFetchError', status: 500, message: 'Database error saving new user' }, true)).toBe(MESSAGE_NON_INVITE)
    expect(classerErreur({ name: 'AuthRetryableFetchError', status: 500, message: 'Database error saving new user' }, true)).toBe('autre')
    expect(MESSAGE_NON_INVITE).toBe("Cette adresse n'a pas été invitée. Demandez à un membre de l'équipe de vous inviter.")
    expect(messageCompte({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }, true)).toBe('Adresse ou mot de passe incorrect.')
    expect(messageCompte({ code: 'email_not_confirmed' }, true)).toContain('pas encore confirmée')
    expect(messageCompte({ code: 'user_already_exists' }, true)).toContain('Un compte existe déjà')
    expect(messageCompte({ code: 'weak_password', message: 'Password should be at least 6 characters.' }, true)).toContain('trop faible')
    expect(messageCompte({ status: 429, code: 'over_email_send_rate_limit' }, true)).toContain('Trop de tentatives')
    expect(messageCompte({ code: 'email_address_not_authorized', message: 'Email address not authorized' }, true)).toContain('SMTP')
    expect(messageCompte({ message: 'Failed to fetch' }, false)).toContain('Pas de connexion')
    expect(messageCompte({ message: 'Failed to fetch' }, true)).toBe(MESSAGE_PAUSE)
    expect(adresseValide(' prenom.nom@entreprise.fr ')).toBe(true)
    expect(adresseValide('prenom.nom')).toBe(false)
  })
})

describe('configuration : adresse du projet et clé publique seulement', () => {
  const URL_PROJET = 'https://exemple.supabase.co'

  it('lit l’adresse et la clé publique', () => {
    expect(lireConfiguration({ VITE_SUPABASE_URL: `${URL_PROJET}/`, VITE_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_essai ' })).toEqual({
      ok: true,
      configuration: { url: URL_PROJET, cle: 'sb_publishable_essai' },
    })
  })

  it('sans variables, on travaille dans ce navigateur', () => {
    expect(lireConfiguration({})).toEqual({ ok: false, raison: 'absente' })
    expect(lireConfiguration({ VITE_SUPABASE_URL: URL_PROJET })).toEqual({ ok: false, raison: 'invalide' })
    expect(lireConfiguration({ VITE_SUPABASE_URL: 'pas une adresse', VITE_SUPABASE_PUBLISHABLE_KEY: 'x' })).toEqual({ ok: false, raison: 'invalide' })
    expect(messageConfiguration('absente')).toBeNull()
  })

  it('refuse une clé secrète', () => {
    expect(lireConfiguration({ VITE_SUPABASE_URL: URL_PROJET, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_essai' })).toEqual({ ok: false, raison: 'cleSecrete' })
    const charge = btoa(JSON.stringify({ role: 'service_role' })).replace(/=+$/, '')
    expect(lireConfiguration({ VITE_SUPABASE_URL: URL_PROJET, VITE_SUPABASE_PUBLISHABLE_KEY: `eyJ.${charge}.sig` })).toEqual({ ok: false, raison: 'cleSecrete' })
    const anon = btoa(JSON.stringify({ role: 'anon' })).replace(/=+$/, '')
    expect(lireConfiguration({ VITE_SUPABASE_URL: URL_PROJET, VITE_SUPABASE_PUBLISHABLE_KEY: `eyJ.${anon}.sig` }).ok).toBe(true)
    expect(messageConfiguration('cleSecrete')).toContain('SECRÈTE')
  })
})

describe('page « Équipe »', () => {
  it('a son adresse, sans chantier à qui revenir en cas d’erreur', () => {
    expect(lireAdresse('#/equipe')).toEqual({ ecran: 'equipe' })
    expect(ecrireAdresse({ ecran: 'equipe' })).toBe('#/equipe')
    expect(cleEcran({ ecran: 'equipe' })).toBe('equipe')
    expect(retoursApresErreur({ ecran: 'equipe' })).toEqual({ chantier: null, accueil: { ecran: 'accueil' } })
  })
})
