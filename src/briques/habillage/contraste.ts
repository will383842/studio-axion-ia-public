/**
 * Rapport de contraste entre deux couleurs (WCAG 2.x). PUR, sans alias « @/ » : lu par le test de la charte et, au
 * besoin, par `studio-rendu`.
 */

/** `#RGB` ou `#RRGGBB` → [r, g, b] de 0 à 255. Lève une erreur sur toute autre forme. */
export function versRvb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Couleur illisible : « ${hex} » (attendu #RGB ou #RRGGBB).`);
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminance relative d'une couleur (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const [r, g, b] = versRvb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste entre deux couleurs, de 1 (identiques) à 21 (noir sur blanc). Symétrique. */
export function rapportContraste(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
