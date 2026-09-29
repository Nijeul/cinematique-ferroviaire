import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { creerCatalogue, type TypeEngin } from '../src/plan/catalogue.ts'
import type { Chantier } from '../src/plan/chantier.ts'
import { ajouterEngin, ajouterRame, groupeDe, modifierEngin, modifierRame, vehiculesDeGroupes } from '../src/plan/engins.ts'
import { basculerAvancement, choisirEtatZone, modifierAvancement } from '../src/plan/etatsZones.ts'
import { lireChantier } from '../src/plan/fichierChantier.ts'
import { ajouterFleche, modifierFlechesImage } from '../src/plan/fleches.ts'
import {
  detailRame,
  entreesLegende,
  legendeAffichee,
  masquerLigneLegende,
  modifierAfficherLegende,
  nomLegendeEngin,
  texteEntree,
  type ListesChantier,
} from '../src/plan/legende.ts'
import { ajouterEtape, miseEnPage, modifierEtape, repartir } from '../src/plan/planche.ts'
import { creerProjet, type Projet } from '../src/plan/projet.ts'
import { creerSynoptique, modifierImage, nouvelleImage, type Synoptique } from '../src/plan/synoptique.ts'

const QUAND = '2026-09-29T15:00:00.000Z'
const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')

const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const listesDe = (c: Chantier): ListesChantier => ({ etatsVoie: c.etatsVoie, typesFleches: c.typesFleches, catalogue: c.catalogue })
const textes = (s: Synoptique, i: number, listes: ListesChantier) => legendeAffichee(s, i, listes).map(texteEntree)

const CATALOGUE = creerCatalogue()
const modele = (m: string): TypeEngin => CATALOGUE.find((t) => t.modele === m)!

// Un plan fictif à l'échelle : une voie de 1 000 px (250 m), une zone.
const plan = (): Projet => ({
  ...creerProjet('Essai'),
  echelle: { pixelsParMetre: 4 },
  voies: [{ id: 'voie-1', nom: 'V1', couleur: '#454f59', epaisseur: 9, points: [{ x: 100, y: 300 }, { x: 1100, y: 300 }] }],
  zones: [{ id: 'zone-1', nom: 'RVB 80 m', couleur: '#33506b', voieId: 'voie-1', debut: 200, fin: 520 }],
})
const synoptique = (): Synoptique =>
  creerSynoptique('synoptique-1', { nom: 'Nuit 1', t0: '2026-10-09T22:30', fin: 480, cadrage: null }, { id: 'plan-1', projet: plan() }, QUAND)

const c0 = fixture()
const LISTES = listesDe(c0)

describe('nom d’un engin dans la légende', () => {
  it('la catégorie seule quand elle n’a qu’un modèle, sinon catégorie et modèle (sans « Type »)', () => {
    expect(nomLegendeEngin(modele('CAT 323'), CATALOGUE)).toBe('Pelle RR')
    expect(nomLegendeEngin(modele('Type 08-32U'), CATALOGUE)).toBe('BML 08-32U')
    expect(nomLegendeEngin(modele('BB 61000'), CATALOGUE)).toBe('Loco BB 61000')
    expect(nomLegendeEngin(modele('R39'), CATALOGUE)).toBe('Wagon')
    // Catégorie absente du catalogue : le modèle aide à le reconnaître.
    expect(nomLegendeEngin({ categorie: 'PEM LEM', modele: 'Portique 2' }, CATALOGUE)).toBe('PEM LEM Portique 2')
  })
})

describe('légende construite d’après l’image', () => {
  it('fixture : TTX 1 avec sa description, pelles et BML numérotées, états et flèches présents', () => {
    const s = c0.synoptiques[2]
    expect(textes(s, 0, LISTES)).toEqual([
      'TTX 1 déblais + sous-couche ballast (BB 61000 + 6 × R39)',
      '1 — Pelle RR déballastage',
      '2 — Pelle RR chargement des déblais',
      '3 — BML 08-32U',
      'Déposée',
      'Déballastée',
      'Sens de travail',
      'Sens avancement TTX',
      'Cheminement',
      'Cheminement retour',
      'Chemin de roule',
    ])
    // Le nom en gras est le numéro et l'engin, la description suit.
    const pelle = legendeAffichee(s, 0, LISTES)[1]
    expect([pelle.nom, pelle.complement]).toEqual(['1 — Pelle RR', 'déballastage'])
  })

  it('image 2 : le TTX et sa flèche partis, la sous-couche remplace la zone déballastée', () => {
    const t = textes(c0.synoptiques[2], 1, LISTES)
    expect(t).not.toContain('Sens avancement TTX')
    expect(t.some((x) => x.startsWith('TTX 1'))).toBe(false)
    expect(t).toContain('Sous-couche ballast')
    expect(t).not.toContain('Déballastée')
    // L'image 1 n'a pas changé.
    expect(textes(c0.synoptiques[2], 0, LISTES)).toContain('Sens avancement TTX')
  })

  it('engins numérotés dans l’ordre des numéros ; engins sans numéro regroupés', () => {
    let s = synoptique()
    s = modifierImage(s, 0, (p) => {
      let q = p
      for (const [numero, abscisse] of [['10', 100], ['', 300], ['2', 500], ['', 700]] as const) {
        const r = ajouterEngin(q, modele('CAT 323'), { genre: 'voie', voieId: 'voie-1', abscisse })
        q = modifierEngin(r.planche, r.id, { numero })
      }
      const bml = ajouterEngin(q, modele('Type 08-32U'), { genre: 'libre', x: 500, y: 600, angle: 0 })
      q = bml.planche
      // Même modèle, autre couleur : pas regroupé.
      const autre = ajouterEngin(q, modele('CAT 323'), { genre: 'libre', x: 200, y: 600, angle: 0 })
      return modifierEngin(autre.planche, autre.id, { couleur: '#00aa00' })
    })
    const listes = { ...LISTES, catalogue: CATALOGUE }
    expect(textes(s, 0, listes)).toEqual(['2 — Pelle RR', '10 — Pelle RR', 'Pelle RR ×2', 'BML 08-32U', 'Pelle RR'])
    const groupe = legendeAffichee(s, 0, listes)[2]
    expect(groupe).toMatchObject({ genre: 'engin', numero: '', nombre: 2 })
  })

  it('rames : nom, numéro, description, composition courte ou longueur', () => {
    let s = synoptique()
    s = modifierImage(s, 0, (p) => {
      const r = ajouterRame(p, vehiculesDeGroupes([groupeDe(modele('BB 61000')), groupeDe(modele('R39'), 10)]), 'voie-1', 600)
      return modifierRame(r.planche, r.id, { nom: 'TTX 1', numero: 'T1', description: '  déblais ' })
    })
    const [rame] = legendeAffichee(s, 0, { ...LISTES, catalogue: CATALOGUE })
    expect(rame).toMatchObject({ genre: 'rame', nom: 'T1 — TTX 1', complement: 'déblais (BB 61000 + 10 × R39)' })
    if (rame.genre === 'rame') expect(rame.couleurs).toEqual([modele('BB 61000').couleur, modele('R39').couleur])
    // Au-delà de trois groupes de véhicules, la longueur.
    const long = vehiculesDeGroupes([groupeDe(modele('BB 61000')), groupeDe(modele('R39')), groupeDe(modele('D12')), groupeDe(modele('R39'))])
    expect(detailRame({ vehicules: long })).toBe('68,3 m')
  })

  it('états présents, reste d’un avancement compris, sans « Avant travaux », dans l’ordre de la liste', () => {
    const e = (nom: string) => c0.etatsVoie.find((x) => x.nom === nom)!.id
    let s = synoptique()
    expect(entreesLegende(s, 0, LISTES)).toEqual([])
    s = choisirEtatZone(s, 0, 'zone-1', e('Voie neuve posée'), c0.etatsVoie)
    s = basculerAvancement(s, 0, 'zone-1', true, c0.etatsVoie)
    s = modifierAvancement(s, 0, 'zone-1', { reste: e('Déposée') }, c0.etatsVoie)
    expect(textes(s, 0, LISTES)).toEqual(['Déposée', 'Voie neuve posée'])
    // Calque des zones masqué : les zones ne sont pas sur la planche.
    const cachees = { ...s, images: s.images.map((im) => ({ ...im, contenu: { ...im.contenu, calques: { ...im.contenu.calques, zones: { visible: false, verrouille: false } } } })) }
    expect(textes(cachees, 0, LISTES)).toEqual([])
  })

  it('types de flèches présents seulement, une ligne par type ; rien si le calque est masqué', () => {
    let s = synoptique()
    s = modifierFlechesImage(s, 0, (f) => {
      let l = ajouterFleche(f, 'type-fleche-5', [{ x: 0, y: 0 }, { x: 50, y: 0 }]).fleches
      l = ajouterFleche(l, 'type-fleche-1', [{ x: 0, y: 10 }, { x: 50, y: 10 }]).fleches
      return ajouterFleche(l, 'type-fleche-1', [{ x: 0, y: 20 }, { x: 50, y: 20 }]).fleches
    })
    expect(textes(s, 0, LISTES)).toEqual(['Sens de travail', 'Chemin de roule'])
    expect(textes({ ...s, calqueFleches: { visible: false, verrouille: false } }, 0, LISTES)).toEqual([])
  })

  it('description : modifiable sur un engin et une rame, espaces superflus retirés', () => {
    let s = synoptique()
    s = modifierImage(s, 0, (p) => {
      const r = ajouterEngin(p, modele('CAT 323'), { genre: 'voie', voieId: 'voie-1', abscisse: 300 })
      return modifierEngin(r.planche, r.id, { numero: '1', description: 'chargement   des déblais' })
    })
    expect(textes(s, 0, { ...LISTES, catalogue: CATALOGUE })).toEqual(['1 — Pelle RR chargement des déblais'])
  })

  it('légende vide : rien à afficher, pas de cadre ni de bande du bas', () => {
    const s = synoptique()
    expect(legendeAffichee(s, 0, LISTES)).toEqual([])
    const p = miseEnPage(s, 0, LISTES)
    expect(p.legende).toBeNull()
    expect(p.planche.y + p.planche.hauteur).toBe(p.carte.y + p.carte.hauteur)
  })
})

describe('réglages de la légende', () => {
  it('« Afficher la légende » décochée : rien sur aucune image', () => {
    const s = modifierAfficherLegende(c0.synoptiques[2], false)
    expect(legendeAffichee(s, 0, LISTES)).toEqual([])
    expect(legendeAffichee(s, 1, LISTES)).toEqual([])
    expect(miseEnPage(s, 0, LISTES).legende).toBeNull()
    // La liste complète reste proposée dans le panneau.
    expect(entreesLegende(s, 0, LISTES).length).toBeGreaterThan(0)
  })

  it('une ligne masquée sur une image ne l’est que sur celle-ci ; « Nouvelle image » garde le réglage', () => {
    const origine = c0.synoptiques[2]
    let s = masquerLigneLegende(origine, 0, 'etat:etat-2', true)
    expect(textes(s, 0, LISTES)).not.toContain('Déposée')
    expect(textes(s, 1, LISTES)).toContain('Déposée')
    expect(masquerLigneLegende(s, 0, 'etat:etat-2', true)).toBe(s)
    const r = nouvelleImage(s, 0)
    expect(r.synoptique.images[1].legendeMasquee).toEqual(['etat:etat-2'])
    s = masquerLigneLegende(s, 0, 'etat:etat-2', false)
    expect(textes(s, 0, LISTES)).toEqual(textes(origine, 0, LISTES))
  })
})

describe('mise en page de la légende', () => {
  const avecEtape = (s: Synoptique, index: number, libelle: string): Synoptique => {
    const r = ajouterEtape(s, index)
    const m = modifierEtape(r.synoptique, index, r.position, { libelle })
    if (!m.ok) throw new Error(m.erreur)
    return m.valeur
  }

  it('cadre « LÉGENDE » en bas à droite, à côté de l’encart PHASAGE, même en-tête', () => {
    const s = avecEtape(c0.synoptiques[2], 1, 'Évacuation')
    const p = miseEnPage(s, 0, LISTES)
    const l = p.legende!
    expect(l.titre.texte).toBe('LÉGENDE')
    expect(l.boite.x + l.boite.largeur).toBeCloseTo(p.carte.x + p.carte.largeur)
    expect(l.boite.y).toBe(p.carte.y + p.carte.hauteur)
    expect(l.boite.x).toBeGreaterThan(p.phasage!.boite.x + p.phasage!.boite.largeur)
    expect(l.entete.hauteur).toBeCloseTo(p.phasage!.entete.hauteur)
    expect(l.boite.hauteur).toBeCloseTo(p.phasage!.boite.hauteur)
    // Échantillons à gauche, textes à droite, tout dans le cadre.
    for (const e of l.entrees) {
      expect(e.echantillon.x + e.echantillon.largeur).toBeLessThan(e.lignes[0].x)
      for (const ligne of e.lignes) {
        expect(ligne.y).toBeLessThan(l.boite.y + l.boite.hauteur)
        expect(ligne.x).toBeGreaterThan(l.boite.x)
      }
    }
    // Le nom est en gras, la description en maigre.
    const pelle = l.entrees.find((e) => e.entree.cle.startsWith('engin:'))!
    expect(pelle.lignes[0].texte.slice(0, pelle.lignes[0].grasJusqua)).toBe('1 — Pelle RR')
  })

  it('légende longue : plusieurs colonnes équilibrées ; même hauteur de bande sur toutes les images', () => {
    const s = c0.synoptiques[2]
    const [p1, p2] = [0, 1].map((i) => miseEnPage(s, i, LISTES))
    const colonnes = new Set(p1.legende!.entrees.map((e) => Math.round(e.echantillon.x)))
    expect(colonnes.size).toBe(2)
    expect(p2.planche).toEqual(p1.planche)
    expect(p2.legende!.boite).toEqual(p1.legende!.boite)
    expect(p2.legende!.entrees.length).toBeLessThan(p1.legende!.entrees.length)
  })

  it('répartition en colonnes : la plus haute est la moins haute possible, l’ordre est gardé', () => {
    expect(repartir([1, 1, 1, 1], 2, 0)).toEqual([2, 2])
    expect(repartir([4, 1, 1, 1, 1], 2, 0)).toEqual([1, 4])
    expect(repartir([1, 1, 1, 1, 1, 1], 3, 0)).toEqual([2, 2, 2])
    expect(repartir([2, 2, 1, 1], 2, 0.5)).toEqual([2, 2])
    expect(repartir([1, 2], 3, 0)).toEqual([1, 1])
    expect(repartir([], 2, 0)).toEqual([])
  })
})
