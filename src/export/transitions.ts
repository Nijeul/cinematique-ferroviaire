import JSZip from 'jszip'
import type { TransitionDiapositive } from '../plan/exportAnime.ts'

// Transitions du PowerPoint animé, écrites dans le XML après pptxgenjs (qui
// n'en écrit aucune) : la Morphose de PowerPoint (2019, 2021, Microsoft 365),
// avec un simple fondu pour les versions qui ne la connaissent pas, et le
// départ de chaque diapositive (au clic, après une pause, ou aussitôt pour
// les intermédiaires). Le fichier est ensuite allégé : une image répétée
// d'une diapositive à l'autre (le décor des intermédiaires, une caisse
// d'engin) n'y est gardée qu'une fois, et le tout est compressé. Sans
// navigateur : testé sous Node.

const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006'
const NS_P159 = 'http://schemas.microsoft.com/office/powerpoint/2015/09/main'
const NS_P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main'

function attributsDepart(t: TransitionDiapositive): string {
  switch (t.depart.genre) {
    case 'clic':
      return ''
    case 'auto':
      return ` advTm="${Math.max(0, Math.round(t.depart.apresMs))}"`
    case 'enchainer':
      return ' advClick="0" advTm="0"'
  }
}

// Le bloc XML de la transition d'une diapositive ; null s'il n'y a rien à
// écrire (pas de Morphose, départ au clic : le comportement par défaut).
export function xmlTransition(t: TransitionDiapositive): string | null {
  const depart = attributsDepart(t)
  if (t.morphoseMs === null) return depart === '' ? null : `<p:transition${depart}/>`
  const duree = Math.max(1, Math.round(t.morphoseMs))
  return (
    `<mc:AlternateContent xmlns:mc="${NS_MC}">` +
    `<mc:Choice xmlns:p159="${NS_P159}" xmlns:p14="${NS_P14}" Requires="p159">` +
    `<p:transition spd="slow" p14:dur="${duree}"${depart}><p159:morph option="byObject"/></p:transition>` +
    `</mc:Choice>` +
    `<mc:Fallback><p:transition spd="slow"${depart}><p:fade/></p:transition></mc:Fallback>` +
    `</mc:AlternateContent>`
  )
}

const FIN_COULEURS = '</p:clrMapOvr>'

// La transition se place juste après <p:clrMapOvr> (ordre imposé par le
// format : cSld, clrMapOvr, transition, timing).
export function insererTransition(xml: string, bloc: string): string {
  const i = xml.indexOf(FIN_COULEURS)
  if (i < 0) throw new Error('Diapositive PowerPoint inattendue : la transition ne trouve pas sa place (<p:clrMapOvr> absent).')
  if (xml.includes('<p:transition')) throw new Error('Diapositive PowerPoint inattendue : elle a déjà une transition.')
  const fin = i + FIN_COULEURS.length
  return xml.slice(0, fin) + bloc + xml.slice(fin)
}

// Empreinte d'un fichier (FNV-1a sur ses octets), pour repérer les doublons.
function empreinteOctets(o: Uint8Array): string {
  let h = 0x811c9dc5
  for (let i = 0; i < o.length; i++) {
    h ^= o[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${h.toString(16)}-${o.length}`
}

const memesOctets = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i])
const extension = (nom: string) => nom.slice(nom.lastIndexOf('.') + 1).toLowerCase()
const base = (nom: string) => nom.slice(nom.lastIndexOf('/') + 1)

// `transitions[i]` : celle de la diapositive i + 1 (null : aucune).
export async function reecrirePptx(octets: ArrayBuffer | Uint8Array, transitions: (TransitionDiapositive | null)[]): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(octets)

  for (const [i, t] of transitions.entries()) {
    const bloc = t && xmlTransition(t)
    if (!bloc) continue
    const chemin = `ppt/slides/slide${i + 1}.xml`
    const fichier = zip.file(chemin)
    if (!fichier) throw new Error(`Diapositive ${i + 1} introuvable dans le fichier PowerPoint.`)
    zip.file(chemin, insererTransition(await fichier.async('string'), bloc))
  }

  // Médias en double : un seul exemplaire, les liens des diapositives
  // repointés dessus.
  const gardes = new Map<string, { nom: string; octets: Uint8Array }[]>()
  const vers = new Map<string, string>()
  const medias = Object.keys(zip.files)
    .filter((n) => n.startsWith('ppt/media/') && !zip.files[n].dir)
    .sort()
  for (const nom of medias) {
    const o = await zip.file(nom)!.async('uint8array')
    const cle = `${extension(nom)}:${empreinteOctets(o)}`
    const candidats = gardes.get(cle) ?? []
    const pareil = candidats.find((c) => memesOctets(c.octets, o))
    if (pareil) {
      vers.set(base(nom), base(pareil.nom))
      zip.remove(nom)
    } else gardes.set(cle, [...candidats, { nom, octets: o }])
  }
  if (vers.size > 0) {
    for (const nom of Object.keys(zip.files).filter((n) => n.endsWith('.rels'))) {
      const xml = await zip.file(nom)!.async('string')
      const repointe = xml.replace(/Target="\.\.\/media\/([^"]+)"/g, (tout, fichier: string) =>
        vers.has(fichier) ? `Target="../media/${vers.get(fichier)}"` : tout,
      )
      if (repointe !== xml) zip.file(nom, repointe)
    }
    const types = zip.file('[Content_Types].xml')
    if (types) {
      const xml = await types.async('string')
      zip.file(
        '[Content_Types].xml',
        xml.replace(/<Override PartName="\/ppt\/media\/([^"]+)"[^>]*\/>/g, (tout, fichier: string) => (vers.has(fichier) ? '' : tout)),
      )
    }
  }
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
