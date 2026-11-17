/**
 * PETITS OBJETS — trait au feutre (X1-09) : points d'un entourage (contour fermé) ou d'un soulignement (trait ouvert). Pur.
 * Le tremblement vient de `tremblement.ts`, la graine de la vidéo est obligatoire (aucun hasard libre).
 * La bibliothèque de tracé (freehand) vit dans studio-rendu seulement : `TraitFeutre.tsx` lui confie ces points.
 * Pièce NON inscrite, éteinte : rien ne l'importe sauf `TraitFeutre.tsx`. Imports relatifs seulement.
 */
import type { ZoneObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { TREMBLEMENT, tremblement } from "./tremblement";
import { verifierZone } from "./zones";

export type GenreTraitFeutre = "entourage" | "soulignement";

/** Épaisseur du feutre en pixels sur une toile de 1080 de haut. */
export const EPAISSEUR_FEUTRE_PX = { min: 2, max: 10 } as const;
export const HAUTEUR_TOILE_PX = 1080;
export const POINTS_ENTOURAGE = 48;
export const POINTS_SOULIGNEMENT = 24;

/** Point en % de la toile (0..100). */
export type PointFeutre = [number, number];

export interface TraitFeutre {
  genre: GenreTraitFeutre;
  points: PointFeutre[];
  ferme: boolean;
  /** Pixels à 1080 de haut, dans [2, 10]. */
  epaisseur: number;
}

/** Épaisseur proportionnelle à la hauteur de la zone (en % de la toile), bornée ; jamais d'exception. */
export function epaisseurFeutre(hauteurZonePourcent: number): number {
  const h = Number.isFinite(hauteurZonePourcent) ? hauteurZonePourcent : 0;
  const px = (Math.max(0, h) / 100) * HAUTEUR_TOILE_PX * 0.05;
  return Math.min(EPAISSEUR_FEUTRE_PX.max, Math.max(EPAISSEUR_FEUTRE_PX.min, Math.round(px * 10) / 10));
}

const borne = (n: number): number => Math.min(100, Math.max(0, Math.round(n * 1000) / 1000));

/** Tremblement du point `i` (pixels → % de la toile de 1080) ; un palier par point. */
function secousse(graine: number, i: number): [number, number] {
  const d = tremblement(graine, i, TREMBLEMENT.ips);
  const pct = 100 / HAUTEUR_TOILE_PX;
  return [d.dx * pct, d.dy * pct];
}

/** Refus (null) si la graine n'est pas un entier ≥ 0, si la zone est invalide, ou touche le visage ou les sous-titres. */
export function traitFeutre(p: { genre: GenreTraitFeutre; graine: number; zone: ZoneObjet; visage?: ZoneObjet }): TraitFeutre | null {
  if (!Number.isInteger(p.graine) || p.graine < 0 || p.graine > 0xffffffff) return null;
  if (verifierZone(p.zone, p.visage ? { visage: p.visage } : undefined) !== "ok") return null;
  const { x, y, largeur, hauteur } = p.zone;
  const points: PointFeutre[] = [];
  if (p.genre === "entourage") {
    const cx = x + largeur / 2;
    const cy = y + hauteur / 2;
    const depart = aleaGraine(p.graine, 100) * 2 * Math.PI;
    for (let i = 0; i < POINTS_ENTOURAGE; i++) {
      const a = depart + (i / POINTS_ENTOURAGE) * 2 * Math.PI;
      const [dx, dy] = secousse(p.graine, i);
      points.push([borne(cx + (Math.cos(a) * largeur) / 2 + dx), borne(cy + (Math.sin(a) * hauteur) / 2 + dy)]);
    }
    points.push([points[0][0], points[0][1]]);
  } else {
    const yBas = y + hauteur;
    for (let i = 0; i < POINTS_SOULIGNEMENT; i++) {
      const [dx, dy] = secousse(p.graine, i);
      points.push([borne(x + (i / (POINTS_SOULIGNEMENT - 1)) * largeur + dx), borne(yBas + dy)]);
    }
  }
  return { genre: p.genre, points, ferme: p.genre === "entourage", epaisseur: epaisseurFeutre(hauteur) };
}

/** Points déjà tracés à l'instant `t` (0 → rien, 1 → tout) ; monotone en `t`, jamais d'exception. */
export function pointsVisibles(points: PointFeutre[], t: number): PointFeutre[] {
  if (!Number.isFinite(t) || t <= 0) return [];
  if (t >= 1) return points;
  return points.slice(0, Math.floor(t * points.length));
}
