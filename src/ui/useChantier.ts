import { useCallback, useEffect, useRef, useState } from 'react'
import { toucher, type Chantier } from '../plan/chantier.ts'
import { enregistrerChantier, lireChantierStocke } from './stockage.ts'

// Le chantier ouvert : lu dans le navigateur, modifié en mémoire, puis
// réenregistré un court instant après la dernière modification — et tout de
// suite quand on quitte le chantier ou la page.

export type Enregistrement = { genre: 'ok' } | { genre: 'enCours' } | { genre: 'erreur'; texte: string }

// `avis` : ce que la mise à jour du chantier à l'ouverture a changé (engins
// retirés des plans), à dire une fois.
type Etat = { id: string; chantier: Chantier | null; charge: boolean; erreur: string | null; avis: string[] }

const DELAI_ENREGISTREMENT = 400

export function useChantier(id: string) {
  const [etat, setEtat] = useState<Etat>({ id, chantier: null, charge: false, erreur: null, avis: [] })
  const [enregistrement, setEnregistrement] = useState<Enregistrement>({ genre: 'ok' })
  // Dernière version modifiée et pas encore écrite.
  const enAttente = useRef<Chantier | null>(null)

  useEffect(() => {
    let actif = true
    lireChantierStocke(id).then(
      (lu) => actif && setEtat({ id, chantier: lu?.chantier ?? null, charge: true, erreur: null, avis: lu?.avis ?? [] }),
      (e: Error) => actif && setEtat({ id, chantier: null, charge: true, erreur: e.message, avis: [] }),
    )
    return () => {
      actif = false
    }
  }, [id])

  const ecrire = useCallback(() => {
    const chantier = enAttente.current
    if (!chantier) return
    enAttente.current = null
    enregistrerChantier(chantier).then(
      () => setEnregistrement((e) => (enAttente.current ? e : { genre: 'ok' })),
      (e: Error) => setEnregistrement({ genre: 'erreur', texte: e.message }),
    )
  }, [])

  const modifier = useCallback((transformer: (c: Chantier) => Chantier) => {
    setEtat((e) => {
      if (!e.chantier) return e
      const suivant = transformer(e.chantier)
      if (suivant === e.chantier) return e
      return { ...e, chantier: toucher(suivant, new Date().toISOString()) }
    })
  }, [])

  // Une modification → enregistrement différé.
  const chantier = etat.id === id ? etat.chantier : null
  const premier = useRef<Chantier | null>(null)
  useEffect(() => {
    if (!chantier) return
    if (premier.current === null || premier.current.id !== chantier.id) {
      premier.current = chantier
      return
    }
    if (premier.current === chantier) return
    enAttente.current = chantier
    setEnregistrement({ genre: 'enCours' })
    const minuterie = setTimeout(ecrire, DELAI_ENREGISTREMENT)
    return () => clearTimeout(minuterie)
  }, [chantier, ecrire])

  // En quittant la page ou le chantier : on écrit ce qui attend.
  useEffect(() => {
    window.addEventListener('pagehide', ecrire)
    return () => {
      window.removeEventListener('pagehide', ecrire)
      ecrire()
    }
  }, [ecrire])

  const avisLu = useCallback(() => setEtat((e) => ({ ...e, avis: [] })), [])

  return {
    chantier,
    charge: etat.id === id && etat.charge,
    erreurLecture: etat.id === id ? etat.erreur : null,
    modifier,
    enregistrement,
    avis: etat.id === id ? etat.avis : [],
    avisLu,
  }
}
