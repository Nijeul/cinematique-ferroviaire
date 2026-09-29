import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ecrireAdresse, type Route } from '../plan/adresse.ts'
import { cleEcran, decrireErreur, detailTechnique, MESSAGE_ERREUR_ECRAN, retoursApresErreur, type Plantage } from '../plan/erreur.ts'
import { COULEURS } from './couleurs.ts'
import { POLICE, styleBouton, styleBoutonPrincipal } from './styles.ts'

// Barrière d'erreur autour des écrans : si un écran plante pendant son
// affichage, on montre un message en français, deux chemins de retour et le
// détail technique (replié) au lieu d'une page blanche. Elle se referme dès
// qu'on change d'écran.

type Etat = { plantage: Plantage | null; cle: string }

export class BarriereErreur extends Component<{ route: Route; children: ReactNode }, Etat> {
  state: Etat = { plantage: null, cle: cleEcran(this.props.route) }

  static getDerivedStateFromProps(props: { route: Route }, etat: Etat): Partial<Etat> | null {
    const cle = cleEcran(props.route)
    return cle === etat.cle ? null : { cle, plantage: null }
  }

  static getDerivedStateFromError(erreur: unknown): Partial<Etat> {
    return {
      plantage: {
        ...decrireErreur(erreur),
        pileComposants: null,
        adresse: window.location.hash,
        navigateur: navigator.userAgent,
        quand: new Date().toISOString(),
      },
    }
  }

  componentDidCatch(_erreur: unknown, info: ErrorInfo) {
    this.setState((e) => (e.plantage ? { plantage: { ...e.plantage, pileComposants: info.componentStack ?? null } } : null))
  }

  // Revenir quelque part ; si c'est l'écran déjà ouvert, on le réaffiche.
  private aller(route: Route) {
    window.location.hash = ecrireAdresse(route)
    this.setState({ plantage: null })
  }

  render() {
    const { plantage } = this.state
    if (!plantage) return this.props.children
    const retours = retoursApresErreur(this.props.route)
    return (
      <div style={{ minHeight: '100vh', fontFamily: POLICE, color: COULEURS.texte, background: COULEURS.panneau }} data-testid="barriere-erreur">
        <div style={{ padding: '9px 14px', background: COULEURS.texte, color: '#ffffff', fontSize: 14, fontWeight: 700 }}>Cinématique ferroviaire</div>
        <main role="alert" style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px' }}>
          <h1 style={{ fontSize: 19, margin: '0 0 10px', color: COULEURS.erreur }}>{MESSAGE_ERREUR_ECRAN}</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 18px' }}>
            Les modifications faites juste avant l'erreur peuvent manquer. Si l'erreur revient, transmettez le détail technique ci-dessous
            (sélectionnez-le, copiez-le et collez-le dans votre message).
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {retours.chantier && (
              <button style={styleBoutonPrincipal} onClick={() => this.aller(retours.chantier!)}>
                Revenir au chantier
              </button>
            )}
            <button style={retours.chantier ? styleBouton() : styleBoutonPrincipal} onClick={() => this.aller(retours.accueil)}>
              Revenir à l'accueil
            </button>
          </div>
          <details style={{ fontSize: 13 }} data-testid="detail-erreur">
            <summary style={{ cursor: 'pointer', color: COULEURS.discret }}>Détail technique (à transmettre)</summary>
            <pre
              style={{
                margin: '8px 0 0',
                padding: 10,
                maxHeight: 340,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
                background: '#ffffff',
                border: `1px solid ${COULEURS.bordure}`,
                borderRadius: 4,
                userSelect: 'text',
              }}
            >
              {detailTechnique(plantage)}
            </pre>
          </details>
        </main>
      </div>
    )
  }
}
