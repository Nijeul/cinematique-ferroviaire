import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CHAMPS_CARTOUCHE, resumeCartouche, type Cartouche } from '../plan/cartouche.ts'
import type { Chantier } from '../plan/chantier.ts'
import { imagesChoisies, PAGES_PDF, type ChoixImages, type FormatPdf, type OptionsExport } from '../plan/export.ts'
import type { Synoptique } from '../plan/synoptique.ts'
import { BoutonsFenetre, Fenetre } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import type { Avancement } from './exporter.ts'
import { styleBouton, styleBoutonPrincipal, styleChamp, styleDiscret, styleTitreSection } from './styles.ts'

// La fenêtre « Exporter… » d'un synoptique : format (PowerPoint ou PDF),
// images (toutes, la courante, ou de n à m), page de garde et son cartouche,
// textes modifiables ou tout en image (PowerPoint), taille de page (PDF).
// Puis l'export, image après image, avec l'avancement et Annuler, et un
// message de fin ou d'erreur. Exporter ne modifie pas le chantier.
// Et la fenêtre du cartouche, qui se remplit dans les propriétés du
// synoptique.

type Phase =
  | { genre: 'reglages' }
  | { genre: 'en-cours'; avancement: Avancement }
  | { genre: 'fini'; texte: string }
  | { genre: 'annule' }
  | { genre: 'erreur'; texte: string }

const styleLigne = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '5px 0' } as const
const styleExplication = { ...styleDiscret, margin: '0 0 4px 24px' }
const styleLien = { font: 'inherit', fontSize: 13, padding: 0, border: 'none', background: 'none', color: COULEURS.selection, textDecoration: 'underline', cursor: 'pointer' }

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '0 0 14px' }}>
      <legend style={{ ...styleTitreSection, padding: 0 }}>{titre}</legend>
      {children}
    </fieldset>
  )
}

function Choix(props: { nom: string; coche: boolean; choisir: () => void; children: ReactNode }) {
  return (
    <label style={styleLigne}>
      <input type="radio" name={props.nom} checked={props.coche} onChange={props.choisir} />
      <span>{props.children}</span>
    </label>
  )
}

const texteImages = (n: number) => (n > 1 ? `${n} images` : '1 image')
const textePages = (format: OptionsExport['format'], n: number) =>
  `${n} ${format === 'pptx' ? (n > 1 ? 'diapositives' : 'diapositive') : n > 1 ? 'pages' : 'page'}`

export function FenetreExport(props: {
  chantier: Chantier
  synoptique: Synoptique
  index: number
  options: OptionsExport
  changerOptions: (o: OptionsExport) => void
  remplirCartouche: () => void
  fermer: () => void
}) {
  const { synoptique: s, options, changerOptions } = props
  const [phase, setPhase] = useState<Phase>({ genre: 'reglages' })
  const controleur = useRef<AbortController | null>(null)
  // Fenêtre fermée pendant un export : il s'arrête.
  useEffect(() => {
    const encours = controleur
    return () => {
      encours.current?.abort()
    }
  }, [])

  const n = s.images.length
  const choix = imagesChoisies(n, props.index, options.images)
  const changer = (o: Partial<OptionsExport>) => changerOptions({ ...options, ...o })
  const images = (c: ChoixImages) => changer({ images: c })
  const plage = options.images.genre === 'plage' ? options.images : { genre: 'plage' as const, de: 1, a: n }
  const nombre = (texte: string) => (texte.trim() === '' ? Number.NaN : Number(texte))
  const pages = choix.ok ? choix.valeur.length + (options.pageDeGarde ? 1 : 0) : 0

  const exporter = async () => {
    if (!choix.ok) return
    const c = new AbortController()
    controleur.current = c
    setPhase({ genre: 'en-cours', avancement: { fait: 0, total: 1, texte: 'Préparation…' } })
    try {
      // Le rendu et l'écriture des fichiers ne sont chargés qu'au premier export.
      const { exporterSynoptique } = await import('./exporter.ts')
      const r = await exporterSynoptique({
        chantier: props.chantier,
        synoptique: s,
        courante: props.index,
        options,
        signal: c.signal,
        avancer: (avancement) => {
          if (!c.signal.aborted) setPhase({ genre: 'en-cours', avancement })
        },
      })
      setPhase({
        genre: 'fini',
        texte: `« ${r.nomFichier} » est enregistré dans vos téléchargements (${textePages(options.format, r.pages)}).`,
      })
    } catch (e) {
      if (c.signal.aborted) setPhase({ genre: 'annule' })
      else setPhase({ genre: 'erreur', texte: e instanceof Error && e.message ? e.message : String(e) })
    } finally {
      controleur.current = null
    }
  }
  const annuler = () => controleur.current?.abort()
  const fermer = () => {
    annuler()
    props.fermer()
  }

  if (phase.genre !== 'reglages') {
    const enCours = phase.genre === 'en-cours'
    return (
      <Fenetre titre={`Exporter « ${s.nom} »`} fermer={fermer} largeur={520}>
        <div data-testid="export-etat" data-phase={phase.genre} style={{ fontSize: 14, lineHeight: 1.5 }}>
          {enCours && (
            <>
              <p style={{ margin: '0 0 8px' }} role="status">
                {phase.avancement.texte}
              </p>
              <progress
                value={phase.avancement.fait}
                max={phase.avancement.total}
                aria-label="Avancement de l'export"
                style={{ width: '100%', height: 14 }}
              />
              <p style={styleDiscret}>
                Les images sont rendues une à une ; le chantier n'est pas modifié. {phase.avancement.fait} / {phase.avancement.total}
              </p>
            </>
          )}
          {phase.genre === 'fini' && (
            <p role="status" style={{ margin: 0 }}>
              <strong>Export terminé.</strong> {phase.texte}
            </p>
          )}
          {phase.genre === 'annule' && (
            <p role="status" style={{ margin: 0 }}>
              Export annulé : aucun fichier n'a été enregistré.
            </p>
          )}
          {phase.genre === 'erreur' && (
            <p role="alert" style={{ margin: 0, color: COULEURS.erreur }}>
              <strong>L'export a échoué.</strong> {phase.texte}
            </p>
          )}
        </div>
        <BoutonsFenetre>
          {/* Des clés distinctes : le bouton « Annuler l'export » n'est jamais
              réutilisé pour « Autre export… » quand l'export se termine au
              moment du clic. */}
          {enCours ? (
            <button key="annuler" style={styleBouton()} onClick={annuler}>
              Annuler l'export
            </button>
          ) : (
            <>
              <button key="reglages" style={styleBouton()} onClick={() => setPhase({ genre: 'reglages' })}>
                {phase.genre === 'fini' ? 'Autre export…' : 'Revenir aux réglages'}
              </button>
              <button style={styleBoutonPrincipal} onClick={props.fermer} autoFocus>
                Fermer
              </button>
            </>
          )}
        </BoutonsFenetre>
      </Fenetre>
    )
  }

  return (
    <Fenetre titre={`Exporter « ${s.nom} »`} fermer={props.fermer} largeur={560}>
      <div data-testid="fenetre-export">
        <Groupe titre="Format">
          <Choix nom="format" coche={options.format === 'pptx'} choisir={() => changer({ format: 'pptx' })}>
            <strong>PowerPoint</strong> (.pptx) : une diapositive 16/9 par image
          </Choix>
          <Choix nom="format" coche={options.format === 'pdf'} choisir={() => changer({ format: 'pdf' })}>
            <strong>PDF</strong> : une page par image, à imprimer ou à transmettre
          </Choix>
        </Groupe>

        <Groupe titre="Images">
          <Choix nom="images" coche={options.images.genre === 'toutes'} choisir={() => images({ genre: 'toutes' })}>
            Toutes les images ({n})
          </Choix>
          <Choix nom="images" coche={options.images.genre === 'courante'} choisir={() => images({ genre: 'courante' })}>
            L'image affichée (image {props.index + 1})
          </Choix>
          <label style={styleLigne}>
            <input type="radio" name="images" checked={options.images.genre === 'plage'} onChange={() => images(plage)} />
            De l'image
            <input
              type="number"
              min={1}
              max={n}
              value={Number.isNaN(plage.de) ? '' : plage.de}
              aria-label="Première image"
              style={{ ...styleChamp, width: 56 }}
              onFocus={() => images(plage)}
              onChange={(e) => images({ ...plage, de: nombre(e.target.value) })}
            />
            à
            <input
              type="number"
              min={1}
              max={n}
              value={Number.isNaN(plage.a) ? '' : plage.a}
              aria-label="Dernière image"
              style={{ ...styleChamp, width: 56 }}
              onFocus={() => images(plage)}
              onChange={(e) => images({ ...plage, a: nombre(e.target.value) })}
            />
          </label>
          {!choix.ok && (
            <p role="alert" style={{ margin: '4px 0 0 24px', fontSize: 12, color: COULEURS.erreur }}>
              {choix.erreur}
            </p>
          )}
        </Groupe>

        <Groupe titre="Page de garde">
          <label style={styleLigne}>
            <input type="checkbox" checked={options.pageDeGarde} onChange={(e) => changer({ pageDeGarde: e.target.checked })} />
            <span>Ajouter une page de garde : nom du chantier et du synoptique, vignette, cartouche</span>
          </label>
          <p style={styleExplication}>
            Cartouche : <span data-testid="resume-cartouche">{resumeCartouche(s.cartouche)}</span> —{' '}
            <button style={styleLien} onClick={props.remplirCartouche}>
              remplir le cartouche…
            </button>
          </p>
        </Groupe>

        {options.format === 'pptx' ? (
          <Groupe titre="Textes des planches">
            <Choix nom="textes" coche={options.textes === 'modifiables'} choisir={() => changer({ textes: 'modifiables' })}>
              <strong>Textes modifiables</strong>
            </Choix>
            <p style={styleExplication}>
              Le bandeau de titre, le créneau horaire et l'encart PHASAGE sont des zones de texte PowerPoint, à retoucher comme
              aujourd'hui. Le reste de la planche (plan, engins, flèches, légende) est une image.
            </p>
            <Choix nom="textes" coche={options.textes === 'image'} choisir={() => changer({ textes: 'image' })}>
              <strong>Tout en image</strong>
            </Choix>
            <p style={styleExplication}>Copie fidèle de la planche entière, non modifiable.</p>
          </Groupe>
        ) : (
          <Groupe titre="Taille de page">
            {(Object.keys(PAGES_PDF) as FormatPdf[]).map((f) => (
              <Choix key={f} nom="page" coche={options.page === f} choisir={() => changer({ page: f })}>
                {PAGES_PDF[f].libelle}
                {f === '16/9' && ' (par défaut)'}
              </Choix>
            ))}
            <p style={styleExplication}>La planche est centrée et ajustée à la page, sans déformation, avec une petite marge.</p>
          </Groupe>
        )}
      </div>
      <p style={{ ...styleDiscret, margin: '4px 0 0' }} data-testid="resume-export">
        {choix.ok ? `${texteImages(choix.valeur.length)} → ${textePages(options.format, pages)}.` : ' '}
      </p>
      <BoutonsFenetre>
        <button style={styleBouton()} onClick={props.fermer}>
          Fermer
        </button>
        <button style={styleBoutonPrincipal} onClick={() => void exporter()} disabled={!choix.ok}>
          Exporter
        </button>
      </BoutonsFenetre>
    </Fenetre>
  )
}

// Le cartouche de la page de garde, rempli dans les propriétés du synoptique
// (valeurs à saisir librement ; la date aussi : « 25/08/2026 »).
export function FenetreCartouche(props: { cartouche: Cartouche; valider: (c: Cartouche) => void; fermer: () => void }) {
  const [c, setC] = useState(props.cartouche)
  return (
    <Fenetre titre="Cartouche de la page de garde" fermer={props.fermer} largeur={560}>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: COULEURS.discret }}>
        Ces informations apparaissent dans le tableau de la page de garde des exports PowerPoint et PDF de ce synoptique.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px', alignItems: 'center' }} data-testid="champs-cartouche">
        {CHAMPS_CARTOUCHE.map(({ champ, libelle }, i) => (
          <label key={champ} style={{ display: 'contents', fontSize: 13 }}>
            <span>{libelle}</span>
            {champ === 'modification' ? (
              <textarea
                value={c[champ]}
                rows={2}
                aria-label={libelle}
                style={{ ...styleChamp, resize: 'vertical' }}
                onChange={(e) => setC({ ...c, [champ]: e.target.value })}
              />
            ) : (
              <input
                type="text"
                value={c[champ]}
                aria-label={libelle}
                autoFocus={i === 0}
                placeholder={champ === 'date' ? 'jj/mm/aaaa' : undefined}
                style={styleChamp}
                onChange={(e) => setC({ ...c, [champ]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      <BoutonsFenetre>
        <button style={styleBouton()} onClick={props.fermer}>
          Annuler
        </button>
        <button style={styleBoutonPrincipal} onClick={() => props.valider(c)}>
          Enregistrer le cartouche
        </button>
      </BoutonsFenetre>
    </Fenetre>
  )
}
