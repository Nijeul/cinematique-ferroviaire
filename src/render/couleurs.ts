// Palette du rendu des états — le cahier des charges est le tableau de
// SPEC.md §4. La couleur porte l'information, comme dans les synoptiques.

export const COULEURS_RAILS: Record<string, string> = {
  poses: '#5c6670',
  tronconnes: '#5c6670',
  desclisses: '#4a525c',
  deposes_en_extremite: '#5c6670',
  neufs_poses: '#8fb3d9',
}

export const COULEURS_TRAVERSES: Record<string, string> = {
  anciennes: '#7a6f5f',
  deposees: '#6f655a',
  neuves_reparties: '#d8d2c4',
  neuves_posees: '#e6e0d1',
}

export const COULEURS_BALLAST: Record<string, { couleur: string; hauteur: number }> = {
  ancien: { couleur: '#8d8d89', hauteur: 0.35 },
  deballaste: { couleur: '#7a5c40', hauteur: 0.1 },
  neuf_repandu: { couleur: '#c2beb2', hauteur: 0.3 },
  regale: { couleur: '#d0ccc0', hauteur: 0.35 },
}

export const COULEURS_SOUS_COUCHE: Record<string, { couleur: string; hauteur: number }> = {
  deversee: { couleur: '#c99a4b', hauteur: 0.12 },
  lissee: { couleur: '#cfa050', hauteur: 0.15 },
  compactee: { couleur: '#d4a855', hauteur: 0.18 },
}

export const COULEURS_PLATEFORME: Record<string, string> = {
  decaissee: '#6e5b45',
  ecretee: '#7a684f',
}

export const COULEURS_GEOMETRIE: Record<string, string> = {
  calee: '#e8c84a',
  bourree: '#e0973f',
  reglee: '#7fbf6a',
  soudee: '#3f8f4f',
}

export const COULEUR_MARQUE_COUPE = '#2f353b'
