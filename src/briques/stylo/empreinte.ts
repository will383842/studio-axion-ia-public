/**
 * EMPREINTE DU STYLO : le quadrilatère que couvre l'image d'un stylo posé (pointe en `pointe`, incliné de `angle` degrés
 * dans le sens horaire autour d'elle, comme `Stylo.tsx`). Sert à vérifier, sur des boîtes, que le stylo ne cache rien
 * et qu'il reste dans l'image. PUR, déterministe, sans alias « @/ ».
 *
 * Convention d'angle : l'image est droite, pointe en bas ; à 0° le corps monte au-dessus de la pointe, à 90° il part à
 * droite, à 180° il descend. Un corps qui part « vers le bas à droite » a un angle entre 90° et 180°.
 */
import type { Cible, Point, Stylo } from "./types";

/**
 * Contour (sens horaire, convexe) de la partie peinte du stylo posé : corps, puis cône jusqu'à la pointe. Avec
 * `sansPointe`, le corps seul (sans le cône taillé, qui touche la page là où le stylo écrit ou marque).
 */
export function empreinteStylo(s: Pick<Stylo, "largeur" | "hauteur" | "pointe" | "emprise">, pointe: Point, hauteur: number, angle: number, sansPointe = false): Point[] {
  const largeur = (hauteur * s.largeur) / s.hauteur;
  const px = s.pointe.x * largeur;
  const py = s.pointe.y * hauteur;
  const r = (angle * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const e = s.emprise;
  const coins = e
    ? [
        { x: e.x0, y: e.y0 },
        { x: e.x1, y: e.y0 },
        { x: e.x1, y: e.cone },
        ...(sansPointe ? [] : [{ x: s.pointe.x, y: s.pointe.y }]),
        { x: e.x0, y: e.cone },
      ]
    : [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];
  return coins.map((c) => {
    const q = { x: c.x * largeur - px, y: c.y * hauteur - py };
    return { x: pointe.x + q.x * cos - q.y * sin, y: pointe.y + q.x * sin + q.y * cos };
  });
}

/** Direction (vecteur unitaire) de la pointe vers le haut du stylo, pour un angle donné. */
export const directionCorps = (angle: number): Point => ({ x: Math.sin((angle * Math.PI) / 180), y: -Math.cos((angle * Math.PI) / 180) });

/** Le polygone convexe `poly` touche-t-il le rectangle `r` (séparation sur les axes) ? */
export function polygoneTouche(poly: readonly Point[], r: Cible): boolean {
  if (r.largeur <= 0 || r.hauteur <= 0) return false;
  const coins = [
    { x: r.x, y: r.y },
    { x: r.x + r.largeur, y: r.y },
    { x: r.x + r.largeur, y: r.y + r.hauteur },
    { x: r.x, y: r.y + r.hauteur },
  ];
  const axes: Point[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    axes.push({ x: -(b.y - a.y), y: b.x - a.x });
  }
  for (const ax of axes) {
    const p1 = poly.map((q) => q.x * ax.x + q.y * ax.y);
    const p2 = coins.map((q) => q.x * ax.x + q.y * ax.y);
    if (Math.max(...p1) <= Math.min(...p2) || Math.max(...p2) <= Math.min(...p1)) return false;
  }
  return true;
}

/** Le polygone est-il entièrement dans le rectangle ? */
export const polygoneDans = (poly: readonly Point[], r: Cible): boolean => poly.every((q) => q.x >= r.x && q.y >= r.y && q.x <= r.x + r.largeur && q.y <= r.y + r.hauteur);
