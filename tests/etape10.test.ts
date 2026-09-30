import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE_PAR_DEFAUT, type TypeEngin } from '../src/plan/catalogue.ts'
import {
  ajouterEtatExploitationChantier,
  imagesDeLEtatExploitation,
  migrerChantier,
  modifierEtatExploitationChantier,
  supprimerEtatExploitationChantier,
  type Chantier,
} from '../src/plan/chantier.ts'
import {
  ajouterCommentaire,
  commentaireSousPointeur,
  deplacerCommentaire,
  miseEnPageCommentaire,
  modifierCalqueCommentaires,
  modifierCommentaire,
  modifierCommentairesImage,
  supprimerCommentaire,
  tailleBaseCommentaire,
} from '../src/plan/commentaires.ts'
import { abscissesCoupes, erreurPasCoupes, pasPresents, reglerCoupes, texteCoupes, traitsCoupes } from '../src/plan/coupes.ts'
import { largeurBandeZone } from '../src/plan/dessin.ts'
import { ajouterEngin, ajouterRame, changerVoieEngin, changerVoieRame, coteTete, empriseRame, modifierEngin, silhouetteEngin, silhouetteRame } from '../src/plan/engins.ts'
import {
  ajouterEtatExploitation,
  choisirExploitationVoie,
  contourExploitation,
  creerEtatsExploitation,
  deplacerEtatExploitation,
  erreurEtatExploitation,
  ETATS_EXPLOITATION_PAR_DEFAUT,
  etatsExploitationPresents,
  largeurBandeExploitation,
  modifierCalqueExploitation,
  voiesExploitees,
} from '../src/plan/exploitation.ts'
import { OPTIONS_PAR_DEFAUT, planchesAExporter, zonesTexte } from '../src/plan/export.ts'
import { lireChantier, serialiserChantier, VERSION_CHANTIER } from '../src/plan/fichierChantier.ts'
import { distancePointPolyligne } from '../src/plan/geometrie.ts'
import { entreesLegende, listesDe, texteEntree } from '../src/plan/legende.ts'
import { miseEnPage } from '../src/plan/planche.ts'
import { creerProjet } from '../src/plan/projet.ts'
import { cadrageIncluant, horsCadrage, nouvelleImage, projetDeImage, type PlanImage, type Synoptique } from '../src/plan/synoptique.ts'
import { pointAAbscisse } from '../src/plan/trace.ts'

// Étape 10 : état d'exploitation des voies, commentaires des images, coupes
// de tronçonnage, changement de voie d'un engin (données fictives).

const texteFixture = readFileSync(new URL('../fixtures/chantier-exemple.chantier.json', import.meta.url), 'utf-8')
const fixture = (): Chantier => {
  const lu = lireChantier(texteFixture)
  if (!lu.ok) throw new Error(lu.erreurs.join('\n'))
  return lu.chantier
}
const synoptique = (c: Chantier, id: string): Synoptique => c.synoptiques.find((s) => s.id === id)!
const valeur = <T>(r: { ok: true; valeur: T } | { ok: false; erreur: string }): T => {
  if (!r.ok) throw new Error(r.erreur)
  return r.valeur
}
const type = (modele: string): TypeEngin => CATALOGUE_PAR_DEFAUT.find((t) => t.modele === modele)!

// Deux voies parallèles horizontales à 4 px/m (V1 en haut, V2 en bas), et une
// voie tracée de droite à gauche.
const plan = (): PlanImage => ({
  ...creerProjet('Essai'),
  engins: [],
  rames: [],
  etatsZones: {},
  fleches: [],
  exploitation: {},
  commentaires: [],
  coupes: {},
  echelle: { pixelsParMetre: 4 },
  voies: [
    { id: 'voie-1', nom: 'V1', couleur: '#454f59', epaisseur: 9, points: [{ x: 100, y: 200 }, { x: 1100, y: 200 }] },
    { id: 'voie-2', nom: 'V2', couleur: '#454f59', epaisseur: 9, points: [{ x: 100, y: 230 }, { x: 1100, y: 230 }] },
    { id: 'voie-3', nom: 'Tiroir', couleur: '#454f59', epaisseur: 9, points: [{ x: 1100, y: 400 }, { x: 100, y: 400 }] },
  ],
})

describe('états d’exploitation : liste du chantier', () => {
  it('liste par défaut : Interceptée, Annoncée, Simultanée, Restituée', () => {
    expect(ETATS_EXPLOITATION_PAR_DEFAUT.map((e) => e.nom)).toEqual(['Interceptée', 'Annoncée', 'Simultanée', 'Restituée'])
    expect(new Set(ETATS_EXPLOITATION_PAR_DEFAUT.map((e) => e.couleur)).size).toBe(4)
    const liste = creerEtatsExploitation()
    liste[0].nom = 'x'
    expect(ETATS_EXPLOITATION_PAR_DEFAUT[0].nom).toBe('Interceptée')
  })

  it('ajoute, renomme, recolore, réordonne ; messages en français', () => {
    let liste = creerEtatsExploitation()
    const r = valeur(ajouterEtatExploitation(liste, '  Fermée '))
    expect(r.id).toBe('exploitation-5')
    liste = r.liste
    expect(liste[4]).toMatchObject({ nom: 'Fermée' })
    expect(erreurEtatExploitation({ nom: ' ' })).toMatch(/nom/)
    expect(erreurEtatExploitation({ couleur: 'rouge' })).toBe('Couleur invalide.')
    expect(deplacerEtatExploitation(liste, 'exploitation-5', -1).map((e) => e.id).slice(3)).toEqual(['exploitation-5', 'exploitation-4'])
    expect(deplacerEtatExploitation(liste, 'exploitation-1', -1)).toBe(liste)
  })

  it('dans le chantier : modifier une couleur change toutes les images ; supprimer retire l’état des voies', () => {
    let c = fixture()
    expect(imagesDeLEtatExploitation(c, 'exploitation-1')).toBe(2)
    expect(imagesDeLEtatExploitation(c, 'exploitation-3')).toBe(1)
    c = valeur(modifierEtatExploitationChantier(c, 'exploitation-1', { couleur: '#000000' }))
    expect(c.etatsExploitation[0].couleur).toBe('#000000')
    expect(modifierEtatExploitationChantier(c, 'exploitation-1', { nom: '' }).ok).toBe(false)
    expect(valeur(ajouterEtatExploitationChantier(c, 'Fermée')).chantier.etatsExploitation).toHaveLength(5)
    const sans = supprimerEtatExploitationChantier(c, 'exploitation-1')
    expect(sans.etatsExploitation.map((e) => e.nom)).not.toContain('Interceptée')
    expect(imagesDeLEtatExploitation(sans, 'exploitation-1')).toBe(0)
    const s = synoptique(sans, 'synoptique-4')
    expect(s.images[0].contenu.exploitation).toEqual({ 'voie-4': 'exploitation-2' })
    // Les autres synoptiques ne changent pas (même objet).
    expect(synoptique(sans, 'synoptique-1')).toBe(synoptique(c, 'synoptique-1'))
  })
})

describe('états d’exploitation : dans une image', () => {
  it('une voie entière reçoit un état, ou n’en a plus ; les autres images ne bougent pas', () => {
    const s0 = synoptique(fixture(), 'synoptique-1')
    const s1 = choisirExploitationVoie(s0, 1, 'voie-3', 'exploitation-2')
    expect(s1.images[1].contenu.exploitation).toEqual({ 'voie-3': 'exploitation-2' })
    expect(s1.images[0]).toBe(s0.images[0])
    expect(choisirExploitationVoie(s1, 1, 'voie-3', 'exploitation-2')).toBe(s1)
    expect(choisirExploitationVoie(s1, 1, 'voie-99', 'exploitation-2')).toBe(s1)
    expect(choisirExploitationVoie(s1, 1, 'voie-3', null).images[1].contenu.exploitation).toEqual({})
  })

  it('« Nouvelle image » recopie les états des voies, les commentaires et les coupes', () => {
    const s = synoptique(fixture(), 'synoptique-4')
    const r = nouvelleImage(s, 0)
    const copie = r.synoptique.images[1].contenu
    expect(copie.exploitation).toEqual(s.images[0].contenu.exploitation)
    expect(copie.commentaires).toEqual(s.images[0].contenu.commentaires)
    expect(copie.coupes).toEqual({ 'zone-1': 6 })
    // Copie indépendante.
    expect(copie.commentaires).not.toBe(s.images[0].contenu.commentaires)
  })

  it('hachures : bande autour de toute la voie, plus large que la bande d’une zone', () => {
    const p = plan()
    const voie = p.voies[0]
    expect(largeurBandeExploitation(voie)).toBeGreaterThan(largeurBandeZone(voie))
    const contour = contourExploitation(voie)
    const xs = contour.map((q) => q.x)
    const ys = contour.map((q) => q.y)
    expect(Math.min(...xs)).toBeCloseTo(100, 6)
    expect(Math.max(...xs)).toBeCloseTo(1100, 6)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(27, 6)
  })

  it('voies exploitées et états présents, dans l’ordre de la liste ; un état inconnu est ignoré', () => {
    const liste = creerEtatsExploitation()
    const contenu = { ...plan(), exploitation: { 'voie-2': 'exploitation-1', 'voie-1': 'exploitation-2', 'voie-3': 'exploitation-1', 'voie-9': 'x' } }
    expect(voiesExploitees(contenu, liste).map((v) => `${v.voie.nom}:${v.etat.nom}`)).toEqual(['V1:Annoncée', 'V2:Interceptée', 'Tiroir:Interceptée'])
    expect(etatsExploitationPresents(contenu, liste).map((e) => `${e.etat.nom} ${e.voies.join('+')}`)).toEqual(['Interceptée V2+Tiroir', 'Annoncée V1'])
  })

  it('légende : une ligne par état présent, avec ses voies ; rien si le calque est masqué', () => {
    const c = fixture()
    const s = synoptique(c, 'synoptique-4')
    const lignes = entreesLegende(s, 0, listesDe(c)).map(texteEntree)
    expect(lignes).toContain('Interceptée (V1)')
    expect(lignes).toContain('Annoncée (V2)')
    expect(lignes).toContain('Coupes rail tous les 6 m')
    expect(entreesLegende(s, 1, listesDe(c)).map(texteEntree)).toContain('Simultanée (V2)')
    const masque = modifierCalqueExploitation(s, { visible: false })
    expect(entreesLegende(masque, 0, listesDe(c)).some((e) => e.genre === 'exploitation')).toBe(false)
  })
})

describe('commentaires des images', () => {
  it('se posent, se modifient, se déplacent, se suppriment', () => {
    let r = ajouterCommentaire([], { x: 10, y: 20 })
    expect(r.id).toBe('commentaire-1')
    expect(r.commentaires[0]).toMatchObject({ texte: 'Commentaire', x: 10, y: 20, taille: 1, gras: true, encadre: true })
    r = ajouterCommentaire(r.commentaires, { x: 50, y: 60 }, 'RCT en place')
    let liste = modifierCommentaire(r.commentaires, 'commentaire-1', { texte: 'Enraillement sur platelage V2', couleur: '#a4282d' })
    expect(liste[0]).toMatchObject({ texte: 'Enraillement sur platelage V2', couleur: '#a4282d' })
    expect(modifierCommentaire(liste, 'commentaire-1', { couleur: 'rouge' })).toBe(liste)
    liste = deplacerCommentaire(liste, 'commentaire-2', { x: 5, y: -5 })
    expect(liste[1]).toMatchObject({ x: 55, y: 55 })
    expect(supprimerCommentaire(liste, 'commentaire-1').map((c) => c.texte)).toEqual(['RCT en place'])
  })

  it('cadre et lignes : plusieurs lignes, texte dans le cadre ; choisi au clic, le dernier posé d’abord', () => {
    const p = { cadrage: null, largeur: 1600, hauteur: 900 }
    const [a] = ajouterCommentaire([], { x: 100, y: 100 }, 'PRR en attente\ncôté Paris').commentaires
    const m = miseEnPageCommentaire(a, p)
    expect(m.taille).toBeCloseTo(tailleBaseCommentaire(p), 9)
    // Proportionnée à la partie du plan montrée : deux fois plus petite sur un cadrage deux fois plus étroit.
    expect(tailleBaseCommentaire({ ...p, cadrage: { x: 0, y: 0, largeur: 800, hauteur: 300 } })).toBeCloseTo(m.taille / 2, 9)
    expect(m.lignes.map((l) => l.texte)).toEqual(['PRR en attente', 'côté Paris'])
    expect(m.boite.x).toBe(100)
    expect(m.boite.y).toBe(100)
    for (const l of m.lignes) {
      expect(l.x).toBeGreaterThan(m.boite.x)
      expect(l.y).toBeLessThan(m.boite.y + m.boite.hauteur)
    }
    expect(m.lignes[1].y - m.lignes[0].y).toBeCloseTo(m.interligne, 9)
    const grand = miseEnPageCommentaire({ ...a, taille: 2 }, p)
    expect(grand.boite.largeur).toBeCloseTo(2 * m.boite.largeur, 6)
    const deux = ajouterCommentaire([a], { x: 110, y: 110 }, 'Autre').commentaires
    expect(commentaireSousPointeur(deux, p, { x: 115, y: 115 }, 2)).toBe('commentaire-2')
    expect(commentaireSousPointeur(deux, p, { x: 900, y: 900 }, 2)).toBeNull()
  })

  it('ne touchent que l’image modifiée ; calque visible / verrouillé', () => {
    const s = synoptique(fixture(), 'synoptique-4')
    const s2 = modifierCommentairesImage(s, 1, (l) => supprimerCommentaire(l, 'commentaire-1'))
    expect(s2.images[1].contenu.commentaires).toEqual([])
    expect(s2.images[0]).toBe(s.images[0])
    expect(modifierCommentairesImage(s, 1, (l) => l)).toBe(s)
    expect(modifierCalqueCommentaires(s, { verrouille: true }).calqueCommentaires).toEqual({ visible: true, verrouille: true })
  })

  it('export PowerPoint « Textes modifiables » : une zone de texte par commentaire, à sa place', () => {
    const c = fixture()
    const s = synoptique(c, 'synoptique-4')
    const [planche] = planchesAExporter(s, [0], listesDe(c), OPTIONS_PAR_DEFAUT)
    const zones = planche.zones.filter((z) => z.nom === 'commentaire')
    expect(zones).toHaveLength(2)
    expect(zones[0]).toMatchObject({ fond: '#ffffff', paragraphes: [{ texte: 'Retour courant traction en place', gras: true }], alignement: 'gauche' })
    expect(zones[0].bord).not.toBeNull()
    // Sans cadre : ni fond ni bord ; deux lignes, deux paragraphes.
    expect(zones[1]).toMatchObject({ fond: null, bord: null, couleur: '#a4282d' })
    expect(zones[1].paragraphes.map((p) => p.texte)).toEqual(['Pelle en attente', 'côté Nord'])
    // Position : celle du cadre sur la planche, ramenée dans la page.
    const page = miseEnPage(s, 0, listesDe(c))
    const m = miseEnPageCommentaire(s.images[0].contenu.commentaires[0], s)
    const k = planche.cible.largeur / page.planche.largeur
    expect(zones[0].x).toBeCloseTo(planche.cible.x + (m.boite.x - page.planche.x) * k, 9)
    expect(zones[0].largeur).toBeCloseTo(m.boite.largeur * k, 9)
    // Calque masqué, ou export tout en image : pas de zone de texte.
    expect(zonesTexte(modifierCalqueCommentaires(s, { visible: false }), 0, page, planche.cible).some((z) => z.nom === 'commentaire')).toBe(false)
    expect(planchesAExporter(s, [0], listesDe(c), { ...OPTIONS_PAR_DEFAUT, textes: 'image' })[0].zones).toEqual([])
  })
})

describe('coupes de tronçonnage', () => {
  const echelle = { pixelsParMetre: 4 }
  const voie = plan().voies[0]
  const zone = { debut: 100, fin: 220 } // 120 px = 30 m

  it('tous les 6 m sur 30 m : 6 traits, bouts compris, à l’échelle', () => {
    const abscisses = abscissesCoupes(voie, zone, 6, echelle)
    expect(abscisses).toHaveLength(6)
    abscisses.forEach((s, i) => expect(s).toBeCloseTo(100 + i * 24, 9))
    const traits = traitsCoupes(voie, zone, 6, echelle)
    // En travers de la voie (verticaux ici), plus longs que la bande de la zone.
    for (const [a, b] of traits) {
      expect(a.x).toBeCloseTo(b.x, 9)
      expect(Math.abs(a.y - b.y)).toBeGreaterThan(largeurBandeZone(voie))
    }
  })

  it('depuis le bout gauche de la zone, même sur une voie tracée de droite à gauche ; le reste à droite', () => {
    const tiroir = plan().voies[2]
    // 7 m : 4 panneaux de 7 m et un reste de 2 m, côté droit.
    const abscisses = abscissesCoupes(tiroir, zone, 7, echelle)
    const xs = abscisses.map((s) => pointAAbscisse(tiroir.points, s).point.x)
    expect(xs[0]).toBeCloseTo(Math.min(...xs), 9)
    expect(xs[1] - xs[0]).toBeCloseTo(28, 9)
    expect(xs[xs.length - 1] - xs[xs.length - 2]).toBeCloseTo(8, 9)
  })

  it('réglage par image : affichées, écart modifié, retirées ; écart vérifié', () => {
    const s = synoptique(fixture(), 'synoptique-1')
    const s1 = valeur(reglerCoupes(s, 0, 'zone-1', 6))
    expect(s1.images[0].contenu.coupes).toEqual({ 'zone-1': 6 })
    expect(s1.images[1]).toBe(s.images[1])
    expect(valeur(reglerCoupes(s1, 0, 'zone-1', 6))).toBe(s1)
    expect(reglerCoupes(s1, 0, 'zone-1', 0).ok).toBe(false)
    expect(erreurPasCoupes(200)).toMatch(/mètres/)
    expect(valeur(reglerCoupes(s1, 0, 'zone-1', null)).images[0].contenu.coupes).toEqual({})
    expect(texteCoupes(6)).toBe('Coupes rail tous les 6 m')
    expect(texteCoupes(4.5)).toBe('Coupes rail tous les 4,5 m')
    expect(pasPresents({ zones: s.images[0].contenu.zones, coupes: { 'zone-1': 6, 'zone-2': 6, 'zone-3': 3, 'zone-99': 1 } })).toEqual([3, 6])
  })
})

describe('changer un engin de voie', () => {
  it('passe sur la voie voisine au plus près, en gardant numéro, couleur, description et type', () => {
    let p = plan()
    const r = ajouterEngin(p, type('CAT 323'), { genre: 'voie', voieId: 'voie-2', abscisse: 400 })
    p = modifierEngin(r.planche, r.id, { numero: '1', couleur: '#123456', description: 'dépose' })
    const avant = p.engins[0]
    const apres = changerVoieEngin(p, r.id, 'voie-1')
    const e = apres.engins[0]
    expect(e).toMatchObject({ id: avant.id, typeId: avant.typeId, type: avant.type, numero: '1', couleur: '#123456', description: 'dépose' })
    expect(e.position).toEqual({ genre: 'voie', voieId: 'voie-1', abscisse: 400 })
    expect(silhouetteEngin(apres, e)!.centre).toEqual({ x: 500, y: 200 })
    // Même voie : rien ne change.
    expect(changerVoieEngin(apres, r.id, 'voie-1')).toBe(apres)
    expect(changerVoieEngin(apres, 'engin-99', 'voie-2')).toBe(apres)
  })

  it('déraillement puis enraillement : libre à l’endroit où il était, puis sur une autre voie', () => {
    const r = ajouterEngin(plan(), type('CAT 323'), { genre: 'voie', voieId: 'voie-1', abscisse: 300 })
    const libre = changerVoieEngin(r.planche, r.id, null)
    expect(libre.engins[0].position).toEqual({ genre: 'libre', x: 400, y: 200, angle: 0 })
    expect(changerVoieEngin(libre, r.id, null)).toBe(libre)
    const loin = { ...libre, engins: libre.engins.map((e) => ({ ...e, position: { genre: 'libre' as const, x: 700, y: 380, angle: 30 } })) }
    const sur = changerVoieEngin(loin, r.id, 'voie-3')
    // Voie tracée de droite à gauche : abscisse 400 depuis x = 1100.
    expect(sur.engins[0].position).toEqual({ genre: 'voie', voieId: 'voie-3', abscisse: 400 })
    expect(sur.engins[0].numero).toBe(libre.engins[0].numero)
  })

  it('une rame change de voie en gardant sa composition et le côté de sa tête', () => {
    const vehicules = [type('BB 61000'), type('R39'), type('R39')].map((t) => ({ typeId: t.id, type: { ...t } }))
    const r = ajouterRame(plan(), vehicules, 'voie-1', 500)
    const cote = coteTete(r.planche, r.planche.rames[0])
    const sur = changerVoieRame(r.planche, r.id, 'voie-3')
    const rame = sur.rames[0]
    expect(rame.voieId).toBe('voie-3')
    expect(rame.vehicules).toEqual(r.planche.rames[0].vehicules)
    expect(coteTete(sur, rame)).toBe(cote)
    expect(silhouetteRame(sur, rame)!.milieu.centre.x).toBeCloseTo(silhouetteRame(r.planche, r.planche.rames[0])!.milieu.centre.x, 6)
    expect(distancePointPolyligne(silhouetteRame(sur, rame)!.milieu.centre, sur.voies[2].points)).toBeCloseTo(0, 6)
  })
})

describe('rame et cadrage : les wagons restent visibles', () => {
  const s = { cadrage: { x: 300, y: 100, largeur: 400, hauteur: 200 }, largeur: 1600, hauteur: 900 }

  it('une rame qui sort du cadrage est repérée ; le cadrage s’agrandit juste assez, dans le plan', () => {
    const vehicules = Array.from({ length: 8 }, () => ({ typeId: type('R39').id, type: { ...type('R39') } }))
    const r = ajouterRame(plan(), vehicules, 'voie-1', 500)
    const emprise = empriseRame(r.planche, r.planche.rames[0])!
    // 8 × 19,9 m × 4 = 636,8 px de long.
    expect(emprise.largeur).toBeCloseTo(636.8, 6)
    expect(horsCadrage(s, emprise)).toBe(true)
    const cadrage = cadrageIncluant(s, emprise, 10)!
    expect(horsCadrage({ ...s, cadrage }, emprise)).toBe(false)
    expect(cadrage.x).toBeCloseTo(emprise.x - 10, 6)
    expect(cadrage.y).toBe(100)
    // Déjà dedans : même cadrage.
    expect(cadrageIncluant({ ...s, cadrage }, emprise, 10)).toBe(cadrage)
  })
})

describe('fichier de chantier version 6 et migrations', () => {
  it('écrit la version 6 et relit tout à l’identique (exploitation, commentaires, coupes, calques)', () => {
    const c = fixture()
    expect(VERSION_CHANTIER).toBe(6)
    const texte = serialiserChantier(c)
    expect(JSON.parse(texte).version).toBe(6)
    const relu = lireChantier(texte)
    expect(relu.ok && relu.chantier).toEqual(c)
    const s = synoptique(c, 'synoptique-4')
    expect(s.images[0].contenu.commentaires.map((x) => x.texte)).toEqual(['Retour courant traction en place', 'Pelle en attente\ncôté Nord'])
  })

  it('un fichier de version 5 s’ouvre : liste par défaut, ni hachures, ni commentaires, ni coupes', () => {
    const brut = JSON.parse(texteFixture)
    brut.version = 5
    delete brut.etatsExploitation
    brut.synoptiques = brut.synoptiques.slice(0, 3)
    for (const s of brut.synoptiques) {
      delete s.calqueExploitation
      delete s.calqueCommentaires
    }
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    expect(lu.chantier.etatsExploitation).toEqual(creerEtatsExploitation())
    for (const s of lu.chantier.synoptiques) {
      expect(s.calqueExploitation).toEqual({ visible: true, verrouille: false })
      for (const im of s.images) expect(im.contenu).toMatchObject({ exploitation: {}, commentaires: [], coupes: {} })
    }
  })

  it('refuse les données incohérentes, avec un message en français', () => {
    const brut = JSON.parse(texteFixture)
    brut.synoptiques[3].images[0].contenu.exploitation['voie-3'] = 'exploitation-99'
    brut.synoptiques[3].images[0].contenu.coupes['zone-99'] = 6
    brut.synoptiques[3].images[0].contenu.commentaires[0].couleur = 'rouge'
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(false)
    if (lu.ok) return
    expect(lu.erreurs.join('\n')).toMatch(/état inconnu/)
    expect(lu.erreurs.join('\n')).toMatch(/zone « zone-99 » n'existe pas/)
    expect(lu.erreurs.join('\n')).toMatch(/couleur « rouge »/)
  })

  it('une version plus récente est refusée (l’application en production ne l’abîme pas)', () => {
    const brut = { ...JSON.parse(texteFixture), version: VERSION_CHANTIER + 1 }
    const lu = lireChantier(JSON.stringify(brut))
    expect(lu.ok).toBe(false)
    if (!lu.ok) expect(lu.erreurs[0]).toMatch(/version plus récente/)
  })

  it('un chantier gardé dans le navigateur avant l’étape 10 est complété', () => {
    const ancien = JSON.parse(JSON.stringify(fixture()))
    delete ancien.etatsExploitation
    for (const s of ancien.synoptiques) {
      delete s.calqueExploitation
      delete s.calqueCommentaires
      for (const im of s.images) {
        delete im.contenu.exploitation
        delete im.contenu.commentaires
        delete im.contenu.coupes
      }
    }
    const { chantier } = migrerChantier(ancien)
    expect(chantier.etatsExploitation).toEqual(creerEtatsExploitation())
    const s = synoptique(chantier, 'synoptique-2')
    expect(s.calqueCommentaires).toEqual({ visible: true, verrouille: false })
    expect(projetDeImage(s, s.images[0])).toMatchObject({ exploitation: {}, commentaires: [], coupes: {} })
    // Un chantier déjà complet n'est pas touché.
    expect(migrerChantier(fixture()).chantier).toEqual(fixture())
  })
})
