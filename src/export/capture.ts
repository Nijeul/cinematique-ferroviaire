// Référence vers le canvas WebGL de la scène, alimentée par Scene à la
// création du contexte. Les exports (vidéo, planches) lisent cette image.
export const cibleCapture = {
  canvas: null as HTMLCanvasElement | null,
}
