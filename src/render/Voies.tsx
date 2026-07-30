import { useMemo } from 'react'
import type { Voie, Zone } from '../domain/projet.ts'
import { abscisseSurVoie, courbeDeVoie } from '../geometry/referencement.ts'
import { useApplication } from '../ui/store.ts'
import { TronconVoie } from './Troncons.tsx'

// Voie courante hors zones de travaux : ballast ancien, traverses anciennes,
// rails posés. Les zones, dont l'aspect dépend du temps, sont rendues par
// Zones.tsx ; ici tout est statique.

function VoieHorsZones({ voie, zones }: { voie: Voie; zones: Zone[] }) {
  const intervallesLibres = useMemo(() => {
    const courbe = courbeDeVoie(voie)
    const occupes = zones
      .map((zone): [number, number] => [
        abscisseSurVoie(voie, zone.pkDebut),
        abscisseSurVoie(voie, zone.pkFin),
      ])
      .sort((a, b) => a[0] - b[0])
    const libres: [number, number][] = []
    let curseur = 0
    for (const [debut, fin] of occupes) {
      if (debut > curseur + 0.05) libres.push([curseur, debut])
      curseur = Math.max(curseur, fin)
    }
    if (curseur < courbe.longueur - 0.05) libres.push([curseur, courbe.longueur])
    return libres
  }, [voie, zones])

  return (
    <>
      {intervallesLibres.map(([s0, s1]) => (
        <TronconVoie
          key={s0}
          voie={voie}
          s0={s0}
          s1={s1}
          rails="poses"
          traverses="anciennes"
          ballast="ancien"
          sousCouche="absente"
          plateforme="existante"
        />
      ))}
    </>
  )
}

export function Voies() {
  const projet = useApplication((etat) => etat.projet)
  if (!projet) return null
  return (
    <>
      {projet.site.voies.map((voie) => (
        <VoieHorsZones
          key={voie.id}
          voie={voie}
          zones={projet.site.zones.filter((zone) => zone.voie === voie.id)}
        />
      ))}
    </>
  )
}
