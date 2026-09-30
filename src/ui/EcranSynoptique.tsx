import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ecrireAdresse } from '../plan/adresse.ts'
import { modifierCartouche, resumeCartouche } from '../plan/cartouche.ts'
import { remplacerSynoptique, texteImages, type Chantier } from '../plan/chantier.ts'
import type { Rectangle } from '../plan/elements.ts'
import { annuler, creerHistorique, enregistrer, peutAnnuler, peutRetablir, retablir } from '../plan/historique.ts'
import { descriptionEchelle } from '../plan/echelle.ts'
import { OPTIONS_PAR_DEFAUT, type OptionsExport } from '../plan/export.ts'
import type { Echelle } from '../plan/projet.ts'
import type { ListesChantier } from '../plan/legende.ts'
import { miseEnPage } from '../plan/planche.ts'
import {
  calerEchelleSynoptique,
  modifierDebut,
  modifierFin,
  modifierHorairesImage,
  nouvelleImage,
  projetDeImage,
  supprimerImage,
  type Synoptique,
} from '../plan/synoptique.ts'
import { formaterDuree, formaterPlage, instantDepuisT0, minutesDepuisT0 } from '../plan/temps.ts'
import { ajusterSurRectangle } from '../plan/vue.ts'
import { FenetreEchelle } from './CalageEchelle.tsx'
import { ChoixCadrage } from './ChoixCadrage.tsx'
import { BandeauMessage, BarreNavigation, BoutonsFenetre, ChampInstant, Fenetre } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import { FenetreCartouche, FenetreExport } from './FenetreExport.tsx'
import { ImageDeTravail } from './ImageDeTravail.tsx'
import { CalqueEngins, ChoixType, RameAPoser } from './PanneauEngins.tsx'
import { CalqueFleches, ChoixTypeFleche, PanneauFleche } from './PanneauFleches.tsx'
import { CalqueCommentaires, PanneauCommentaire } from './PanneauCommentaires.tsx'
import { PanneauExploitation } from './PanneauExploitation.tsx'
import { PanneauCreneau, PanneauLegende, PanneauPhasage, PanneauZone } from './PanneauImage.tsx'
import { DessinPlanche } from './Planche.tsx'
import { POLICE, styleBouton, styleBoutonDanger, styleBoutonPrincipal, styleChamp, styleDiscret, styleTitreSection } from './styles.ts'
import type { Message } from './useEditeur.ts'
import { RAISON_SANS_ECHELLE, TOUCHES_IMAGE, useEditeurImage, type EditeurImage, type OutilImage } from './useEditeurImage.ts'

// Écran d'un synoptique : on feuillette ses images comme un PowerPoint, et on
// pose les engins et les rames sur l'image courante, à l'échelle copiée du
// plan (ou calée ici) ; on y trace les flèches, on y choisit l'état de chaque
// zone de travaux, le créneau, les étapes de l'encart PHASAGE et ce que
// montre la légende. Chaque image a ses propres engins, flèches et états de
// zones ; « Nouvelle image » les recopie, il ne reste qu'à changer ce qui
// bouge. Horaires, nombre d'images et propriétés du synoptique (dont le
// bandeau de titre et cartouche) se modifient aussi — le tout avec Annuler /
// Rétablir. « Exporter… » produit le PowerPoint ou le PDF des images, sans
// rien modifier.

// L'image courante fait partie de l'historique : Annuler ramène sur l'image
// qu'on venait de modifier.
type Etat = { synoptique: Synoptique; index: number }

const estChampDeSaisie = (cible: EventTarget | null): boolean =>
  cible instanceof HTMLElement && (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName))

const dateLisible = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' ', ' à ')

// Une image du synoptique, mise en page comme une planche, dessinée dans un
// rectangle d'écran.
function ImageCadree(props: { synoptique: Synoptique; index: number; listes: ListesChantier; largeur: number; hauteur: number; marge: number }) {
  const { synoptique: s, index, largeur, hauteur, marge } = props
  const vue = ajusterSurRectangle(miseEnPage(s, index, props.listes).planche, { largeur, hauteur }, marge)
  return (
    <g transform={`translate(${vue.dx} ${vue.dy}) scale(${vue.zoom})`}>
      <DessinPlanche synoptique={s} index={index} listes={props.listes} zoom={vue.zoom} />
    </g>
  )
}

const VIGNETTE = { largeur: 168, hauteur: 104 }

function Vignettes(props: { synoptique: Synoptique; index: number; listes: ListesChantier; choisir: (i: number) => void }) {
  const { synoptique: s, index, choisir } = props
  const choisie = useRef<HTMLButtonElement>(null)
  // Corps en accolades : un effet ne doit rien renvoyer d'autre qu'une fonction
  // de nettoyage. Les Chrome / Edge récents font renvoyer une promesse à
  // scrollIntoView ; renvoyée par l'effet, React tentait de l'appeler au
  // changement d'image (« l is not a function », page blanche).
  useEffect(() => {
    choisie.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [index])
  return (
    <ol
      aria-label="Images du synoptique"
      style={{
        display: 'flex',
        gap: 10,
        listStyle: 'none',
        margin: 0,
        padding: '10px 14px',
        overflowX: 'auto',
        background: COULEURS.panneau,
        borderTop: `1px solid ${COULEURS.bordure}`,
        flexShrink: 0,
      }}
      data-testid="vignettes"
    >
      {s.images.map((image, i) => (
        <li key={image.id}>
          <button
            ref={i === index ? choisie : undefined}
            onClick={() => choisir(i)}
            aria-current={i === index}
            title={`Image ${i + 1} : ${formaterPlage(s.t0, image.debut, image.fin)}`}
            style={{
              display: 'block',
              padding: 4,
              font: 'inherit',
              background: '#ffffff',
              border: `2px solid ${i === index ? COULEURS.selection : COULEURS.bordure}`,
              borderRadius: 6,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <svg width={VIGNETTE.largeur} height={VIGNETTE.hauteur} style={{ display: 'block', background: COULEURS.autourDuPlan }}>
              <ImageCadree synoptique={s} index={i} listes={props.listes} {...VIGNETTE} marge={3} />
            </svg>
            <span style={{ display: 'block', fontSize: 12, marginTop: 3, color: i === index ? COULEURS.selection : COULEURS.texte }}>
              <strong>{i + 1}</strong> · {formaterPlage(s.t0, image.debut, image.fin)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

function Section({ titre, children }: { titre: ReactNode; children: ReactNode }) {
  return (
    <section style={{ borderBottom: `1px solid ${COULEURS.bordure}`, padding: '12px 14px' }}>
      <h2 style={styleTitreSection}>{titre}</h2>
      {children}
    </section>
  )
}

function FenetreCadrage(props: { synoptique: Synoptique; index: number; valider: (c: Rectangle | null) => void; fermer: () => void }) {
  const [cadrage, setCadrage] = useState(props.synoptique.cadrage)
  return (
    <Fenetre titre="Cadrage du synoptique" fermer={props.fermer} largeur={760}>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: COULEURS.discret }}>Le cadrage s'applique à toutes les images du synoptique.</p>
      <ChoixCadrage projet={projetDeImage(props.synoptique, props.synoptique.images[props.index])} cadrage={cadrage} changer={setCadrage} />
      <BoutonsFenetre>
        <button style={styleBouton()} onClick={props.fermer}>
          Annuler
        </button>
        <button style={styleBoutonPrincipal} onClick={() => props.valider(cadrage)}>
          Appliquer ce cadrage
        </button>
      </BoutonsFenetre>
    </Fenetre>
  )
}

const OUTILS_IMAGE: { outil: OutilImage; libelle: string; titre: string }[] = [
  { outil: 'selection', libelle: 'Sélection', titre: 'Choisir un engin, une rame, une flèche ou un commentaire (le glisser, le supprimer), ou une zone (changer son état)' },
  { outil: 'main', libelle: 'Main', titre: 'Déplacer la vue' },
  { outil: 'engin', libelle: 'Engin', titre: "Engin à l'échelle : sur une voie (il la suit) ou hors voie" },
  { outil: 'rame', libelle: 'Rame', titre: 'Train : véhicules bout à bout le long d’une voie' },
  { outil: 'fleche', libelle: 'Flèche', titre: 'Flèche : sens de travail, avancement du TTX, cheminement, chemin de roule…' },
  { outil: 'texte', libelle: 'Texte', titre: 'Commentaire posé sur l’image : « RCT en place », « Enraillement sur platelage »…' },
]

// Outils de l'image courante : Engin et Rame sont grisés tant que le
// synoptique n'a pas d'échelle, avec l'explication en infobulle.
function BarreOutilsImage({ editeur }: { editeur: EditeurImage }) {
  const sansEchelle = !editeur.synoptique.echelle
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        background: '#ffffff',
        borderBottom: `1px solid ${COULEURS.bordure}`,
      }}
      data-testid="outils-image"
    >
      <span style={{ fontSize: 13, color: COULEURS.discret, marginRight: 4 }}>
        Modifier l'image <strong style={{ color: COULEURS.texte }}>{editeur.index + 1}</strong> :
      </span>
      {OUTILS_IMAGE.map(({ outil, libelle, titre }) => {
        const bloque = sansEchelle && (outil === 'engin' || outil === 'rame')
        return (
          <button
            key={outil}
            style={{ ...styleBouton(editeur.outil === outil), ...(bloque ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
            title={bloque ? `${titre} — ${RAISON_SANS_ECHELLE}` : `${titre} — raccourci : ${TOUCHES_IMAGE[outil]}`}
            aria-pressed={editeur.outil === outil}
            aria-disabled={bloque}
            data-outil={outil}
            onClick={() => editeur.choisirOutil(outil)}
          >
            {libelle}
          </button>
        )
      })}
      <span style={{ width: 1, alignSelf: 'stretch', background: COULEURS.bordure, margin: '0 4px' }} />
      <button style={styleBouton()} onClick={() => editeur.setVue(null)} title="Voir toute l'image">
        Recadrer
      </button>
    </div>
  )
}

// Consigne en bas de l'image : ce qu'il faut faire avec l'outil en cours.
function consigne(editeur: EditeurImage): string {
  const fleches = ' · ← → : image précédente ou suivante'
  switch (editeur.outil) {
    case 'engin':
      return editeur.typeChoisi
        ? `Cliquez sur une voie pour y poser « ${editeur.typeChoisi.modele} » le long de la voie, ou loin des voies pour le poser libre · type à choisir dans le panneau`
        : "Catalogue d'engins vide : ajoutez des types dans la page du chantier"
    case 'rame':
      return editeur.composition.length > 0
        ? 'Cliquez sur une voie : la rame se pose centrée sur ce point, véhicules bout à bout · composition dans le panneau'
        : 'Composez la rame dans le panneau de droite, puis cliquez sur une voie'
    case 'fleche':
      return editeur.typeFleche
        ? `Flèche « ${editeur.typeFleche.nom} » : un clic par point · double-clic ou Entrée pour finir · Maj : horizontal, vertical, 45° · Suppr : retirer le dernier point · Échap : annuler`
        : 'Liste des flèches vide : ajoutez des types dans la page du chantier'
    case 'texte':
      return `Cliquez sur l'image pour y poser un commentaire (son coin haut gauche), puis tapez son texte dans le panneau${fleches}`
    case 'main':
      return `Glissez pour déplacer la vue · molette : zoom${fleches}`
    case 'selection':
      if (editeur.commentaire) {
        return `Commentaire choisi : glissez-le pour le déplacer, modifiez son texte dans le panneau · Suppr : le retirer de cette image · Échap : le libérer${fleches}`
      }
      if (editeur.fleche) {
        return `Flèche choisie : glissez un point rond pour le déplacer (Maj : horizontal, vertical, 45°), ou le trait pour déplacer toute la flèche · Suppr : la retirer de cette image · Échap : la libérer${fleches}`
      }
      return editeur.zone
        ? `Zone « ${editeur.zone.nom} » : choisissez son état dans le panneau, ou touches 1 à ${Math.min(9, editeur.etatsVoie.length)} · Échap : la libérer${fleches}`
        : `Cliquez un engin, une rame, une flèche ou un commentaire pour le choisir, puis glissez-le · cliquez une zone pour changer son état ou ses coupes · Suppr : retirer de cette image · molette : zoom${fleches}`
  }
}

export function EcranSynoptique(props: {
  chantier: Chantier
  synoptique: Synoptique
  imageInitiale: number
  modifierChantier: (transformer: (c: Chantier) => Chantier) => void
  etat: ReactNode
}) {
  const { chantier } = props
  const initial = props.synoptique
  const [historique, setHistorique] = useState(() =>
    creerHistorique<Etat>({ synoptique: initial, index: Math.min(initial.images.length, Math.max(1, props.imageInitiale)) - 1 }),
  )
  const [message, setMessage] = useState<Message | null>(null)
  const [fenetre, setFenetre] = useState<'cadrage' | 'echelle' | 'export' | 'cartouche' | null>(null)
  // Cartouche ouvert depuis la fenêtre d'export : on y revient ensuite.
  const [cartoucheDepuisExport, setCartoucheDepuisExport] = useState(false)
  // Réglages du dernier export, repris à la prochaine ouverture.
  const [optionsExport, setOptionsExport] = useState<OptionsExport>(OPTIONS_PAR_DEFAUT)
  const { synoptique: s } = historique.present
  const index = Math.min(historique.present.index, s.images.length - 1)
  const image = s.images[index]

  // Chaque nouvel état part au chantier (qui l'enregistre).
  const { modifierChantier } = props
  useEffect(() => {
    if (s !== initial) modifierChantier((c) => remplacerSynoptique(c, s))
  }, [s, initial, modifierChantier])

  // L'adresse suit l'image affichée (sans ajouter d'étape au bouton Précédent).
  useEffect(() => {
    const adresse = ecrireAdresse({ ecran: 'synoptique', chantierId: chantier.id, synoptiqueId: s.id, image: index + 1 })
    if (window.location.hash !== adresse) window.history.replaceState(null, '', adresse)
  }, [chantier.id, s.id, index])

  const modifier = (suivant: Synoptique, nouvelIndex = index, cle: string | null = null) =>
    setHistorique((h) => enregistrer(h, { synoptique: suivant, index: nouvelIndex }, cle))

  const editeur = useEditeurImage({
    synoptique: s,
    index,
    enregistrer: (suivant, cle = null) => modifier(suivant, index, cle),
    catalogue: chantier.catalogue,
    etatsVoie: chantier.etatsVoie,
    typesFleches: chantier.typesFleches,
    etatsExploitation: chantier.etatsExploitation,
    setMessage,
  })

  const calerEchelle = (echelle: Echelle) => {
    setFenetre(null)
    modifier(calerEchelleSynoptique(s, echelle))
    setMessage({
      genre: 'info',
      texte: `Échelle calée pour ce synoptique : ${descriptionEchelle(echelle, s.largeur)}. Les outils Engin et Rame sont disponibles. Le plan « ${s.origine.nomPlan} » ne change pas.`,
    })
  }

  const aller = (i: number) => {
    const borne = Math.min(s.images.length - 1, Math.max(0, i))
    setHistorique((h) => ({ ...h, present: { ...h.present, index: borne } }))
  }

  const ajouterImage = () => {
    const r = nouvelleImage(s, index)
    modifier(r.synoptique, r.index)
    setMessage(r.message ? { genre: 'info', texte: r.message } : null)
  }

  const retirerImage = () => {
    const r = supprimerImage(s, index)
    if (!r.ok) {
      setMessage({ genre: 'erreur', texte: r.erreur })
      return
    }
    modifier(r.valeur, Math.min(index, r.valeur.images.length - 1))
    setMessage({ genre: 'info', texte: `Image ${index + 1} supprimée. Annuler (Ctrl+Z) la rétablit.` })
  }

  const faireAnnuler = () => {
    setHistorique(annuler)
    setMessage(null)
  }
  const faireRetablir = () => {
    setHistorique(retablir)
    setMessage(null)
  }

  // Clavier : flèches pour feuilleter, Ctrl+Z / Ctrl+Y, outils de l'image,
  // Suppr, Échap, Espace pour déplacer la vue.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (fenetre || estChampDeSaisie(e.target)) return
      const ctrl = e.ctrlKey || e.metaKey
      const touche = e.key.toLowerCase()
      if (e.key === ' ') {
        e.preventDefault()
        editeur.setEspace(true)
      } else if (editeur.trace && e.key === 'Enter') {
        // Flèche en cours de tracé : Entrée la termine, Suppr retire le
        // dernier point, Échap l'abandonne.
        e.preventDefault()
        editeur.terminerFleche(0)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (editeur.trace) editeur.retirerDernierPoint()
        else editeur.supprimerSelection()
      } else if (e.key === 'Escape') {
        if (editeur.trace) editeur.annulerTrace()
        else editeur.toutDeselectionner()
      } else if (editeur.zone && !ctrl && !e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        editeur.choisirEtatNumero(Number(e.key))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        aller(index - 1)
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        aller(index + 1)
      } else if (ctrl && touche === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (editeur.trace) editeur.retirerDernierPoint()
        else faireAnnuler()
      } else if (ctrl && (touche === 'y' || (touche === 'z' && e.shiftKey))) {
        e.preventDefault()
        faireRetablir()
      } else if (!ctrl && !e.altKey) {
        const choisi = (Object.keys(TOUCHES_IMAGE) as OutilImage[]).find((o) => TOUCHES_IMAGE[o].toLowerCase() === touche)
        if (choisi) editeur.choisirOutil(choisi)
      }
    }
    const surRelache = (e: KeyboardEvent) => {
      if (e.key === ' ') editeur.setEspace(false)
    }
    const surPerteFocus = () => editeur.setEspace(false)
    window.addEventListener('keydown', surTouche)
    window.addEventListener('keyup', surRelache)
    window.addEventListener('blur', surPerteFocus)
    return () => {
      window.removeEventListener('keydown', surTouche)
      window.removeEventListener('keyup', surRelache)
      window.removeEventListener('blur', surPerteFocus)
    }
  })

  // Saisie d'un horaire : renvoie le message d'erreur, ou applique.
  const horaireImage = (bout: 'debut' | 'fin') => (texte: string) => {
    const minutes = minutesDepuisT0(s.t0, texte)
    if (minutes === null) return "Indiquez la date et l'heure complètes."
    const r = modifierHorairesImage(s, index, { [bout]: minutes })
    if (!r.ok) return r.erreur
    modifier(r.valeur, index, `${bout}:${image.id}`)
    return null
  }
  const horaireSynoptique = (bout: 'debut' | 'fin') => (texte: string) => {
    const r = bout === 'debut' ? modifierDebut(s, texte) : modifierFin(s, texte)
    if (!r.ok) return r.erreur
    modifier(r.valeur, index, `synoptique-${bout}`)
    return null
  }


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: POLICE, color: COULEURS.texte }}>
      <BarreNavigation
        chemin={[
          { libelle: 'Accueil', route: { ecran: 'accueil' } },
          { libelle: chantier.nom, route: { ecran: 'chantier', chantierId: chantier.id } },
          { libelle: s.nom || 'Synoptique sans nom' },
        ]}
        etat={props.etat}
      />
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          padding: '8px 14px',
          background: '#ffffff',
          borderBottom: `1px solid ${COULEURS.bordure}`,
        }}
      >
        <strong style={{ fontSize: 16 }} data-testid="nom-synoptique">
          {s.nom}
        </strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={styleBouton()} onClick={() => aller(index - 1)} disabled={index === 0} aria-label="Image précédente" title="Image précédente (←)">
            ◀
          </button>
          <span style={{ fontSize: 14, minWidth: 92, textAlign: 'center' }} data-testid="numero-image">
            Image <strong>{index + 1}</strong> / {s.images.length}
          </span>
          <button
            style={styleBouton()}
            onClick={() => aller(index + 1)}
            disabled={index === s.images.length - 1}
            aria-label="Image suivante"
            title="Image suivante (→)"
          >
            ▶
          </button>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: COULEURS.selection }} data-testid="horaires-image">
          {formaterPlage(s.t0, image.debut, image.fin)}
        </span>
        <span style={{ fontSize: 12, color: COULEURS.discret }}>({formaterDuree(image.fin - image.debut)})</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button style={styleBoutonPrincipal} onClick={ajouterImage} title="Copie de l'image affichée, insérée juste après">
            + Nouvelle image
          </button>
          <button style={styleBouton()} disabled={!peutAnnuler(historique)} onClick={faireAnnuler} title="Ctrl+Z">
            ↶ Annuler
          </button>
          <button style={styleBouton()} disabled={!peutRetablir(historique)} onClick={faireRetablir} title="Ctrl+Y">
            ↷ Rétablir
          </button>
          <button
            style={styleBouton()}
            onClick={() => setFenetre('export')}
            title="PowerPoint ou PDF des images de ce synoptique, avec page de garde"
          >
            Exporter…
          </button>
        </div>
      </header>
      <BarreOutilsImage editeur={editeur} />
      {!s.echelle && (
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
            <strong>Échelle non définie</strong> : ce synoptique vient d'un plan sans échelle. Calez-la ici pour poser des engins à la
            bonne taille (le plan « {s.origine.nomPlan} » ne change pas).
          </span>
          <button style={styleBoutonPrincipal} onClick={() => setFenetre('echelle')}>
            Caler l'échelle…
          </button>
        </div>
      )}
      <BandeauMessage message={message} fermer={() => setMessage(null)} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', userSelect: 'none' }}>
          {/* La consigne sous l'image, pas par-dessus : elle ne cache ni le plan ni l'encart PHASAGE. */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ImageDeTravail editeur={editeur} />
          </div>
          <p
            style={{
              margin: 0,
              padding: '5px 12px',
              fontSize: 12,
              background: '#ffffff',
              borderTop: `1px solid ${COULEURS.bordure}`,
              color: COULEURS.discret,
            }}
            data-testid="consigne"
          >
            {consigne(editeur)}
          </p>
        </main>
        <aside
          style={{ width: 380, flexShrink: 0, overflowY: 'auto', background: COULEURS.panneau, borderLeft: `1px solid ${COULEURS.bordure}` }}
          data-testid="panneau-synoptique"
        >
          <PanneauZone editeur={editeur} />
          <PanneauFleche editeur={editeur} />
          <PanneauCommentaire editeur={editeur} />
          {editeur.outil === 'engin' && <ChoixType editeur={editeur} />}
          {editeur.outil === 'rame' && <RameAPoser editeur={editeur} />}
          {editeur.outil === 'fleche' && <ChoixTypeFleche editeur={editeur} />}
          <Section titre={`Image ${index + 1} sur ${s.images.length}`}>
            <ChampInstant libelle="Début" valeur={instantDepuisT0(s.t0, image.debut)} changer={horaireImage('debut')} />
            <ChampInstant libelle="Fin" valeur={instantDepuisT0(s.t0, image.fin)} changer={horaireImage('fin')} />
            <p style={styleDiscret}>Durée : {formaterDuree(image.fin - image.debut)}</p>
            <button
              style={{ ...styleBoutonDanger, marginTop: 6 }}
              onClick={retirerImage}
              disabled={s.images.length <= 1}
              title={s.images.length <= 1 ? "C'est la seule image : elle ne peut pas être supprimée" : 'Annuler (Ctrl+Z) la rétablit'}
            >
              Supprimer cette image
            </button>
          </Section>
          <PanneauCreneau synoptique={s} index={index} modifier={(suivant, cle = null) => modifier(suivant, index, cle)} />
          <PanneauPhasage synoptique={s} index={index} modifier={(suivant, cle = null) => modifier(suivant, index, cle)} />
          <PanneauLegende synoptique={s} index={index} listes={editeur.listes} modifier={(suivant, cle = null) => modifier(suivant, index, cle)} />
          <CalqueEngins editeur={editeur} />
          <CalqueFleches editeur={editeur} />
          <CalqueCommentaires editeur={editeur} />
          <PanneauExploitation editeur={editeur} />
          <Section titre="Synoptique">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ width: 40, flexShrink: 0 }}>Nom</span>
              <input
                type="text"
                value={s.nom}
                aria-label="Nom du synoptique"
                style={{ ...styleChamp, flex: 1, fontWeight: 600 }}
                onChange={(e) => modifier({ ...s, nom: e.target.value }, index, 'nom')}
              />
            </label>
            <label style={{ display: 'block', fontSize: 13, margin: '8px 0' }}>
              Bandeau de titre <span style={{ color: COULEURS.discret, fontSize: 12 }}>(en haut de chaque image ; vide : pas de bandeau)</span>
              <textarea
                value={s.bandeau}
                rows={2}
                aria-label="Bandeau de titre"
                style={{ ...styleChamp, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, resize: 'vertical' }}
                onChange={(e) => modifier({ ...s, bandeau: e.target.value }, index, 'bandeau')}
              />
            </label>
            <ChampInstant libelle="Début" valeur={s.t0} changer={horaireSynoptique('debut')} />
            <ChampInstant libelle="Fin" valeur={instantDepuisT0(s.t0, s.fin)} changer={horaireSynoptique('fin')} />
            <p style={styleDiscret}>
              {formaterPlage(s.t0, 0, s.fin)} · {formaterDuree(s.fin)} · {texteImages(s.images.length)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}>
              <span style={{ flex: 1 }}>
                Cadrage :{' '}
                <strong>{s.cadrage ? 'une partie du plan' : 'tout le plan'}</strong>
              </span>
              <button style={styleBouton()} onClick={() => setFenetre('cadrage')}>
                Modifier…
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
              <span style={{ flex: 1 }}>
                Cartouche (page de garde) : <strong>{resumeCartouche(s.cartouche)}</strong>
              </span>
              <button
                style={styleBouton()}
                onClick={() => {
                  setCartoucheDepuisExport(false)
                  setFenetre('cartouche')
                }}
              >
                Remplir…
              </button>
            </div>
          </Section>
          <Section titre="Origine">
            <p style={{ ...styleDiscret, lineHeight: 1.5 }}>
              Copie figée du plan « {s.origine.nomPlan} » faite le {dateLisible(s.origine.copieLe)}. Modifier ce plan ne change pas ce
              synoptique.
            </p>
          </Section>
        </aside>
      </div>
      <Vignettes synoptique={s} index={index} listes={editeur.listes} choisir={aller} />
      {fenetre === 'cadrage' && (
        <FenetreCadrage
          synoptique={s}
          index={index}
          fermer={() => setFenetre(null)}
          valider={(cadrage) => {
            setFenetre(null)
            if (JSON.stringify(cadrage) !== JSON.stringify(s.cadrage)) {
              modifier({ ...s, cadrage })
              editeur.setVue(null)
            }
          }}
        />
      )}
      {fenetre === 'export' && (
        <FenetreExport
          chantier={chantier}
          synoptique={s}
          index={index}
          options={optionsExport}
          changerOptions={setOptionsExport}
          remplirCartouche={() => {
            setCartoucheDepuisExport(true)
            setFenetre('cartouche')
          }}
          fermer={() => setFenetre(null)}
        />
      )}
      {fenetre === 'cartouche' && (
        <FenetreCartouche
          cartouche={s.cartouche}
          fermer={() => setFenetre(cartoucheDepuisExport ? 'export' : null)}
          valider={(cartouche) => {
            if (JSON.stringify(cartouche) !== JSON.stringify(s.cartouche)) modifier(modifierCartouche(s, cartouche))
            setFenetre(cartoucheDepuisExport ? 'export' : null)
          }}
        />
      )}
      {fenetre === 'echelle' && (
        <FenetreEchelle
          titre="Caler l'échelle du synoptique"
          explication={`L'échelle vaut pour toutes les images de ce synoptique ; le plan « ${s.origine.nomPlan} » ne change pas.`}
          projet={projetDeImage(s, image)}
          valider={calerEchelle}
          fermer={() => setFenetre(null)}
        />
      )}
    </div>
  )
}
