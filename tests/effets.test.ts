import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

// Garde-fou contre la page blanche à « Nouvelle image » : un effet React qui
// renvoie autre chose que rien ou une fonction de nettoyage (ici la promesse
// que les Chrome / Edge récents font renvoyer à scrollIntoView) plante l'écran
// au changement d'image. Le défaut dépend du navigateur, pas de la logique : on
// vérifie donc que la règle de `npm run lint` refuse ces écritures.
const eslint = new ESLint()
const messages = async (code: string) => {
  const [resultat] = await eslint.lintText(`import { useEffect, useLayoutEffect, useInsertionEffect } from 'react'\n${code}\n`, {
    filePath: 'src/ui/EssaiEffet.tsx',
  })
  return resultat.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message)
}

describe('effets React : jamais de valeur renvoyée autre qu’un nettoyage', () => {
  it('refuse l’écriture qui a fait planter « Nouvelle image »', async () => {
    const code = `export function V({ el, index }: { el: { current: HTMLElement | null }; index: number }) {
  useEffect(() => el.current?.scrollIntoView({ block: 'nearest' }), [index])
  return null
}`
    const refus = await messages(code)
    expect(refus).toHaveLength(1)
    expect(refus[0]).toContain('corps-expression')
  })

  it('refuse les autres formes : corps-expression, async, return d’une valeur', async () => {
    const code = `export function V({ ok }: { ok: boolean }) {
  useLayoutEffect(() => requestAnimationFrame(() => {}), [])
  useInsertionEffect(() => ok && console.log(ok), [ok])
  useEffect(async () => {}, [])
  useEffect(() => {
    return setTimeout(() => {}, 10)
  }, [])
  useEffect(() => {
    if (ok) return 1
  }, [ok])
  return null
}`
    expect(await messages(code)).toHaveLength(5)
  })

  it('accepte les corps entre accolades et les fonctions de nettoyage', async () => {
    const code = `export function V({ el, ok }: { el: { current: HTMLElement | null }; ok: boolean }) {
  useEffect(() => {
    el.current?.scrollIntoView({ block: 'nearest' })
  }, [el])
  useEffect(() => {
    if (!ok) return
    const minuterie = setTimeout(() => {}, 10)
    return () => clearTimeout(minuterie)
  }, [ok])
  useLayoutEffect(() => {
    const image = requestAnimationFrame(() => {})
    return () => cancelAnimationFrame(image)
  }, [])
  return null
}`
    expect(await messages(code)).toEqual([])
  })
})
