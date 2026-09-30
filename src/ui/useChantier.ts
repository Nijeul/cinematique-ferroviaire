import { useCallback, useEffect, useRef, useState } from 'react'
import { toucher, type Chantier } from '../plan/chantier.ts'
import type { Conflit, Envoi, Memoire } from './memoire.ts'

// Le chantier ouvert : lu (en ligne, ou dans la copie de secours du
// navigateur), modifié en mémoire, puis gardé dans le navigateur un court
// instant après la dernière modification, et envoyé en ligne un peu plus
// tard (pour ne pas envoyer à chaque clic). En quittant la page : copie du
// navigateur tout de suite, et envoi de dernière minute quand c'est possible.
// Au retour de la connexion, ce qui attend est envoyé.

export type Enregistrement =
  | { genre: 'ok' }
  | { genre: 'enCours' }
  | { genre: 'horsLigne' }
  | { genre: 'conflit'; conflit: Conflit }
  | { genre: 'erreur'; texte: string }

// `avis` : ce que l'ouverture a changé ou constaté, à dire une fois.
// `revision` : augmente quand le chantier est remplacé d'un bloc (version d'un
// collègue rechargée) : les écrans repartent de zéro.
type Etat = { id: string; chantier: Chantier | null; charge: boolean; erreur: string | null; avis: string[]; revision: number }

const DELAI_NAVIGATEUR = 400
const DELAI_EN_LIGNE = 2500

const depuisEnvoi = (r: Envoi): Enregistrement => {
  switch (r.genre) {
    case 'ok':
      return { genre: 'ok' }
    case 'horsLigne':
      return { genre: 'horsLigne' }
    case 'conflit':
      return { genre: 'conflit', conflit: r.conflit }
    case 'erreur':
      return { genre: 'erreur', texte: r.texte }
  }
}

export function useChantier(id: string, memoire: Memoire) {
  const [etat, setEtat] = useState<Etat>({ id, chantier: null, charge: false, erreur: null, avis: [], revision: 0 })
  const [enregistrement, setEnregistrement] = useState<Enregistrement>({ genre: 'ok' })
  // Dernière version modifiée et pas encore gardée dans le navigateur.
  const enAttente = useRef<Chantier | null>(null)
  // Dernière version connue, et si elle attend d'être envoyée en ligne.
  const derniere = useRef<Chantier | null>(null)
  const aEnvoyer = useRef(false)
  const minuterieEnLigne = useRef<ReturnType<typeof setTimeout> | null>(null)

  const envoyer = useCallback(() => {
    if (minuterieEnLigne.current) clearTimeout(minuterieEnLigne.current)
    minuterieEnLigne.current = null
    const c = derniere.current
    if (!c || !aEnvoyer.current) return
    aEnvoyer.current = false
    setEnregistrement({ genre: 'enCours' })
    memoire.envoyer(c).then((r) => {
      // Une modification plus récente attend : c'est son envoi qui dira l'état.
      if (derniere.current !== c) return
      if (r.genre !== 'ok') aEnvoyer.current = true
      setEnregistrement(depuisEnvoi(r))
    })
  }, [memoire])

  const programmerEnvoi = useCallback(() => {
    aEnvoyer.current = true
    if (minuterieEnLigne.current) clearTimeout(minuterieEnLigne.current)
    minuterieEnLigne.current = setTimeout(envoyer, DELAI_EN_LIGNE)
  }, [envoyer])

  useEffect(() => {
    let actif = true
    memoire.ouvrir(id).then(
      (o) => {
        if (!actif) return
        setEtat({ id, chantier: o?.chantier ?? null, charge: true, erreur: null, avis: o?.avis ?? [], revision: 0 })
        derniere.current = o?.chantier ?? null
        if (!o) return
        if (o.conflit) {
          aEnvoyer.current = true
          setEnregistrement({ genre: 'conflit', conflit: o.conflit })
        } else if (o.horsLigne) {
          aEnvoyer.current = o.aEnvoyer
          setEnregistrement(o.aEnvoyer ? { genre: 'horsLigne' } : { genre: 'ok' })
        } else if (o.aEnvoyer) {
          // Des modifications de ce navigateur attendaient : envoi tout de suite.
          aEnvoyer.current = true
          envoyer()
        }
      },
      (e: Error) => actif && setEtat({ id, chantier: null, charge: true, erreur: e.message, avis: [], revision: 0 }),
    )
    return () => {
      actif = false
    }
  }, [id, memoire, envoyer])

  const garder = useCallback(() => {
    const chantier = enAttente.current
    if (!chantier) return
    enAttente.current = null
    memoire.garder(chantier).then(
      () => undefined,
      (e: Error) => setEnregistrement({ genre: 'erreur', texte: e.message }),
    )
  }, [memoire])

  const modifier = useCallback((transformer: (c: Chantier) => Chantier) => {
    setEtat((e) => {
      if (!e.chantier) return e
      const suivant = transformer(e.chantier)
      if (suivant === e.chantier) return e
      return { ...e, chantier: toucher(suivant, new Date().toISOString()) }
    })
  }, [])

  // Une modification → copie du navigateur différée, puis envoi en ligne.
  const chantier = etat.id === id ? etat.chantier : null
  const premier = useRef<Chantier | null>(null)
  useEffect(() => {
    if (!chantier) return
    if (premier.current === null || premier.current.id !== chantier.id || derniere.current === chantier) {
      premier.current = chantier
      derniere.current = chantier
      return
    }
    enAttente.current = chantier
    derniere.current = chantier
    setEnregistrement((e) => (e.genre === 'conflit' ? e : { genre: 'enCours' }))
    programmerEnvoi()
    const minuterie = setTimeout(garder, DELAI_NAVIGATEUR)
    return () => clearTimeout(minuterie)
  }, [chantier, garder, programmerEnvoi])

  // En quittant la page ou le chantier : on garde ce qui attend, et on tente
  // l'envoi. Au retour de la connexion : on envoie ce qui attend.
  useEffect(() => {
    const partir = () => {
      garder()
      if (aEnvoyer.current && derniere.current) memoire.envoyerEnPartant(derniere.current)
    }
    const retour = () => envoyer()
    window.addEventListener('pagehide', partir)
    window.addEventListener('online', retour)
    return () => {
      window.removeEventListener('pagehide', partir)
      window.removeEventListener('online', retour)
      garder()
      envoyer()
    }
  }, [garder, envoyer, memoire])

  // Conflit : « Garder la mienne » écrase la version en ligne…
  const garderLaMienne = useCallback(() => {
    const c = derniere.current
    if (!c || enregistrement.genre !== 'conflit') return
    const version = enregistrement.conflit.version
    aEnvoyer.current = false
    setEnregistrement({ genre: 'enCours' })
    memoire.garderLaMienne(c, version).then((r) => {
      if (r.genre !== 'ok') aEnvoyer.current = true
      setEnregistrement(depuisEnvoi(r))
    })
  }, [memoire, enregistrement])

  // … « Recharger sa version » remplace celle de ce navigateur.
  const rechargerEnLigne = useCallback(() => {
    setEnregistrement({ genre: 'enCours' })
    memoire.reprendreVersionEnLigne(id).then(
      (o) => {
        aEnvoyer.current = false
        enAttente.current = null
        derniere.current = o.chantier
        premier.current = o.chantier
        setEtat((e) => ({ ...e, chantier: o.chantier, avis: o.avis, revision: e.revision + 1 }))
        setEnregistrement({ genre: 'ok' })
      },
      (e: Error) => setEnregistrement({ genre: 'erreur', texte: e.message }),
    )
  }, [memoire, id])

  const avisLu = useCallback(() => setEtat((e) => ({ ...e, avis: [] })), [])

  return {
    chantier,
    charge: etat.id === id && etat.charge,
    erreurLecture: etat.id === id ? etat.erreur : null,
    modifier,
    enregistrement,
    avis: etat.id === id ? etat.avis : [],
    avisLu,
    revision: etat.revision,
    garderLaMienne,
    rechargerEnLigne,
  }
}
