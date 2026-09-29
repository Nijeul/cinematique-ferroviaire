import { useState } from 'react'
import type { Rectangle } from '../plan/elements.ts'
import type { Projet } from '../plan/projet.ts'
import { verifierDemande, type DemandeValide } from '../plan/synoptique.ts'
import { ecrireInstant, lireInstant } from '../plan/temps.ts'
import { ChoixCadrage } from './ChoixCadrage.tsx'
import { BoutonsFenetre, ChampInstant, Fenetre } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import { styleBouton, styleBoutonPrincipal, styleChamp, styleTitreSection } from './styles.ts'

// « Nouveau synoptique » depuis un plan : nom, heure de début et de fin,
// cadrage. À la validation, le synoptique est une copie figée du plan.

// Proposition de départ : ce soir 22h00 → demain 06h00, à ajuster.
function horairesProposes(): { debut: string; fin: string } {
  const d = new Date()
  const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const debut = `${jour}T22:00`
  return { debut, fin: ecrireInstant(lireInstant(debut)! + 8 * 60) }
}

export function NouveauSynoptique(props: {
  projet: Projet
  nomPropose: string
  creer: (demande: DemandeValide) => void
  fermer: () => void
}) {
  const { projet } = props
  const [propose] = useState(horairesProposes)
  const [nom, setNom] = useState(props.nomPropose)
  const [debut, setDebut] = useState(propose.debut)
  const [fin, setFin] = useState(propose.fin)
  const [cadrage, setCadrage] = useState<Rectangle | null>(null)
  const [erreurs, setErreurs] = useState<string[]>([])

  // Une saisie efface les erreurs affichées : elles seront revérifiées à la validation.
  const saisir = (changer: (t: string) => void) => (t: string) => {
    changer(t)
    setErreurs([])
    return null
  }

  const valider = () => {
    const r = verifierDemande({ nom, debut, fin, cadrage })
    if (r.ok) props.creer(r.valeur)
    else setErreurs(r.erreurs)
  }

  return (
    <Fenetre titre={`Nouveau synoptique depuis le plan « ${projet.nom} »`} fermer={props.fermer} largeur={760}>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: COULEURS.discret }}>
        Le synoptique est une <strong>copie figée</strong> du plan tel qu'il est maintenant : modifier le plan ensuite ne le
        changera pas.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ width: 40 }}>Nom</span>
        <input
          type="text"
          value={nom}
          aria-label="Nom du synoptique"
          autoFocus
          onChange={(e) => saisir(setNom)(e.target.value)}
          style={{ ...styleChamp, flex: 1, fontWeight: 600 }}
        />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 28, margin: '4px 0 10px' }}>
        <ChampInstant libelle="Début" valeur={debut} changer={saisir(setDebut)} />
        <ChampInstant libelle="Fin" valeur={fin} changer={saisir(setFin)} />
      </div>
      <h3 style={styleTitreSection}>Cadrage</h3>
      <ChoixCadrage
        projet={projet}
        cadrage={cadrage}
        changer={(c) => {
          setCadrage(c)
          setErreurs([])
        }}
      />
      {erreurs.length > 0 && (
        <ul role="alert" style={{ margin: '8px 0 0', paddingLeft: 20, color: COULEURS.erreur, fontSize: 13 }}>
          {erreurs.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <BoutonsFenetre>
        <button style={styleBouton()} onClick={props.fermer}>
          Annuler
        </button>
        <button style={styleBoutonPrincipal} onClick={valider}>
          Créer le synoptique
        </button>
      </BoutonsFenetre>
    </Fenetre>
  )
}
