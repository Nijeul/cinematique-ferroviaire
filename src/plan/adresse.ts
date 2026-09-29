// L'adresse de chaque écran, dans la partie « # » de l'URL : le bouton
// Précédent du navigateur fonctionne, et recharger la page reste au même
// endroit.
//
//   #/                                        accueil
//   #/chantier/<id>                           un chantier
//   #/chantier/<id>/plan/<id>                 un plan
//   #/chantier/<id>/synoptique/<id>/image/<n> une image d'un synoptique

export type Route =
  | { ecran: 'accueil' }
  | { ecran: 'chantier'; chantierId: string }
  | { ecran: 'plan'; chantierId: string; planId: string }
  | { ecran: 'synoptique'; chantierId: string; synoptiqueId: string; image: number }

const ACCUEIL: Route = { ecran: 'accueil' }

function decoder(segment: string): string | null {
  try {
    const texte = decodeURIComponent(segment)
    return texte === '' ? null : texte
  } catch {
    return null
  }
}

// Une adresse inconnue ou abîmée ramène à l'accueil.
export function lireAdresse(hash: string): Route {
  const segments = hash.replace(/^#?\/?/, '').split('/').filter((s) => s !== '')
  if (segments[0] !== 'chantier' || segments.length < 2) return ACCUEIL
  const chantierId = decoder(segments[1])
  if (!chantierId) return ACCUEIL
  if (segments.length === 2) return { ecran: 'chantier', chantierId }
  const id = segments[3] === undefined ? null : decoder(segments[3])
  if (!id) return { ecran: 'chantier', chantierId }
  if (segments[2] === 'plan' && segments.length === 4) return { ecran: 'plan', chantierId, planId: id }
  if (segments[2] === 'synoptique') {
    const numero = segments[4] === 'image' ? Number(segments[5]) : 1
    const image = Number.isInteger(numero) && numero >= 1 ? numero : 1
    return { ecran: 'synoptique', chantierId, synoptiqueId: id, image }
  }
  return { ecran: 'chantier', chantierId }
}

export function ecrireAdresse(route: Route): string {
  const c = (id: string) => encodeURIComponent(id)
  switch (route.ecran) {
    case 'accueil':
      return '#/'
    case 'chantier':
      return `#/chantier/${c(route.chantierId)}`
    case 'plan':
      return `#/chantier/${c(route.chantierId)}/plan/${c(route.planId)}`
    case 'synoptique':
      return `#/chantier/${c(route.chantierId)}/synoptique/${c(route.synoptiqueId)}/image/${route.image}`
  }
}
