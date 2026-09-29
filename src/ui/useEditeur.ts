import { useCallback, useEffect, useRef, useState } from 'react'
import { ajouterVoie, supprimerPoint, supprimerVoie, remplacerFond } from '../plan/edition.ts'
import { bornerPage, typeDeFond } from '../plan/fond.ts'
import { terminerTrace } from '../plan/geometrie.ts'
import { annuler, creerHistorique, enregistrer, peutAnnuler, peutRetablir, retablir } from '../plan/historique.ts'
import { creerProjet, lireProjet, nomDeFichier, serialiserProjet, type Point, type Projet } from '../plan/projet.ts'
import type { Vue } from '../plan/vue.ts'
import { fermerPdf, lireImage, ouvrirPdf, rendrePage, type PdfOuvert } from './fondDePlan.ts'
import { chargerSauvegarde, sauvegarder, telecharger, type EtatSauvegarde } from './navigateur.ts'

// L'état de l'éditeur et toutes ses actions : projet et historique, outil,
// sélection, tracé en cours, vue, fond PDF ouvert, messages, raccourcis.

export type Outil = 'selection' | 'tracer' | 'main'
export type Selection = { voieId: string; point: number | null } | null
export type Message = { genre: 'info' | 'erreur'; texte: string; details?: string[] }

const estChampDeSaisie = (cible: EventTarget | null): boolean =>
  cible instanceof HTMLElement &&
  (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName))

export function useEditeur() {
  const [initial] = useState(() => chargerSauvegarde())
  const [historique, setHistorique] = useState(() => creerHistorique(initial?.projet ?? creerProjet()))
  const [outil, setOutil] = useState<Outil>('tracer')
  const [selectionBrute, setSelection] = useState<Selection>(null)
  const [trace, setTrace] = useState<Point[] | null>(null)
  const [vue, setVue] = useState<Vue | null>(null)
  const [espace, setEspace] = useState(false)
  const [pdf, setPdf] = useState<PdfOuvert | null>(null)
  const [occupe, setOccupe] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(() =>
    initial?.fondManquant
      ? {
          genre: 'erreur',
          texte: `Le fond « ${initial.projet.fond?.nomFichier} » était trop lourd pour être gardé par le navigateur : vos voies sont là, mais ouvrez votre fichier enregistré ou réimportez le fond.`,
        }
      : null,
  )
  const [etatSauvegarde, setEtatSauvegarde] = useState<EtatSauvegarde>('ok')
  const jetonPage = useRef(0)

  const projet = historique.present

  // Une sélection qui ne correspond plus à rien (après Annuler…) est ignorée.
  const voieChoisie = selectionBrute ? projet.voies.find((v) => v.id === selectionBrute.voieId) : undefined
  const selection: Selection =
    voieChoisie && selectionBrute
      ? { voieId: voieChoisie.id, point: selectionBrute.point !== null && selectionBrute.point < voieChoisie.points.length ? selectionBrute.point : null }
      : null

  const modifier = useCallback((transformer: (p: Projet) => Projet, cle: string | null = null) => {
    setHistorique((h) => enregistrer(h, transformer(h.present), cle))
  }, [])

  // Sauvegarde automatique, un court instant après la dernière modification,
  // et au moment de quitter la page.
  useEffect(() => {
    const minuterie = setTimeout(() => setEtatSauvegarde(sauvegarder(projet)), 400)
    const enQuittant = () => sauvegarder(projet)
    window.addEventListener('pagehide', enQuittant)
    return () => {
      clearTimeout(minuterie)
      window.removeEventListener('pagehide', enQuittant)
    }
  }, [projet])

  const terminer = (tolerance: number) => {
    if (!trace) return
    const points = terminerTrace(trace, tolerance)
    setTrace(null)
    if (!points) return
    const { projet: suivant, id } = ajouterVoie(projet, points)
    modifier(() => suivant)
    setSelection({ voieId: id, point: null })
  }

  const ajouterPointTrace = (p: Point) => setTrace((t) => [...(t ?? []), p])
  const retirerDernierPointTrace = () => setTrace((t) => (t && t.length > 1 ? t.slice(0, -1) : null))

  const choisirOutil = (nouvel: Outil) => {
    if (trace) terminer(0)
    setOutil(nouvel)
  }

  const supprimerSelection = () => {
    if (!selection) return
    if (selection.point !== null) {
      const indice = selection.point
      const { voieSupprimee } = supprimerPoint(projet, selection.voieId, indice)
      modifier((p) => supprimerPoint(p, selection.voieId, indice).projet)
      setSelection(voieSupprimee ? null : { voieId: selection.voieId, point: null })
    } else {
      modifier((p) => supprimerVoie(p, selection.voieId))
      setSelection(null)
    }
  }

  const faireAnnuler = () => setHistorique(annuler)
  const faireRetablir = () => setHistorique(retablir)

  // Raccourcis clavier, hors des champs de saisie.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (estChampDeSaisie(e.target)) return
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
        else setSelection(null)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (trace) retirerDernierPointTrace()
        else supprimerSelection()
      } else if (!ctrl && !e.altKey) {
        if (touche === 's') choisirOutil('selection')
        else if (touche === 't') choisirOutil('tracer')
        else if (touche === 'm') choisirOutil('main')
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
    const type = typeDeFond(fichier.name, fichier.type)
    if (!type) {
      setMessage({ genre: 'erreur', texte: `« ${fichier.name} » n'est ni une image (PNG, JPG) ni un PDF.` })
      return
    }
    setOccupe('Lecture du fond de plan…')
    try {
      const ouvert = type === 'pdf' ? await ouvrirPdf(fichier) : null
      const fond = ouvert ? await rendrePage(ouvert, 1) : await lireImage(fichier)
      fermerPdf(pdf)
      setPdf(ouvert)
      jetonPage.current++
      modifier((p) => remplacerFond(p, fond))
      setVue(null)
      setMessage(
        ouvert && ouvert.nombrePages > 1
          ? { genre: 'info', texte: `PDF de ${ouvert.nombrePages} pages : page 1 affichée. Changez de page dans le panneau « Calques ».` }
          : null,
      )
    } catch (e) {
      setMessage({ genre: 'erreur', texte: `Impossible de lire « ${fichier.name} » : ${(e as Error).message}` })
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
      if (jeton === jetonPage.current) {
        setMessage({ genre: 'erreur', texte: `Impossible d'afficher la page ${page} : ${(e as Error).message}` })
      }
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
      setMessage({ genre: 'erreur', texte: `Le fichier « ${fichier.name} » n'a pas pu être lu.` })
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
    setSelection(null)
    setVue(null)
    setMessage({ genre: 'info', texte: `Projet « ${lu.projet.nom} » ouvert (Annuler pour revenir au précédent).` })
  }

  const enregistrerProjet = () => {
    telecharger(nomDeFichier(projet.nom), serialiserProjet(projet))
    if (projet.fond && !projet.fond.image) {
      setMessage({ genre: 'erreur', texte: 'Enregistré sans le fond de plan, qui manque : réimportez-le puis enregistrez à nouveau.' })
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
    supprimerSelection,
    trace,
    ajouterPointTrace,
    terminer,
    vue,
    setVue,
    espace,
    pdf,
    occupe,
    message,
    setMessage,
    etatSauvegarde,
    importerFond,
    changerPage,
    retirerFondPdf,
    ouvrirProjet,
    enregistrerProjet,
  }
}

export type Editeur = ReturnType<typeof useEditeur>
