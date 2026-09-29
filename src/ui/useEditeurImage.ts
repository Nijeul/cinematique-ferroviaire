import { useState } from 'react'
import type { TypeEngin } from '../plan/catalogue.ts'
import { accrocherVoie } from '../plan/detection.ts'
import {
  ajouterEngin,
  ajouterRame,
  avertissementDepassement,
  existeEngin,
  silhouetteEngin,
  silhouetteRame,
  supprimerEngin,
  vehiculesDeGroupes,
  type Groupe,
  type PositionEngin,
  type ReferenceEngin,
} from '../plan/engins.ts'
import type { EtatVoie } from '../plan/etatsVoie.ts'
import { basculerAvancement, choisirEtatZone, etatDeZone, modifierAvancement, type Avancement } from '../plan/etatsZones.ts'
import type { Point } from '../plan/projet.ts'
import { modifierCalqueEngins, modifierImage, projetDeImage, type PlanImage, type Synoptique } from '../plan/synoptique.ts'
import type { Vue } from '../plan/vue.ts'
import type { Message } from './useEditeur.ts'

// Édition de l'image courante d'un synoptique : on y pose, choisit, glisse et
// supprime des engins et des rames, à l'échelle du synoptique ; on y choisit
// une zone de travaux pour changer son état (elle ne se déplace pas). Seule
// l'image courante change ; l'historique (Annuler / Rétablir) est celui du
// synoptique.

export type OutilImage = 'selection' | 'engin' | 'rame' | 'main'

export const TOUCHES_IMAGE: Record<OutilImage, string> = { selection: 'S', engin: 'E', rame: 'W', main: 'M' }

export const RAISON_SANS_ECHELLE =
  "Calez d'abord l'échelle du synoptique (bouton « Caler l'échelle… ») : sans elle, les engins ne peuvent pas être à la bonne taille."

const CALQUE_VERROUILLE = 'Le calque « Engins » est verrouillé : décochez « Verrouillé » dans le panneau pour le modifier.'

export function useEditeurImage(args: {
  synoptique: Synoptique
  index: number
  // Enregistre un nouvel état du synoptique (sur l'image courante) ; `cle` :
  // voir l'historique.
  enregistrer: (suivant: Synoptique, cle?: string | null) => void
  catalogue: TypeEngin[]
  etatsVoie: EtatVoie[]
  setMessage: (m: Message | null) => void
}) {
  const { synoptique: s, index, enregistrer, catalogue, etatsVoie, setMessage } = args
  const [outil, setOutil] = useState<OutilImage>('selection')
  const [selectionBrute, setSelectionBrute] = useState<ReferenceEngin | null>(null)
  const [zoneBrute, setZoneBrute] = useState<string | null>(null)
  const [typeChoisiId, setTypeChoisi] = useState<string | null>(catalogue[0]?.id ?? null)
  const [composition, setComposition] = useState<Groupe[]>([])
  const [vue, setVue] = useState<Vue | null>(null)
  const [espace, setEspace] = useState(false)

  const planche: PlanImage = projetDeImage(s, s.images[index])
  const calque = s.calqueEngins
  // Un engin choisi sur une image reste choisi sur les autres images où il
  // est (même identifiant, copié par « Nouvelle image ») ; ailleurs, rien.
  const selection = selectionBrute && existeEngin(planche, selectionBrute) ? selectionBrute : null
  // Une zone choisie le reste d'une image à l'autre (mêmes zones, plan figé).
  const zone = zoneBrute ? (planche.zones.find((z) => z.id === zoneBrute) ?? null) : null
  const etatZone = zone ? etatDeZone(planche.etatsZones, etatsVoie, zone.id) : null
  // Choisir un engin libère la zone, et inversement.
  const setSelection = (ref: ReferenceEngin | null) => {
    setSelectionBrute(ref)
    if (ref) setZoneBrute(null)
  }
  const choisirZone = (id: string | null) => {
    setZoneBrute(id)
    if (id) setSelectionBrute(null)
  }
  const typeChoisi = catalogue.find((t) => t.id === typeChoisiId) ?? catalogue[0]
  const erreur = (texte: string) => setMessage({ genre: 'erreur', texte })

  // Modification des engins de l'image courante.
  const modifier = (transformer: (p: PlanImage) => PlanImage, cle: string | null = null) => {
    const suivant = modifierImage(s, index, transformer)
    if (suivant !== s) enregistrer(suivant, cle)
  }

  const modifiable = (): boolean => {
    if (!s.echelle) {
      erreur(RAISON_SANS_ECHELLE)
      return false
    }
    if (calque.verrouille) {
      erreur(CALQUE_VERROUILLE)
      return false
    }
    return true
  }

  const choisirOutil = (nouvel: OutilImage) => {
    if ((nouvel === 'engin' || nouvel === 'rame') && !s.echelle) {
      erreur(RAISON_SANS_ECHELLE)
      return
    }
    setOutil(nouvel)
  }

  // Ce qu'on pose doit se voir : le calque « Engins » est réaffiché au besoin.
  const poser = (transformer: (p: PlanImage) => PlanImage) => {
    const avec = modifierImage(s, index, transformer)
    enregistrer(calque.visible ? avec : modifierCalqueEngins(avec, { visible: true }))
  }

  // Pose d'un engin : le long de la voie cliquée, ou libre loin de toute voie.
  const poserEngin = (p: Point, tolerance: number) => {
    if (!modifiable()) return
    if (!typeChoisi) return erreur("Le catalogue d'engins du chantier est vide : ajoutez un type dans la page du chantier.")
    const accroche = planche.calques.voies.visible ? accrocherVoie(planche.voies, p, tolerance) : null
    const position: PositionEngin = accroche
      ? { genre: 'voie', voieId: accroche.voieId, abscisse: accroche.abscisse }
      : { genre: 'libre', x: p.x, y: p.y, angle: 0 }
    const { planche: suivante, id } = ajouterEngin(planche, typeChoisi, position)
    poser(() => suivante)
    setSelection({ genre: 'engin', id })
    const engin = suivante.engins.find((e) => e.id === id)!
    const voie = accroche ? planche.voies.find((v) => v.id === accroche.voieId) : undefined
    const depasse = avertissementDepassement(`« ${typeChoisi.modele} »`, voie, silhouetteEngin(suivante, engin)?.depassement ?? 0)
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
    if (!modifiable()) return
    const vehicules = vehiculesDeGroupes(composition)
    if (vehicules.length === 0) return erreur("Composez d'abord la rame dans le panneau de droite (« Rame à poser »).")
    const accroche = planche.calques.voies.visible ? accrocherVoie(planche.voies, p, tolerance) : null
    if (!accroche) return erreur("Cliquez sur une voie : une rame se pose le long d'une voie.")
    const { planche: suivante, id } = ajouterRame(planche, vehicules, accroche.voieId, accroche.abscisse)
    poser(() => suivante)
    setSelection({ genre: 'rame', id })
    const rame = suivante.rames.find((r) => r.id === id)!
    const voie = planche.voies.find((v) => v.id === accroche.voieId)
    const depasse = avertissementDepassement(`La rame « ${rame.nom} »`, voie, silhouetteRame(suivante, rame)?.depassement ?? 0)
    setMessage(depasse ? { genre: 'erreur', texte: depasse } : null)
  }

  const supprimer = (ref: ReferenceEngin) => {
    if (calque.verrouille) return erreur(CALQUE_VERROUILLE)
    const nom = ref.genre === 'engin' ? planche.engins.find((e) => e.id === ref.id)?.type.modele : planche.rames.find((r) => r.id === ref.id)?.nom
    modifier((p) => supprimerEngin(p, ref))
    if (selection?.genre === ref.genre && selection.id === ref.id) setSelection(null)
    setMessage({
      genre: 'info',
      texte: `« ${nom ?? '?'} » retiré de l'image ${index + 1} (les autres images ne changent pas). Ctrl+Z le rétablit.`,
    })
  }

  const supprimerSelection = () => {
    if (selection) supprimer(selection)
    else if (zone) setMessage({ genre: 'info', texte: `Les zones viennent du plan figé : elles ne se suppriment pas ici, seul leur état change.` })
  }

  // État de la zone choisie. `cle` : glisser le curseur du pourcentage ne
  // fait qu'un Annuler.
  const choisirEtat = (etatId: string) => {
    if (zone) enregistrer(choisirEtatZone(s, index, zone.id, etatId, etatsVoie))
  }
  const choisirEtatNumero = (n: number) => {
    const etat = etatsVoie[n - 1]
    if (zone && etat) choisirEtat(etat.id)
  }
  const changerAvancement = (actif: boolean) => {
    if (zone) enregistrer(basculerAvancement(s, index, zone.id, actif, etatsVoie))
  }
  const reglerAvancement = (champs: Partial<Avancement>, cle: string | null = null) => {
    if (zone) enregistrer(modifierAvancement(s, index, zone.id, champs, etatsVoie), cle)
  }

  return {
    synoptique: s,
    index,
    planche,
    calque,
    changerCalque: (champs: { visible?: boolean; verrouille?: boolean }) => enregistrer(modifierCalqueEngins(s, champs)),
    outil,
    choisirOutil,
    selection,
    setSelection,
    choisir: (ref: ReferenceEngin) => setSelection(ref),
    zone,
    etatZone,
    choisirZone,
    etatsVoie,
    choisirEtat,
    choisirEtatNumero,
    changerAvancement,
    reglerAvancement,
    toutDeselectionner: () => {
      setSelectionBrute(null)
      setZoneBrute(null)
    },
    catalogue,
    typeChoisi,
    setTypeChoisi,
    composition,
    setComposition,
    modifier,
    poserEngin,
    poserRame,
    supprimer,
    supprimerSelection,
    vue,
    setVue,
    espace,
    setEspace,
    setMessage,
  }
}

export type EditeurImage = ReturnType<typeof useEditeurImage>
