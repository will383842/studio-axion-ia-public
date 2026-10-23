/**
 * Matière (lot APP-MAT, axe 9) : géométrie du trait fait main (MAT-C) et lecture de la matière d'une scène (PUR, sans
 * React). Tremblé DÉTERMINISTE (même dessin à chaque image et à chaque rendu : graine tirée de l'identifiant), repris
 * de la maquette validée `prototypes/d1-ouvertures-fins/matiere.tsx`.
 */
import type { CodesParAxe } from "../../../../../src/briques/schema-motion/variete";
import type { VarieteScene } from "../ContexteVariete";

export type CodeMatiere = Exclude<CodesParAxe["matiere"], "MAT-A">;

/** La matière de la scène (`null` : référence MAT-A, net et plat). */
export function matiereDe(v: VarieteScene | null): CodeMatiere | null {
  if (!v) return null;
  const d = v.donnees.matiere as { code?: string } | undefined;
  const code = (d?.code ?? v.recette.matiere) as CodesParAxe["matiere"];
  return code === "MAT-B" || code === "MAT-C" || code === "MAT-D" ? code : null;
}

/** Suite pseudo-aléatoire déterministe dans [-1, 1] (générateur de Park-Miller). */
export function alea(graine: number) {
  let s = Math.max(1, Math.floor(graine)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
}

/** Contour « au feutre » d'un rectangle : chaque côté dépasse un peu aux coins, léger tremblé. */
export function rectMain(x: number, y: number, l: number, h: number, graine: number, amp = 3, depasse = 14): string {
  const r = alea(graine);
  const cote = (x0: number, y0: number, x1: number, y1: number) => {
    const long = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(long / 70));
    const dx = (x1 - x0) / long;
    const dy = (y1 - y0) / long;
    const ax = x0 - dx * depasse * Math.abs(r());
    const ay = y0 - dy * depasse * Math.abs(r());
    const bx = x1 + dx * depasse * Math.abs(r());
    const by = y1 + dy * depasse * Math.abs(r());
    let d = `M${(ax + r() * amp).toFixed(1)} ${(ay + r() * amp).toFixed(1)}`;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      d += ` L${(ax + (bx - ax) * t - dy * r() * amp).toFixed(1)} ${(ay + (by - ay) * t + dx * r() * amp).toFixed(1)}`;
    }
    return d;
  };
  return [cote(x, y, x + l, y), cote(x + l, y, x + l, y + h), cote(x + l, y + h, x, y + h), cote(x, y + h, x, y)].join(" ");
}

/** Hachures obliques (ombre « au feutre ») couvrant un rectangle : segments parallèles, pas de 18 px. */
export function hachures(x: number, y: number, l: number, h: number, pas = 18): [number, number, number, number][] {
  const n = Math.ceil((l + h) / pas) + 1;
  return Array.from({ length: n }, (_, i) => [x - h + i * pas, y + h, x - h + i * pas + h, y] as [number, number, number, number]);
}
