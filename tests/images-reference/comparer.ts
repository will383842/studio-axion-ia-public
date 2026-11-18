// N-10. Le rendu ne tourne pas dans la CI (aucune ligne de `.github/`) : la session qui déploie lance `npx tsx outils/images-reference/rendre-et-comparer.mts` avant toute mise en ligne d'une pièce neuve.
export interface ImageRgba {
  largeur: number;
  hauteur: number;
  rgba: Uint8Array;
}

export interface ResultatComparaison {
  identiques: boolean;
  partEcart: number;
  pixelsDifferents: number;
  message?: string;
}

/** Compare deux images RGBA brutes. Un pixel diffère si un canal s'écarte de plus de `seuilCanal` (défaut 16 sur 255). */
export function comparerImages(a: ImageRgba, b: ImageRgba, options: { seuilCanal?: number } = {}): ResultatComparaison {
  const seuilCanal = options.seuilCanal ?? 16;
  if (a.largeur !== b.largeur || a.hauteur !== b.hauteur) {
    return { identiques: false, partEcart: 1, pixelsDifferents: Math.max(a.largeur * a.hauteur, b.largeur * b.hauteur), message: "tailles différentes" };
  }
  const total = a.largeur * a.hauteur;
  if (a.rgba.length !== total * 4 || b.rgba.length !== total * 4) {
    return { identiques: false, partEcart: 1, pixelsDifferents: total, message: "données incohérentes avec la taille" };
  }
  let differents = 0;
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (
      Math.abs(a.rgba[i]! - b.rgba[i]!) > seuilCanal ||
      Math.abs(a.rgba[i + 1]! - b.rgba[i + 1]!) > seuilCanal ||
      Math.abs(a.rgba[i + 2]! - b.rgba[i + 2]!) > seuilCanal ||
      Math.abs(a.rgba[i + 3]! - b.rgba[i + 3]!) > seuilCanal
    ) differents++;
  }
  const partEcart = total === 0 ? 0 : differents / total;
  return { identiques: differents === 0, partEcart, pixelsDifferents: differents };
}
