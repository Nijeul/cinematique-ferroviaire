import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ajouterEtatChantier,
  ajouterPlan,
  ajouterSynoptique,
  creerChantier,
  deplacerEtatChantier,
  imagesDeLEtat,
  migrerChantier,
  modifierEtatChantier,
  supprimerEtatChantier,
  type Chantier,
} from '../src/plan/chantier.ts'
import {
  ajouterEtat,
  creerEtatsVoie,
  deplacerEtat,
  ETATS_PAR_DEFAUT,
  etatParId,
  etatPrecedent,
  modifierEtat,
  motifBallast,
  peutSupprimerEtat,
} from '../src/plan/etatsVoie.ts'
import {
  basculerAvancement,
  choisirEtatZone,
  decouperZone,
  debutEstAGauche,
  etatDeZone,
  modifierAvancement,
  traitDuFront,
} from '../src/plan/etatsZones.ts'
import { lireChantier, serialiserChantier, VERSION_CHANTIER } from '../src/plan/fichierChantier.ts'
import { creerProjet, type Point, type Projet } from '../src/plan/projet.ts'
import { nouvelleImage, type Synoptique } from '../src/plan/synoptique.ts'
import { longueurPolyligne, pointAAbscisse, sousPolyligne } from '../src/plan/trace.ts'

const QUAND = '2026-09-29T15:00:00.000Z'
const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')

const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}

const valeur = <T>(r: { ok: true; valeur: T } | { ok: false; erreur: string }): T => {
  if (!r.ok) throw new Error(r.erreur)
  return r.valeur
}

const ETATS = creerEtatsVoie()
const id = (nom: string) => ETATS.find((e) => e.nom === nom)!.id

// Un plan fictif : une voie droite (V1, tracée de gauche à droite), une voie
// tracée de droite à gauche (V2), une voie courbe (V3), une zone sur chacune.
const arc = (): Point[] =>
  Array.from({ length: 61 }, (_, i) => {
    const a = Math.PI + (i / 60) * (Math.PI / 2)
    return { x: 900 + 400 * Math.cos(a), y: 900 + 400 * Math.sin(a) }
  })
const plan = (): Projet => ({
  ...creerProjet('Essai'),
  echelle: { pixelsParMetre: 4 },
  voies: [
    { id: 'voie-1', nom: 'V1', couleur: '#454f59', epaisseur: 9, points: [{ x: 100, y: 200 }, { x: 1100, y: 200 }] },
    { id: 'voie-2', nom: 'V2', couleur: '#454f59', epaisseur: 9, points: [{ x: 1100, y: 300 }, { x: 100, y: 300 }] },
    { id: 'voie-3', nom: 'V3', couleur: '#454f59', epaisseur: 9, points: arc() },
  ],
  zones: [
    { id: 'zone-1', nom: 'RVB 80 m', couleur: '#33506b', voieId: 'voie-1', debut: 200, fin: 520 },
    { id: 'zone-2', nom: 'Zone BS 2', couleur: '#8e3b8e', voieId: 'voie-2', debut: 100, fin: 300 },
    { id: 'zone-3', nom: 'RVB courbe', couleur: '#33506b', voieId: 'voie-3', debut: 0, fin: 400 },
  ],
})

const chantierEssai = (): Chantier => {
  let c = creerChantier('chantier-1', 'Essai (fictif)', QUAND)
  c = ajouterPlan(c, plan()).chantier
  return ajouterSynoptique(c, c.plans[0], { nom: 'Nuit 1', t0: '2026-10-09T22:30', fin: 480, cadrage: null }, QUAND).chantier
}

describe('liste des états de la voie par défaut', () => {
  it('cinq états, dans l’ordre des travaux, avec leurs rendus', () => {
    expect(ETATS_PAR_DEFAUT.map((e) => [e.nom, e.rendu, e.voile])).toEqual([
      ['Avant travaux', 'zone', false],
      ['Déposée', 'ballast', false],
      ['Déballastée', 'aplat', false],
      ['Sous-couche ballast', 'aplat', false],
      ['Voie neuve posée', 'ballast', true],
    ])
    // Saumon pour le déballastage, jaune pour la voie neuve, et une couleur
    // de sous-couche distincte des deux.
    const [, , deballastee, sousCouche, neuve] = ETATS_PAR_DEFAUT
    expect(deballastee.couleur).toBe('#f4b183')
    expect(neuve.couleur).toBe('#e8dc3c')
    expect(new Set([deballastee.couleur, sousCouche.couleur, neuve.couleur]).size).toBe(3)
  })

  it('chaque chantier neuf en reçoit une copie indépendante', () => {
    const c = creerChantier('c', 'C', QUAND)
    expect(c.etatsVoie).toEqual(ETATS_PAR_DEFAUT)
    c.etatsVoie[1].nom = 'Autre'
    expect(ETATS_PAR_DEFAUT[1].nom).toBe('Déposée')
  })

  it('la texture ballast est la même à chaque affichage et se raccorde', () => {
    const motif = motifBallast()
    expect(motifBallast()).toEqual(motif)
    expect(motif.length).toBeGreaterThanOrEqual(16)
    for (const c of motif) {
      expect(c.x + c.rx).toBeGreaterThan(0)
      expect(c.x - c.rx).toBeLessThan(1)
    }
  })
})

describe('modification de la liste', () => {
  it('ajoute un état en fin de liste, aplat de couleur, nom obligatoire', () => {
    const r = valeur(ajouterEtat(ETATS, '  Ballastée '))
    expect(r.id).toBe('etat-6')
    expect(r.liste[5]).toMatchObject({ nom: 'Ballastée', rendu: 'aplat', voile: false })
    expect(ajouterEtat(ETATS, ' ').ok).toBe(false)
  })

  it('la couleur propre de la zone est réservée au premier état', () => {
    expect(modifierEtat(ETATS, id('Déballastée'), { rendu: 'zone' }).ok).toBe(false)
    expect(modifierEtat(ETATS, id('Avant travaux'), { rendu: 'aplat' }).ok).toBe(false)
    const liste = valeur(modifierEtat(ETATS, id('Déposée'), { rendu: 'ballast', voile: true, couleur: '#123456' }))
    expect(etatParId(liste, id('Déposée'))).toMatchObject({ voile: true, couleur: '#123456' })
  })

  it('réordonne, sans jamais déplacer le premier état', () => {
    const liste = deplacerEtat(ETATS, id('Sous-couche ballast'), -1)
    expect(liste.map((e) => e.nom)).toEqual(['Avant travaux', 'Déposée', 'Sous-couche ballast', 'Déballastée', 'Voie neuve posée'])
    expect(deplacerEtat(ETATS, id('Déposée'), -1)).toBe(ETATS)
    expect(deplacerEtat(ETATS, id('Avant travaux'), 1)).toBe(ETATS)
    expect(peutSupprimerEtat(ETATS, id('Avant travaux'))).toBe(false)
    expect(etatPrecedent(ETATS, id('Déballastée'))?.nom).toBe('Déposée')
  })

  it('dans le chantier : ajouter, modifier, réordonner', () => {
    let c = chantierEssai()
    c = valeur(ajouterEtatChantier(c, 'Ballastée')).chantier
    c = valeur(modifierEtatChantier(c, id('Sous-couche ballast'), { couleur: '#8b6b3e' }))
    c = deplacerEtatChantier(c, 'etat-6', -1)
    expect(c.etatsVoie.map((e) => e.nom)).toEqual(['Avant travaux', 'Déposée', 'Déballastée', 'Sous-couche ballast', 'Ballastée', 'Voie neuve posée'])
    expect(c.etatsVoie[3].couleur).toBe('#8b6b3e')
  })
})

describe('état d’une zone dans une image', () => {
  it('par défaut : Avant travaux (le premier état)', () => {
    const s = chantierEssai().synoptiques[0]
    expect(s.images[0].contenu.etatsZones).toEqual({})
    expect(etatDeZone({}, ETATS, 'zone-1')).toEqual({ etat: ETATS[0], avancement: null })
    // Un état disparu s'affiche comme le premier, sans erreur.
    expect(etatDeZone({ 'zone-1': { etat: 'etat-99', avancement: null } }, ETATS, 'zone-1')?.etat.nom).toBe('Avant travaux')
  })

  it('change l’état d’une seule zone, d’une seule image', () => {
    let s = chantierEssai().synoptiques[0]
    s = nouvelleImage(s, 0).synoptique
    const avant = s
    s = choisirEtatZone(s, 1, 'zone-1', id('Déposée'), ETATS)
    expect(s.images[1].contenu.etatsZones).toEqual({ 'zone-1': { etat: id('Déposée'), avancement: null } })
    expect(s.images[0]).toBe(avant.images[0])
    expect(choisirEtatZone(s, 1, 'zone-inconnue', id('Déposée'), ETATS)).toBe(s)
  })

  it('« En partie » : 50 % depuis la gauche, le reste dans l’état précédent', () => {
    let s = chantierEssai().synoptiques[0]
    s = choisirEtatZone(s, 0, 'zone-1', id('Déballastée'), ETATS)
    s = basculerAvancement(s, 0, 'zone-1', true, ETATS)
    expect(s.images[0].contenu.etatsZones['zone-1'].avancement).toEqual({ pourcentage: 50, depuis: 'gauche', reste: id('Déposée') })
    s = modifierAvancement(s, 0, 'zone-1', { pourcentage: 140, depuis: 'droite' }, ETATS)
    expect(s.images[0].contenu.etatsZones['zone-1'].avancement).toMatchObject({ pourcentage: 100, depuis: 'droite' })
    const resolu = etatDeZone(s.images[0].contenu.etatsZones, ETATS, 'zone-1')!
    expect([resolu.etat.nom, resolu.avancement?.reste.nom]).toEqual(['Déballastée', 'Déposée'])
    s = basculerAvancement(s, 0, 'zone-1', false, ETATS)
    expect(s.images[0].contenu.etatsZones['zone-1']).toEqual({ etat: id('Déballastée'), avancement: null })
  })

  it('« Nouvelle image » recopie les états des zones', () => {
    let s = chantierEssai().synoptiques[0]
    s = choisirEtatZone(s, 0, 'zone-1', id('Déballastée'), ETATS)
    s = basculerAvancement(s, 0, 'zone-1', true, ETATS)
    const r = nouvelleImage(s, 0)
    expect(r.synoptique.images[1].contenu.etatsZones).toEqual(s.images[0].contenu.etatsZones)
    // Copie indépendante : changer la nouvelle image ne touche pas l'autre.
    const suite = choisirEtatZone(r.synoptique, 1, 'zone-1', id('Sous-couche ballast'), ETATS)
    expect(suite.images[0].contenu.etatsZones['zone-1'].etat).toBe(id('Déballastée'))
  })
})

describe('avancement partiel : coupure de la bande le long de la voie', () => {
  const { voies, zones } = plan()
  const [v1, v2, v3] = voies
  const [z1, z2, z3] = zones

  it('voie droite tracée vers la droite : 40 % depuis la gauche, puis depuis la droite', () => {
    expect(debutEstAGauche(v1, z1)).toBe(true)
    expect(decouperZone(v1, z1, { pourcentage: 40, depuis: 'gauche' })).toEqual({
      fait: { debut: 200, fin: 328 },
      reste: { debut: 328, fin: 520 },
      front: 328,
    })
    expect(decouperZone(v1, z1, { pourcentage: 40, depuis: 'droite' })).toEqual({
      fait: { debut: 392, fin: 520 },
      reste: { debut: 200, fin: 392 },
      front: 392,
    })
  })

  it('voie tracée de droite à gauche : le côté se lit sur le plan, pas dans le sens du tracé', () => {
    expect(debutEstAGauche(v2, z2)).toBe(false)
    // Depuis la droite (Sud) = depuis le début de la zone sur cette voie.
    const d = decouperZone(v2, z2, { pourcentage: 25, depuis: 'droite' })
    expect(d).toEqual({ fait: { debut: 100, fin: 150 }, reste: { debut: 150, fin: 300 }, front: 150 })
    // Le front est bien du côté droit du milieu de la zone.
    expect(pointAAbscisse(v2.points, d.front!).point.x).toBeGreaterThan(pointAAbscisse(v2.points, 200).point.x)
  })

  it('voie courbe : la partie faite mesure 40 % de la longueur le long de la courbe', () => {
    const d = decouperZone(v3, z3, { pourcentage: 40, depuis: 'droite' })
    const faite = longueurPolyligne(sousPolyligne(v3.points, d.fait!.debut, d.fait!.fin))
    const reste = longueurPolyligne(sousPolyligne(v3.points, d.reste!.debut, d.reste!.fin))
    expect(faite).toBeCloseTo(160, 6)
    expect(reste).toBeCloseTo(240, 6)
    // Côté droit de la zone sur l'arc : sa fin (le haut de l'arc, à droite).
    expect(d.fait!.fin).toBe(400)
    // Le trait du front est en travers de la voie, centré sur elle.
    const [a, b] = traitDuFront(v3, d.front!, 10)
    const centre = pointAAbscisse(v3.points, d.front!).point
    expect((a.x + b.x) / 2).toBeCloseTo(centre.x, 6)
    expect((a.y + b.y) / 2).toBeCloseTo(centre.y, 6)
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(32, 6)
  })

  it('aux bornes : 0 % tout reste à faire, 100 % tout est fait, sans front', () => {
    expect(decouperZone(v1, z1, { pourcentage: 0, depuis: 'gauche' })).toEqual({ fait: null, reste: { debut: 200, fin: 520 }, front: null })
    expect(decouperZone(v1, z1, { pourcentage: 100, depuis: 'droite' })).toEqual({ fait: { debut: 200, fin: 520 }, reste: null, front: null })
  })
})

describe('suppression d’un état utilisé', () => {
  const avecEtats = (): Chantier => {
    const c = chantierEssai()
    let s: Synoptique = c.synoptiques[0]
    s = choisirEtatZone(s, 0, 'zone-1', id('Déballastée'), ETATS)
    s = nouvelleImage(s, 0).synoptique
    s = basculerAvancement(s, 1, 'zone-1', true, ETATS) // Déballastée en partie, reste Déposée
    s = choisirEtatZone(s, 1, 'zone-2', id('Déposée'), ETATS)
    s = nouvelleImage(s, 1).synoptique
    s = choisirEtatZone(s, 2, 'zone-1', id('Sous-couche ballast'), ETATS)
    s = modifierAvancement(s, 2, 'zone-1', { reste: id('Déballastée') }, ETATS)
    return { ...c, synoptiques: [s] }
  }

  it('compte les images concernées (état entier, partie faite ou reste)', () => {
    const c = avecEtats()
    expect(imagesDeLEtat(c, id('Déballastée'))).toBe(3)
    expect(imagesDeLEtat(c, id('Déposée'))).toBe(2)
    expect(imagesDeLEtat(c, id('Voie neuve posée'))).toBe(0)
  })

  it('les zones reviennent à l’état précédent de la liste', () => {
    const r = valeur(supprimerEtatChantier(avecEtats(), id('Déballastée')))
    expect(r.repli.nom).toBe('Déposée')
    expect(r.chantier.etatsVoie.map((e) => e.nom)).not.toContain('Déballastée')
    const [im1, im2, im3] = r.chantier.synoptiques[0].images.map((im) => im.contenu.etatsZones)
    expect(im1['zone-1']).toEqual({ etat: id('Déposée'), avancement: null })
    // Partie faite et reste dans le même état : plus d'avancement.
    expect(im2['zone-1']).toEqual({ etat: id('Déposée'), avancement: null })
    expect(im3['zone-1']).toEqual({ etat: id('Sous-couche ballast'), avancement: { pourcentage: 50, depuis: 'gauche', reste: id('Déposée') } })
    expect(imagesDeLEtat(r.chantier, id('Déballastée'))).toBe(0)
  })

  it('le premier état ne se supprime pas', () => {
    expect(supprimerEtatChantier(avecEtats(), id('Avant travaux')).ok).toBe(false)
  })
})

describe('fixture : un synoptique qui raconte les états d’une zone', () => {
  it('déposée, déballastée à 40 % depuis le Sud, sous-couche, voie neuve posée', () => {
    const c = fixture()
    const s = c.synoptiques[1]
    expect(s.bandeau).toContain('fictive')
    const etats = s.images.map((im) => {
      const e = etatDeZone(im.contenu.etatsZones, c.etatsVoie, 'zone-1')!
      return [e.etat.nom, e.avancement && [e.avancement.pourcentage, e.avancement.depuis, e.avancement.reste.nom]]
    })
    expect(etats).toEqual([
      ['Déposée', null],
      ['Déballastée', [40, 'droite', 'Déposée']],
      ['Sous-couche ballast', null],
      ['Voie neuve posée', null],
    ])
    expect(s.images.map((im) => im.phasage.map((e) => e.numero))).toEqual([[1, 2], [3], [4], [5]])
    expect(s.images[0].titre).not.toBe('')
    expect(s.images[3].heures).toBe('debut')
  })
})

describe('export et import', () => {
  it('la liste d’états, les états des zones, le créneau et le phasage voyagent avec le chantier', () => {
    let c = fixture()
    c = valeur(ajouterEtatChantier(c, 'Ballastée')).chantier
    c = valeur(modifierEtatChantier(c, id('Sous-couche ballast'), { couleur: '#8b6b3e' }))
    const texte = serialiserChantier(c)
    expect(JSON.parse(texte).version).toBe(VERSION_CHANTIER)
    const relu = lireChantier(texte)
    expect(relu.ok).toBe(true)
    if (relu.ok) expect(relu.chantier).toEqual(c)
  })

  it('refuse un état inconnu, un avancement impossible, un rendu réservé', () => {
    const brut = JSON.parse(serialiserChantier(fixture()))
    brut.synoptiques[1].images[0].contenu.etatsZones['zone-1'].etat = 'etat-99'
    brut.synoptiques[1].images[1].contenu.etatsZones['zone-1'].avancement.pourcentage = 140
    brut.etatsVoie[2].rendu = 'zone'
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(false)
    if (!lu.ok) {
      const texte = lu.erreurs.join('\n')
      expect(texte).toContain('Seul le premier état')
      expect(texte).toContain('état inconnu')
      expect(texte).toContain('avancement illisible')
    }
  })
})

// Le même chantier tel que l'étape 5 le gardait (navigateur) ou l'exportait
// (fichier version 2) : ni états de la voie, ni bandeau, ni créneau, ni
// phasage, ni états des zones.
const enEtape5 = (c: Chantier) => {
  const brut = JSON.parse(serialiserChantier(c))
  delete brut.etatsVoie
  brut.synoptiques.forEach((s: Record<string, unknown> & { images: Record<string, unknown>[] }) => {
    delete s.bandeau
    s.images.forEach((im) => {
      delete im.titre
      delete im.heures
      delete im.phasage
      delete (im.contenu as Record<string, unknown>).etatsZones
    })
  })
  return brut
}

describe('chantiers et synoptiques des étapes 4 et 5', () => {
  it('rangé dans le navigateur à l’étape 5 : liste par défaut, tout avant travaux', () => {
    const brut = enEtape5(chantierEssai())
    delete brut.format
    delete brut.version
    const { chantier } = migrerChantier(brut)
    expect(chantier.etatsVoie).toEqual(ETATS_PAR_DEFAUT)
    const s = chantier.synoptiques[0]
    expect(s.bandeau).toBe('')
    expect(s.images[0]).toMatchObject({ titre: '', heures: 'plage', phasage: [] })
    expect(s.images[0].contenu.etatsZones).toEqual({})
    expect(etatDeZone(s.images[0].contenu.etatsZones, chantier.etatsVoie, 'zone-1')?.etat.nom).toBe('Avant travaux')
    // Rien d'autre ne change.
    expect(chantier).toEqual(chantierEssai())
  })

  it('rangé à l’étape 4 (ni catalogue, ni engins) : complété aussi', () => {
    const brut = enEtape5(chantierEssai())
    delete brut.format
    delete brut.version
    delete brut.catalogue
    brut.synoptiques.forEach((s: Record<string, unknown> & { images: { contenu: Record<string, unknown> }[] }) => {
      delete s.echelle
      delete s.calqueEngins
      s.images.forEach((im) => {
        delete im.contenu.engins
        delete im.contenu.rames
      })
    })
    const { chantier } = migrerChantier(brut)
    expect(chantier.etatsVoie).toEqual(ETATS_PAR_DEFAUT)
    expect(chantier.synoptiques[0].images[0]).toMatchObject({ titre: '', heures: 'plage', phasage: [], contenu: { etatsZones: {}, engins: [] } })
  })

  it('fichier exporté à l’étape 5 (version 2) : s’ouvre, tout avant travaux', () => {
    const brut = { ...enEtape5(fixture()), version: 2 }
    // L'étape 5 n'avait que le premier synoptique.
    brut.synoptiques = brut.synoptiques.slice(0, 1)
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.chantier.etatsVoie).toEqual(ETATS_PAR_DEFAUT)
    const s = lu.chantier.synoptiques[0]
    expect(s.images).toHaveLength(3)
    expect(s.images.every((im) => im.titre === '' && im.heures === 'plage' && im.phasage.length === 0)).toBe(true)
    expect(s.images.every((im) => Object.keys(im.contenu.etatsZones).length === 0)).toBe(true)
    expect(s.images[0].contenu.engins).toHaveLength(3)
  })
})
