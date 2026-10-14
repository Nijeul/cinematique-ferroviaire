import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Chantier } from '../src/plan/chantier.ts'
import { lireChantier } from '../src/plan/fichierChantier.ts'
import { annuler, creerHistorique, enregistrer } from '../src/plan/historique.ts'
import { listesDe } from '../src/plan/legende.ts'
import { miseEnPage, modifierCreneau } from '../src/plan/planche.ts'
import type { Synoptique } from '../src/plan/synoptique.ts'
import { formaterPlage, lireHeuresTapees, lirePlageTapee } from '../src/plan/temps.ts'
import { appliquerHeures, champEdition, texteDe, texteMultiligne, verifierTexte } from '../src/plan/textesPlanche.ts'

// Les heures du créneau tapées sur la planche (« Oui, on peut modifier les
// heures sur l'image, c'est bien aussi ») : saisie souple, en français ; le
// temps reste en minutes depuis T0. Données fictives.

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const c = fixture()
const listes = listesDe(c)
const synoptique = (id: string): Synoptique => c.synoptiques.find((s) => s.id === id)!
// T0 : vendredi 23 octobre 2026, 22h30 ; 8 h ; image 1 de 0 à 180 (Ve 22h30 → Ve/Sa 01h30).
const s3 = synoptique('synoptique-3')
const T0 = s3.t0
const plage = (texte: string, actuel = { debut: 0, fin: 180 }, debutSeul = false) => lirePlageTapee(T0, texte, actuel, debutSeul)
const valeur = <T,>(r: { ok: true; valeur: T } | { ok: false; erreur: string }): T => {
  if (!r.ok) throw new Error(r.erreur)
  return r.valeur
}
const erreur = (r: { ok: boolean; erreur?: string }): string => (r.ok ? '' : (r.erreur ?? ''))

describe('heures tapées : formats acceptés', () => {
  it('tiret, tiret long, flèche, « à », espace, deux-points, heure sans minutes', () => {
    for (const t of ['23h15 – 00h35', '23h15-00h35', '23h15 — 00h35', '23h15 → 00h35', '23h15 à 00h35', '23:15 00:35', '23h15 00h35', ' 23 h 15 - 0h35 '])
      expect(valeur(plage(t))).toEqual({ debut: 45, fin: 125 })
    expect(valeur(plage('23h – 1h'))).toEqual({ debut: 30, fin: 150 })
  })

  it('avec les jours : abrégés ou entiers, « Ve/Sa » vaut samedi (la nuit), comme sur les planches', () => {
    expect(valeur(plage('Ve 22h30 – Sa 01h15'))).toEqual({ debut: 0, fin: 165 })
    expect(valeur(plage('vendredi 22h30 à samedi 1h15'))).toEqual({ debut: 0, fin: 165 })
    expect(valeur(plage('Ve/Sa 00h30 – 03h30'))).toEqual({ debut: 120, fin: 300 })
    expect(lireHeuresTapees('Ve/Sa 00h30 – 03h30')).toEqual({
      ok: true,
      valeur: [
        { jour: 6, heures: 0, minutes: 30 },
        { jour: null, heures: 3, minutes: 30 },
      ],
    })
  })

  it('le texte affiché se relit tel quel', () => {
    expect(texteDe(s3, 0, { genre: 'heures' })).toBe('Ve 22h30 – Ve/Sa 01h30')
    expect(valeur(plage('Ve 22h30 – Ve/Sa 01h30'))).toEqual({ debut: 0, fin: 180 })
    expect(texteDe(s3, 1, { genre: 'heures' })).toBe('Ve/Sa 01h30 – 04h30')
    expect(valeur(plage('Ve/Sa 01h30 – 04h30', { debut: 180, fin: 360 }))).toEqual({ debut: 180, fin: 360 })
    expect(verifierTexte(s3, 1, { genre: 'heures' }, 'Ve/Sa 01h30 – 04h30')).toEqual({ ok: true, valeur: s3 })
  })
})

describe('heures tapées : passage de minuit, plusieurs jours, début seul', () => {
  it('passage de minuit : la fin est la première fois que l’heure revient après le début', () => {
    expect(valeur(plage('22h30 – 01h15'))).toEqual({ debut: 0, fin: 165 })
    expect(formaterPlage(T0, 0, 165)).toBe('Ve 22h30 → Ve/Sa 01h15')
    // Sans jour, le début est l'heure la plus proche du début actuel de l'image.
    expect(valeur(plage('00h30 – 03h30'))).toEqual({ debut: 120, fin: 300 })
  })

  it('synoptique de plusieurs jours : le jour choisit la bonne nuit', () => {
    const s1 = synoptique('synoptique-1') // Ve 22h30, 56 h
    const derniere = s1.images[2] // de 360 à 3360
    const lu = valeur(lirePlageTapee(s1.t0, 'Sa 05h00 – Di 08h00', derniere, false))
    expect(lu).toEqual({ debut: 390, fin: 2010 })
    expect(formaterPlage(s1.t0, lu.debut, lu.fin)).toBe('Ve/Sa 05h00 → Di 08h00')
    expect(valeur(lirePlageTapee(s1.t0, 'Sa 22h30 – Lu 06h00', derniere, false))).toEqual({ debut: 1440, fin: 3330 })
    const r = appliquerHeures(s1, 2, 'Sa 22h30 – Lu 06h00')
    expect(r.ok && r.valeur.images[2]).toMatchObject({ debut: 1440, fin: 3330 })
  })

  it('créneau qui n’affiche que le début : une seule heure suffit, la fin ne change pas', () => {
    const s2 = synoptique('synoptique-2')
    expect(s2.images[3].heures).toBe('debut')
    expect(texteDe(s2, 3, { genre: 'heures' })).toBe('Ve/Sa 04h30')
    const r = appliquerHeures(s2, 3, '04h45')
    expect(r.ok && r.valeur.images[3]).toMatchObject({ debut: 375, fin: s2.images[3].fin })
    // Ailleurs, le début et la fin sont demandés.
    expect(erreur(plage('22h30'))).toContain('Indiquez le début et la fin')
  })
})

describe('heures tapées : refus, avec un message clair', () => {
  it('fin avant début, hors du synoptique : refusé, avec ce qui a été compris', () => {
    const avant = appliquerHeures(s3, 0, 'Sa 01h15 – Ve 22h30')
    expect(erreur(avant)).toBe("La fin de l'image doit être après son début. Compris : Ve/Sa 01h15 → Ve 22h30.")
    expect(erreur(appliquerHeures(s3, 0, '20h00 – 23h00'))).toContain("L'image ne peut pas commencer avant le début du synoptique (Ve 22h30)")
    expect(erreur(appliquerHeures(s3, 0, '23h00 – 07h00'))).toContain("L'image ne peut pas finir après la fin du synoptique (Sa 06h30). Compris : Ve 23h00 → Sa 07h00.")
  })

  it('texte illisible, heure impossible, jours qui ne se suivent pas, vide', () => {
    expect(erreur(plage('bientôt'))).toContain('Heures illisibles : « bientôt »')
    expect(erreur(plage('22h30 – 01h15 environ'))).toContain('Heures illisibles')
    expect(erreur(plage('22h30 – 01h15 – 02h00'))).toContain('Heures illisibles')
    expect(erreur(plage('2230 – 0115'))).toContain('Heures illisibles')
    expect(erreur(plage('25h00 – 02h00'))).toBe('Heure impossible : « 25h00 » (de 00h00 à 23h59).')
    expect(erreur(plage('22h75 – 02h00'))).toContain('Heure impossible')
    expect(erreur(plage('Ve/Lu 01h00 – 02h00'))).toContain('« Ve/Lu » : écrivez deux jours qui se suivent')
    expect(erreur(plage('  '))).toContain('Indiquez les heures')
  })
})

describe('heures tapées sur la planche', () => {
  it('une seule étape d’annulation, en minutes depuis T0 ; texte inchangé : rien', () => {
    let h = creerHistorique(s3)
    const r = verifierTexte(s3, 0, { genre: 'heures' }, '22h45 – 01h15')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    h = enregistrer(h, r.valeur)
    expect(h.present.images[0]).toMatchObject({ debut: 15, fin: 165 })
    expect(h.present.images[1]).toBe(s3.images[1])
    expect(miseEnPage(h.present, 0, listes).creneau.lignes.map((l) => l.texte)).toEqual(['Ve 22h45 –', 'Ve/Sa 01h15'])
    h = annuler(h)
    expect(h.present).toBe(s3)
    // Même plage écrite autrement : rien à annuler.
    expect(verifierTexte(s3, 0, { genre: 'heures' }, '22h30-01h30')).toEqual({ ok: true, valeur: s3 })
  })

  it('refusé : rien ne change ; une ligne seulement ; caché quand le créneau ne montre pas les heures', () => {
    expect(verifierTexte(s3, 0, { genre: 'heures' }, 'n’importe quoi').ok).toBe(false)
    expect(texteMultiligne({ genre: 'heures' })).toBe(false)
    const sansHeures = modifierCreneau(s3, 0, { titre: 'Phase 1', heures: 'aucune' })
    expect(texteDe(sansHeures, 0, { genre: 'heures' })).toBeNull()
  })

  it('le champ couvre les heures, sous le titre', () => {
    const s = modifierCreneau(s3, 0, { titre: 'Phase 1' })
    const page = miseEnPage(s, 0, listes)
    const champ = champEdition(s, 0, listes, { genre: 'heures' }, texteDe(s, 0, { genre: 'heures' })!)!
    expect(champ.boite.y).toBeGreaterThan(page.creneau.lignes[0].y)
    expect(champ.boite.y).toBeLessThan(page.creneau.lignes[1].y)
    // Sous un titre, les heures sont en maigre, comme sur la planche.
    expect(champ).toMatchObject({ gras: false, multiligne: false, centre: true })
  })
})
