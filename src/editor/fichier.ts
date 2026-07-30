import type { Projet } from '../domain/projet.ts'

// Enregistrement et ouverture du fichier .cinef : pas de backend, le projet
// est un fichier que l'utilisateur garde et transmet.

export function enregistrerProjet(projet: Projet, nomFichier: string): void {
  const contenu = JSON.stringify(projet, null, 2)
  const blob = new Blob([contenu], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier.endsWith('.cinef') ? nomFichier : `${nomFichier}.cinef`
  lien.click()
  URL.revokeObjectURL(url)
}

export function lireFichierTexte(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader()
    lecteur.onload = () => resoudre(lecteur.result as string)
    lecteur.onerror = () => rejeter(new Error('lecture du fichier impossible'))
    lecteur.readAsText(fichier)
  })
}
