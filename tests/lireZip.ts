import { inflateRawSync } from 'node:zlib'

// Lecture minimale d'une archive ZIP (un .pptx en est une), pour vérifier
// dans les tests ce qu'elle contient, sans dépendance de plus : le répertoire
// central donne chaque fichier, décompressé avec zlib.
export function lireZip(octets: ArrayBuffer): Map<string, Buffer> {
  const b = Buffer.from(octets)
  let fin = b.length - 22
  while (fin >= 0 && b.readUInt32LE(fin) !== 0x06054b50) fin--
  if (fin < 0) throw new Error('Archive ZIP illisible : fin de répertoire introuvable.')
  const nombre = b.readUInt16LE(fin + 10)
  let p = b.readUInt32LE(fin + 16)
  const fichiers = new Map<string, Buffer>()
  for (let i = 0; i < nombre; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('Archive ZIP illisible : répertoire central abîmé.')
    const methode = b.readUInt16LE(p + 10)
    const tailleCompressee = b.readUInt32LE(p + 20)
    const longueurNom = b.readUInt16LE(p + 28)
    const longueurExtra = b.readUInt16LE(p + 30)
    const longueurCommentaire = b.readUInt16LE(p + 32)
    const local = b.readUInt32LE(p + 42)
    const nom = b.toString('utf8', p + 46, p + 46 + longueurNom)
    const debut = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28)
    const donnees = b.subarray(debut, debut + tailleCompressee)
    fichiers.set(nom, methode === 8 ? inflateRawSync(donnees) : Buffer.from(donnees))
    p += 46 + longueurNom + longueurExtra + longueurCommentaire
  }
  return fichiers
}
