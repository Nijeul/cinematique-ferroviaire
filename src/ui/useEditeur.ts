import { useCallback, useEffect, useRef, useState } from 'react'
import { accrocherVoie, CALQUE_DU_GENRE, existe, type Genre, type Reference } from '../plan/detection.ts'
import { ajouterVoie, dependancesVoie, supprimerPoint, remplacerFond, type Dependances } from '../plan/edition.ts'
import { ajouterCadre, ajouterCommunication, ajouterAppareil, ajouterTexte, ajouterZone, jumeau, supprimerElement } from '../plan/elements.ts'
import { bornerPage } from '../plan/fond.ts'
import {
  ajouterEngin,
  ajouterRame,
  avertissementDepassement,
  silhouetteEngin,
  silhouetteRame,
  vehiculesDeGroupes,
  type Groupe,
} from '../plan/engins.ts'
import { terminerTrace } from '../plan/geometrie.ts'
import { annuler, creerHistorique, enregistrer, peutAnnuler, peutRetablir, retablir } from '../plan/historique.ts'
import { lireProjet } from '../plan/lecture.ts'
import { nomDeFichier, serialiserProjet, type Point, type PositionEngin, type Projet, type TypeEngin } from '../plan/projet.ts'
import type { Vue } from '../plan/vue.ts'
import { fermerPdf, ouvrirFond, rendrePage, type PdfOuvert } from './fondDePlan.ts'
import { telecharger } from './navigateur.ts'

// L'état de l'éditeur d'un plan et toutes ses actions : projet et historique,
// outil, sélection, tracé ou pose en cours, vue, fond PDF ouvert, messages,
// raccourcis. Le plan vient du chantier ; chaque changement lui est renvoyé
// (`surChangement`), et c'est le chantier qui l'enregistre dans le navigateur.
// `suspendu` : une fenêtre est ouverte par-dessus, les raccourcis se taisent.

export type Outil = 'selection' | 'voie' | 'zone' | 'bs' | 'communication' | 'cadre' | 'texte' | 'engin' | 'rame' | 'main'
// Élément choisi ; pour une voie, `point` désigne en plus le point choisi.
export type Selection = (Reference & { point: number | null }) | null
// Premier clic d'une zone, d'un BS ou d'une communication, en attente du second.
export type Pose = { outil: 'zone' | 'bs' | 'communication'; voieId: string; abscisse: number } | null
export type Message = { genre: 'info' | 'erreur'; texte: string; details?: string[] }

export const TOUCHES: Record<Outil, string> = {
  selection: 'S',
  voie: 'T',
  zone: 'Z',
  bs: 'B',
  communication: 'C',
  cadre: 'R',
  texte: 'X',
  engin: 'E',
  rame: 'W',
  main: 'M',
}

// L'outil « Échelle » ouvre la fenêtre de calage.
export const TOUCHE_ECHELLE = 'L'

export const RAISON_SANS_ECHELLE =
  "Calez d'abord l'échelle du plan (bouton « Échelle… ») : sans elle, les engins ne peuvent pas être à la bonne taille."


const NOM_CALQUE: Record<Genre, string> = {
  cadre: 'Cadres',
  voie: 'Voies',
  zone: 'Zones',
  appareil: 'Appareils',
  engin: 'Engins',
  rame: 'Engins',
  texte: 'Textes',
}

const estChampDeSaisie = (cible: EventTarget | null): boolean =>
  cible instanceof HTMLElement &&
  (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName))

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export type OptionsEditeur = {
  // Une fenêtre est ouverte par-dessus : les raccourcis se taisent.
  suspendu: boolean
  // Le catalogue d'engins du chantier.
  catalogue: TypeEngin[]
  ouvrirEchelle: () => void
}

export function useEditeur(projetInitial: Projet, surChangement: (projet: Projet) => void, options: OptionsEditeur) {
  const { suspendu, catalogue, ouvrirEchelle } = options
  const [historique, setHistorique] = useState(() => creerHistorique(projetInitial))
  const [outil, setOutil] = useState<Outil>('voie')
  const [typeChoisiId, setTypeChoisi] = useState<string | null>(catalogue[0]?.id ?? null)
  const [composition, setComposition] = useState<Groupe[]>([])
  const [selectionBrute, setSelection] = useState<Selection>(null)
  const [trace, setTrace] = useState<Point[] | null>(null)
  const [pose, setPose] = useState<Pose>(null)
  const [texteAFocaliser, setTexteAFocaliser] = useState<string | null>(null)
  const [vue, setVue] = useState<Vue | null>(null)
  const [espace, setEspace] = useState(false)
  const [pdf, setPdf] = useState<PdfOuvert | null>(null)
  const [occupe, setOccupe] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const jetonPage = useRef(0)

  const projet = historique.present

  // Une sélection qui ne correspond plus à rien (après Annuler…) est ignorée.
  const selection: Selection = (() => {
    if (!selectionBrute || !existe(projet, selectionBrute)) return null
    if (selectionBrute.genre !== 'voie' || selectionBrute.point === null) return { ...selectionBrute, point: null }
    const voie = projet.voies.find((v) => v.id === selectionBrute.id)
    return { ...selectionBrute, point: voie && selectionBrute.point < voie.points.length ? selectionBrute.point : null }
  })()
  // Pose en attente sur une voie qui n'existe plus : abandonnée.
  const poseValide = pose && pose.outil === outil && projet.voies.some((v) => v.id === pose.voieId) ? pose : null

  const modifier = useCallback((transformer: (p: Projet) => Projet, cle: string | null = null) => {
    setHistorique((h) => enregistrer(h, transformer(h.present), cle))
  }, [])

  const choisir = (genre: Genre, id: string) => setSelection({ genre, id, point: null })

  // Chaque nouvel état du plan part au chantier (qui l'enregistre).
  const rappel = useRef(surChangement)
  useEffect(() => {
    rappel.current = surChangement
  })
  useEffect(() => {
    if (projet !== projetInitial) rappel.current(projet)
  }, [projet, projetInitial])

  const erreur = (texte: string) => setMessage({ genre: 'erreur', texte })

  // On ne crée ni ne modifie rien sur un calque verrouillé.
  const calqueModifiable = (genre: Genre): boolean => {
    if (!projet.calques[CALQUE_DU_GENRE[genre]].verrouille) return true
    erreur(`Le calque « ${NOM_CALQUE[genre]} » est verrouillé : décochez « Verrouillé » dans le panneau pour le modifier.`)
    return false
  }

  const terminer = (tolerance: number) => {
    if (!trace) return
    const points = terminerTrace(trace, tolerance)
    setTrace(null)
    if (!points) return
    const { projet: suivant, id } = ajouterVoie(projet, points)
    modifier(() => suivant)
    choisir('voie', id)
  }

  const ajouterPointTrace = (p: Point) => {
    if (!trace && !calqueModifiable('voie')) return
    setTrace((t) => [...(t ?? []), p])
  }
  const retirerDernierPointTrace = () => setTrace((t) => (t && t.length > 1 ? t.slice(0, -1) : null))

  const choisirOutil = (nouvel: Outil) => {
    if ((nouvel === 'engin' || nouvel === 'rame') && !projet.echelle) {
      erreur(RAISON_SANS_ECHELLE)
      return
    }
    if (trace) terminer(0)
    setPose(null)
    setOutil(nouvel)
  }

  // Type choisi pour l'outil Engin (le premier du catalogue par défaut).
  const typeChoisi = catalogue.find((t) => t.id === typeChoisiId) ?? catalogue[0]

  // Pose d'un engin : le long de la voie cliquée, ou libre loin de toute voie.
  const poserEngin = (p: Point, tolerance: number) => {
    if (!projet.echelle) return erreur(RAISON_SANS_ECHELLE)
    if (!calqueModifiable('engin')) return
    if (!typeChoisi) return erreur("Le catalogue d'engins du chantier est vide : ajoutez un type dans la page du chantier.")
    const accroche = projet.calques.voies.visible ? accrocherVoie(projet.voies, p, tolerance) : null
    const position: PositionEngin = accroche
      ? { genre: 'voie', voieId: accroche.voieId, abscisse: accroche.abscisse }
      : { genre: 'libre', x: p.x, y: p.y, angle: 0 }
    const { projet: suivant, id } = ajouterEngin(projet, typeChoisi, position)
    modifier(() => suivant)
    choisir('engin', id)
    const engin = suivant.engins.find((e) => e.id === id)!
    const voie = accroche ? projet.voies.find((v) => v.id === accroche.voieId) : undefined
    const depasse = avertissementDepassement(`« ${typeChoisi.modele} »`, voie, silhouetteEngin(suivant, engin)?.depassement ?? 0)
    setMessage(
      depasse
        ? { genre: 'erreur', texte: depasse }
        : accroche
          ? null
          : { genre: 'info', texte: `« ${typeChoisi.modele} » posé hors voie : tournez-le avec la poignée ronde ou le champ « Angle » du panneau.` },
    )
  }

  // Pose d'une rame composée dans le panneau : centrée sur le point cliqué de la voie.
  const poserRame = (p: Point, tolerance: number) => {
    if (!projet.echelle) return erreur(RAISON_SANS_ECHELLE)
    if (!calqueModifiable('rame')) return
    const vehicules = vehiculesDeGroupes(composition)
    if (vehicules.length === 0) return erreur('Composez d\'abord la rame dans le panneau de droite (« Rame à poser »).')
    const accroche = projet.calques.voies.visible ? accrocherVoie(projet.voies, p, tolerance) : null
    if (!accroche) return erreur('Cliquez sur une voie : une rame se pose le long d\'une voie.')
    const { projet: suivant, id } = ajouterRame(projet, vehicules, accroche.voieId, accroche.abscisse)
    modifier(() => suivant)
    choisir('rame', id)
    const rame = suivant.rames.find((r) => r.id === id)!
    const voie = projet.voies.find((v) => v.id === accroche.voieId)
    const depasse = avertissementDepassement(`La rame « ${rame.nom} »`, voie, silhouetteRame(suivant, rame)?.depassement ?? 0)
    setMessage(depasse ? { genre: 'erreur', texte: depasse } : null)
  }

  // Clic avec l'outil Zone, Appareil (BS) ou Communication : le premier clic
  // s'accroche à une voie, le second termine l'élément.
  const poserSurVoie = (p: Point, tolerance: number) => {
    if (outil !== 'zone' && outil !== 'bs' && outil !== 'communication') return
    if (!calqueModifiable(outil === 'zone' ? 'zone' : 'appareil')) return
    if (projet.voies.length === 0) {
      erreur("Tracez d'abord les voies : zones et appareils se posent sur une voie.")
      return
    }
    if (!projet.calques.voies.visible) {
      erreur('Le calque « Voies » est masqué : affichez-le pour poser sur une voie.')
      return
    }
    if (!poseValide) {
      const accroche = accrocherVoie(projet.voies, p, tolerance)
      if (!accroche) {
        erreur('Cliquez sur une voie : aucune voie sous le pointeur.')
        return
      }
      setPose({ outil, voieId: accroche.voieId, abscisse: accroche.abscisse })
      setMessage(null)
      return
    }
    const premiere = projet.voies.find((v) => v.id === poseValide.voieId)!
    if (outil === 'zone') {
      const accroche = accrocherVoie([premiere], p, tolerance)
      if (!accroche) {
        erreur(
          accrocherVoie(projet.voies, p, tolerance)
            ? `La fin de la zone doit être sur la même voie que le début (« ${premiere.nom} »).`
            : `Cliquez sur la voie « ${premiere.nom} » pour placer la fin de la zone.`,
        )
        return
      }
      if (Math.abs(accroche.abscisse - poseValide.abscisse) < tolerance / 3) {
        erreur('Zone trop courte : cliquez la fin de la zone plus loin sur la voie.')
        return
      }
      const { projet: suivant, id } = ajouterZone(projet, premiere.id, poseValide.abscisse, accroche.abscisse)
      modifier(() => suivant)
      choisir('zone', id)
    } else {
      const accroche = accrocherVoie(projet.voies, p, tolerance, premiere.id)
      if (!accroche) {
        erreur(
          accrocherVoie([premiere], p, tolerance)
            ? outil === 'bs'
              ? `Le talon doit être sur une autre voie que la pointe (« ${premiere.nom} ») : cliquez sur la voie déviée.`
              : `Le second BS doit être sur une autre voie que le premier (« ${premiere.nom} »).`
            : 'Cliquez sur une voie : aucune voie sous le pointeur.',
        )
        return
      }
      const depart = { voieId: premiere.id, abscisse: poseValide.abscisse }
      const arrivee = { voieId: accroche.voieId, abscisse: accroche.abscisse }
      if (outil === 'bs') {
        const { projet: suivant, id } = ajouterAppareil(projet, depart, arrivee)
        modifier(() => suivant)
        choisir('appareil', id)
      } else {
        const { projet: suivant, ids } = ajouterCommunication(projet, depart, arrivee)
        modifier(() => suivant)
        choisir('appareil', ids[0])
      }
    }
    setPose(null)
    setMessage(null)
  }

  const creerCadre = (a: Point, b: Point) => {
    if (!calqueModifiable('cadre')) return
    const { projet: suivant, id } = ajouterCadre(projet, a, b)
    modifier(() => suivant)
    choisir('cadre', id)
    setMessage(null)
  }

  // Outil Texte sur un texte existant : on le reprend au lieu d'en créer un.
  const editerTexte = (id: string) => {
    choisir('texte', id)
    setTexteAFocaliser(id)
  }

  const creerTexte = (p: Point) => {
    if (!calqueModifiable('texte')) return
    const { projet: suivant, id } = ajouterTexte(projet, p)
    modifier(() => suivant)
    choisir('texte', id)
    setTexteAFocaliser(id)
    setMessage(null)
  }

  // Message après la suppression d'une voie qui portait zones, appareils,
  // engins ou rames.
  const annoncerCascade = (nomVoie: string, dependances: Dependances) => {
    const { zones, appareils, engins, rames } = dependances
    if (zones + appareils + engins + rames === 0) return
    const parties = [zones && pluriel(zones, 'zone'), appareils && pluriel(appareils, 'appareil'), engins && pluriel(engins, 'engin'), rames && pluriel(rames, 'rame')].filter(
      (x): x is string => typeof x === 'string',
    )
    const avec = parties.length > 1 ? `${parties.slice(0, -1).join(', ')} et ${parties[parties.length - 1]}` : parties[0]
    setMessage({ genre: 'info', texte: `Voie « ${nomVoie} » supprimée avec ce qui était posé dessus : ${avec}. Ctrl+Z rétablit le tout.` })
  }

  const supprimer = (ref: Reference) => {
    if (!calqueModifiable(ref.genre)) return
    if (ref.genre === 'voie') {
      const voie = projet.voies.find((v) => v.id === ref.id)
      if (voie) annoncerCascade(voie.nom, dependancesVoie(projet, ref.id))
    }
    if (ref.genre === 'appareil') {
      const appareil = projet.appareils.find((a) => a.id === ref.id)
      const autre = appareil && jumeau(projet, appareil)
      if (appareil && autre) {
        setMessage({
          genre: 'info',
          texte: `Communication supprimée : « ${appareil.nom} » et « ${autre.nom} » partent ensemble. Ctrl+Z la rétablit.`,
        })
      }
    }
    modifier((p) => supprimerElement(p, ref))
    if (selection && selection.genre === ref.genre && selection.id === ref.id) setSelection(null)
  }

  const supprimerSelection = () => {
    if (!selection) return
    if (selection.genre === 'voie' && selection.point !== null) {
      if (!calqueModifiable('voie')) return
      const indice = selection.point
      const voie = projet.voies.find((v) => v.id === selection.id)!
      const { voieSupprimee } = supprimerPoint(projet, selection.id, indice)
      if (voieSupprimee) annoncerCascade(voie.nom, dependancesVoie(projet, voie.id))
      modifier((p) => supprimerPoint(p, selection.id, indice).projet)
      setSelection(voieSupprimee ? null : { ...selection, point: null })
    } else {
      supprimer(selection)
    }
  }

  const faireAnnuler = () => setHistorique(annuler)
  const faireRetablir = () => setHistorique(retablir)

  // Raccourcis clavier, hors des champs de saisie.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (suspendu || estChampDeSaisie(e.target)) return
      const ctrl = e.ctrlKey || e.metaKey
      const touche = e.key.toLowerCase()
      if (e.key === ' ') {
        e.preventDefault()
        setEspace(true)
      } else if (ctrl && touche === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (trace) retirerDernierPointTrace()
        else faireAnnuler()
      } else if (ctrl && (touche === 'y' || (touche === 'z' && e.shiftKey))) {
        e.preventDefault()
        faireRetablir()
      } else if (e.key === 'Enter') {
        if (trace) {
          e.preventDefault()
          terminer(0)
        }
      } else if (e.key === 'Escape') {
        if (trace) setTrace(null)
        else if (poseValide) setPose(null)
        else setSelection(null)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (trace) retirerDernierPointTrace()
        else supprimerSelection()
      } else if (!ctrl && !e.altKey && touche === TOUCHE_ECHELLE.toLowerCase()) {
        ouvrirEchelle()
      } else if (!ctrl && !e.altKey) {
        const choisi = (Object.keys(TOUCHES) as Outil[]).find((o) => TOUCHES[o].toLowerCase() === touche)
        if (choisi) choisirOutil(choisi)
      }
    }
    const surRelache = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        if (!estChampDeSaisie(e.target)) e.preventDefault()
        setEspace(false)
      }
    }
    const surPerteFocus = () => setEspace(false)
    window.addEventListener('keydown', surTouche)
    window.addEventListener('keyup', surRelache)
    window.addEventListener('blur', surPerteFocus)
    return () => {
      window.removeEventListener('keydown', surTouche)
      window.removeEventListener('keyup', surRelache)
      window.removeEventListener('blur', surPerteFocus)
    }
  })

  const importerFond = async (fichier: File) => {
    setOccupe('Lecture du fond de plan…')
    try {
      const { fond, pdf: ouvert } = await ouvrirFond(fichier)
      fermerPdf(pdf)
      setPdf(ouvert)
      jetonPage.current++
      modifier((p) => remplacerFond(p, fond))
      setVue(null)
      const pages = ouvert && ouvert.nombrePages > 1 ? `PDF de ${ouvert.nombrePages} pages : page 1 affichée. Changez de page dans le panneau « Calques ». ` : ''
      const echelle = projet.echelle ? 'Nouveau fond : vérifiez l\'échelle du plan (bouton « Échelle… »).' : ''
      setMessage(pages || echelle ? { genre: 'info', texte: pages + echelle } : null)
    } catch (e) {
      erreur(`Impossible de lire « ${fichier.name} » : ${(e as Error).message}`)
    } finally {
      setOccupe(null)
    }
  }

  // Change la page du PDF ouvert : la page est rendue à nouveau depuis le
  // fichier gardé en mémoire. Si l'on clique vite, seule la dernière demande
  // compte.
  const changerPage = async (demandee: number) => {
    if (!pdf || projet.calques.fond.verrouille) return
    const page = bornerPage(demandee, pdf.nombrePages)
    if (page === projet.fond?.page && projet.fond.image) return
    const jeton = ++jetonPage.current
    setOccupe(`Rendu de la page ${page}…`)
    try {
      const fond = await rendrePage(pdf, page)
      if (jeton !== jetonPage.current) return
      modifier((p) => remplacerFond(p, fond), 'page-pdf')
      setMessage(null)
    } catch (e) {
      if (jeton === jetonPage.current) erreur(`Impossible d'afficher la page ${page} : ${(e as Error).message}`)
    } finally {
      if (jeton === jetonPage.current) setOccupe(null)
    }
  }

  const retirerFondPdf = () => {
    fermerPdf(pdf)
    setPdf(null)
  }

  const ouvrirProjet = async (fichier: File) => {
    let texte: string
    try {
      texte = await fichier.text()
    } catch {
      erreur(`Le fichier « ${fichier.name} » n'a pas pu être lu.`)
      return
    }
    const lu = lireProjet(texte)
    if (!lu.ok) {
      setMessage({ genre: 'erreur', texte: `« ${fichier.name} » ne peut pas être ouvert :`, details: lu.erreurs })
      return
    }
    retirerFondPdf()
    modifier(() => lu.projet)
    setTrace(null)
    setPose(null)
    setSelection(null)
    setVue(null)
    setMessage({ genre: 'info', texte: `Plan « ${lu.projet.nom} » ouvert à la place du précédent (Annuler pour revenir en arrière).` })
  }

  const enregistrerProjet = () => {
    telecharger(nomDeFichier(projet.nom), serialiserProjet(projet))
    if (projet.fond && !projet.fond.image) {
      erreur('Exporté sans le fond de plan, qui manque : réimportez-le puis exportez à nouveau.')
    }
  }

  return {
    projet,
    modifier,
    peutAnnuler: peutAnnuler(historique),
    peutRetablir: peutRetablir(historique),
    annuler: faireAnnuler,
    retablir: faireRetablir,
    outil,
    choisirOutil,
    selection,
    setSelection,
    choisir,
    supprimer,
    supprimerSelection,
    trace,
    ajouterPointTrace,
    terminer,
    pose: poseValide,
    poserSurVoie,
    catalogue,
    typeChoisi,
    setTypeChoisi,
    poserEngin,
    composition,
    setComposition,
    poserRame,
    creerCadre,
    creerTexte,
    editerTexte,
    texteAFocaliser,
    texteFocalise: () => setTexteAFocaliser(null),
    vue,
    setVue,
    espace,
    pdf,
    occupe,
    message,
    setMessage,
    importerFond,
    changerPage,
    retirerFondPdf,
    ouvrirProjet,
    enregistrerProjet,
  }
}

export type Editeur = ReturnType<typeof useEditeur>
