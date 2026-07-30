// Calage d'une orthophoto par deux points d'ancrage pixel → monde.
// Deux points suffisent : échelle, rotation et origine s'en déduisent.
// L'axe pixel y descend (convention image), l'axe monde y est direct.

export type Ancrage = { pixel: [number, number]; monde: [number, number] }

export type TransformationImage = {
  echelle: number
  angle: number
  versMonde: (px: number, py: number) => [number, number]
}

export function transformationImage(ancrages: [Ancrage, Ancrage]): TransformationImage {
  const [a, b] = ancrages
  // Coordonnées pixel redressées (y vers le haut).
  const dqx = b.pixel[0] - a.pixel[0]
  const dqy = -(b.pixel[1] - a.pixel[1])
  const dmx = b.monde[0] - a.monde[0]
  const dmy = b.monde[1] - a.monde[1]
  const normePixel = Math.hypot(dqx, dqy)
  const normeMonde = Math.hypot(dmx, dmy)
  if (normePixel === 0 || normeMonde === 0) {
    throw new Error('les deux points d’ancrage doivent être distincts, en pixels et en mètres')
  }
  const echelle = normeMonde / normePixel
  const angle = Math.atan2(dmy, dmx) - Math.atan2(dqy, dqx)
  const cosinus = Math.cos(angle)
  const sinus = Math.sin(angle)

  const versMonde = (px: number, py: number): [number, number] => {
    const qx = (px - a.pixel[0]) * echelle
    const qy = -(py - a.pixel[1]) * echelle
    return [a.monde[0] + qx * cosinus - qy * sinus, a.monde[1] + qx * sinus + qy * cosinus]
  }

  return { echelle, angle, versMonde }
}

// Emplacement du rectangle image dans le monde : centre, rotation et
// dimensions en mètres, prêt à poser au sol.
export function cadreImage(
  ancrages: [Ancrage, Ancrage],
  largeurPx: number,
  hauteurPx: number,
): { centre: [number, number]; angle: number; largeur: number; hauteur: number } {
  const transformation = transformationImage(ancrages)
  return {
    centre: transformation.versMonde(largeurPx / 2, hauteurPx / 2),
    angle: transformation.angle,
    largeur: largeurPx * transformation.echelle,
    hauteur: hauteurPx * transformation.echelle,
  }
}
