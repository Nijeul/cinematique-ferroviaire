import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chargerProjet } from '../src/domain/chargement.ts'
import { COUCHES, type Couche } from '../src/domain/etats.ts'
import type { Projet } from '../src/domain/projet.ts'
import { etatAt } from '../src/state/etatAt.ts'

const chargerFixture = (nom: string): Projet => {
  const resultat = chargerProjet(
    readFileSync(new URL(`../fixtures/${nom}`, import.meta.url), 'utf-8'),
  )
  if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
  return resultat.projet
}

const ocp1 = chargerFixture('ocp1-sud.cinef')
const test2 = chargerFixture('chantier-test.cinef')

// Les couches « matérielles » ne reviennent jamais en arrière au fil du
// chantier. La géométrie est exclue : une voie en exploitation (reglee) est
// recalée puis rebourrée pendant les travaux, c'est un cycle normal.
const COUCHES_MONOTONES: Couche[] = ['plateforme', 'sousCouche', 'ballast', 'traverses', 'rails']

describe.each([
  ['ocp1-sud.cinef', ocp1],
  ['chantier-test.cinef', test2],
])('etatAt sur %s', (_nom, projet) => {
  const instants: number[] = []
  for (let t = 0; t <= projet.temps.dureeMinutes; t += projet.temps.pasCreneau) instants.push(t)

  it('se résout à tout instant sans erreur et avec des valeurs de couches légales', () => {
    for (const t of instants) {
      const etat = etatAt(projet, t)
      for (const zone of Object.values(etat.zones)) {
        for (const couche of Object.keys(COUCHES) as Couche[]) {
          expect(COUCHES[couche]).toContain(zone.couches[couche])
        }
        for (const front of zone.fronts) {
          expect(front.fraction).toBeGreaterThanOrEqual(0)
          expect(front.fraction).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('est une fonction pure : deux appels au même instant donnent le même état', () => {
    expect(etatAt(projet, 300)).toEqual(etatAt(projet, 300))
  })

  it('ne fait jamais revenir une couche matérielle en arrière', () => {
    let precedent = etatAt(projet, 0)
    for (const t of instants) {
      const courant = etatAt(projet, t)
      for (const [zoneId, zone] of Object.entries(courant.zones)) {
        for (const couche of COUCHES_MONOTONES) {
          const valeurs = COUCHES[couche] as readonly string[]
          const avant = valeurs.indexOf(precedent.zones[zoneId].couches[couche])
          const apres = valeurs.indexOf(zone.couches[couche])
          expect(apres, `zone ${zoneId}, couche ${couche}, t=${t}`).toBeGreaterThanOrEqual(avant)
        }
      }
      precedent = courant
    }
  })

  it('ne rend jamais un stock négatif', () => {
    for (const t of instants) {
      const etat = etatAt(projet, t)
      for (const [lieuId, stock] of Object.entries(etat.stocks)) {
        for (const contenu of stock.contenus) {
          expect(
            contenu.quantite,
            `stock ${lieuId}, ${contenu.quoi}, t=${t}`,
          ).toBeGreaterThanOrEqual(-1e-9)
        }
      }
    }
  })

  it('liste les opérations actives à leur fenêtre exacte', () => {
    const op = projet.operations[0]
    expect(etatAt(projet, op.tDebut).operations).toContain(op.id)
    expect(etatAt(projet, op.tFin).operations).not.toContain(op.id)
  })
})

describe('etatAt — comportements attendus sur le phasage de référence', () => {
  it('applique un front de progression pendant une dépose linéaire', () => {
    // Opération 8 : dépose RVB 55 m de 240 à 300, sens PK croissant.
    const etat = etatAt(ocp1, 285)
    const fronts = etat.zones['z-rvb55'].fronts
    const frontRails = fronts.find((f) => f.couche === 'rails')
    expect(frontRails).toBeDefined()
    expect(frontRails?.de).toBe('poses')
    expect(frontRails?.vers).toBe('deposes_en_extremite')
    expect(frontRails?.fraction).toBeCloseTo(0.75)
    expect(frontRails?.sens).toBe('pk_croissant')
    // Avant la fin, la couche elle-même n'a pas encore basculé.
    expect(etat.zones['z-rvb55'].couches.rails).toBe('poses')
  })

  it('compose deux opérations simultanées sur la même zone', () => {
    // Opérations 28 (répartir) et 32 (poser) toutes deux sur RVB 15 m à t=1100.
    const fronts = etatAt(ocp1, 1100).zones['z-rvb15'].fronts
    const surTraverses = fronts.filter((f) => f.couche === 'traverses')
    expect(surTraverses.map((f) => f.operation).sort()).toEqual(['op-28', 'op-32'])
  })

  it('fait progresser un stock pendant une dépose, jusqu’au solde exact', () => {
    // Opération 2 : 83 traverses de z-rvb50 vers st-tba-n entre 150 et 210.
    const aMiParcours = etatAt(ocp1, 180).stocks['st-tba-n'].contenus
    expect(aMiParcours.find((c) => c.quoi === 'traverses_anciennes')?.quantite).toBeCloseTo(41.5)
    // En fin de chantier, tout est rechargé dans le TTX 4 : solde nul.
    const finales = etatAt(ocp1, ocp1.temps.dureeMinutes).stocks
    expect(
      finales['st-tba-n'].contenus.find((c) => c.quoi === 'traverses_anciennes')?.quantite,
    ).toBeCloseTo(0)
    expect(
      finales['st-tba-s'].contenus.find((c) => c.quoi === 'traverses_anciennes')?.quantite,
    ).toBeCloseTo(0)
  })

  it('remplit le TTX 4 au chargement final des traverses', () => {
    const charge = etatAt(ocp1, ocp1.temps.dureeMinutes).ressources['ttx4'].charge
    expect(charge.find((c) => c.quoi === 'traverses_anciennes')?.quantite).toBeCloseTo(350)
  })

  it('place une pelle au droit du front qu’elle travaille', () => {
    // Opération 10 : p4 déballaste z-rvb50 (PK 100,130 → 100,180) de 270 à 330.
    const position = etatAt(ocp1, 300).ressources['p4'].position
    expect(position).toEqual({ type: 'voie', voie: 'vc', pk: expect.closeTo(100.155, 5) })
  })

  it('change le mode d’une pelle par enraillement, jamais autrement', () => {
    expect(etatAt(ocp1, 0).ressources['p4'].mode).toBe('route')
    expect(etatAt(ocp1, 200).ressources['p4'].mode).toBe('rail')
  })

  it('dépose un appareil et suit ses panneaux jusqu’au stockage', () => {
    // Opération 6 : dépose BS A jusqu'à 270 ; opération 7 : panneaux vers la
    // base arrière jusqu'à 285.
    expect(etatAt(ocp1, 200).appareils['bs-a'].pose).toBe(true)
    const apres = etatAt(ocp1, 300).appareils['bs-a']
    expect(apres.pose).toBe(false)
    expect(apres.panneaux['pointe'].chez).toBe('ba-sud')
    expect(apres.panneaux['talon'].chez).toBe('ba-sud')
  })

  it('aboutit à des zones renouvelées là où le phasage pose la voie neuve', () => {
    const fin = etatAt(ocp1, ocp1.temps.dureeMinutes)
    for (const zoneId of ['z-rvb15', 'z-rvb27', 'z-rvb63', 'z-rvb54', 'z-rvb50', 'z-rr14']) {
      expect(fin.zones[zoneId].couches.rails, zoneId).toBe('neufs_poses')
      expect(fin.zones[zoneId].couches.traverses, zoneId).toBe('neuves_posees')
    }
    // Le RVB 41 m n'est touché par aucune opération du document source :
    // il reste en l'état initial (point signalé au commanditaire).
    expect(fin.zones['z-rvb41'].couches.rails).toBe('poses')
  })
})

describe('etatAt — chantier test', () => {
  it('suit le cycle tronçonnage → dépose → déballastage', () => {
    const fin = etatAt(test2, test2.temps.dureeMinutes)
    expect(fin.zones['z-test-a'].couches.rails).toBe('deposes_en_extremite')
    expect(fin.zones['z-test-a'].couches.traverses).toBe('deposees')
    expect(fin.zones['z-test-a'].couches.ballast).toBe('deballaste')
  })

  it('dépose le BS T1 et range son panneau au dépôt', () => {
    const fin = etatAt(test2, test2.temps.dureeMinutes)
    expect(fin.appareils['bs-t1'].pose).toBe(false)
    expect(fin.appareils['bs-t1'].panneaux['complet'].chez).toBe('st-test')
  })

  it('rend la pelle à la route en fin d’interception', () => {
    expect(etatAt(test2, test2.temps.dureeMinutes).ressources['pt1'].mode).toBe('route')
  })
})
