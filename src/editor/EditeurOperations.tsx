import { useState } from 'react'
import { FLUX_QUOI, NOMS_VERBES, VERBES } from '../domain/etats.ts'
import type { Effet, Flux, Operation, Projet } from '../domain/projet.ts'
import { useApplication } from '../ui/store.ts'
import { idUnique, modifierProjet } from './outils.ts'

// Éditeur du phasage : la table des opérations, avec la liste fermée des
// verbes. Le phasage se modifie dans l'interface, plus besoin de JSON.

const styleLigne: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  padding: '4px 0',
}
const styleBloc: React.CSSProperties = {
  border: '1px solid #d5dade',
  borderRadius: 4,
  padding: '6px 8px',
  marginBottom: 6,
}
const styleNombre: React.CSSProperties = { width: 68 }

function SelectionMultiple({
  valeurs,
  options,
  surChangement,
  titre,
}: {
  valeurs: string[]
  options: { id: string; nom: string }[]
  surChangement: (valeurs: string[]) => void
  titre: string
}) {
  return (
    <label title={titre}>
      {titre}
      <select
        multiple
        size={Math.min(options.length, 4)}
        value={valeurs}
        onChange={(evenement) =>
          surChangement([...evenement.target.selectedOptions].map((option) => option.value))
        }
        style={{ verticalAlign: 'top', marginLeft: 4, minWidth: 130 }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.nom}
          </option>
        ))}
      </select>
    </label>
  )
}

function EditeurEffet({
  effet,
  indexOperation,
  indexEffet,
  projet,
}: {
  effet: Effet
  indexOperation: number
  indexEffet: number
  projet: Projet
}) {
  const versAdmis = VERBES[effet.verbe]?.vers ?? []
  const modifier = (transformation: (e: Effet) => void) =>
    modifierProjet((p) => transformation(p.operations[indexOperation].effets[indexEffet]))
  return (
    <div style={styleLigne}>
      <select
        value={effet.verbe}
        onChange={(evenement) =>
          modifier((e) => {
            e.verbe = evenement.target.value
            delete e.vers
          })
        }
      >
        {NOMS_VERBES.map((verbe) => (
          <option key={verbe} value={verbe}>
            {verbe}
          </option>
        ))}
      </select>
      {versAdmis.length > 0 && (
        <select
          value={effet.vers ?? ''}
          onChange={(evenement) =>
            modifier((e) => {
              if (evenement.target.value) e.vers = evenement.target.value
              else delete e.vers
            })
          }
        >
          <option value="">vers (défaut)</option>
          {versAdmis.map((valeur) => (
            <option key={valeur} value={valeur}>
              {valeur}
            </option>
          ))}
        </select>
      )}
      {(effet.verbe === 'deposer_adv' || effet.verbe === 'poser_adv') && (
        <input
          value={effet.decoupage?.join(', ') ?? ''}
          placeholder="panneaux : pointe, talon…"
          onChange={(evenement) =>
            modifier((e) => {
              const panneaux = evenement.target.value.split(',').map((v) => v.trim()).filter(Boolean)
              if (panneaux.length > 0) e.decoupage = panneaux
              else delete e.decoupage
            })
          }
          style={{ width: 180 }}
        />
      )}
      {effet.verbe === 'installer' && (
        <input
          value={effet.objet ?? ''}
          placeholder="objet"
          onChange={(evenement) =>
            modifier((e) => {
              if (evenement.target.value) e.objet = evenement.target.value
              else delete e.objet
            })
          }
          style={{ width: 140 }}
        />
      )}
      {effet.verbe === 'circuler' && (
        <>
          <select
            value={effet.voie ?? ''}
            onChange={(evenement) =>
              modifier((e) => {
                if (evenement.target.value) e.voie = evenement.target.value
                else delete e.voie
              })
            }
          >
            <option value="">voie…</option>
            {projet.site.voies.map((voie) => (
              <option key={voie.id} value={voie.id}>
                {voie.nom}
              </option>
            ))}
          </select>
          <input
            type="number"
            step={0.001}
            value={effet.pkArrivee ?? ''}
            placeholder="PK arrivée"
            onChange={(evenement) =>
              modifier((e) => {
                if (evenement.target.value !== '') e.pkArrivee = Number(evenement.target.value)
                else delete e.pkArrivee
              })
            }
            style={styleNombre}
          />
        </>
      )}
      <button
        onClick={() => modifierProjet((p) => void p.operations[indexOperation].effets.splice(indexEffet, 1))}
        style={{ cursor: 'pointer', marginLeft: 'auto' }}
        title="Supprimer l'effet"
      >
        ✕
      </button>
    </div>
  )
}

function EditeurFlux({
  flux,
  indexOperation,
  indexFlux,
  emplacements,
  porteurs,
}: {
  flux: Flux
  indexOperation: number
  indexFlux: number
  emplacements: { id: string; nom: string }[]
  porteurs: { id: string; nom: string }[]
}) {
  const modifier = (transformation: (f: Flux) => void) =>
    modifierProjet((p) => transformation(p.operations[indexOperation].flux[indexFlux]))
  const selectEmplacement = (valeur: string, surChangement: (v: string) => void) => (
    <select value={valeur} onChange={(evenement) => surChangement(evenement.target.value)}>
      {emplacements.map((option) => (
        <option key={option.id} value={option.id}>
          {option.nom}
        </option>
      ))}
    </select>
  )
  return (
    <div style={styleLigne}>
      <select
        value={flux.quoi}
        onChange={(evenement) => modifier((f) => void (f.quoi = evenement.target.value as Flux['quoi']))}
      >
        {FLUX_QUOI.map((quoi) => (
          <option key={quoi} value={quoi}>
            {quoi}
          </option>
        ))}
      </select>
      de {selectEmplacement(flux.de, (v) => modifier((f) => void (f.de = v)))}
      vers {selectEmplacement(flux.vers, (v) => modifier((f) => void (f.vers = v)))}
      <input
        type="number"
        value={flux.quantite ?? ''}
        placeholder="qté"
        onChange={(evenement) =>
          modifier((f) => {
            if (evenement.target.value !== '') f.quantite = Number(evenement.target.value)
            else delete f.quantite
          })
        }
        style={{ width: 56 }}
      />
      <select
        value={flux.porteur ?? ''}
        onChange={(evenement) =>
          modifier((f) => {
            if (evenement.target.value) f.porteur = evenement.target.value
            else delete f.porteur
          })
        }
      >
        <option value="">porteur…</option>
        {porteurs.map((porteur) => (
          <option key={porteur.id} value={porteur.id}>
            {porteur.nom}
          </option>
        ))}
      </select>
      {flux.quoi === 'panneau_adv' && (
        <input
          value={flux.ref ?? ''}
          placeholder="réf. appareil.panneau"
          onChange={(evenement) =>
            modifier((f) => {
              if (evenement.target.value) f.ref = evenement.target.value
              else delete f.ref
            })
          }
          style={{ width: 150 }}
        />
      )}
      <button
        onClick={() => modifierProjet((p) => void p.operations[indexOperation].flux.splice(indexFlux, 1))}
        style={{ cursor: 'pointer', marginLeft: 'auto' }}
        title="Supprimer le flux"
      >
        ✕
      </button>
    </div>
  )
}

function EditeurOperation({
  operation,
  index,
  projet,
  ouverte,
  basculer,
}: {
  operation: Operation
  index: number
  projet: Projet
  ouverte: boolean
  basculer: () => void
}) {
  const modifier = (transformation: (o: Operation) => void) =>
    modifierProjet((p) => transformation(p.operations[index]))
  const cibles = [
    ...projet.site.zones.map((z) => ({ id: z.id, nom: z.nom })),
    ...projet.site.appareils.map((a) => ({ id: a.id, nom: a.nom })),
    ...projet.site.lieux.map((l) => ({ id: l.id, nom: l.nom })),
  ]
  const emplacements = [...cibles, ...projet.ressources.map((r) => ({ id: r.id, nom: r.nom }))]
  const ressources = projet.ressources.map((r) => ({ id: r.id, nom: r.nom }))

  return (
    <div style={styleBloc}>
      <div style={{ ...styleLigne, cursor: 'pointer' }} onClick={basculer}>
        <strong>
          {operation.numero}
          {operation.optionnelle ? ' *' : ''}
        </strong>
        <span style={{ flex: 1 }}>{operation.libelle}</span>
        <span>
          {operation.tDebut}–{operation.tFin} min
        </span>
        <span>{ouverte ? '▾' : '▸'}</span>
      </div>
      {ouverte && (
        <>
          <div style={styleLigne}>
            <label>
              N°
              <input
                type="number"
                value={operation.numero}
                onChange={(e) => modifier((o) => void (o.numero = Number(e.target.value)))}
                style={{ width: 54, marginLeft: 4 }}
              />
            </label>
            <input
              value={operation.libelle}
              onChange={(e) => modifier((o) => void (o.libelle = e.target.value))}
              style={{ flex: 1, minWidth: 200 }}
            />
          </div>
          <div style={styleLigne}>
            <label>
              Début
              <input
                type="number"
                value={operation.tDebut}
                onChange={(e) => modifier((o) => void (o.tDebut = Number(e.target.value)))}
                style={{ ...styleNombre, marginLeft: 4 }}
              />
            </label>
            <label>
              Fin
              <input
                type="number"
                value={operation.tFin}
                onChange={(e) => modifier((o) => void (o.tFin = Number(e.target.value)))}
                style={{ ...styleNombre, marginLeft: 4 }}
              />
            </label>
            <select
              value={operation.sens ?? ''}
              onChange={(e) =>
                modifier((o) => {
                  if (e.target.value) o.sens = e.target.value as Operation['sens']
                  else delete o.sens
                })
              }
            >
              <option value="">sens…</option>
              <option value="pk_croissant">PK croissant</option>
              <option value="pk_decroissant">PK décroissant</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={operation.optionnelle ?? false}
                onChange={(e) =>
                  modifier((o) => {
                    if (e.target.checked) o.optionnelle = true
                    else delete o.optionnelle
                  })
                }
              />
              optionnelle
            </label>
          </div>
          <div style={styleLigne}>
            <SelectionMultiple
              titre="Moyens"
              valeurs={operation.ressources}
              options={ressources}
              surChangement={(valeurs) => modifier((o) => void (o.ressources = valeurs))}
            />
            <SelectionMultiple
              titre="Cibles"
              valeurs={operation.cibles}
              options={cibles}
              surChangement={(valeurs) => modifier((o) => void (o.cibles = valeurs))}
            />
          </div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>Effets</div>
          {operation.effets.map((effet, indexEffet) => (
            <EditeurEffet
              key={indexEffet}
              effet={effet}
              indexOperation={index}
              indexEffet={indexEffet}
              projet={projet}
            />
          ))}
          <button
            onClick={() => modifier((o) => void o.effets.push({ verbe: 'attendre' } as Effet))}
            style={{ cursor: 'pointer' }}
          >
            + effet
          </button>
          <div style={{ fontWeight: 600, marginTop: 6 }}>Flux</div>
          {operation.flux.map((flux, indexFlux) => (
            <EditeurFlux
              key={indexFlux}
              flux={flux}
              indexOperation={index}
              indexFlux={indexFlux}
              emplacements={emplacements}
              porteurs={ressources}
            />
          ))}
          <button
            onClick={() =>
              modifier((o) =>
                o.flux.push({
                  quoi: 'traverses_anciennes',
                  de: cibles[0]?.id ?? '',
                  vers: cibles[0]?.id ?? '',
                } as Flux),
              )
            }
            style={{ cursor: 'pointer' }}
          >
            + flux
          </button>
          <div style={styleLigne}>
            <input
              value={operation.commentaire ?? ''}
              placeholder="commentaire"
              onChange={(e) =>
                modifier((o) => {
                  if (e.target.value) o.commentaire = e.target.value
                  else delete o.commentaire
                })
              }
              style={{ flex: 1 }}
            />
            <button
              onClick={() => modifierProjet((p) => void p.operations.splice(index, 1))}
              style={{ cursor: 'pointer', color: '#a4282d' }}
            >
              Supprimer l'opération
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function EditeurRessources({ projet }: { projet: Projet }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700, margin: '6px 0' }}>Moyens</div>
      {projet.ressources.map((ressource, i) => (
        <div key={ressource.id} style={styleLigne}>
          <input
            value={ressource.nom}
            onChange={(e) => modifierProjet((p) => void (p.ressources[i].nom = e.target.value))}
            style={{ width: 150 }}
          />
          <select
            value={ressource.type}
            onChange={(e) =>
              modifierProjet(
                (p) => void (p.ressources[i].type = e.target.value as typeof ressource.type),
              )
            }
          >
            <option value="pelle_rr">pelle RR</option>
            <option value="train_travaux">TTX</option>
            <option value="portique">portique</option>
          </select>
          <input
            type="number"
            value={ressource.numero ?? ''}
            placeholder="n°"
            onChange={(e) =>
              modifierProjet((p) => {
                if (e.target.value !== '') p.ressources[i].numero = Number(e.target.value)
                else delete p.ressources[i].numero
              })
            }
            style={{ width: 46 }}
          />
          <select
            value={ressource.lieuInitial}
            onChange={(e) =>
              modifierProjet((p) => void (p.ressources[i].lieuInitial = e.target.value))
            }
          >
            {projet.site.lieux.map((lieu) => (
              <option key={lieu.id} value={lieu.id}>
                {lieu.nom}
              </option>
            ))}
          </select>
          <input
            type="color"
            value={`#${ressource.couleur ?? '888888'}`}
            onChange={(e) =>
              modifierProjet(
                (p) => void (p.ressources[i].couleur = e.target.value.slice(1).toUpperCase()),
              )
            }
            title="Couleur"
          />
          <button
            onClick={() => modifierProjet((p) => void p.ressources.splice(i, 1))}
            style={{ cursor: 'pointer', marginLeft: 'auto' }}
            title="Supprimer"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          modifierProjet((p) => {
            const id = idUnique('engin', p.ressources)
            p.ressources.push({
              id,
              nom: `Engin ${p.ressources.length + 1}`,
              type: 'pelle_rr',
              modeInitial: 'route',
              lieuInitial: p.site.lieux[0]?.id ?? '',
              couleur: 'E8A33D',
            })
          })
        }
        style={{ cursor: 'pointer' }}
      >
        + moyen
      </button>
    </div>
  )
}

export function EditeurOperations() {
  const projet = useApplication((etat) => etat.projet)
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set())
  if (!projet) return null

  const basculer = (id: string) =>
    setOuvertes((courantes) => {
      const suivantes = new Set(courantes)
      if (suivantes.has(id)) suivantes.delete(id)
      else suivantes.add(id)
      return suivantes
    })

  const operationsTriees = projet.operations
    .map((operation, index) => ({ operation, index }))
    .sort((a, b) => a.operation.tDebut - b.operation.tDebut || a.operation.numero - b.operation.numero)

  return (
    <div>
      <EditeurRessources projet={projet} />
      <div style={{ fontWeight: 700, margin: '6px 0' }}>
        Opérations ({projet.operations.length})
      </div>
      {operationsTriees.map(({ operation, index }) => (
        <EditeurOperation
          key={operation.id}
          operation={operation}
          index={index}
          projet={projet}
          ouverte={ouvertes.has(operation.id)}
          basculer={() => basculer(operation.id)}
        />
      ))}
      <button
        onClick={() =>
          modifierProjet((p) => {
            const id = idUnique('op', p.operations)
            const dernier = p.operations[p.operations.length - 1]
            p.operations.push({
              id,
              numero: (dernier?.numero ?? 0) + 1,
              libelle: 'Nouvelle opération',
              tDebut: dernier?.tFin ?? 0,
              tFin: (dernier?.tFin ?? 0) + 30,
              ressources: [],
              cibles: [],
              effets: [{ verbe: 'attendre' } as Effet],
              flux: [],
            })
          })
        }
        style={{ cursor: 'pointer' }}
      >
        + opération
      </button>
    </div>
  )
}
