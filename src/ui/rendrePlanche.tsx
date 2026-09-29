import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { POLICE_EXPORT, tailleRendu, typeImageRendue, type ImageRendue } from '../plan/export.ts'
import type { ListesChantier } from '../plan/legende.ts'
import { miseEnPage } from '../plan/planche.ts'
import type { Synoptique } from '../plan/synoptique.ts'
import { DessinPlanche } from './Planche.tsx'

// Une image de synoptique rendue en image haute définition pour les exports,
// avec le même dessin que l'écran (DessinPlanche), sans aucun repère
// d'édition : le SVG est écrit hors de la page, sérialisé, chargé comme une
// image, puis peint sur une toile. Le fond (déjà en data URL), la texture
// ballast et les textes sont dans le SVG lui-même ; les textes sont en Arial,
// comme les zones de texte PowerPoint (police du système, jamais chargée du
// réseau : un SVG chargé comme image n'y a pas accès).

class RenduImpossible extends Error {}

// Le SVG autonome d'une planche, à la taille demandée en pixels.
function svgDePlanche(s: Synoptique, index: number, listes: ListesChantier, largeur: number, hauteur: number, textesAPart: boolean): string {
  const { planche } = miseEnPage(s, index, listes)
  const hote = document.createElement('div')
  const racine = createRoot(hote)
  try {
    flushSync(() => {
      racine.render(
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={largeur}
          height={hauteur}
          viewBox={`${planche.x} ${planche.y} ${planche.largeur} ${planche.hauteur}`}
        >
          <DessinPlanche
            synoptique={s}
            index={index}
            listes={listes}
            zoom={largeur / planche.largeur}
            textesAPart={textesAPart}
            police={POLICE_EXPORT.image}
          />
        </svg>,
      )
    })
    const svg = hote.firstElementChild
    if (!svg) throw new RenduImpossible(`Le dessin de l'image ${index + 1} est vide.`)
    return new XMLSerializer().serializeToString(svg)
  } finally {
    racine.unmount()
  }
}

// Rend l'image `index` en PNG (ou en JPEG si un fond est affiché) d'environ
// `cote` pixels. La toile est libérée aussitôt.
export async function rendrePlanche(
  s: Synoptique,
  index: number,
  listes: ListesChantier,
  options: { cote?: number; textesAPart: boolean },
): Promise<ImageRendue> {
  const { planche } = miseEnPage(s, index, listes)
  const taille = tailleRendu(planche, options.cote)
  const texte = svgDePlanche(s, index, listes, taille.largeur, taille.hauteur, options.textesAPart)
  const url = URL.createObjectURL(new Blob([texte], { type: 'image/svg+xml' }))
  const toile = document.createElement('canvas')
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      throw new RenduImpossible(`Le navigateur n'a pas pu dessiner l'image ${index + 1}.`)
    }
    toile.width = taille.largeur
    toile.height = taille.hauteur
    const contexte = toile.getContext('2d')
    if (!contexte) throw new RenduImpossible('Le navigateur refuse de dessiner (mémoire insuffisante ?).')
    contexte.fillStyle = '#ffffff'
    contexte.fillRect(0, 0, taille.largeur, taille.hauteur)
    contexte.drawImage(image, 0, 0, taille.largeur, taille.hauteur)
    const avecFond = Boolean(s.fond?.image) && s.images[index].contenu.calques.fond.visible
    const donnees = toile.toDataURL(typeImageRendue(avecFond), 0.92)
    if (!donnees.startsWith('data:image/')) throw new RenduImpossible('Le navigateur refuse de produire l’image (mémoire insuffisante ?).')
    return { donnees, largeur: taille.largeur, hauteur: taille.hauteur }
  } finally {
    URL.revokeObjectURL(url)
    toile.width = 0
    toile.height = 0
  }
}
