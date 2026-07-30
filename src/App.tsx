import { Scene } from './render/Scene.tsx'
import { CurseurTemps } from './ui/CurseurTemps.tsx'
import { PanneauOrthophoto } from './ui/PanneauOrthophoto.tsx'
import { PanneauProjet } from './ui/PanneauProjet.tsx'

export default function App() {
  return (
    <>
      <Scene />
      <PanneauProjet />
      <PanneauOrthophoto />
      <CurseurTemps />
    </>
  )
}
