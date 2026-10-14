import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Chantier } from '../src/plan/chantier.ts'
import { miseEnPageCommentaire } from '../src/plan/commentaires.ts'
import { lireChantier } from '../src/plan/fichierChantier.ts'
import { annuler, creerHistorique, enregistrer } from '../src/plan/historique.ts'
import { listesDe } from '../src/plan/legende.ts'
import { miseEnPage, texteEtape } from '../src/plan/planche.ts'
import type { Point } from '../src/plan/projet.ts'
import type { Synoptique } from '../src/plan/synoptique.ts'
import {
  actionToucheEdition,
  appliquerTexte,
  champEdition,
  syntheseEdition,
  texteDe,
  texteMultiligne,
  texteSousPointeur,
  type TexteEditable,
} from '../src/plan/textesPlanche.ts'

// Modifier les textes de la planche en double-cliquant dessus (« je veux
// pouvoir modifier les textes en cliquant, même dans le phasage ou dans le
// titre ») : commentaires, libellés des flèches, bandeau, titre du créneau,
// étapes du PHASAGE. Données fictives.

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const c = fixture()
const listes = listesDe(c)
const synoptique = (id: string): Synoptique => c.synoptiques.find((s) => s.id === id)!
// Synoptique 3 : bandeau, deux étapes, cinq flèches dont une avec libellé.
const s3 = synoptique('synoptique-3')
// Synoptique 4 : des commentaires.
const s4 = synoptique('synoptique-4')
const centre = (r: { x: number; y: number; largeur: number; hauteur: number }): Point => ({ x: r.x + r.largeur / 2, y: r.y + r.hauteur / 2 })
const tous = { commentaires: true, fleches: true }

describe('touches pendant la frappe', () => {
  it('Entrée valide, Maj+Entrée va à la ligne, Échap annule ; un libellé de flèche tient sur une ligne', () => {
    expect(actionToucheEdition('Enter', false)).toBe('valider')
    expect(actionToucheEdition('Enter', true)).toBe('aLaLigne')
    expect(actionToucheEdition('Enter', true, false)).toBe('valider')
    expect(actionToucheEdition('Escape', true, false)).toBe('annuler')
    for (const t of ['t', 'Delete', 'z', 'ArrowRight', '1']) expect(actionToucheEdition(t, false)).toBeNull()
    expect(texteMultiligne({ genre: 'fleche', id: 'fleche-1' })).toBe(false)
    for (const cible of [{ genre: 'bandeau' }, { genre: 'creneau' }, { genre: 'etape', position: 0 }, { genre: 'commentaire', id: 'x' }] as TexteEditable[])
      expect(texteMultiligne(cible)).toBe(true)
  })
})

describe('le texte modifiable de chaque cible', () => {
  it('bandeau, titre du créneau, libellé d’une étape (sans son numéro), libellé de flèche, commentaire', () => {
    expect(texteDe(s3, 0, { genre: 'bandeau' })).toBe(s3.bandeau)
    expect(texteDe(s3, 0, { genre: 'creneau' })).toBe('')
    expect(texteDe(s3, 0, { genre: 'etape', position: 1 })).toBe('Chargement des déblais dans le TTX 1')
    expect(texteDe(s3, 0, { genre: 'fleche', id: 'fleche-5' })).toBe('retour à vide')
    expect(texteDe(s4, 0, { genre: 'commentaire', id: s4.images[0].contenu.commentaires[0].id })).toBe(s4.images[0].contenu.commentaires[0].texte)
    // Ce qui n'existe pas dans l'image : null.
    expect(texteDe(s3, 0, { genre: 'etape', position: 9 })).toBeNull()
    expect(texteDe(s3, 1, { genre: 'fleche', id: 'fleche-2' })).toBeNull()
    expect(texteDe(s3, 7, { genre: 'bandeau' })).toBeNull()
  })
})

describe('appliquer le texte tapé', () => {
  it('une seule étape d’annulation par modification ; texte inchangé : rien', () => {
    const cibles: [TexteEditable, string][] = [
      [{ genre: 'bandeau' }, 'RVB V1 — titre retouché'],
      [{ genre: 'creneau' }, 'Phase de déballastage'],
      [{ genre: 'etape', position: 1 }, 'Chargement des déblais\ndans le TTX 1'],
      [{ genre: 'fleche', id: 'fleche-5' }, 'retour du TTX'],
    ]
    for (const [cible, texte] of cibles) {
      expect(appliquerTexte(s3, 0, cible, texteDe(s3, 0, cible)!)).toBe(s3)
      let h = creerHistorique(s3)
      h = enregistrer(h, appliquerTexte(s3, 0, cible, texte))
      expect(texteDe(h.present, 0, cible)).toBe(texte)
      expect(h.passe).toHaveLength(1)
      h = annuler(h)
      expect(h.present).toBe(s3)
    }
    const id = s4.images[0].contenu.commentaires[0].id
    const s = appliquerTexte(s4, 0, { genre: 'commentaire', id }, 'RCT en place')
    expect(texteDe(s, 0, { genre: 'commentaire', id })).toBe('RCT en place')
    expect(s.images[1]).toBe(s4.images[1])
  })

  it('l’étape garde son numéro ; seule l’image courante change (le bandeau, lui, est commun)', () => {
    const s = appliquerTexte(s3, 0, { genre: 'etape', position: 0 }, 'Déballastage depuis le Sud')
    expect(s.images[0].phasage[0]).toEqual({ numero: 1, libelle: 'Déballastage depuis le Sud' })
    expect(texteEtape(s.images[0].phasage[0])).toBe('1 – Déballastage depuis le Sud')
    expect(s.images[0].phasage[1]).toBe(s3.images[0].phasage[1])
    expect(s.images[1]).toBe(s3.images[1])
    const t = appliquerTexte(s3, 0, { genre: 'creneau' }, 'Phase 1')
    expect(t.images[1].titre).toBe('')
    const b = appliquerTexte(s3, 1, { genre: 'bandeau' }, 'Nouveau bandeau')
    expect(miseEnPage(b, 0, listes).bandeau?.lignes.map((l) => l.texte)).toEqual(['Nouveau bandeau'])
  })

  it('texte vidé : comme dans les panneaux (étape gardée avec son numéro, bandeau et titre disparus)', () => {
    const vide = appliquerTexte(s3, 0, { genre: 'etape', position: 1 }, '')
    expect(vide.images[0].phasage).toHaveLength(2)
    expect(vide.images[0].phasage[1]).toEqual({ numero: 2, libelle: '' })
    expect(miseEnPage(vide, 0, listes).phasage?.lignes.map((l) => l.texte)).toContain('2 –')
    expect(miseEnPage(appliquerTexte(s3, 0, { genre: 'bandeau' }, ''), 0, listes).bandeau).toBeNull()
    const titre = appliquerTexte(s3, 0, { genre: 'creneau' }, 'Phase 1')
    expect(miseEnPage(appliquerTexte(titre, 0, { genre: 'creneau' }, ''), 0, listes).creneau.titre).toBe(0)
    expect(appliquerTexte(s3, 0, { genre: 'fleche', id: 'fleche-5' }, '').images[0].contenu.fleches.find((f) => f.id === 'fleche-5')?.libelle).toBe('')
  })

  it('un libellé de flèche reste sur une ligne ; une cible absente ne change rien', () => {
    const s = appliquerTexte(s3, 0, { genre: 'fleche', id: 'fleche-5' }, 'retour\n à vide')
    expect(texteDe(s, 0, { genre: 'fleche', id: 'fleche-5' })).toBe('retour à vide')
    expect(s).toBe(s3)
    expect(appliquerTexte(s3, 0, { genre: 'etape', position: 9 }, 'x')).toBe(s3)
    expect(appliquerTexte(s3, 1, { genre: 'fleche', id: 'fleche-2' }, 'x')).toBe(s3)
  })
})

describe('mise en page : lignes du titre du créneau et de chaque étape', () => {
  it('le créneau compte ses lignes de titre ; chaque étape connaît ses lignes', () => {
    expect(miseEnPage(s3, 0, listes).creneau.titre).toBe(0)
    const s = appliquerTexte(s3, 0, { genre: 'creneau' }, 'Phase\nde déballastage')
    const p = miseEnPage(s, 0, listes).creneau
    expect(p.titre).toBe(2)
    expect(p.lignes.slice(0, 2).map((l) => l.texte)).toEqual(['Phase', 'de déballastage'])
    const deux = appliquerTexte(s3, 0, { genre: 'etape', position: 0 }, 'Déballastage\nsur deux lignes')
    const ph = miseEnPage(deux, 0, listes).phasage!
    expect(ph.etapes).toEqual([
      { debut: 0, fin: 2 },
      { debut: 2, fin: 3 },
    ])
    expect(ph.lignes[2].texte.startsWith('2 – ')).toBe(true)
  })
})

describe('le champ de saisie, à la place du texte', () => {
  it('bandeau : son cadre, centré, en gras ; vide : un champ à sa place quand même', () => {
    const page = miseEnPage(s3, 0, listes)
    const champ = champEdition(s3, 0, listes, { genre: 'bandeau' }, s3.bandeau)!
    expect(champ.boite).toEqual(page.bandeau!.boite)
    expect(champ).toMatchObject({ centre: true, gras: true, taille: page.bandeau!.lignes[0].taille, multiligne: true, coupe: true, prefixe: '' })
    const vide = champEdition(s3, 0, listes, { genre: 'bandeau' }, '')
    expect(vide).not.toBeNull()
    expect(vide!.boite.hauteur).toBeGreaterThan(0)
    // La planche dessinée pendant la frappe garde la place du texte vide.
    expect(miseEnPage(syntheseEdition(s3, 0, { genre: 'bandeau' }, ''), 0, listes).bandeau).not.toBeNull()
  })

  it('étape : le numéro fixe devant le champ, à la hauteur de ses lignes', () => {
    const page = miseEnPage(s3, 0, listes)
    const ph = page.phasage!
    const champ = champEdition(s3, 0, listes, { genre: 'etape', position: 1 }, texteDe(s3, 0, { genre: 'etape', position: 1 })!)!
    expect(champ.prefixe).toBe('2 – ')
    const premiere = ph.lignes[ph.etapes[1].debut]
    expect(champ.boite.y).toBeLessThan(premiere.y)
    expect(champ.boite.y + champ.boite.hauteur).toBeGreaterThan(premiere.y)
    expect(champ.boite.x + champ.retrait.x).toBeCloseTo(premiere.x, 9)
    expect(champ.taille).toBe(premiere.taille)
  })

  it('créneau : le champ couvre le titre, les heures restent dessous', () => {
    const s = appliquerTexte(s3, 0, { genre: 'creneau' }, 'Phase 1')
    const page = miseEnPage(s, 0, listes)
    const champ = champEdition(s, 0, listes, { genre: 'creneau' }, 'Phase 1')!
    expect(champ.boite.y).toBe(page.creneau.boite.y)
    expect(champ.boite.y + champ.boite.hauteur).toBeLessThan(page.creneau.lignes[1].y)
    expect(champ.boite.y + champ.boite.hauteur).toBeGreaterThan(page.creneau.lignes[0].y)
  })

  it('libellé de flèche : le long de la flèche, sur une ligne ; commentaire : son cadre', () => {
    const champ = champEdition(s3, 0, listes, { genre: 'fleche', id: 'fleche-5' }, 'retour à vide')!
    expect(champ.rotation).not.toBeNull()
    expect(champ).toMatchObject({ multiligne: false, coupe: false, gras: true, centre: true })
    // Plus long : plus large.
    expect(champEdition(s3, 0, listes, { genre: 'fleche', id: 'fleche-5' }, 'retour à vide du TTX')!.boite.largeur).toBeGreaterThan(champ.boite.largeur)
    const com = s4.images[0].contenu.commentaires[0]
    const champCom = champEdition(s4, 0, listes, { genre: 'commentaire', id: com.id }, com.texte)!
    const m = miseEnPageCommentaire(com, s4)
    expect(champCom.boite.x).toBe(m.boite.x)
    expect(champCom.boite.y).toBe(m.boite.y)
    expect(champCom).toMatchObject({ couleur: com.couleur, taille: m.taille, coupe: false })
    expect(champEdition(s3, 0, listes, { genre: 'etape', position: 9 }, 'x')).toBeNull()
  })
})

describe('le texte sous le pointeur (double-clic)', () => {
  const page = miseEnPage(s3, 0, listes)
  it('bandeau, créneau, chaque étape du PHASAGE', () => {
    expect(texteSousPointeur(s3, 0, listes, centre(page.bandeau!.boite), 0, tous)).toEqual({ genre: 'bandeau' })
    expect(texteSousPointeur(s3, 0, listes, centre(page.creneau.boite), 0, tous)).toEqual({ genre: 'creneau' })
    const ph = page.phasage!
    for (const [position, e] of ph.etapes.entries()) {
      const l = ph.lignes[e.debut]
      expect(texteSousPointeur(s3, 0, listes, { x: l.x + 5, y: l.y - l.taille * 0.3 }, 0, tous)).toEqual({ genre: 'etape', position })
    }
    // L'en-tête « PHASAGE » ne se modifie pas.
    expect(texteSousPointeur(s3, 0, listes, centre(ph.entete), 0, tous)).toBeNull()
  })

  it('bandeau vide : double-clic à sa place pour le retaper', () => {
    const sans = appliquerTexte(s3, 0, { genre: 'bandeau' }, '')
    expect(texteSousPointeur(sans, 0, listes, centre(page.bandeau!.boite), 0, tous)).toEqual({ genre: 'bandeau' })
  })

  it('libellé ou trait d’une flèche, commentaire ; pas quand leur calque est verrouillé', () => {
    const champ = champEdition(s3, 0, listes, { genre: 'fleche', id: 'fleche-5' }, 'retour à vide')!
    const sur = { x: champ.rotation!.x, y: champ.rotation!.y - champ.taille * 0.3 }
    expect(texteSousPointeur(s3, 0, listes, sur, 0, tous)).toEqual({ genre: 'fleche', id: 'fleche-5' })
    expect(texteSousPointeur(s3, 0, listes, sur, 0, { commentaires: true, fleches: false })).toBeNull()
    const f1 = s3.images[0].contenu.fleches.find((f) => f.id === 'fleche-1')!
    const milieu = { x: (f1.points[0].x + f1.points[1].x) / 2, y: (f1.points[0].y + f1.points[1].y) / 2 }
    expect(texteSousPointeur(s3, 0, listes, milieu, 1, tous)).toEqual({ genre: 'fleche', id: 'fleche-1' })
    const com = s4.images[0].contenu.commentaires[0]
    const b = miseEnPageCommentaire(com, s4).boite
    expect(texteSousPointeur(s4, 0, listes, centre(b), 0, tous)).toEqual({ genre: 'commentaire', id: com.id })
    expect(texteSousPointeur(s4, 0, listes, centre(b), 0, { commentaires: false, fleches: true })).toBeNull()
  })
})
