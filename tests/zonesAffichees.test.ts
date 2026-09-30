import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { migrerChantier, type Chantier } from '../src/plan/chantier.ts'
import { zoneSousPointeur } from '../src/plan/detection.ts'
import { lireChantier, serialiserChantier, VERSION_CHANTIER } from '../src/plan/fichierChantier.ts'
import { entreesLegende, legendeAffichee, listesDe } from '../src/plan/legende.ts'
import { miseEnPage } from '../src/plan/planche.ts'
import { creerProjet } from '../src/plan/projet.ts'
import { creerSynoptique, nouvelleImage, projetDeImage, type Synoptique } from '../src/plan/synoptique.ts'
import { pointAAbscisse } from '../src/plan/trace.ts'
import { afficherToutesLesZones, afficherZone, texteZonesAffichees, zoneAffichee, zonesDuSynoptique, zonesVisibles } from '../src/plan/zonesAffichees.ts'

// Complément de l'étape 10 : masquer ou afficher des zones dans un synoptique
// (« je me fiche de voir les RVB des zones que je ne traite pas dans ce
// synoptique »). Données fictives.

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const synoptique = (c: Chantier, id: string): Synoptique => c.synoptiques.find((s) => s.id === id)!
const ids = (zones: { id: string }[]) => zones.map((z) => z.id)

describe('zones affichées d’un synoptique', () => {
  it('par défaut, toutes les zones sont affichées (synoptiques existants inchangés)', () => {
    const c = fixture()
    for (const s of c.synoptiques) {
      expect(s.zonesMasquees).toEqual([])
      for (const im of s.images) expect(ids(projetDeImage(s, im).zones)).toEqual(ids(im.contenu.zones))
    }
    const neuf = creerSynoptique('s', { nom: 'Essai', t0: '2026-10-09T22:00', fin: 480, cadrage: null }, { id: 'plan-1', projet: creerProjet('P') }, '2026-09-30T10:00:00Z')
    expect(neuf.zonesMasquees).toEqual([])
  })

  it('liste les zones du plan figé avec leur voie, dans l’ordre du plan', () => {
    const s = synoptique(fixture(), 'synoptique-4')
    const zones = zonesDuSynoptique(s)
    expect(zones.map((z) => z.zone.nom)).toEqual(['RVB 50 m', 'RR 14 m', 'RVB 63 m', 'RVB 41 m'])
    expect(zones.every((z) => z.affichee)).toBe(true)
    expect(zones.every((z) => z.voie !== '')).toBe(true)
    expect(texteZonesAffichees(s)).toBe('les 4 zones sont affichées')
  })

  it('une zone masquée disparaît de toutes les images, sans perdre son état ni ses coupes', () => {
    const avant = synoptique(fixture(), 'synoptique-4')
    const s = afficherZone(avant, 'zone-1', false)
    expect(zoneAffichee(s, 'zone-1')).toBe(false)
    expect(texteZonesAffichees(s)).toBe('3 sur 4 affichées')
    for (const im of s.images) {
      expect(ids(projetDeImage(s, im).zones)).toEqual(['zone-2', 'zone-3', 'zone-4'])
      // Les données restent dans l'image.
      expect(im.contenu.zones.some((z) => z.id === 'zone-1')).toBe(true)
    }
    expect(s.images).toBe(avant.images)
    expect(s.images[0].contenu.etatsZones['zone-1']).toEqual(avant.images[0].contenu.etatsZones['zone-1'])
    expect(s.images[0].contenu.coupes['zone-1']).toBe(6)
    // Réaffichée : tout revient.
    const apres = afficherZone(s, 'zone-1', true)
    expect(apres).toEqual(avant)
    expect(ids(projetDeImage(apres, apres.images[0]).zones)).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4'])
    // Rien ne change si la zone est déjà dans l'état demandé.
    expect(afficherZone(avant, 'zone-1', true)).toBe(avant)
  })

  it('« Tout masquer » puis « Tout afficher »', () => {
    const avant = synoptique(fixture(), 'synoptique-4')
    const masque = afficherToutesLesZones(avant, false)
    expect(masque.zonesMasquees).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4'])
    expect(texteZonesAffichees(masque)).toBe('0 sur 4 affichée')
    for (const im of masque.images) expect(projetDeImage(masque, im).zones).toEqual([])
    expect(afficherToutesLesZones(masque, false)).toBe(masque)
    const affiche = afficherToutesLesZones(masque, true)
    expect(affiche.zonesMasquees).toEqual([])
    expect(afficherToutesLesZones(avant, true)).toBe(avant)
  })

  it('filtre une liste de zones en gardant l’ordre', () => {
    const zones = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(zonesVisibles({ zonesMasquees: [] }, zones)).toBe(zones)
    expect(ids(zonesVisibles({ zonesMasquees: ['b'] }, zones))).toEqual(['a', 'c'])
  })

  it('une zone masquée ne se choisit plus en cliquant sur l’image', () => {
    const avant = synoptique(fixture(), 'synoptique-4')
    const image = avant.images[0]
    const zone = image.contenu.zones.find((z) => z.id === 'zone-1')!
    const voie = image.contenu.voies.find((v) => v.id === zone.voieId)!
    const { point } = pointAAbscisse(voie.points, (zone.debut + zone.fin) / 2)
    expect(zoneSousPointeur(projetDeImage(avant, image), point, 4)).toBe('zone-1')
    const s = afficherZone(avant, 'zone-1', false)
    expect(zoneSousPointeur(projetDeImage(s, s.images[0]), point, 4)).not.toBe('zone-1')
  })

  it('« Nouvelle image » garde le réglage (il vaut pour tout le synoptique)', () => {
    const s = afficherZone(synoptique(fixture(), 'synoptique-4'), 'zone-3', false)
    const r = nouvelleImage(s, 0)
    const nouvelle = r.synoptique.images[r.index]
    expect(ids(projetDeImage(r.synoptique, nouvelle).zones)).not.toContain('zone-3')
    expect(nouvelle.contenu.zones.some((z) => z.id === 'zone-3')).toBe(true)
  })
})

describe('légende sans les zones masquées', () => {
  it('ni l’état, ni les coupes d’une zone masquée', () => {
    const c = fixture()
    const listes = listesDe(c)
    const avant = synoptique(c, 'synoptique-4')
    const cles = (s: Synoptique) => entreesLegende(s, 0, listes).map((e) => e.cle)
    // RVB 50 m (zone-1) : déballastée sur 60 %, reste déposé, coupes tous les 6 m ;
    // RR 14 m (zone-2) : déposée.
    expect(cles(avant)).toEqual(expect.arrayContaining(['etat:etat-2', 'etat:etat-3', 'coupes:6']))
    const s = afficherZone(avant, 'zone-1', false)
    expect(cles(s)).toContain('etat:etat-2')
    expect(cles(s)).not.toContain('etat:etat-3')
    expect(cles(s)).not.toContain('coupes:6')
    // Les autres lignes (exploitation, flèches…) ne bougent pas.
    const autres = (l: string[]) => l.filter((k) => !k.startsWith('etat:') && !k.startsWith('coupes:'))
    expect(autres(cles(s))).toEqual(autres(cles(avant)))
    // Toutes les zones masquées : plus aucun état ni coupe.
    const rien = afficherToutesLesZones(avant, false)
    expect(cles(rien).filter((k) => k.startsWith('etat:') || k.startsWith('coupes:'))).toEqual([])
    // La planche (et donc les exports) suit la même légende.
    const page = miseEnPage(s, 0, listes)
    const textes = (page.legende?.entrees ?? []).map((e) => e.entree.cle)
    expect(textes).toEqual(legendeAffichee(s, 0, listes).map((e) => e.cle))
    expect(textes).not.toContain('coupes:6')
  })
})

describe('fichier et navigateur : zones masquées', () => {
  it('reste en version 6 : le champ est facultatif', () => {
    expect(VERSION_CHANTIER).toBe(6)
  })

  it('s’enregistre et se relit', () => {
    const c = fixture()
    const s = afficherZone(synoptique(c, 'synoptique-4'), 'zone-2', false)
    const modifie = { ...c, synoptiques: c.synoptiques.map((x) => (x.id === s.id ? s : x)) }
    const lu = lireChantier(serialiserChantier(modifie))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(synoptique(lu.chantier, 'synoptique-4').zonesMasquees).toEqual(['zone-2'])
    expect(synoptique(lu.chantier, 'synoptique-1').zonesMasquees).toEqual([])
  })

  it('un fichier sans le champ s’ouvre avec toutes les zones affichées ; une zone inconnue est ignorée', () => {
    const brut = JSON.parse(texteFixture)
    for (const s of brut.synoptiques) delete s.zonesMasquees
    brut.synoptiques[0].zonesMasquees = ['zone-99', 'zone-4', 'zone-4']
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.chantier.synoptiques[0].zonesMasquees).toEqual(['zone-4'])
    expect(lu.chantier.synoptiques[1].zonesMasquees).toEqual([])
  })

  it('une liste illisible est refusée, avec un message en français', () => {
    const brut = JSON.parse(texteFixture)
    brut.synoptiques[0].zonesMasquees = 'zone-1'
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(false)
    if (!lu.ok) expect(lu.erreurs.join('\n')).toMatch(/zones masquées est illisible/)
  })

  it('un chantier gardé dans le navigateur avant ce complément est complété', () => {
    const ancien = JSON.parse(JSON.stringify(fixture()))
    for (const s of ancien.synoptiques) delete s.zonesMasquees
    const { chantier } = migrerChantier(ancien)
    for (const s of chantier.synoptiques) expect(s.zonesMasquees).toEqual([])
    // Un chantier qui a déjà des zones masquées les garde.
    const deja = JSON.parse(JSON.stringify(fixture()))
    deja.synoptiques[0].zonesMasquees = ['zone-1']
    expect(migrerChantier(deja).chantier.synoptiques[0].zonesMasquees).toEqual(['zone-1'])
  })
})
