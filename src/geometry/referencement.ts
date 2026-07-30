import type { Voie } from '../domain/projet.ts'
import { creerCourbe, poseSurCourbe, type Courbe, type Pose2D } from './courbe.ts'

// Référencement PK ↔ abscisse curviligne. Le PK est en kilomètres ; l'abscisse
// en mètres depuis le début de la polyligne. `pkOrigine` est le PK au début de
// la polyligne (0 par défaut pour une voie de service sans PK réel).

const courbes = new WeakMap<Voie, Courbe>()

export function courbeDeVoie(voie: Voie): Courbe {
  let courbe = courbes.get(voie)
  if (!courbe) {
    courbe = creerCourbe(voie.polyligne)
    courbes.set(voie, courbe)
  }
  return courbe
}

export function abscisseSurVoie(voie: Voie, pk: number): number {
  return (pk - (voie.pkOrigine ?? 0)) * 1000
}

// La règle n° 3 du projet : aucun objet ferroviaire ne stocke de XYZ.
// Position = (voie, pk, offset) ; les coordonnées sortent d'ici.
export function pose(voie: Voie, pk: number, offset = 0): Pose2D {
  return poseSurCourbe(courbeDeVoie(voie), abscisseSurVoie(voie, pk), offset)
}
