/**
 * Réglages > Services reliés : les champs d'argent se saisissent et s'affichent en EUROS (format français).
 * PUR. Le stockage (centimes de dollar) et toutes les conditions de blocage de dépense restent en dollars : ce module
 * ne fait que traduire à l'écran. Le taux est le réglage existant `taux.usdEur` (euros pour 1 $, défaut
 * TAUX_USD_EUR_PAR_DEFAUT) : la page le lit et le passe aux composants.
 */
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";

/** Taux par défaut (€ pour 1 $) quand le réglage `taux.usdEur` est absent ou invalide. À confirmer par Williams. */
export const TAUX_EUR_PAR_USD = TAUX_USD_EUR_PAR_DEFAUT;

/** Taux utilisable (fini, > 0) ou le défaut. */
export function tauxValide(taux: number | null | undefined): number {
  return typeof taux === "number" && Number.isFinite(taux) && taux > 0 ? taux : TAUX_EUR_PAR_USD;
}

/** Dollars → euros, arrondi au centime. */
export function dollarsVersEuros(dollars: number, taux?: number | null): number {
  return Math.round(dollars * tauxValide(taux) * 100) / 100;
}

/** Euros saisis → dollars, arrondi au centime (c'est ce montant, en dollars, qui part aux actions inchangées). */
export function eurosVersDollars(euros: number, taux?: number | null): number {
  return Math.round((euros / tauxValide(taux)) * 100) / 100;
}

/** Saisie française (« 20 », « 20,5 », « 1 200,50 ») → nombre, NaN si vide ou illisible. */
export function lireSaisieEuros(saisie: string): number {
  const t = saisie.replace(/[\s  ]/g, "").replace(",", ".").replace(/€/g, "");
  if (t === "" || !/^\d*\.?\d+$|^\d+\.$/.test(t)) return Number.NaN;
  return Number(t);
}

/** Valeur d'un champ de saisie en euros : « 180 » ou « 180,5 » (virgule, sans symbole). */
export function champEuros(euros: number): string {
  return String(Math.round(euros * 100) / 100).replace(".", ",");
}

/** « ≈ 0,25 € » : un montant en dollars affiché en euros, format français. */
export function texteEuros(dollars: number, taux?: number | null): string {
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(dollarsVersEuros(dollars, taux))} €`;
}
