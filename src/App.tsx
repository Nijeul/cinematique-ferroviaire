import { chargerSite } from './plan/site.ts'
import { Planche } from './ui/Planche.tsx'
import contenuSiteExemple from '../fixtures/site-exemple.json?raw'

// Étape 1 du PLAN.md : une seule planche, le fond de plan du site d'exemple.
// La navigation image par image arrive à l'étape 2, après validation.

const resultat = chargerSite(contenuSiteExemple)

export default function App() {
  return (
    <main style={{ maxWidth: 1500, margin: '0 auto', padding: '16px 20px 40px' }}>
      <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#5a646e' }}>
        Version 2 — étape 1 sur 7 : fond de plan 2D à valider (données d'exemple fictives).
        Voir <strong>PLAN.md</strong> pour la suite.
      </p>
      {resultat.ok ? (
        <div style={{ border: '1px solid #c8cfd6', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
          <Planche site={resultat.site} />
        </div>
      ) : (
        <div style={{ fontFamily: 'system-ui, sans-serif', color: '#a4282d' }}>
          <strong>Site d'exemple invalide :</strong>
          <ul>
            {resultat.erreurs.map((erreur) => (
              <li key={erreur}>{erreur}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
