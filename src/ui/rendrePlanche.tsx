import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { coinsRectangle } from '../plan/engins.ts'
import { POLICE_EXPORT, tailleRendu, typeImageRendue, type ImageRendue } from '../plan/export.ts'
import { BASE_ETIQUETTE, type ObjetAnime } from '../plan/exportAnime.ts'
import type { ListesChantier } from '../plan/legende.ts'
import { miseEnPage } from '../plan/planche.ts'
import type { ContenuImage, Synoptique } from '../plan/synoptique.ts'
import { Caisse, EtiquetteRame, Pastille } from './DessinEngins.tsx'
import { DessinPlanche } from './Planche.tsx'

// Une image de synoptique rendue en image haute définition pour les exports,
// avec le même dessin que l'écran (DessinPlanche), sans aucun repère
// d'édition : le SVG est écrit hors de la page, sérialisé, chargé comme une
// image, puis peint sur une toile. Le fond (déjà en data URL), la texture
// ballast et les textes sont dans le SVG lui-même ; les textes sont en Arial,
// comme les zones de texte PowerPoint (police du système, jamais chargée du
// réseau : un SVG chargé comme image n'y a pas accès).

class RenduImpossible extends Error {}

// Le SVG autonome d'un dessin, à la taille demandée en pixels, `vue` étant
// le rectangle montré (unités du plan).
function svgDe(dessin: ReactNode, vue: { x: number; y: number; largeur: number; hauteur: number }, largeur: number, hauteur: number, quoi: string): string {
  const hote = document.createElement('div')
  const racine = createRoot(hote)
  try {
    flushSync(() => {
      racine.render(
        <svg xmlns="http://www.w3.org/2000/svg" width={largeur} height={hauteur} viewBox={`${vue.x} ${vue.y} ${vue.largeur} ${vue.hauteur}`}>
          {dessin}
        </svg>,
      )
    })
    const svg = hote.firstElementChild
    if (!svg) throw new RenduImpossible(`Le dessin ${quoi} est vide.`)
    return new XMLSerializer().serializeToString(svg)
  } finally {
    racine.unmount()
  }
}

// Peint un SVG sur une toile et la renvoie en image : sur fond blanc, ou
// transparente (PNG). La toile est libérée aussitôt.
async function peindre(texte: string, largeur: number, hauteur: number, sortie: 'image/png' | 'image/jpeg', transparent: boolean, quoi: string): Promise<ImageRendue> {
  const url = URL.createObjectURL(new Blob([texte], { type: 'image/svg+xml' }))
  const toile = document.createElement('canvas')
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      throw new RenduImpossible(`Le navigateur n'a pas pu dessiner ${quoi}.`)
    }
    toile.width = largeur
    toile.height = hauteur
    const contexte = toile.getContext('2d')
    if (!contexte) throw new RenduImpossible('Le navigateur refuse de dessiner (mémoire insuffisante ?).')
    if (!transparent) {
      contexte.fillStyle = '#ffffff'
      contexte.fillRect(0, 0, largeur, hauteur)
    }
    contexte.drawImage(image, 0, 0, largeur, hauteur)
    const donnees = toile.toDataURL(sortie, 0.92)
    if (!donnees.startsWith('data:image/')) throw new RenduImpossible('Le navigateur refuse de produire l’image (mémoire insuffisante ?).')
    return { donnees, largeur, hauteur }
  } finally {
    URL.revokeObjectURL(url)
    toile.width = 0
    toile.height = 0
  }
}

// Rend l'image `index` en PNG (ou en JPEG si un fond est affiché) d'environ
// `cote` pixels. PowerPoint animé : une seule couche de la planche
// (« dessous » opaque, ou « dessus » en PNG transparent sur le plan), et le
// contenu d'une image intermédiaire à la place de celui de l'image.
export async function rendrePlanche(
  s: Synoptique,
  index: number,
  listes: ListesChantier,
  options: { cote?: number; textesAPart: boolean; couche?: 'tout' | 'dessous' | 'dessus'; contenuCarte?: ContenuImage },
): Promise<ImageRendue> {
  const { planche } = miseEnPage(s, index, listes)
  const taille = tailleRendu(planche, options.cote)
  const couche = options.couche ?? 'tout'
  const texte = svgDe(
    <DessinPlanche
      synoptique={s}
      index={index}
      listes={listes}
      zoom={taille.largeur / planche.largeur}
      textesAPart={options.textesAPart}
      police={POLICE_EXPORT.image}
      couche={couche}
      contenuCarte={options.contenuCarte}
    />,
    planche,
    taille.largeur,
    taille.hauteur,
    `de l'image ${index + 1}`,
  )
  const contenu = options.contenuCarte ?? s.images[index].contenu
  const avecFond = Boolean(s.fond?.image) && contenu.calques.fond.visible && couche !== 'dessus'
  return peindre(texte, taille.largeur, taille.hauteur, couche === 'dessus' ? 'image/png' : typeImageRendue(avecFond), couche === 'dessus', `l'image ${index + 1}`)
}

// Les objets séparés du PowerPoint animé sont rendus deux fois plus fins que
// la planche, pour rester nets une fois tournés.
const FINESSE_SPRITE = 2

// L'image d'un objet du PowerPoint animé (caisse d'engin ou de véhicule,
// pastille, étiquette de rame), PNG transparent, centré sur l'objet, à la
// résolution de la planche (`pixelsParUnite` : pixels par unité du plan).
export async function rendreSprite(o: Pick<ObjetAnime, 'sprite' | 'largeur' | 'hauteur'>, pixelsParUnite: number): Promise<ImageRendue> {
  const largeur = Math.max(1, Math.round(o.largeur * pixelsParUnite * FINESSE_SPRITE))
  const hauteur = Math.max(1, Math.round(o.hauteur * pixelsParUnite * FINESSE_SPRITE))
  const vue = { x: -o.largeur / 2, y: -o.hauteur / 2, largeur: o.largeur, hauteur: o.hauteur }
  const sp = o.sprite
  let dessin: ReactNode
  if (sp.genre === 'caisse') {
    const s = {
      centre: { x: 0, y: 0 },
      direction: { x: 1, y: 0 },
      longueur: sp.longueur,
      largeur: sp.largeur,
      coins: coinsRectangle({ x: 0, y: 0 }, { x: 1, y: 0 }, sp.longueur, sp.largeur),
      angle: 0,
      depassement: sp.horsVoie ? 1 : 0,
    }
    // Libellé tête en bas : la caisse est tournée de 180° de plus sur la
    // diapositive (voir angleCaisse).
    dessin = (
      <g transform="rotate(180)">
        <Caisse s={s} couleur={sp.couleur} modele={sp.modele} id="sprite" />
      </g>
    )
  } else if (sp.genre === 'pastille') {
    dessin = <Pastille centre={{ x: 0, y: 0 }} rayon={sp.rayon} couleur={sp.couleur} texte={sp.texte} />
  } else {
    dessin = <EtiquetteRame x={0} y={BASE_ETIQUETTE * sp.taille} taille={sp.taille} alerte={sp.alerte} texte={sp.texte} />
  }
  const texte = svgDe(<g fontFamily={POLICE_EXPORT.image}>{dessin}</g>, vue, largeur, hauteur, 'd’un engin')
  return peindre(texte, largeur, hauteur, 'image/png', true, 'un engin')
}
