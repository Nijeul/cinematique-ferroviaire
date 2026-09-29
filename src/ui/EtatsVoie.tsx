import { useState, type CSSProperties } from 'react'
import {
  ajouterEtatChantier,
  deplacerEtatChantier,
  imagesDeLEtat,
  modifierEtatChantier,
  supprimerEtatChantier,
  texteImages,
  type Chantier,
} from '../plan/chantier.ts'
import { etatPrecedent, peutDeplacerEtat, peutSupprimerEtat, type ChampsEtat, type EtatVoie, type RenduEtat } from '../plan/etatsVoie.ts'
import { Champ } from './CatalogueEngins.tsx'
import { Confirmation } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import { ApercuEtat } from './DessinEtats.tsx'
import { styleBouton, styleBoutonPrincipal, styleChamp, styleDiscret, styleTitreSection } from './styles.ts'
import type { Message } from './useEditeur.ts'

// Section « États de la voie » de la page du chantier : les états que
// prennent les zones de travaux dans les images des synoptiques (Avant
// travaux, Déposée, Déballastée…), dans l'ordre des travaux. On modifie le
// nom, le rendu et la couleur, on ajoute, on réordonne, on supprime (les
// zones concernées reviennent à l'état précédent de la liste).

const cellule: CSSProperties = { padding: '3px 6px', borderBottom: `1px solid ${COULEURS.bordure}`, fontSize: 13 }
const entete: CSSProperties = { ...cellule, textAlign: 'left', fontSize: 12, color: COULEURS.discret, fontWeight: 600 }
const petit: CSSProperties = { ...styleBouton(), padding: '2px 7px' }

const RENDUS: { valeur: Exclude<RenduEtat, 'zone'>; libelle: string }[] = [
  { valeur: 'aplat', libelle: 'Aplat de couleur' },
  { valeur: 'ballast', libelle: 'Texture ballast' },
]

// La couleur ne sert qu'à l'aplat, ou au voile posé sur la texture.
const couleurUtile = (e: EtatVoie): boolean => e.rendu === 'aplat' || (e.rendu === 'ballast' && e.voile)

type ASupprimer = { etat: EtatVoie; images: number; repli: EtatVoie }

export function EtatsVoie(props: { chantier: Chantier; modifierChantier: (transformer: (c: Chantier) => Chantier) => void }) {
  const { chantier, modifierChantier } = props
  const liste = chantier.etatsVoie
  const [avis, setAvis] = useState<Message | null>(null)
  const [nouveau, setNouveau] = useState('')
  const [aSupprimer, setASupprimer] = useState<ASupprimer | null>(null)

  const modifier = (etat: EtatVoie, champs: ChampsEtat): boolean => {
    const r = modifierEtatChantier(chantier, etat.id, champs)
    if (!r.ok) {
      setAvis({ genre: 'erreur', texte: `« ${etat.nom} » : ${r.erreur}` })
      return false
    }
    modifierChantier((c) => {
      const suivant = modifierEtatChantier(c, etat.id, champs)
      return suivant.ok ? suivant.valeur : c
    })
    setAvis(null)
    return true
  }

  const ajouter = () => {
    const r = ajouterEtatChantier(chantier, nouveau)
    if (!r.ok) {
      setAvis({ genre: 'erreur', texte: r.erreur })
      return
    }
    modifierChantier((c) => {
      const suivant = ajouterEtatChantier(c, nouveau)
      return suivant.ok ? suivant.valeur.chantier : c
    })
    setAvis({ genre: 'info', texte: `État « ${nouveau.trim()} » ajouté en fin de liste : choisissez son rendu et sa couleur.` })
    setNouveau('')
  }

  const supprimer = (etat: EtatVoie) => {
    setASupprimer(null)
    const r = supprimerEtatChantier(chantier, etat.id)
    if (!r.ok) {
      setAvis({ genre: 'erreur', texte: r.erreur })
      return
    }
    const images = imagesDeLEtat(chantier, etat.id)
    modifierChantier((c) => {
      const suivant = supprimerEtatChantier(c, etat.id)
      return suivant.ok ? suivant.valeur.chantier : c
    })
    setAvis({
      genre: 'info',
      texte: `État « ${etat.nom} » supprimé.${images > 0 ? ` Les zones de ${texteImages(images)} sont revenues à l'état « ${r.valeur.repli.nom} ».` : ''}`,
    })
  }

  const demanderSuppression = (etat: EtatVoie) => {
    const images = imagesDeLEtat(chantier, etat.id)
    if (images === 0) supprimer(etat)
    else setASupprimer({ etat, images, repli: etatPrecedent(liste, etat.id)! })
  }

  return (
    <section style={{ marginTop: 28 }} data-testid="section-etats">
      <h2 style={styleTitreSection}>États de la voie</h2>
      <p style={styleDiscret}>
        L'état que prend chaque zone de travaux dans les images des synoptiques, dans l'ordre des travaux (les touches 1 à 9 d'une
        image suivent cet ordre). Modifier un état change toutes les images qui l'utilisent. Le premier état garde la couleur propre
        de chaque zone.
      </p>
      <table style={{ borderCollapse: 'collapse', background: '#ffffff', border: `1px solid ${COULEURS.bordure}` }} data-testid="table-etats">
        <thead>
          <tr>
            <th style={entete}>N°</th>
            <th style={entete}>Aperçu</th>
            <th style={entete}>Nom</th>
            <th style={entete}>Rendu</th>
            <th style={entete}>Couleur</th>
            <th style={entete} title="Images où une zone est dans cet état">
              Images
            </th>
            <th style={entete} />
          </tr>
        </thead>
        <tbody>
          {liste.map((etat, i) => (
            <tr key={etat.id} data-testid="ligne-etat" data-etat={etat.nom}>
              <td style={{ ...cellule, color: COULEURS.discret, textAlign: 'right' }}>{i + 1}</td>
              <td style={cellule}>
                <ApercuEtat etat={etat} largeur={44} hauteur={18} />
              </td>
              <td style={cellule}>
                <Champ valeur={etat.nom} libelle={`Nom de l'état ${etat.nom}`} largeur={170} valider={(t) => modifier(etat, { nom: t })} />
              </td>
              <td style={cellule}>
                {etat.rendu === 'zone' ? (
                  <span style={{ color: COULEURS.discret }}>Couleur propre de la zone</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      value={etat.rendu}
                      aria-label={`Rendu de ${etat.nom}`}
                      style={styleChamp}
                      onChange={(e) => modifier(etat, { rendu: e.target.value as RenduEtat })}
                    >
                      {RENDUS.map((r) => (
                        <option key={r.valeur} value={r.valeur}>
                          {r.libelle}
                        </option>
                      ))}
                    </select>
                    {etat.rendu === 'ballast' && (
                      <label
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                        title="Un aplat semi-transparent de la couleur, par-dessus la texture (jaune tacheté de la voie neuve)"
                      >
                        <input
                          type="checkbox"
                          checked={etat.voile}
                          aria-label={`Voile coloré sur ${etat.nom}`}
                          onChange={(e) => modifier(etat, { voile: e.target.checked })}
                        />
                        voile coloré
                      </label>
                    )}
                  </div>
                )}
              </td>
              <td style={cellule}>
                {couleurUtile(etat) ? (
                  <input
                    type="color"
                    value={etat.couleur}
                    aria-label={`Couleur de ${etat.nom}`}
                    style={{ width: 30, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                    onChange={(e) => modifier(etat, { couleur: e.target.value })}
                  />
                ) : (
                  <span style={{ color: COULEURS.discret }}>—</span>
                )}
              </td>
              <td style={{ ...cellule, color: COULEURS.discret, textAlign: 'center' }}>{imagesDeLEtat(chantier, etat.id) || ''}</td>
              <td style={{ ...cellule, whiteSpace: 'nowrap' }}>
                <button
                  style={{ ...petit, opacity: peutDeplacerEtat(liste, etat.id, -1) ? 1 : 0.35 }}
                  disabled={!peutDeplacerEtat(liste, etat.id, -1)}
                  aria-label={`Monter ${etat.nom}`}
                  title="Plus tôt dans les travaux"
                  onClick={() => modifierChantier((c) => deplacerEtatChantier(c, etat.id, -1))}
                >
                  ↑
                </button>{' '}
                <button
                  style={{ ...petit, opacity: peutDeplacerEtat(liste, etat.id, 1) ? 1 : 0.35 }}
                  disabled={!peutDeplacerEtat(liste, etat.id, 1)}
                  aria-label={`Descendre ${etat.nom}`}
                  title="Plus tard dans les travaux"
                  onClick={() => modifierChantier((c) => deplacerEtatChantier(c, etat.id, 1))}
                >
                  ↓
                </button>{' '}
                {peutSupprimerEtat(liste, etat.id) ? (
                  <button
                    style={{ ...petit, color: COULEURS.erreur }}
                    aria-label={`Supprimer l'état ${etat.nom}`}
                    title="Supprimer cet état (les zones concernées reviennent à l'état précédent)"
                    onClick={() => demanderSuppression(etat)}
                  >
                    ✕
                  </button>
                ) : (
                  <span style={{ display: 'inline-block', width: 26 }} title="Le premier état ne se supprime pas" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {avis && (
        <p
          role={avis.genre === 'erreur' ? 'alert' : 'status'}
          data-testid="message-etats"
          style={{ ...styleDiscret, color: avis.genre === 'erreur' ? COULEURS.erreur : COULEURS.texte, fontSize: 13 }}
        >
          {avis.texte}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }} data-testid="ajout-etat">
        <strong>Ajouter un état :</strong>
        <input
          type="text"
          value={nouveau}
          placeholder="Nom (« Ballastée »…)"
          aria-label="Nom du nouvel état"
          style={{ ...styleChamp, width: 200 }}
          onChange={(e) => setNouveau(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') ajouter()
          }}
        />
        <button style={styleBoutonPrincipal} onClick={ajouter}>
          Ajouter
        </button>
      </div>
      {aSupprimer && (
        <Confirmation
          titre={`Supprimer l'état « ${aSupprimer.etat.nom} » ?`}
          texte={
            <>
              <p style={{ margin: '0 0 8px' }} data-testid="texte-confirmation-etat">
                Cet état est utilisé dans <strong>{texteImages(aSupprimer.images)}</strong>. Les zones concernées reviendront à l'état
                précédent de la liste : <strong>« {aSupprimer.repli.nom} »</strong>.
              </p>
              <p style={{ margin: 0, color: COULEURS.erreur }}>Cette suppression est définitive.</p>
            </>
          }
          action="Supprimer l'état"
          confirmer={() => supprimer(aSupprimer.etat)}
          annuler={() => setASupprimer(null)}
        />
      )}
    </section>
  )
}
