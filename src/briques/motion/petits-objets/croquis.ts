/**
 * PETITS OBJETS — style croquis (X1-08) : paramètres purs. Aucune bibliothèque de tracé ici (elle vit dans studio-rendu seulement).
 * Pièce NON inscrite (rien ne l'importe sauf `Croquis.tsx`). Couleur par `couleurDuTon`, jamais en dur. Imports relatifs seulement.
 */
import type { FondAxion } from "../../jetons-motion";
import type { TonObjet } from "./contrat";
import { couleurDuTon } from "./tons";

export const FORMES_CROQUIS = ["rectangle", "ellipse", "fleche", "ligne"] as const;
export type FormeCroquis = (typeof FORMES_CROQUIS)[number];

/** Plafond de la rugosité (au-delà, le trait devient illisible). */
export const RUGOSITE_MAX = 1.5;
export const RUGOSITE_DEFAUT = 1;
export const EPAISSEUR_CROQUIS = 5;

/** En % de la toile (0..100), comme les autres petits objets. */
export interface ParametresCroquis {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  rugosite?: number;
}

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Jamais d'exception ; null = rien n'est dessiné. */
export function validerCroquis(p: unknown): ParametresCroquis | null {
  if (typeof p !== "object" || p === null) return null;
  const { x, y, largeur, hauteur, rugosite } = p as Record<string, unknown>;
  if (!nombre(x) || !nombre(y) || !nombre(largeur) || !nombre(hauteur)) return null;
  if (x < 0 || y < 0 || largeur <= 0 || hauteur <= 0 || x + largeur > 100 || y + hauteur > 100) return null;
  if (rugosite !== undefined && (!nombre(rugosite) || rugosite < 0)) return null;
  return rugosite === undefined ? { x, y, largeur, hauteur } : { x, y, largeur, hauteur, rugosite };
}

/** La graine de la vidéo doit être un entier ≥ 0 ; la bibliothèque tire au hasard avec 0. */
export function graineCroquisValide(graine: unknown): graine is number {
  return typeof graine === "number" && Number.isInteger(graine) && graine >= 0 && graine <= 0xffffffff;
}

export interface ReglagesCroquis {
  seed: number;
  roughness: number;
  stroke: string;
  strokeWidth: number;
}

export function reglagesCroquis(p: ParametresCroquis, ton: TonObjet, fond: FondAxion, graine: number): ReglagesCroquis {
  return {
    /** 1 .. 2^31-1 : jamais 0 (hasard libre), et deux pas de plus ne retombent pas sur un multiple de 2^32. */
    seed: (graine % 2147483646) + 1,
    roughness: Math.min(RUGOSITE_MAX, p.rugosite ?? RUGOSITE_DEFAUT),
    stroke: couleurDuTon(ton, fond),
    strokeWidth: EPAISSEUR_CROQUIS,
  };
}
