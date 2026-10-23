/** Montants en centimes (AV2.2-9). PUR. */
import type { Montant } from "@/domaine/types";
import { formateurNombre } from "@/lib/intl";

export function euros(valeur: number): Montant {
  return { centimes: Math.round(valeur * 100), devise: "EUR" };
}

export function centimes(c: number): Montant {
  return { centimes: Math.round(c), devise: "EUR" };
}

/** Bruit des flottants toléré (3,4999999999999996 vaut 3,5 ; 9,000000000000002 vaut 9). */
const BRUIT_FLOTTANT = 1e-9;

/**
 * L3-01 : une DÉPENSE (ou ce qui va être dépensé) en fraction de centime est comptée au centime SUPÉRIEUR, jamais au plus
 * proche : x,0 reste x, x,5 (et x,1) devient x + 1. Le bruit des flottants n'ajoute ni ne retire un centime. PUR.
 */
export function centimesAuSuperieur(c: number): number {
  return Math.ceil(c - BRUIT_FLOTTANT);
}

/** L3-01 : un PLAFOND en unités (dollars, euros) vers des centimes entiers, au centime INFÉRIEUR (jamais un centime au-dessus). PUR. */
export function centimesDuPlafond(unites: number): number {
  return Math.floor(unites * 100 + BRUIT_FLOTTANT);
}

export const ZERO: Montant = { centimes: 0, devise: "EUR" };

export function additionner(...montants: (Montant | undefined)[]): Montant {
  return centimes(montants.reduce((t, m) => t + (m?.centimes ?? 0), 0));
}

export function multiplier(m: Montant, facteur: number): Montant {
  return centimes(m.centimes * facteur);
}

/**
 * Taux dollar → euro par défaut (réglage `taux.usdEur`, modifiable dans Réglages > Budget).
 * Les outils facturent en dollars ; la console compte et affiche en euros (A.8).
 */
export const TAUX_USD_EUR_PAR_DEFAUT = 0.9;

/** Convertit des centimes de dollar en montant en euros, au centime SUPÉRIEUR (L3-01 : une dépense n'est jamais sous-comptée). */
export function usdVersEur(centimesUsd: number, taux: number = TAUX_USD_EUR_PAR_DEFAUT): Montant {
  return centimes(centimesAuSuperieur(centimesUsd * taux));
}

/** « 4,20 € » ; `court` → « 4 € » si rond. */
export function formaterMontant(m: Montant | undefined, options: { court?: boolean } = {}): string {
  const c = m?.centimes ?? 0;
  const rond = c % 100 === 0;
  return formateurNombre("fr-FR", {
    style: "currency",
    currency: m?.devise ?? "EUR",
    minimumFractionDigits: options.court && rond ? 0 : 2,
    maximumFractionDigits: options.court && rond ? 0 : 2,
  }).format(c / 100);
}
