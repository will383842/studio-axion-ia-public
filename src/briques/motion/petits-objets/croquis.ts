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

/** Toile carrée de 1000 unités (les paramètres sont en %). */
export const TOILE_CROQUIS = 1000;
const POINTE_FLECHE = 46;
const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Un trait demandé à la bibliothèque : genre, nombres dans l'ordre de son appel, graine propre à ce trait. */
export interface TraitCroquis {
  genre: "rectangle" | "ellipse" | "ligne";
  /** rectangle : x,y,l,h · ellipse : centre x, centre y, l, h · ligne : x1,y1,x2,y2 */
  nombres: [number, number, number, number];
  seed: number;
}

export interface PlanCroquis {
  reglages: ReglagesCroquis;
  traits: TraitCroquis[];
}

/** Partie PURE du croquis : quels traits, avec quels nombres et quelles graines. Null si paramètres ou graine invalides. */
export function planCroquis(forme: FormeCroquis, parametres: unknown, ton: TonObjet, fond: FondAxion, graine: unknown): PlanCroquis | null {
  const p = validerCroquis(parametres);
  if (!p || !graineCroquisValide(graine)) return null;
  const reglages = reglagesCroquis(p, ton, fond, graine);
  const x = (p.x / 100) * TOILE_CROQUIS;
  const y = (p.y / 100) * TOILE_CROQUIS;
  const l = (p.largeur / 100) * TOILE_CROQUIS;
  const h = (p.hauteur / 100) * TOILE_CROQUIS;
  const seed = reglages.seed;
  if (forme === "rectangle") return { reglages, traits: [{ genre: "rectangle", nombres: [x, y, l, h], seed }] };
  if (forme === "ellipse") return { reglages, traits: [{ genre: "ellipse", nombres: [x + l / 2, y + h / 2, l, h], seed }] };
  const traits: TraitCroquis[] = [{ genre: "ligne", nombres: [x, y, x + l, y + h], seed }];
  if (forme === "fleche") {
    const angle = Math.atan2(h, l);
    [0.5, -0.5].forEach((ouverture, i) => {
      const a = angle + Math.PI + ouverture;
      traits.push({ genre: "ligne", nombres: [x + l, y + h, arrondi(x + l + POINTE_FLECHE * Math.cos(a)), arrondi(y + h + POINTE_FLECHE * Math.sin(a))], seed: seed + i + 1 });
    });
  }
  return { reglages, traits };
}
