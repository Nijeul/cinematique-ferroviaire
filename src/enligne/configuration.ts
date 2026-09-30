// Adresse du projet Supabase et clé publique, données au site par les
// variables d'environnement de Vercel (VITE_SUPABASE_URL et
// VITE_SUPABASE_PUBLISHABLE_KEY). Seule une clé PUBLIQUE a sa place dans le
// navigateur : une clé secrète (« sb_secret_… » ou jeton « service_role »)
// donnerait tous les droits à n'importe quel visiteur. Elle est refusée.

export type Configuration = { url: string; cle: string }

export type LectureConfiguration = { ok: true; configuration: Configuration } | { ok: false; raison: 'absente' | 'invalide' | 'cleSecrete' }

function roleDuJeton(cle: string): string | null {
  const morceaux = cle.split('.')
  if (morceaux.length !== 3) return null
  try {
    const charge = JSON.parse(atob(morceaux[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown }
    return typeof charge.role === 'string' ? charge.role : null
  } catch {
    return null
  }
}

export function lireConfiguration(env: Record<string, unknown>): LectureConfiguration {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : ''
  const cle = typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string' ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : ''
  if (url === '' && cle === '') return { ok: false, raison: 'absente' }
  if (!/^https:\/\/[^\s/]+$/.test(url.replace(/\/+$/, '')) || cle === '') return { ok: false, raison: 'invalide' }
  if (cle.startsWith('sb_secret_') || roleDuJeton(cle) === 'service_role') return { ok: false, raison: 'cleSecrete' }
  return { ok: true, configuration: { url: url.replace(/\/+$/, ''), cle } }
}

export function messageConfiguration(raison: 'absente' | 'invalide' | 'cleSecrete'): string | null {
  switch (raison) {
    case 'absente':
      return null
    case 'invalide':
      return "La mémoire en ligne est mal configurée (adresse ou clé Supabase illisible) : les chantiers sont gardés dans ce navigateur seulement. Le responsable du site doit vérifier VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans Vercel."
    case 'cleSecrete':
      return "La clé Supabase donnée au site est une clé SECRÈTE : elle est refusée, car elle donnerait tous les droits à n'importe quel visiteur. Le responsable du site doit mettre la clé publique (« sb_publishable_… ») dans VITE_SUPABASE_PUBLISHABLE_KEY sur Vercel, et régénérer la clé secrète dans Supabase."
  }
}
