import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { Route } from '../plan/adresse.ts'
import { ajouterSynoptique, nomLibre, remplacerPlan, type Chantier, type PlanDuChantier } from '../plan/chantier.ts'
import { descriptionEchelle } from '../plan/echelle.ts'
import type { Echelle } from '../plan/projet.ts'
import { FenetreEchelle } from './CalageEchelle.tsx'
import { BandeauMessage, BarreNavigation } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import { NouveauSynoptique } from './NouveauSynoptique.tsx'
import { PanneauCalques } from './PanneauCalques.tsx'
import { PlanDeTravail } from './PlanDeTravail.tsx'
import { POLICE, styleBouton, styleBoutonPrincipal } from './styles.ts'
import { TOUCHE_ECHELLE, TOUCHES, useEditeur, type Editeur, type Outil } from './useEditeur.ts'

// Écran d'un plan : l'éditeur — fond de plan importé (image ou PDF) et, au
// calque par-dessus, voies, zones de travaux, appareils de voie, cadres et
// textes — l'outil « Échelle » et le bouton « Nouveau synoptique ». Le plan
// ne contient aucun engin : les engins se posent dans les images des
// synoptiques, à l'échelle copiée depuis le plan.

function Groupe({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{children}</div>
}

const Separateur = () => <div style={{ width: 1, alignSelf: 'stretch', background: COULEURS.bordure }} />

const OUTILS: { outil: Outil; libelle: string; titre: string }[] = [
  { outil: 'selection', libelle: 'Sélection', titre: 'Choisir, déplacer, supprimer' },
  { outil: 'voie', libelle: 'Voie', titre: 'Tracer une voie point par point' },
  { outil: 'zone', libelle: 'Zone', titre: 'Zone de travaux sur une voie' },
  { outil: 'bs', libelle: 'Appareil (BS)', titre: 'Branchement simple : pointe puis talon' },
  { outil: 'communication', libelle: 'Communication', titre: 'Deux BS talon contre talon entre deux voies' },
  { outil: 'cadre', libelle: 'Cadre', titre: 'Rectangle : stockage, base arrière, pont…' },
  { outil: 'texte', libelle: 'Texte', titre: 'Texte libre sur le plan' },
  { outil: 'main', libelle: 'Main', titre: 'Déplacer la vue' },
]

// Consigne en bas du plan : ce qu'il faut faire avec l'outil en cours, y
// compris après le premier clic d'une zone, d'un BS ou d'une communication.
function consigne(editeur: Editeur): string {
  const { outil, pose, projet } = editeur
  const voie = pose && projet.voies.find((v) => v.id === pose.voieId)
  const annuler = ' · Échap : annuler'
  switch (outil) {
    case 'voie':
      return 'Cliquez pour poser les points de la voie · double-clic ou Entrée pour terminer · Maj : horizontal, vertical, 45° · Échap : annuler'
    case 'zone':
      return voie
        ? `Cliquez la fin de la zone sur la même voie (« ${voie.nom} »)${annuler}`
        : 'Cliquez sur une voie au début de la zone'
    case 'bs':
      return voie
        ? `Cliquez sur la voie déviée, côté talon (pointe posée sur « ${voie.nom} »)${annuler}`
        : 'Cliquez sur la voie directe, à la pointe du BS'
    case 'communication':
      return voie
        ? `Cliquez sur la seconde voie, à la pointe du second BS (premier posé sur « ${voie.nom} »)${annuler}`
        : 'Cliquez sur la première voie, à la pointe du premier BS'
    case 'cadre':
      return 'Glissez pour tracer le cadre, dans n\'importe quel sens'
    case 'texte':
      return 'Cliquez où poser le texte, puis tapez-le dans le panneau à droite · clic sur un texte : le modifier'
    case 'selection':
      return 'Cliquez un élément pour le choisir, puis glissez-le ou ses poignées · Suppr : supprimer'
    case 'main':
      return 'Glissez pour déplacer la vue · molette : zoom'
  }
}

function BarreOutils({ editeur, ouvrirEchelle }: { editeur: Editeur; ouvrirEchelle: () => void }) {
  const choixFond = useRef<HTMLInputElement>(null)
  const choixProjet = useRef<HTMLInputElement>(null)
  const verrouille = editeur.projet.calques.fond.verrouille
  return (
    <header
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        padding: '8px 12px',
        background: '#ffffff',
        borderBottom: `1px solid ${COULEURS.bordure}`,
      }}
    >
      <Groupe>
        <button
          style={styleBouton()}
          onClick={() => choixProjet.current?.click()}
          title="Remplace ce plan par un plan enregistré dans un fichier (Annuler pour revenir en arrière)"
        >
          Ouvrir un fichier…
        </button>
        <button style={styleBouton()} onClick={editeur.enregistrerProjet} title="Télécharge ce plan seul dans un fichier">
          Exporter le plan
        </button>
        <input
          ref={choixProjet}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="choix-projet"
          onChange={(e) => {
            const fichier = e.target.files?.[0]
            e.target.value = ''
            if (fichier) void editeur.ouvrirProjet(fichier)
          }}
        />
      </Groupe>
      <Separateur />
      <Groupe>
        <button
          style={styleBouton()}
          disabled={verrouille}
          title={verrouille ? 'Le calque « Fond » est verrouillé' : 'Image PNG, JPG ou PDF'}
          onClick={() => choixFond.current?.click()}
        >
          Importer un fond…
        </button>
        <input
          ref={choixFond}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          hidden
          data-testid="choix-fond"
          onChange={(e) => {
            const fichier = e.target.files?.[0]
            e.target.value = ''
            if (fichier) void editeur.importerFond(fichier)
          }}
        />
      </Groupe>
      <Separateur />
      <Groupe>
        {OUTILS.map(({ outil, libelle, titre }) => (
          <button
            key={outil}
            style={styleBouton(editeur.outil === outil)}
            title={`${titre} — raccourci : ${TOUCHES[outil]}`}
            aria-pressed={editeur.outil === outil}
            data-outil={outil}
            onClick={() => editeur.choisirOutil(outil)}
          >
            {libelle}
          </button>
        ))}
        <button
          style={styleBouton()}
          onClick={ouvrirEchelle}
          title={`Caler ou recaler l'échelle du plan : deux repères et leur distance réelle — raccourci : ${TOUCHE_ECHELLE}`}
        >
          Échelle…
        </button>
      </Groupe>
      <Separateur />
      <Groupe>
        <button style={styleBouton()} disabled={!editeur.peutAnnuler} onClick={editeur.annuler} title="Ctrl+Z">
          ↶ Annuler
        </button>
        <button style={styleBouton()} disabled={!editeur.peutRetablir} onClick={editeur.retablir} title="Ctrl+Y">
          ↷ Rétablir
        </button>
      </Groupe>
      <Separateur />
      <button style={styleBouton()} onClick={() => editeur.setVue(null)} title="Voir tout le plan">
        Recadrer
      </button>
    </header>
  )
}

function Bandeau({ editeur, ouvrirEchelle }: { editeur: Editeur; ouvrirEchelle: () => void }) {
  const { occupe } = editeur
  return (
    <>
      {!editeur.projet.echelle && (
        <div
          role="note"
          data-testid="bandeau-sans-echelle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '7px 14px',
            fontSize: 13,
            color: COULEURS.avertissement,
            background: '#fdf6e3',
            borderBottom: `1px solid #ecd9a8`,
          }}
        >
          <span style={{ flex: 1 }}>
            <strong>Échelle non définie</strong> : calez-la pour que les engins des synoptiques issus de ce plan soient à la bonne taille.
          </span>
          <button style={styleBoutonPrincipal} onClick={ouvrirEchelle}>
            Caler l'échelle…
          </button>
        </div>
      )}
      {occupe && (
        <p role="status" style={{ margin: 0, padding: '6px 14px', fontSize: 13, color: COULEURS.discret, background: '#ffffff' }}>
          {occupe}
        </p>
      )}
      <BandeauMessage message={editeur.message} fermer={() => editeur.setMessage(null)} />
    </>
  )
}

export function EcranPlan(props: {
  chantier: Chantier
  plan: PlanDuChantier
  modifierChantier: (transformer: (c: Chantier) => Chantier) => void
  aller: (route: Route) => void
  etat: ReactNode
}) {
  const { chantier, plan, modifierChantier } = props
  const [fenetre, setFenetre] = useState<'synoptique' | 'echelle' | null>(null)
  const ouvrirEchelle = useCallback(() => setFenetre('echelle'), [])
  const editeur = useEditeur(plan.projet, (projet) => modifierChantier((c) => remplacerPlan(c, plan.id, projet)), {
    suspendu: fenetre !== null,
    ouvrirEchelle,
  })
  const { projet } = editeur

  const recaler = (echelle: Echelle) => {
    const avant = projet.echelle
    editeur.modifier((p) => ({ ...p, echelle }))
    setFenetre(null)
    const synoptiques = chantier.synoptiques.some((s) => s.origine.planId === plan.id)
    editeur.setMessage({
      genre: 'info',
      texte:
        `Échelle ${avant ? 'recalée' : 'calée'} : ${descriptionEchelle(echelle, projet.largeur)}.` +
        (synoptiques ? ' Les synoptiques déjà créés depuis ce plan gardent la leur (copies figées).' : '') +
        ' Ctrl+Z pour revenir en arrière.',
    })
  }
  const vide = !projet.fond && projet.voies.length + projet.cadres.length + projet.textes.length === 0 && !editeur.trace

  const creerSynoptique = (demande: Parameters<typeof ajouterSynoptique>[2]) => {
    const maintenant = new Date().toISOString()
    const source = { id: plan.id, projet }
    const { id } = ajouterSynoptique(chantier, source, demande, maintenant)
    modifierChantier((c) => ajouterSynoptique(remplacerPlan(c, plan.id, projet), source, demande, maintenant).chantier)
    props.aller({ ecran: 'synoptique', chantierId: chantier.id, synoptiqueId: id, image: 1 })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: POLICE, color: COULEURS.texte }}>
      <BarreNavigation
        chemin={[
          { libelle: 'Accueil', route: { ecran: 'accueil' } },
          { libelle: chantier.nom, route: { ecran: 'chantier', chantierId: chantier.id } },
          { libelle: projet.nom || 'Plan sans nom' },
        ]}
        etat={props.etat}
        action={
          <button
            style={{ ...styleBoutonPrincipal, borderColor: '#5b93cc' }}
            onClick={() => setFenetre('synoptique')}
            title="Créer un synoptique à partir de ce plan (copie figée)"
          >
            Nouveau synoptique…
          </button>
        }
      />
      <BarreOutils editeur={editeur} ouvrirEchelle={ouvrirEchelle} />
      <Bandeau editeur={editeur} ouvrirEchelle={ouvrirEchelle} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <main style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden', userSelect: 'none' }}>
          <PlanDeTravail editeur={editeur} />
          {vide && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <p style={{ maxWidth: 440, textAlign: 'center', fontSize: 15, lineHeight: 1.5, color: COULEURS.discret }}>
                Importez votre plan (image ou PDF) avec <strong>Importer un fond…</strong>, puis tracez les voies
                par-dessus avec l'outil <strong>Voie</strong>.
              </p>
            </div>
          )}
          <p
            style={{
              position: 'absolute',
              left: 10,
              bottom: 8,
              margin: 0,
              padding: '4px 9px',
              fontSize: 12,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.92)',
              border: `1px solid ${COULEURS.bordure}`,
              color: COULEURS.discret,
              pointerEvents: 'none',
            }}
            data-testid="consigne"
          >
            {consigne(editeur)}
          </p>
        </main>
        <PanneauCalques editeur={editeur} />
      </div>
      {fenetre === 'echelle' && (
        <FenetreEchelle
          titre={projet.echelle ? "Recaler l'échelle du plan" : "Caler l'échelle du plan"}
          explication="Les synoptiques créés ensuite à partir de ce plan reprendront cette échelle : leurs engins y seront à la bonne taille."
          projet={projet}
          valider={recaler}
          fermer={() => setFenetre(null)}
        />
      )}
      {fenetre === 'synoptique' && (
        <NouveauSynoptique
          projet={projet}
          nomPropose={nomLibre(
            chantier.synoptiques.map((s) => s.nom),
            `Synoptique ${chantier.synoptiques.length + 1}`,
          )}
          creer={creerSynoptique}
          fermer={() => setFenetre(null)}
        />
      )}
    </div>
  )
}
