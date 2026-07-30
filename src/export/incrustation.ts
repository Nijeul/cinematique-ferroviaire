import type { Projet } from '../domain/projet.ts'
import { etatAtMemoise } from '../state/etatAt.ts'
import { formaterInstant } from '../ui/temps.ts'

// Incrustations des sorties (vidéo et planches) : horloge et encart PHASAGE,
// dessinés au canvas 2D par-dessus l'image de la scène — les mêmes
// informations que les panneaux de l'application, mais dans l'image.

// Cartouche des planches : chantier, document, indice, horaire, numéro.
export function dessinerCartouche(
  contexte: CanvasRenderingContext2D,
  projet: Projet,
  t: number,
  numero: number,
  total: number,
): void {
  const { width: largeur, height: hauteur } = contexte.canvas
  const echelle = Math.max(largeur / 1600, 0.7)
  const taille = Math.round(18 * echelle)
  const hauteurCartouche = taille * 3.6
  const y = hauteur - hauteurCartouche - 16
  const largeurCartouche = Math.min(430 * echelle, largeur * 0.4)
  contexte.fillStyle = 'rgba(255,255,255,0.94)'
  contexte.fillRect(16, y, largeurCartouche, hauteurCartouche)
  contexte.strokeStyle = '#b9c0c8'
  contexte.strokeRect(16, y, largeurCartouche, hauteurCartouche)
  contexte.fillStyle = '#1c2430'
  contexte.textBaseline = 'middle'
  contexte.font = `bold ${taille}px system-ui, sans-serif`
  contexte.fillText(projet.meta.chantier, 26, y + taille, largeurCartouche - 20)
  contexte.font = `${taille}px system-ui, sans-serif`
  const sousTitre = [projet.meta.document, projet.meta.indice ? `indice ${projet.meta.indice}` : '']
    .filter(Boolean)
    .join(' — ')
  contexte.fillText(sousTitre || '—', 26, y + taille * 2.1, largeurCartouche - 20)
  contexte.fillText(
    `${formaterInstant(projet.temps.t0, t)} · planche ${numero}/${total}`,
    26,
    y + taille * 3.1,
    largeurCartouche - 20,
  )
}

export function dessinerIncrustations(
  contexte: CanvasRenderingContext2D,
  projet: Projet,
  t: number,
): void {
  const { width: largeur, height: hauteur } = contexte.canvas
  const echelle = Math.max(largeur / 1600, 0.7)

  // Horloge en haut à gauche.
  contexte.font = `${Math.round(30 * echelle)}px system-ui, sans-serif`
  const horloge = ` ${formaterInstant(projet.temps.t0, t)} `
  const largeurHorloge = contexte.measureText(horloge).width
  contexte.fillStyle = 'rgba(255,255,255,0.9)'
  contexte.fillRect(16, 16, largeurHorloge + 16, 46 * echelle)
  contexte.fillStyle = '#1c2430'
  contexte.textBaseline = 'middle'
  contexte.fillText(horloge, 24, 16 + 23 * echelle)

  // Encart PHASAGE en bas à droite.
  const actives = new Set(etatAtMemoise(projet, t).operations)
  const operations = projet.operations
    .filter((op) => actives.has(op.id))
    .sort((a, b) => a.numero - b.numero)
    .slice(0, 8)
  const taille = Math.round(19 * echelle)
  contexte.font = `${taille}px system-ui, sans-serif`
  const lignes = operations.map(
    (op) => `${op.numero}${op.optionnelle ? '*' : ''} — ${op.libelle}`,
  )
  const largeurEncart = Math.min(
    Math.max(260, ...lignes.map((ligne) => contexte.measureText(ligne).width + 28)),
    largeur * 0.45,
  )
  const hauteurEncart = (lignes.length + 1.6) * taille * 1.35 + 12
  const x = largeur - largeurEncart - 16
  const y = hauteur - hauteurEncart - 16
  contexte.fillStyle = 'rgba(255,255,255,0.92)'
  contexte.fillRect(x, y, largeurEncart, hauteurEncart)
  contexte.strokeStyle = '#b9c0c8'
  contexte.strokeRect(x, y, largeurEncart, hauteurEncart)
  contexte.fillStyle = '#1c2430'
  contexte.font = `bold ${taille}px system-ui, sans-serif`
  contexte.fillText('PHASAGE', x + 12, y + taille)
  contexte.font = `${taille}px system-ui, sans-serif`
  lignes.forEach((ligne, i) => {
    contexte.fillText(ligne, x + 12, y + taille + (i + 1.2) * taille * 1.35, largeurEncart - 24)
  })
  if (lignes.length === 0) {
    contexte.fillText('Aucune opération en cours.', x + 12, y + taille * 2.5)
  }
}
