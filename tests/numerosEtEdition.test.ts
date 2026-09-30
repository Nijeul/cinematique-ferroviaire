import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { migrerChantier, type Chantier } from '../src/plan/chantier.ts'
import { actionToucheEdition, modifierCommentairesImage, validerTexteCommentaire } from '../src/plan/commentaires.ts'
import { lireChantier, serialiserChantier, VERSION_CHANTIER } from '../src/plan/fichierChantier.ts'
import { annuler, creerHistorique, enregistrer } from '../src/plan/historique.ts'
import { entreesLegende, listesDe, texteEntree } from '../src/plan/legende.ts'
import { miseEnPage } from '../src/plan/planche.ts'
import { enginsAffiches, modifierNumerosEngins } from '../src/plan/numerosEngins.ts'
import { creerProjet } from '../src/plan/projet.ts'
import { creerSynoptique, nouvelleImage, type Synoptique } from '../src/plan/synoptique.ts'

// Compléments de l'étape 10 : numéros des engins sur l'image (« il ne faut
// pas afficher les numéros des pelles dans les bulles, c'est pas lisible ») et
// modification d'un commentaire en cliquant dessus. Données fictives.

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const synoptique = (c: Chantier, id: string): Synoptique => c.synoptiques.find((s) => s.id === id)!
const avecImage0 = (s: Synoptique, transformer: (c: Synoptique['images'][number]['contenu']) => Synoptique['images'][number]['contenu']): Synoptique => ({
  ...s,
  images: s.images.map((im, i) => (i === 0 ? { ...im, contenu: transformer(im.contenu) } : im)),
})

describe('numéros des engins sur l’image', () => {
  it('par défaut, affichés (nouveaux synoptiques et synoptiques existants)', () => {
    const neuf = creerSynoptique('s', { nom: 'Essai', t0: '2026-10-09T22:00', fin: 480, cadrage: null }, { id: 'plan-1', projet: creerProjet('P') }, '2026-09-30T10:00:00Z')
    expect(neuf.numerosEngins).toBe(true)
    for (const s of fixture().synoptiques) expect(s.numerosEngins).toBe(true)
  })

  it('décochés : engins et rames dessinés sans numéro, données intactes ; recochés : tout revient', () => {
    const avant = synoptique(fixture(), 'synoptique-1')
    const contenu = avant.images[0].contenu
    expect(enginsAffiches(avant, contenu)).toBe(contenu)
    const s = modifierNumerosEngins(avant, false)
    const dessines = enginsAffiches(s, contenu)
    expect(dessines.engins.map((e) => e.numero)).toEqual(['', '', ''])
    expect(dessines.rames.map((r) => r.numero)).toEqual([''])
    // Le reste des engins ne change pas, et les numéros restent enregistrés.
    expect(dessines.engins.map((e) => ({ ...e, numero: '' }))).toEqual(contenu.engins.map((e) => ({ ...e, numero: '' })))
    expect(s.images[0].contenu.engins.map((e) => e.numero)).toEqual(['', '3', 'P4'])
    expect(s.images).toBe(avant.images)
    expect(modifierNumerosEngins(s, true)).toEqual(avant)
    expect(modifierNumerosEngins(avant, true)).toBe(avant)
    // « Nouvelle image » garde le réglage.
    expect(nouvelleImage(s, 0).synoptique.numerosEngins).toBe(false)
  })

  it('légende sans numéro, descriptions gardées ; deux descriptions différentes : deux lignes', () => {
    const c = fixture()
    const listes = listesDe(c)
    const avant = synoptique(c, 'synoptique-3')
    const lignes = (s: Synoptique) => entreesLegende(s, 0, listes).filter((e) => e.genre === 'engin' || e.genre === 'rame')
    expect(lignes(avant).map(texteEntree)).toEqual(
      expect.arrayContaining(['1 — Pelle RR déballastage', '2 — Pelle RR chargement des déblais', '3 — BML 08-32U']),
    )
    const s = modifierNumerosEngins(avant, false)
    const sans = lignes(s)
    expect(sans.every((e) => (e.genre === 'engin' || e.genre === 'rame') && e.numero === '')).toBe(true)
    expect(sans.map(texteEntree)).toEqual(expect.arrayContaining(['Pelle RR déballastage', 'Pelle RR chargement des déblais', 'BML 08-32U']))
    expect(sans.map(texteEntree).some((t) => /^\d/.test(t))).toBe(false)
    // Deux pelles de même description : une seule ligne « ×2 ».
    const memes = avecImage0(s, (co) => ({ ...co, engins: co.engins.map((e) => (e.id === 'engin-2' ? { ...e, description: 'déballastage' } : e)) }))
    expect(lignes(memes).map(texteEntree)).toContain('Pelle RR ×2 déballastage')
    // La planche (et les exports) suit la même légende.
    const page = miseEnPage(s, 0, listes)
    expect((page.legende?.entrees ?? []).some((e) => (e.entree.genre === 'engin' || e.entree.genre === 'rame') && e.entree.numero !== '')).toBe(false)
  })
})

describe('fichier et navigateur : numéros des engins', () => {
  it('reste en version 6 ; se relit ; absent : affichés', () => {
    expect(VERSION_CHANTIER).toBe(6)
    const c = fixture()
    const s = modifierNumerosEngins(synoptique(c, 'synoptique-3'), false)
    const lu = lireChantier(serialiserChantier({ ...c, synoptiques: c.synoptiques.map((x) => (x.id === s.id ? s : x)) }))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(synoptique(lu.chantier, 'synoptique-3').numerosEngins).toBe(false)
    expect(synoptique(lu.chantier, 'synoptique-1').numerosEngins).toBe(true)
    const brut = JSON.parse(texteFixture)
    brut.synoptiques[0].numerosEngins = 'non'
    const lu2 = lireChantier(JSON.stringify(brut))
    expect(lu2.ok && lu2.chantier.synoptiques[0].numerosEngins).toBe(true)
  })

  it('un chantier gardé dans le navigateur sans ce réglage : numéros affichés ; décochés : gardés', () => {
    const ancien = JSON.parse(JSON.stringify(fixture()))
    for (const s of ancien.synoptiques) delete s.numerosEngins
    for (const s of migrerChantier(ancien).chantier.synoptiques) expect(s.numerosEngins).toBe(true)
    ancien.synoptiques[2].numerosEngins = false
    expect(migrerChantier(ancien).chantier.synoptiques[2].numerosEngins).toBe(false)
  })
})

describe('modifier un commentaire sur l’image', () => {
  it('Entrée valide, Maj+Entrée va à la ligne, Échap annule, le reste s’écrit', () => {
    expect(actionToucheEdition('Enter', false)).toBe('valider')
    expect(actionToucheEdition('Enter', true)).toBe('aLaLigne')
    expect(actionToucheEdition('Escape', false)).toBe('annuler')
    for (const t of ['t', 'T', 'Delete', 'Backspace', 'z', ' ', 'ArrowLeft']) expect(actionToucheEdition(t, false)).toBeNull()
  })

  it('valide le texte en une seule étape d’annulation ; rien si le texte n’a pas changé', () => {
    const s0 = synoptique(fixture(), 'synoptique-4')
    const [c] = s0.images[0].contenu.commentaires
    const liste = s0.images[0].contenu.commentaires
    expect(validerTexteCommentaire(liste, c.id, c.texte)).toBe(liste)
    expect(validerTexteCommentaire(liste, 'commentaire-99', 'x')).toBe(liste)
    const texte = 'RCT en place\nconnexions 40 m'
    const nouvelle = validerTexteCommentaire(liste, c.id, texte)
    expect(nouvelle.find((x) => x.id === c.id)).toEqual({ ...c, texte })
    expect(nouvelle.filter((x) => x.id !== c.id)).toEqual(liste.filter((x) => x.id !== c.id))
    let h = creerHistorique(s0)
    h = enregistrer(h, modifierCommentairesImage(s0, 0, (l) => validerTexteCommentaire(l, c.id, texte)))
    expect(h.present.images[0].contenu.commentaires.find((x) => x.id === c.id)?.texte).toBe(texte)
    // Les autres images ne changent pas.
    expect(h.present.images[1]).toBe(s0.images[1])
    h = annuler(h)
    expect(h.present).toBe(s0)
    // Texte inchangé : aucune étape.
    expect(modifierCommentairesImage(s0, 0, (l) => validerTexteCommentaire(l, c.id, c.texte))).toBe(s0)
  })
})
