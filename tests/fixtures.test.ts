import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chargerProjet } from '../src/domain/chargement.ts'

// Les deux jeux de données de fixtures/ sont les cas de test de référence.
// Ils doivent tous les deux se charger et se valider sans erreur : un test qui
// ne passe que sur l'un des deux signale une spécialisation du code.

const lireFixture = (nom: string) =>
  readFileSync(new URL(`../fixtures/${nom}`, import.meta.url), 'utf-8')

describe.each(['ocp1-sud.cinef', 'chantier-test.cinef'])('fixture %s', (nom) => {
  const resultat = chargerProjet(lireFixture(nom))

  it('se charge et se valide sans erreur', () => {
    if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
  })

  it('a des opérations cohérentes avec la durée du chantier', () => {
    if (!resultat.ok) return
    const { projet } = resultat
    expect(projet.operations.length).toBeGreaterThan(0)
    for (const op of projet.operations) {
      expect(op.tDebut).toBeGreaterThanOrEqual(0)
      expect(op.tFin).toBeGreaterThan(op.tDebut)
      expect(op.tFin).toBeLessThanOrEqual(projet.temps.dureeMinutes)
    }
  })

  it('donne un état initial complet à chaque zone', () => {
    if (!resultat.ok) return
    for (const zone of resultat.projet.site.zones) {
      expect(Object.keys(zone.etatInitial)).toHaveLength(6)
    }
  })
})

describe('fixture ocp1-sud.cinef', () => {
  const resultat = chargerProjet(lireFixture('ocp1-sud.cinef'))

  it('contient les 51 opérations du phasage de référence', () => {
    if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
    expect(resultat.projet.operations).toHaveLength(51)
    // Le trou de numérotation (opération 48 absente du document source) est
    // conservé tel quel : le format doit l'encaisser.
    const numeros = new Set(resultat.projet.operations.map((op) => op.numero))
    expect(numeros.has(48)).toBe(false)
    expect(numeros.has(49)).toBe(true)
  })

  it('porte l’opération optionnelle sans champ ad hoc', () => {
    if (!resultat.ok) return
    const optionnelles = resultat.projet.operations.filter((op) => op.optionnelle)
    expect(optionnelles.map((op) => op.numero)).toEqual([49])
  })

  it('décrit quatre appareils de voie découpés en panneaux', () => {
    if (!resultat.ok) return
    expect(resultat.projet.site.appareils).toHaveLength(4)
    for (const adv of resultat.projet.site.appareils) {
      expect(adv.panneaux.length).toBeGreaterThan(0)
    }
  })
})
