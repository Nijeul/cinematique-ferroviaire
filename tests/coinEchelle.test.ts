import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { migrerChantier, type Chantier } from '../src/plan/chantier.ts'
import {
  cadreBarreEchelle,
  COIN_ECHELLE_PAR_DEFAUT,
  COINS_ECHELLE,
  lireCoinEchelle,
  modifierCoinEchelle,
  placerEchelle,
  reperesExtremites,
  type CoinEchelle,
} from '../src/plan/coinEchelle.ts'
import type { Rectangle } from '../src/plan/elements.ts'
import { lireChantier, serialiserChantier, VERSION_CHANTIER } from '../src/plan/fichierChantier.ts'
import { annuler, creerHistorique, enregistrer, retablir } from '../src/plan/historique.ts'
import { listesDe } from '../src/plan/legende.ts'
import { miseEnPage } from '../src/plan/planche.ts'
import { creerProjet } from '../src/plan/projet.ts'
import { creerSynoptique, nouvelleImage, projetDeImage, type Synoptique } from '../src/plan/synoptique.ts'

// Coin de l'échelle graphique « 0 — 100 m » choisi pour chaque synoptique
// (elle tombait parfois sur les voies, en bas à droite). Données fictives.

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const synoptique = (c: Chantier, id: string): Synoptique => c.synoptiques.find((s) => s.id === id)!
const COINS: CoinEchelle[] = ['bas-droite', 'bas-gauche', 'haut-droite', 'haut-gauche']

const dedans = (r: Rectangle, cadre: Rectangle): boolean =>
  r.x >= cadre.x && r.y >= cadre.y && r.x + r.largeur <= cadre.x + cadre.largeur && r.y + r.hauteur <= cadre.y + cadre.hauteur
const touche = (a: Rectangle, b: Rectangle): boolean =>
  a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur
const proche = (a: number, b: number) => expect(a).toBeCloseTo(b, 9)

describe('coin de l’échelle : réglage du synoptique', () => {
  it('quatre coins, en bas à droite par défaut', () => {
    expect(COIN_ECHELLE_PAR_DEFAUT).toBe('bas-droite')
    expect(COINS_ECHELLE.map((c) => c.coin)).toEqual(COINS)
    expect(COINS_ECHELLE.map((c) => c.libelle)).toEqual(['En bas à droite', 'En bas à gauche', 'En haut à droite', 'En haut à gauche'])
    const neuf = creerSynoptique('s', { nom: 'Essai', t0: '2026-10-09T22:00', fin: 480, cadrage: null }, { id: 'plan-1', projet: creerProjet('P') }, '2026-09-30T10:00:00Z')
    expect(neuf.coinEchelle).toBe('bas-droite')
    for (const s of fixture().synoptiques) expect(s.coinEchelle).toBe('bas-droite')
  })

  it('une valeur absente ou illisible donne le coin par défaut', () => {
    expect(lireCoinEchelle(undefined)).toBe('bas-droite')
    expect(lireCoinEchelle(null)).toBe('bas-droite')
    expect(lireCoinEchelle('')).toBe('bas-droite')
    expect(lireCoinEchelle('en haut')).toBe('bas-droite')
    expect(lireCoinEchelle(3)).toBe('bas-droite')
    expect(lireCoinEchelle({ coin: 'haut-gauche' })).toBe('bas-droite')
    for (const coin of COINS) expect(lireCoinEchelle(coin)).toBe(coin)
  })

  it('se règle pour tout le synoptique, sans toucher au reste', () => {
    const avant = synoptique(fixture(), 'synoptique-3')
    const s = modifierCoinEchelle(avant, 'haut-gauche')
    expect(s.coinEchelle).toBe('haut-gauche')
    expect(avant.coinEchelle).toBe('bas-droite')
    expect({ ...s, coinEchelle: 'bas-droite' }).toEqual(avant)
    // Même valeur, ou valeur qui n'est pas un coin : même synoptique.
    expect(modifierCoinEchelle(s, 'haut-gauche')).toBe(s)
    expect(modifierCoinEchelle(s, 'milieu' as CoinEchelle)).toBe(s)
    // « Nouvelle image » ne le change pas (réglage du synoptique).
    expect(nouvelleImage(s, 0).synoptique.coinEchelle).toBe('haut-gauche')
  })

  it('s’annule et se rétablit', () => {
    const s0 = synoptique(fixture(), 'synoptique-2')
    let h = creerHistorique(s0)
    h = enregistrer(h, modifierCoinEchelle(h.present, 'haut-droite'))
    h = enregistrer(h, modifierCoinEchelle(h.present, 'bas-gauche'))
    expect(h.present.coinEchelle).toBe('bas-gauche')
    h = annuler(h)
    expect(h.present.coinEchelle).toBe('haut-droite')
    h = annuler(h)
    expect(h.present).toBe(s0)
    h = retablir(h)
    expect(h.present.coinEchelle).toBe('haut-droite')
  })
})

describe('coin de l’échelle : place de la barre', () => {
  const carte: Rectangle = { x: 160, y: 200, largeur: 900, hauteur: 460 }
  const unites = 2 // 2 unités du plan par mètre

  it('en bas à droite : exactement la place d’avant', () => {
    const p = placerEchelle(carte, unites, 'bas-droite')
    proche(p.x, carte.x + carte.largeur - carte.largeur * 0.015)
    proche(p.y, carte.y + carte.hauteur - carte.largeur * 0.015)
    expect(p.ancre).toBe('droite')
    proche(p.taille, carte.largeur / 90)
    proche(p.longueurMax, carte.largeur * 0.2)
    // 180 unités au plus, soit 90 m : barre ronde de 50 m.
    expect(p.metres).toBe(50)
    proche(p.longueur, 100)
  })

  it('chaque coin met la barre dans son coin, toujours dans le plan', () => {
    const milieu = { x: carte.x + carte.largeur / 2, y: carte.y + carte.hauteur / 2 }
    for (const coin of COINS) {
      const p = placerEchelle(carte, unites, coin)
      expect(dedans(p.cadre, carte), coin).toBe(true)
      expect(p.cadre).toEqual(cadreBarreEchelle(p))
      const aDroite = p.cadre.x > milieu.x
      const enBas = p.cadre.y > milieu.y
      expect(aDroite, coin).toBe(coin.endsWith('droite'))
      expect(enBas, coin).toBe(coin.startsWith('bas'))
      expect(p.ancre).toBe(coin.endsWith('droite') ? 'droite' : 'gauche')
      // Même barre partout : seule la place change.
      expect(p.metres).toBe(50)
    }
  })

  it('mêmes écarts aux bords dans les quatre coins', () => {
    const bd = placerEchelle(carte, unites, 'bas-droite').cadre
    const bg = placerEchelle(carte, unites, 'bas-gauche').cadre
    const hd = placerEchelle(carte, unites, 'haut-droite').cadre
    const hg = placerEchelle(carte, unites, 'haut-gauche').cadre
    const droite = carte.x + carte.largeur - (bd.x + bd.largeur)
    const bas = carte.y + carte.hauteur - (bd.y + bd.hauteur)
    expect(droite).toBeGreaterThan(0)
    expect(bas).toBeGreaterThan(0)
    proche(bg.x - carte.x, droite)
    proche(hd.y - carte.y, bas)
    proche(hg.x - carte.x, droite)
    proche(hg.y - carte.y, bas)
    proche(carte.x + carte.largeur - (hd.x + hd.largeur), droite)
    proche(carte.y + carte.hauteur - (bg.y + bg.hauteur), bas)
    // Haut et bas : même hauteur de cadre.
    proche(hd.hauteur, bd.hauteur)
  })

  it('s’écarte d’un repère qu’elle toucherait, en s’éloignant du bord, sans sortir du plan', () => {
    const libre = placerEchelle(carte, unites, 'haut-droite')
    const repere: Rectangle = { x: libre.cadre.x + 20, y: carte.y + 5, largeur: 60, hauteur: 12 }
    const p = placerEchelle(carte, unites, 'haut-droite', [repere])
    expect(touche(p.cadre, repere)).toBe(false)
    expect(p.cadre.y).toBeGreaterThan(repere.y + repere.hauteur)
    expect(p.cadre.x).toBe(libre.cadre.x)
    expect(dedans(p.cadre, carte)).toBe(true)
    // Un repère ailleurs ne la déplace pas.
    expect(placerEchelle(carte, unites, 'haut-droite', [{ x: carte.x, y: carte.y, largeur: 50, hauteur: 12 }])).toEqual(libre)
    // En bas, elle monte au-dessus du repère.
    const bas = placerEchelle(carte, unites, 'bas-gauche')
    const gene: Rectangle = { x: bas.cadre.x, y: bas.cadre.y + 4, largeur: 30, hauteur: 30 }
    const q = placerEchelle(carte, unites, 'bas-gauche', [gene])
    expect(touche(q.cadre, gene)).toBe(false)
    expect(q.cadre.y + q.cadre.hauteur).toBeLessThan(gene.y)
  })

  it('cadre blanc : la barre et ses chiffres au-dessus', () => {
    const c = cadreBarreEchelle({ x: 500, y: 300, ancre: 'droite', taille: 10, longueur: 100 })
    expect(c).toEqual({ x: 395, y: 300 - 5 - 14.5, largeur: 110, hauteur: 5 + 14.5 + 4 })
    const g = cadreBarreEchelle({ x: 500, y: 300, ancre: 'gauche', taille: 10, longueur: 100 })
    expect(g.x).toBe(495)
  })

  it('sur les planches de la fixture : jamais sur le bandeau, le créneau, le PHASAGE, la légende ni les repères Nord / Sud', () => {
    const c = fixture()
    const listes = listesDe(c)
    for (const s0 of c.synoptiques) {
      expect(s0.echelle).not.toBeNull()
      for (const coin of COINS) {
        const s = modifierCoinEchelle(s0, coin)
        s.images.forEach((_, i) => {
          const page = miseEnPage(s, i, listes)
          const reperes = reperesExtremites(projetDeImage(s, s.images[i]), page.carte)
          const p = placerEchelle(page.carte, s.echelle!.pixelsParMetre, s.coinEchelle, reperes)
          const { cadre } = p
          const ou = `${s.id} image ${i + 1} ${coin}`
          expect(dedans(cadre, page.carte), ou).toBe(true)
          // Les repères « ◀ Nord » et « Sud ▶ » restent visibles.
          for (const r of reperes) expect(touche(cadre, r), ou).toBe(false)
          // En bas, rien ne change par rapport à la place sans repère.
          if (coin.startsWith('bas')) expect(p, ou).toEqual(placerEchelle(page.carte, s.echelle!.pixelsParMetre, s.coinEchelle))
          for (const boite of [page.bandeau?.boite, page.creneau.boite, page.phasage?.boite, page.legende?.boite]) {
            if (boite) expect(touche(cadre, boite), ou).toBe(false)
          }
        })
      }
    }
  })
})

describe('fichier et navigateur : coin de l’échelle', () => {
  it('reste en version 6 : champ facultatif', () => {
    expect(VERSION_CHANTIER).toBe(6)
  })

  it('s’enregistre et se relit', () => {
    const c = fixture()
    const s = modifierCoinEchelle(synoptique(c, 'synoptique-4'), 'haut-gauche')
    const lu = lireChantier(serialiserChantier({ ...c, synoptiques: c.synoptiques.map((x) => (x.id === s.id ? s : x)) }))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(synoptique(lu.chantier, 'synoptique-4').coinEchelle).toBe('haut-gauche')
    expect(synoptique(lu.chantier, 'synoptique-1').coinEchelle).toBe('bas-droite')
  })

  it('un fichier sans ce champ, ou avec une valeur illisible, s’ouvre avec l’échelle en bas à droite', () => {
    const brut = JSON.parse(texteFixture)
    for (const s of brut.synoptiques) expect(s.coinEchelle).toBeUndefined()
    brut.synoptiques[0].coinEchelle = 'au milieu'
    brut.synoptiques[1].coinEchelle = 42
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(true)
    if (lu.ok) for (const s of lu.chantier.synoptiques) expect(s.coinEchelle).toBe('bas-droite')
  })

  it('un chantier gardé dans le navigateur (ou en ligne) sans ce champ le reçoit ; un réglé le garde', () => {
    const c = fixture()
    const ancien = JSON.parse(JSON.stringify(c))
    for (const s of ancien.synoptiques) delete s.coinEchelle
    ancien.synoptiques[1].coinEchelle = 'n’importe quoi'
    for (const s of migrerChantier(ancien).chantier.synoptiques) expect(s.coinEchelle).toBe('bas-droite')
    const regle = { ...c, synoptiques: c.synoptiques.map((s) => (s.id === 'synoptique-2' ? modifierCoinEchelle(s, 'bas-gauche') : s)) }
    expect(synoptique(migrerChantier(regle).chantier, 'synoptique-2').coinEchelle).toBe('bas-gauche')
  })

  it('un chantier de dix synoptiques sans ce champ se lit sans erreur', () => {
    const brut = JSON.parse(texteFixture)
    const modele = brut.synoptiques[0]
    brut.synoptiques = Array.from({ length: 10 }, (_, i) => ({ ...structuredClone(modele), id: `synoptique-${i + 1}`, nom: `Nuit ${i + 1}` }))
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(true)
    if (lu.ok) {
      expect(lu.chantier.synoptiques).toHaveLength(10)
      for (const s of lu.chantier.synoptiques) expect(s.coinEchelle).toBe('bas-droite')
    }
  })
})
