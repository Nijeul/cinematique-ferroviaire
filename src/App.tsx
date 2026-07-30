import { EditeurOperations } from './editor/EditeurOperations.tsx'
import { PanneauEdition } from './editor/PanneauEdition.tsx'
import { Scene } from './render/Scene.tsx'
import { CurseurTemps } from './ui/CurseurTemps.tsx'
import { EncartPhasage } from './ui/EncartPhasage.tsx'
import { PanneauOrthophoto } from './ui/PanneauOrthophoto.tsx'
import { PanneauProjet } from './ui/PanneauProjet.tsx'
import { SelecteurVues } from './ui/SelecteurVues.tsx'

export default function App() {
  return (
    <>
      <Scene />
      <PanneauProjet />
      <PanneauEdition
        ongletsSupplementaires={[{ titre: 'Opérations', contenu: <EditeurOperations /> }]}
      />
      <PanneauOrthophoto />
      <SelecteurVues />
      <EncartPhasage />
      <CurseurTemps />
    </>
  )
}
