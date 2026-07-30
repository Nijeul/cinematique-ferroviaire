import { describe, expect, it } from 'vitest'
import { chargerProjet } from '../src/domain/chargement.ts'
import { COUCHES, NOMS_VERBES, VERBES } from '../src/domain/etats.ts'

// Un projet minimal valide, à altérer cas par cas. Aucune valeur d'un
// chantier réel ici : uniquement des identifiants d'essai.
const projetMinimal = () => ({
  meta: { chantier: 'Essai' },
  temps: { t0: '2027-01-01T00:00:00', dureeMinutes: 100 },
  site: {
    voies: [{ id: 'v-essai', nom: 'Voie essai', polyligne: [[0, 0], [100, 0]] }],
    appareils: [
      {
        id: 'adv-essai', nom: 'BS essai', type: 'branchement_simple',
        voieDirecte: 'v-essai', voiedeviee: 'v-essai', pkPointe: 0.02,
        orientation: 'pointe', panneaux: ['complet'],
      },
    ],
    zones: [{ id: 'z-essai', nom: 'Zone essai', voie: 'v-essai', pkDebut: 0, pkFin: 0.05, longueur: 50 }],
    lieux: [{ id: 'l-essai', nom: 'Lieu essai', type: 'stockage', contour: [[0, 0], [1, 0], [1, 1]] }],
  },
  ressources: [{ id: 'r-essai', nom: 'Engin essai', type: 'pelle_rr', lieuInitial: 'l-essai' }],
  operations: [
    {
      id: 'op-essai', numero: 1, libelle: 'Essai', tDebut: 0, tFin: 10,
      ressources: ['r-essai'], cibles: ['z-essai'],
      effets: [{ verbe: 'deballaster', vers: 'deballaste' }],
    },
  ],
})

const charger = (projet: unknown) => chargerProjet(JSON.stringify(projet))

const erreursDe = (projet: unknown): string[] => {
  const resultat = charger(projet)
  expect(resultat.ok).toBe(false)
  return resultat.ok ? [] : resultat.erreurs
}

describe('chargerProjet', () => {
  it('accepte un projet minimal valide', () => {
    const resultat = charger(projetMinimal())
    if (!resultat.ok) throw new Error(resultat.erreurs.join('\n'))
    expect(resultat.projet.meta.chantier).toBe('Essai')
    expect(resultat.projet.temps.pasCreneau).toBe(30)
  })

  it('signale un JSON invalide sans lever d’exception', () => {
    const resultat = chargerProjet('{ pas du json')
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreurs[0]).toContain('JSON')
  })

  it('signale un verbe inconnu en situant l’opération', () => {
    const projet = projetMinimal()
    projet.operations[0].effets[0].verbe = 'demonter'
    const erreurs = erreursDe(projet)
    expect(erreurs.join('\n')).toContain('op-essai')
    expect(erreurs.join('\n')).toContain('valeurs possibles')
  })

  it('refuse un « vers » étranger à la couche du verbe', () => {
    const projet = projetMinimal()
    projet.operations[0].effets[0].vers = 'neufs_poses'
    expect(erreursDe(projet).join('\n')).toContain('deballaster')
  })

  it('signale une cible inconnue', () => {
    const projet = projetMinimal()
    projet.operations[0].cibles = ['z-fantome']
    expect(erreursDe(projet).join('\n')).toContain('z-fantome')
  })

  it('signale une ressource inconnue', () => {
    const projet = projetMinimal()
    projet.operations[0].ressources = ['r-fantome']
    expect(erreursDe(projet).join('\n')).toContain('r-fantome')
  })

  it('signale un panneau non déclaré sur l’appareil', () => {
    const projet = projetMinimal()
    projet.operations[0].cibles = ['adv-essai']
    projet.operations[0].effets = [{ verbe: 'deposer_adv', decoupage: ['pointe'] } as never]
    const texte = erreursDe(projet).join('\n')
    expect(texte).toContain('pointe')
    expect(texte).toContain('adv-essai')
  })

  it('signale une référence de panneau invalide dans un flux', () => {
    const projet = projetMinimal()
    projet.operations[0] = {
      ...projet.operations[0],
      effets: [{ verbe: 'acheminer' }],
      cibles: [],
      flux: [{ quoi: 'panneau_adv', ref: 'adv-essai.talon', de: 'adv-essai', vers: 'l-essai' }],
    } as never
    expect(erreursDe(projet).join('\n')).toContain('talon')
  })

  it('refuse une opération qui finit avant de commencer', () => {
    const projet = projetMinimal()
    projet.operations[0].tFin = 0
    expect(erreursDe(projet).join('\n')).toContain('tFin')
  })

  it('refuse une opération qui dépasse la durée du chantier', () => {
    const projet = projetMinimal()
    projet.operations[0].tFin = 5000
    expect(erreursDe(projet).join('\n')).toContain('dépasse')
  })

  it('signale un champ inconnu — probable faute de frappe', () => {
    const projet = projetMinimal() as Record<string, unknown>
    ;(projet.operations as Record<string, unknown>[])[0].ciles = ['z-essai']
    const texte = erreursDe(projet).join('\n')
    expect(texte).toContain('champ inconnu')
    expect(texte).toContain('ciles')
  })

  it('signale une longueur de zone incohérente avec ses PK', () => {
    const projet = projetMinimal()
    projet.site.zones[0].longueur = 80
    expect(erreursDe(projet).join('\n')).toContain('longueur')
  })

  it('refuse deux éléments de même identifiant', () => {
    const projet = projetMinimal()
    projet.site.zones.push({ ...projet.site.zones[0] })
    expect(erreursDe(projet).join('\n')).toContain('z-essai')
  })
})

describe('table des verbes', () => {
  it('reprend les 25 verbes de FORMAT.md, sans ajout ni oubli', () => {
    expect(NOMS_VERBES).toHaveLength(25)
  })

  it('couvre les six couches', () => {
    const couchesTouchees = new Set(Object.values(VERBES).flatMap((v) => v.couches))
    expect([...couchesTouchees].sort()).toEqual(Object.keys(COUCHES).sort())
  })
})
