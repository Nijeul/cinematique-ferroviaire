// Conversion des minutes depuis T0 en horaire lisible, à l'affichage
// uniquement — la règle n° 4 du projet : le temps du modèle reste en minutes.

const JOURS = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa']

// Rend « Ve 22h30 » en journée, « Ve/Sa 01h30 » en nuit (avant 6 h) : la
// nuit appartient aux deux jours, comme sur les synoptiques.
export function formaterInstant(t0: string, minutes: number): string {
  const date = new Date(t0)
  date.setMinutes(date.getMinutes() + Math.round(minutes))
  const heures = date.getHours()
  const hhmm = `${String(heures).padStart(2, '0')}h${String(date.getMinutes()).padStart(2, '0')}`
  if (heures < 6) {
    const veille = new Date(date)
    veille.setDate(date.getDate() - 1)
    return `${JOURS[veille.getDay()]}/${JOURS[date.getDay()]} ${hhmm}`
  }
  return `${JOURS[date.getDay()]} ${hhmm}`
}
