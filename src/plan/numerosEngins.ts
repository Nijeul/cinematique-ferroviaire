import type { EnginsEtRames } from './engins.ts'
import type { Synoptique } from './synoptique.ts'

// Numéros des engins sur l'image : les bulles numérotées des pelles et des
// rames (demande du commanditaire : « Il ne faut pas afficher les numéros des
// pelles dans les bulles sur les images, c'est pas lisible »). Réglage du
// synoptique, pour toutes ses images : case décochée, aucune bulle sur
// l'image de travail, la planche, les vignettes et les exports, et la légende
// ne cite plus les numéros (ils ne se voient plus) mais garde les
// descriptions. Les numéros restent enregistrés sur chaque engin : recochée,
// la case les fait revenir. Par défaut (et pour les synoptiques enregistrés
// sans ce réglage), les numéros sont affichés.

export const NUMEROS_ENGINS_PAR_DEFAUT = true

export function modifierNumerosEngins(s: Synoptique, afficher: boolean): Synoptique {
  return s.numerosEngins === afficher ? s : { ...s, numerosEngins: afficher }
}

// Les engins et les rames tels qu'on les dessine et qu'on les légende : sans
// numéro quand la case est décochée. Les données ne changent pas.
export function enginsAffiches<E extends EnginsEtRames>(s: Pick<Synoptique, 'numerosEngins'>, contenu: E): E {
  if (s.numerosEngins) return contenu
  const aNumero = contenu.engins.some((e) => e.numero !== '') || contenu.rames.some((r) => r.numero !== '')
  if (!aNumero) return contenu
  return {
    ...contenu,
    engins: contenu.engins.map((e) => (e.numero === '' ? e : { ...e, numero: '' })),
    rames: contenu.rames.map((r) => (r.numero === '' ? r : { ...r, numero: '' })),
  }
}
