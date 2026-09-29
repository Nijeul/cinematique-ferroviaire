import { useEffect, useRef, useState } from 'react'
import { nouveauPlan } from '../plan/chantier.ts'
import { remplacerFond } from '../plan/edition.ts'
import { bornerPage } from '../plan/fond.ts'
import { creerProjet, type Echelle, type Fond, type Projet } from '../plan/projet.ts'
import { CalageEchelle } from './CalageEchelle.tsx'
import { BoutonsFenetre, Fenetre } from './commun.tsx'
import { COULEURS } from './couleurs.ts'
import { fermerPdf, ouvrirFond, rendrePage, type PdfOuvert } from './fondDePlan.ts'
import { styleBouton, styleBoutonPrincipal, styleChamp, styleDiscret } from './styles.ts'

// Assistant « Nouveau plan », en trois étapes courtes : le nom, le fond
// (image ou PDF, facultatif), puis l'échelle, obligatoire. Le plan n'est créé
// qu'à la fin : il a toujours une échelle, et les engins qu'on y pose sont à
// la bonne taille.

type Etape = 1 | 2 | 3

const TITRES: Record<Etape, string> = { 1: 'Nom du plan', 2: 'Fond de plan', 3: 'Échelle du plan' }

export function AssistantNouveauPlan(props: { nomPropose: string; creer: (projet: Projet) => void; fermer: () => void }) {
  const [etape, setEtape] = useState<Etape>(1)
  const [nom, setNom] = useState(props.nomPropose)
  const [fond, setFond] = useState<Fond | null>(null)
  const [pdf, setPdf] = useState<PdfOuvert | null>(null)
  const [occupe, setOccupe] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [echelle, setEchelle] = useState<Echelle | null>(null)
  const choixFond = useRef<HTMLInputElement>(null)

  // Le PDF ouvert est libéré en quittant l'assistant.
  const pdfOuvert = useRef<PdfOuvert | null>(null)
  useEffect(() => {
    pdfOuvert.current = pdf
  }, [pdf])
  useEffect(() => {
    return () => fermerPdf(pdfOuvert.current)
  }, [])

  const importer = async (fichier: File) => {
    setOccupe('Lecture du fond de plan…')
    setErreur(null)
    try {
      const lu = await ouvrirFond(fichier)
      fermerPdf(pdf)
      setPdf(lu.pdf)
      setFond(lu.fond)
    } catch (e) {
      setErreur(`Impossible de lire « ${fichier.name} » : ${(e as Error).message}`)
    } finally {
      setOccupe(null)
    }
  }

  const changerPage = async (page: number) => {
    if (!pdf) return
    setOccupe(`Rendu de la page ${page}…`)
    try {
      setFond(await rendrePage(pdf, bornerPage(page, pdf.nombrePages)))
    } catch (e) {
      setErreur(`Impossible d'afficher la page ${page} : ${(e as Error).message}`)
    } finally {
      setOccupe(null)
    }
  }

  // Le plan tel qu'il sera, pour caler l'échelle dessus.
  const apercu: Projet = fond ? remplacerFond(creerProjet(nom), fond) : creerProjet(nom)

  const suivant = () => setEtape((e) => (e < 3 ? ((e + 1) as Etape) : e))
  const precedent = () => {
    setEchelle(null)
    setEtape((e) => (e > 1 ? ((e - 1) as Etape) : e))
  }

  return (
    <Fenetre titre={`Nouveau plan — étape ${etape} sur 3 : ${TITRES[etape]}`} fermer={props.fermer} largeur={etape === 3 ? 900 : 560}>
      {etape === 1 && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: COULEURS.discret }}>
            Un plan par phase : définitive, provisoire, transitoire…
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 40 }}>Nom</span>
            <input
              type="text"
              value={nom}
              aria-label="Nom du plan"
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nom.trim() !== '') suivant()
              }}
              style={{ ...styleChamp, flex: 1, fontWeight: 600 }}
            />
          </label>
        </>
      )}

      {etape === 2 && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5 }}>
            Importez votre plan (image PNG ou JPG, ou PDF) : vous tracerez les voies par-dessus. Sans fond, vous tracerez sur une
            feuille blanche.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button style={styleBouton()} onClick={() => choixFond.current?.click()} disabled={occupe !== null}>
              {fond ? 'Choisir un autre fond…' : 'Importer un fond…'}
            </button>
            <input
              ref={choixFond}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              hidden
              data-testid="assistant-choix-fond"
              onChange={(e) => {
                const fichier = e.target.files?.[0]
                e.target.value = ''
                if (fichier) void importer(fichier)
              }}
            />
            {fond && (
              <span style={{ fontSize: 13 }} data-testid="assistant-fond">
                <strong>{fond.nomFichier}</strong> · {fond.largeur} × {fond.hauteur} pixels
              </span>
            )}
          </div>
          {pdf && fond?.page && pdf.nombrePages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13 }}>
              <span>Page</span>
              <button style={styleBouton()} disabled={fond.page <= 1 || occupe !== null} onClick={() => void changerPage(fond.page! - 1)}>
                ◀
              </button>
              <strong>
                {fond.page} / {pdf.nombrePages}
              </strong>
              <button
                style={styleBouton()}
                disabled={fond.page >= pdf.nombrePages || occupe !== null}
                onClick={() => void changerPage(fond.page! + 1)}
              >
                ▶
              </button>
            </div>
          )}
          {fond && (
            <img
              src={fond.image}
              alt="Aperçu du fond"
              style={{ display: 'block', marginTop: 10, maxWidth: '100%', maxHeight: 220, border: `1px solid ${COULEURS.bordure}` }}
            />
          )}
          {occupe && <p style={styleDiscret}>{occupe}</p>}
        </>
      )}

      {etape === 3 && (
        <>
          <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.5 }}>
            L'échelle est <strong>obligatoire</strong> : c'est elle qui met les engins à la bonne taille (une R39 fait 19,9 m sur le
            plan). {fond ? 'Cliquez deux repères dont vous connaissez l’écart réel, puis tapez cet écart.' : 'Sans fond, indiquez la longueur réelle que représente la largeur de la feuille.'}
          </p>
          <CalageEchelle projet={apercu} changer={setEchelle} />
        </>
      )}

      {erreur && (
        <p role="alert" style={{ ...styleDiscret, color: COULEURS.erreur }}>
          {erreur}
        </p>
      )}
      <BoutonsFenetre>
        <button style={styleBouton()} onClick={props.fermer}>
          Annuler
        </button>
        {etape > 1 && (
          <button style={styleBouton()} onClick={precedent}>
            ◀ Précédent
          </button>
        )}
        {etape < 3 ? (
          <button style={styleBoutonPrincipal} onClick={suivant} disabled={nom.trim() === '' || occupe !== null}>
            {etape === 2 && !fond ? 'Continuer sans fond ▶' : 'Suivant ▶'}
          </button>
        ) : (
          <button
            style={{ ...styleBoutonPrincipal, opacity: echelle ? 1 : 0.5 }}
            disabled={!echelle}
            title={echelle ? undefined : "Calez d'abord l'échelle"}
            onClick={() => echelle && props.creer(nouveauPlan(nom, fond, echelle))}
          >
            Créer le plan
          </button>
        )}
      </BoutonsFenetre>
    </Fenetre>
  )
}
