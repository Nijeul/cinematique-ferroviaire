import { useEffect, useState } from 'react'
import type { Projet } from '../domain/projet.ts'
import { useApplication } from '../ui/store.ts'
import { arrondiMetre, ETAT_INITIAL_ZONE, idUnique, modifierProjet, pkAuClic } from './outils.ts'

// Éditeur de site : tracé des voies à la souris, pose des zones et des
// appareils, contours des lieux. Un nouveau chantier se saisit sans JSON.

const styleLigne: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  padding: '4px 0',
  borderBottom: '1px solid #e3e6e9',
}
const styleNombre: React.CSSProperties = { width: 78 }
const styleTitre: React.CSSProperties = { fontWeight: 700, margin: '10px 0 4px' }

function BoutonSupprimer({ surClic }: { surClic: () => void }) {
  return (
    <button onClick={surClic} title="Supprimer" style={{ cursor: 'pointer', marginLeft: 'auto' }}>
      ✕
    </button>
  )
}

export function EditeurSite({ projet }: { projet: Projet }) {
  const outilTrace = useApplication((etat) => etat.outilTrace)
  const pointsSaisie = useApplication((etat) => etat.pointsSaisie)
  const choisirOutil = useApplication((etat) => etat.choisirOutil)
  const viderSaisie = useApplication((etat) => etat.viderSaisie)

  const [voieZone, setVoieZone] = useState(projet.site.voies[0]?.id ?? '')
  const [voieDirecte, setVoieDirecte] = useState(projet.site.voies[0]?.id ?? '')
  const [voieDeviee, setVoieDeviee] = useState(projet.site.voies[0]?.id ?? '')
  const [typeLieu, setTypeLieu] = useState<'base_arriere' | 'stockage' | 'acces' | 'zone_speciale' | 'ouvrage'>('stockage')

  // Une zone se pose en deux clics sur sa voie.
  useEffect(() => {
    if (outilTrace !== 'zone' || pointsSaisie.length < 2) return
    const voie = projet.site.voies.find((v) => v.id === voieZone)
    if (!voie) return viderSaisie()
    const pks = [pkAuClic(voie, pointsSaisie[0]), pkAuClic(voie, pointsSaisie[1])].sort((a, b) => a - b)
    if (pks[1] - pks[0] < 0.001) return viderSaisie()
    modifierProjet((p) => {
      const id = idUnique('zone', p.site.zones)
      p.site.zones.push({
        id,
        nom: `Zone ${p.site.zones.length + 1}`,
        voie: voie.id,
        pkDebut: pks[0],
        pkFin: pks[1],
        longueur: Math.round((pks[1] - pks[0]) * 10000) / 10,
        etatInitial: { ...ETAT_INITIAL_ZONE },
      })
    })
    viderSaisie()
  }, [outilTrace, pointsSaisie, projet, voieZone, viderSaisie])

  // Un appareil se pose en un clic sur sa voie directe.
  useEffect(() => {
    if (outilTrace !== 'appareil' || pointsSaisie.length < 1) return
    const voie = projet.site.voies.find((v) => v.id === voieDirecte)
    if (!voie) return viderSaisie()
    const pk = pkAuClic(voie, pointsSaisie[0])
    modifierProjet((p) => {
      const id = idUnique('adv', p.site.appareils)
      p.site.appareils.push({
        id,
        nom: `BS ${p.site.appareils.length + 1}`,
        type: 'branchement_simple',
        tangente: 0.085,
        voieDirecte: voie.id,
        voiedeviee: voieDeviee,
        pkPointe: pk,
        orientation: 'pointe',
        panneaux: ['pointe', 'intermediaire', 'talon'],
      })
    })
    viderSaisie()
  }, [outilTrace, pointsSaisie, projet, voieDirecte, voieDeviee, viderSaisie])

  const selectVoies = (valeur: string, surChangement: (v: string) => void) => (
    <select value={valeur} onChange={(e) => surChangement(e.target.value)}>
      {projet.site.voies.map((voie) => (
        <option key={voie.id} value={voie.id}>
          {voie.nom}
        </option>
      ))}
    </select>
  )

  return (
    <div>
      <div style={styleTitre}>Voies</div>
      {projet.site.voies.map((voie, i) => (
        <div key={voie.id} style={styleLigne}>
          <input
            value={voie.nom}
            onChange={(e) => modifierProjet((p) => void (p.site.voies[i].nom = e.target.value))}
            style={{ width: 110 }}
          />
          <label>
            PK origine
            <input
              type="number"
              step={0.001}
              value={voie.pkOrigine ?? 0}
              onChange={(e) =>
                modifierProjet((p) => void (p.site.voies[i].pkOrigine = Number(e.target.value)))
              }
              style={styleNombre}
            />
          </label>
          <span>{Math.round(voie.polyligne.length)} pts</span>
          <BoutonSupprimer
            surClic={() => modifierProjet((p) => void p.site.voies.splice(i, 1))}
          />
        </div>
      ))}
      {outilTrace === 'voie' ? (
        <div style={styleLigne}>
          <span>{pointsSaisie.length} point(s) cliqués…</span>
          <button
            disabled={pointsSaisie.length < 2}
            onClick={() => {
              modifierProjet((p) => {
                const id = idUnique('voie', p.site.voies)
                p.site.voies.push({
                  id,
                  nom: `Voie ${p.site.voies.length + 1}`,
                  polyligne: pointsSaisie,
                  pkOrigine: 0,
                })
              })
              viderSaisie()
            }}
            style={{ cursor: 'pointer' }}
          >
            Terminer la voie
          </button>
          <button onClick={viderSaisie} style={{ cursor: 'pointer' }}>Annuler</button>
        </div>
      ) : (
        <button onClick={() => choisirOutil('voie')} style={{ cursor: 'pointer' }}>
          Tracer une voie (clics au sol)
        </button>
      )}

      <div style={styleTitre}>Zones</div>
      {projet.site.zones.map((zone, i) => (
        <div key={zone.id} style={styleLigne}>
          <input
            value={zone.nom}
            onChange={(e) => modifierProjet((p) => void (p.site.zones[i].nom = e.target.value))}
            style={{ width: 110 }}
          />
          {selectVoies(zone.voie, (v) => modifierProjet((p) => void (p.site.zones[i].voie = v)))}
          <input
            type="number"
            step={0.001}
            value={zone.pkDebut}
            onChange={(e) =>
              modifierProjet((p) => {
                p.site.zones[i].pkDebut = arrondiMetre(Number(e.target.value))
                p.site.zones[i].longueur =
                  Math.round((p.site.zones[i].pkFin - p.site.zones[i].pkDebut) * 10000) / 10
              })
            }
            style={styleNombre}
            title="PK début"
          />
          <input
            type="number"
            step={0.001}
            value={zone.pkFin}
            onChange={(e) =>
              modifierProjet((p) => {
                p.site.zones[i].pkFin = arrondiMetre(Number(e.target.value))
                p.site.zones[i].longueur =
                  Math.round((p.site.zones[i].pkFin - p.site.zones[i].pkDebut) * 10000) / 10
              })
            }
            style={styleNombre}
            title="PK fin"
          />
          <span>{zone.longueur} m</span>
          <BoutonSupprimer surClic={() => modifierProjet((p) => void p.site.zones.splice(i, 1))} />
        </div>
      ))}
      <div style={styleLigne}>
        Sur {selectVoies(voieZone, setVoieZone)}
        {outilTrace === 'zone' ? (
          <>
            <span>cliquez le début puis la fin sur la voie…</span>
            <button onClick={viderSaisie} style={{ cursor: 'pointer' }}>Annuler</button>
          </>
        ) : (
          <button onClick={() => choisirOutil('zone')} style={{ cursor: 'pointer' }}>
            Placer une zone (2 clics)
          </button>
        )}
      </div>

      <div style={styleTitre}>Appareils de voie</div>
      {projet.site.appareils.map((adv, i) => (
        <div key={adv.id} style={styleLigne}>
          <input
            value={adv.nom}
            onChange={(e) => modifierProjet((p) => void (p.site.appareils[i].nom = e.target.value))}
            style={{ width: 90 }}
          />
          <select
            value={adv.orientation}
            onChange={(e) =>
              modifierProjet(
                (p) => void (p.site.appareils[i].orientation = e.target.value as 'pointe' | 'talon'),
              )
            }
          >
            <option value="pointe">pointe</option>
            <option value="talon">talon</option>
          </select>
          <input
            type="number"
            step={0.001}
            value={adv.pkPointe}
            onChange={(e) =>
              modifierProjet((p) => void (p.site.appareils[i].pkPointe = Number(e.target.value)))
            }
            style={styleNombre}
            title="PK pointe"
          />
          <input
            value={adv.panneaux.join(', ')}
            onChange={(e) =>
              modifierProjet(
                (p) =>
                  void (p.site.appareils[i].panneaux = e.target.value
                    .split(',')
                    .map((panneau) => panneau.trim())
                    .filter(Boolean)),
              )
            }
            style={{ width: 170 }}
            title="Panneaux, séparés par des virgules"
          />
          <BoutonSupprimer
            surClic={() => modifierProjet((p) => void p.site.appareils.splice(i, 1))}
          />
        </div>
      ))}
      <div style={styleLigne}>
        Directe {selectVoies(voieDirecte, setVoieDirecte)}
        Déviée {selectVoies(voieDeviee, setVoieDeviee)}
        {outilTrace === 'appareil' ? (
          <>
            <span>cliquez la pointe sur la voie directe…</span>
            <button onClick={viderSaisie} style={{ cursor: 'pointer' }}>Annuler</button>
          </>
        ) : (
          <button onClick={() => choisirOutil('appareil')} style={{ cursor: 'pointer' }}>
            Placer un appareil (1 clic)
          </button>
        )}
      </div>

      <div style={styleTitre}>Lieux</div>
      {projet.site.lieux.map((lieu, i) => (
        <div key={lieu.id} style={styleLigne}>
          <input
            value={lieu.nom}
            onChange={(e) => modifierProjet((p) => void (p.site.lieux[i].nom = e.target.value))}
            style={{ width: 160 }}
          />
          <select
            value={lieu.type}
            onChange={(e) =>
              modifierProjet((p) => void (p.site.lieux[i].type = e.target.value as typeof lieu.type))
            }
          >
            <option value="base_arriere">base arrière</option>
            <option value="stockage">stockage</option>
            <option value="acces">accès</option>
            <option value="zone_speciale">zone spéciale</option>
            <option value="ouvrage">ouvrage</option>
          </select>
          <BoutonSupprimer surClic={() => modifierProjet((p) => void p.site.lieux.splice(i, 1))} />
        </div>
      ))}
      {outilTrace === 'lieu' ? (
        <div style={styleLigne}>
          <span>{pointsSaisie.length} point(s) du contour…</span>
          <button
            disabled={pointsSaisie.length < 3}
            onClick={() => {
              modifierProjet((p) => {
                const id = idUnique('lieu', p.site.lieux)
                p.site.lieux.push({
                  id,
                  nom: `Lieu ${p.site.lieux.length + 1}`,
                  type: typeLieu,
                  contour: pointsSaisie,
                })
              })
              viderSaisie()
            }}
            style={{ cursor: 'pointer' }}
          >
            Fermer le contour
          </button>
          <button onClick={viderSaisie} style={{ cursor: 'pointer' }}>Annuler</button>
        </div>
      ) : (
        <div style={styleLigne}>
          <select value={typeLieu} onChange={(e) => setTypeLieu(e.target.value as typeof typeLieu)}>
            <option value="base_arriere">base arrière</option>
            <option value="stockage">stockage</option>
            <option value="acces">accès</option>
            <option value="zone_speciale">zone spéciale</option>
            <option value="ouvrage">ouvrage</option>
          </select>
          <button onClick={() => choisirOutil('lieu')} style={{ cursor: 'pointer' }}>
            Tracer un lieu (≥ 3 clics)
          </button>
        </div>
      )}
    </div>
  )
}
