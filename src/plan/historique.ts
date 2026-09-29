// Annuler / Rétablir : la pile des états successifs du projet.
//
// Une modification peut porter une « clé » : deux modifications de suite avec
// la même clé n'en font qu'une dans l'historique (taper un nom lettre par
// lettre, glisser un point, bouger le curseur d'opacité → un seul Annuler).

export type Historique<T> = {
  passe: T[]
  present: T
  futur: T[]
  derniereCle: string | null
}

export const LIMITE_HISTORIQUE = 100

export function creerHistorique<T>(present: T): Historique<T> {
  return { passe: [], present, futur: [], derniereCle: null }
}

export function enregistrer<T>(h: Historique<T>, nouveau: T, cle: string | null = null): Historique<T> {
  if (nouveau === h.present) return h
  if (cle !== null && cle === h.derniereCle) {
    return { ...h, present: nouveau, futur: [] }
  }
  const passe = [...h.passe, h.present]
  if (passe.length > LIMITE_HISTORIQUE) passe.splice(0, passe.length - LIMITE_HISTORIQUE)
  return { passe, present: nouveau, futur: [], derniereCle: cle }
}

export const peutAnnuler = <T>(h: Historique<T>): boolean => h.passe.length > 0
export const peutRetablir = <T>(h: Historique<T>): boolean => h.futur.length > 0

export function annuler<T>(h: Historique<T>): Historique<T> {
  if (!peutAnnuler(h)) return h
  return {
    passe: h.passe.slice(0, -1),
    present: h.passe[h.passe.length - 1],
    futur: [h.present, ...h.futur],
    derniereCle: null,
  }
}

export function retablir<T>(h: Historique<T>): Historique<T> {
  if (!peutRetablir(h)) return h
  return {
    passe: [...h.passe, h.present],
    present: h.futur[0],
    futur: h.futur.slice(1),
    derniereCle: null,
  }
}
