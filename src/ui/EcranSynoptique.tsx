import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ecrireAdresse } from '../plan/adresse.ts'
import { remplacerSynoptique, texteImages, type Chantier } from '../plan/chantier.ts'
import type { Rectangle } from '../plan/elements.ts'
import { annuler, creerHistorique, enregistrer, peutAnnuler, peutRetablir, retablir } from '../plan/historique.ts'
import {
  avertissementsImages,
  modifierDebut,
  modifierFin,
  modifierHorairesImage,
  nouvelleImage,
  projetDeImage,
  rectangleAffiche,
  supprimerImage,
  type Synoptique,
} from '../plan/synoptique.ts'
import { formaterDuree, formaterPlage, instantDepuisT0, minutesDepuisT0 } from '../plan/temps.ts'
import { ajusterSurRectangle } from '../plan/vue.ts'
import { ChoixCadrage } from './ChoixCadrage.tsx'
import { BandeauMessage, BarreNavigation, BoutonsFenetre, ChampInstant, Fenetre } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import { DessinPlan } from './DessinPlan.tsx'
import { POLICE, styleAvertissement, styleBouton, styleBoutonDanger, styleBoutonPrincipal, styleChamp, styleDiscret, styleTitreSection } from './styles.ts'
import type { Message } from './useEditeur.ts'

// Écran d'un synoptique : on feuillette ses images comme un PowerPoint. Chaque
// image montre le plan figé, limité au cadrage. À cette étape, le contenu des
// images ne se modifie pas ; seuls leurs horaires, leur nombre et les
// propriétés du synoptique changent — avec Annuler / Rétablir.

// L'image courante fait partie de l'historique : Annuler ramène sur l'image
// qu'on venait de modifier.
type Etat = { synoptique: Synoptique; index: number }

const estChampDeSaisie = (cible: EventTarget | null): boolean =>
  cible instanceof HTMLElement && (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName))

const dateLisible = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' ', ' à ')

// Une image du synoptique dessinée dans un rectangle d'écran : vue ajustée au
// cadrage, et rien en dehors.
function ImageCadree(props: { synoptique: Synoptique; index: number; largeur: number; hauteur: number; marge: number }) {
  const { synoptique: s, index, largeur, hauteur, marge } = props
  const idClip = useId()
  const cadre = rectangleAffiche(s)
  const vue = ajusterSurRectangle(cadre, { largeur, hauteur }, marge)
  const image = s.images[index]
  return (
    <g transform={`translate(${vue.dx} ${vue.dy}) scale(${vue.zoom})`}>
      <clipPath id={idClip}>
        <rect x={cadre.x} y={cadre.y} width={cadre.largeur} height={cadre.hauteur} />
      </clipPath>
      <g clipPath={`url(#${idClip})`}>
        <rect x={cadre.x} y={cadre.y} width={cadre.largeur} height={cadre.hauteur} fill="#ffffff" />
        <DessinPlan projet={projetDeImage(s, image)} zoom={vue.zoom} affiche={cadre} />
      </g>
      <rect
        x={cadre.x}
        y={cadre.y}
        width={cadre.largeur}
        height={cadre.hauteur}
        fill="none"
        stroke={COULEURS.bordFeuille}
        strokeWidth={1 / vue.zoom}
      />
    </g>
  )
}

function VueImage({ synoptique, index }: { synoptique: Synoptique; index: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [taille, setTaille] = useState({ largeur: 0, hauteur: 0 })
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observateur = new ResizeObserver(([entree]) => setTaille({ largeur: entree.contentRect.width, hauteur: entree.contentRect.height }))
    observateur.observe(svg)
    return () => observateur.disconnect()
  }, [])
  return (
    <svg ref={svgRef} style={{ display: 'block', width: '100%', height: '100%' }} data-testid="image-synoptique">
      <rect width="100%" height="100%" fill={COULEURS.autourDuPlan} />
      {taille.largeur > 0 && <ImageCadree synoptique={synoptique} index={index} largeur={taille.largeur} hauteur={taille.hauteur} marge={24} />}
    </svg>
  )
}

const VIGNETTE = { largeur: 168, hauteur: 94 }

function Vignettes(props: { synoptique: Synoptique; index: number; choisir: (i: number) => void }) {
  const { synoptique: s, index, choisir } = props
  const choisie = useRef<HTMLButtonElement>(null)
  useEffect(() => choisie.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), [index])
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
              <ImageCadree synoptique={s} index={i} {...VIGNETTE} marge={3} />
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
  const [fenetreCadrage, setFenetreCadrage] = useState(false)
  const { synoptique: s } = historique.present
  const index = Math.min(historique.present.index, s.images.length - 1)
  const image = s.images[index]
  const avertissements = avertissementsImages(s)

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

  // Clavier : flèches pour feuilleter, Ctrl+Z / Ctrl+Y.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (fenetreCadrage || estChampDeSaisie(e.target)) return
      const ctrl = e.ctrlKey || e.metaKey
      const touche = e.key.toLowerCase()
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        aller(index - 1)
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        aller(index + 1)
      } else if (ctrl && touche === 'z' && !e.shiftKey) {
        e.preventDefault()
        faireAnnuler()
      } else if (ctrl && (touche === 'y' || (touche === 'z' && e.shiftKey))) {
        e.preventDefault()
        faireRetablir()
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
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
        </div>
      </header>
      <BandeauMessage message={message} fermer={() => setMessage(null)} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <main style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>
          <VueImage synoptique={s} index={index} />
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
            }}
          >
            ← → : image précédente ou suivante · les images reprennent le plan « {s.origine.nomPlan} » tel qu'il était le{' '}
            {dateLisible(s.origine.copieLe)}
          </p>
        </main>
        <aside
          style={{ width: 380, flexShrink: 0, overflowY: 'auto', background: COULEURS.panneau, borderLeft: `1px solid ${COULEURS.bordure}` }}
          data-testid="panneau-synoptique"
        >
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
            {avertissements.length > 0 && (
              <div style={{ marginTop: 10 }} data-testid="avertissements">
                {avertissements.map((a) => (
                  <p key={a} style={styleAvertissement}>
                    {a}
                  </p>
                ))}
              </div>
            )}
          </Section>
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
              <button style={styleBouton()} onClick={() => setFenetreCadrage(true)}>
                Modifier…
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
      <Vignettes synoptique={s} index={index} choisir={aller} />
      {fenetreCadrage && (
        <FenetreCadrage
          synoptique={s}
          index={index}
          fermer={() => setFenetreCadrage(false)}
          valider={(cadrage) => {
            setFenetreCadrage(false)
            if (JSON.stringify(cadrage) !== JSON.stringify(s.cadrage)) modifier({ ...s, cadrage })
          }}
        />
      )}
    </div>
  )
}
