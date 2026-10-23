/** Éléments de décor communs aux scènes : plan de fond, motifs discrets, ombres portées, étincelles. Aucun texte. */
import { FIN, MICRO } from "./Cadre";
import type { PaletteDessin } from "./palette";

/** Plan du fond : un grand disque pâle semé d'un motif de points crème (calculé, sans motif SVG ni `url()`). */
export function FondDisque({ p, cx = 100, cy = 100, r = 84, pas = 12 }: { p: PaletteDessin; cx?: number; cy?: number; r?: number; pas?: number }) {
  const points: Array<[number, number]> = [];
  for (let x = cx - r; x <= cx + r; x += pas) {
    for (let y = cy - r; y <= cy + r; y += pas) if (Math.hypot(x - cx, y - cy) < r - 8) points.push([x, y]);
  }
  return (
    <g stroke="none">
      <circle cx={cx} cy={cy} r={r} fill={p.pale} />
      {points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill={p.creme} />)}
    </g>
  );
}

/** Plan du fond : une arche pâle (fenêtre, mur) avec un quadrillage léger crème. */
export function FondArche({ p, x = 22, y = 18, l = 156, h = 150, pas = 16 }: { p: PaletteDessin; x?: number; y?: number; l?: number; h?: number; pas?: number }) {
  const r = l / 2;
  const lignes: string[] = [];
  for (let k = x + pas; k < x + l; k += pas) lignes.push(`M${k} ${y + h}V${y + r - Math.sqrt(Math.max(0, r * r - (k - x - r) ** 2)) + 6}`);
  for (let k = y + h - pas; k > y + 6; k -= pas) {
    const dy = Math.max(0, y + r - k);
    const demi = Math.sqrt(Math.max(0, r * r - dy * dy)) - 6;
    if (demi > 0) lignes.push(`M${x + r - demi} ${k}H${x + r + demi}`);
  }
  return (
    <g>
      <path d={`M${x} ${y + h}V${y + r}A${r} ${r} 0 0 1 ${x + l} ${y + r}V${y + h}Z`} fill={p.pale} stroke="none" />
      <path d={lignes.join("")} stroke={p.creme} strokeWidth={MICRO} />
    </g>
  );
}

/** Ombre portée à plat sur le sol (ellipse pâle ou encre). */
export function Ombre({ cx, cy, rx, ry = 7, couleur }: { cx: number; cy: number; rx: number; ry?: number; couleur: string }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={couleur} stroke="none" />;
}

/** Étincelle à quatre branches, pleine. */
export function Etincelle({ x, y, r, couleur }: { x: number; y: number; r: number; couleur: string }) {
  const c = r * 0.18;
  return <path d={`M${x} ${y - r}C${x + c} ${y - c} ${x + c} ${y - c} ${x + r} ${y}C${x + c} ${y + c} ${x + c} ${y + c} ${x} ${y + r}C${x - c} ${y + c} ${x - c} ${y + c} ${x - r} ${y}C${x - c} ${y - c} ${x - c} ${y - c} ${x} ${y - r}Z`} fill={couleur} stroke="none" />;
}

/** Traits de mouvement (vitesse), en encre fine. */
export function Vitesse({ d }: { d: string }) {
  return <path d={d} strokeWidth={FIN} />;
}
