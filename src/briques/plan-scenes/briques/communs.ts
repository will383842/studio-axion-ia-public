/**
 * Communs des briques du plan de scènes : propriétés, couleurs, apparition douce. PUR (aucun hook React, aucun
 * Remotion) : l'image courante arrive en propriété, donc même entrée = même image.
 */
import type { CSSProperties } from "react";
import { couleursSur, decelerer, entre, FAMILLE_CSS_AXION, progression, type AccentAxion, type FondAxion } from "../../jetons-motion";

export interface ProprietesBrique<P> {
  /** Image courante, comptée depuis le début de la brique. */
  image: number;
  fps: number;
  /** Durée de la brique (images). */
  dureeImages: number;
  fond: FondAxion;
  accent?: AccentAxion;
  parametres: P;
}

export function palette(fond: FondAxion, accent?: AccentAxion) {
  return couleursSur(fond, accent);
}

export const RACINE: CSSProperties = { position: "absolute", inset: 0, fontFamily: FAMILLE_CSS_AXION, fontFeatureSettings: '"tnum"' };

/** Arrivée douce : fondu + léger glissé vers le haut (aucun dépassement). */
export function apparition(image: number, debut: number, duree = 12, distance = 24): CSSProperties {
  const t = progression(image, debut, duree, decelerer);
  return { opacity: t, transform: `translateY(${round(entre(distance, 0, t))}px)` };
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ombre(fond: FondAxion): string {
  return fond === "noir" ? "0 18px 50px rgba(20, 20, 19, 0.45)" : "0 18px 50px rgba(20, 20, 19, 0.10)";
}

/** Nombre à la française (virgule décimale, espace fine des milliers), sans `Intl` : identique partout. */
export function nombreFr(v: number, decimales: number): string {
  const [ent, dec] = Math.abs(v).toFixed(decimales).split(".");
  const groupes = ent!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v < 0 ? "−" : ""}${groupes}${dec ? `,${dec}` : ""}`;
}

/** Dimension boîte comprise (gardée dans ce `.ts` : la garde des classes Tailwind lit `border-…` dans les `.tsx`). */
export const BOITE_INCLUSE: CSSProperties = { boxSizing: "border-box" };
