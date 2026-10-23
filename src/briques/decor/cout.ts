/**
 * DÉPENSE DU DÉCOR IA (lot L10). PUR.
 *
 * Format face caméra = `sansPrix` : aucun montant n'est jamais AFFICHÉ (ni devis, ni confirmation). La dépense est
 * pourtant comptée : chaque passage payé devient une `LigneCout` réelle (fournisseur `higgsfield`) qui entre dans le
 * total du mois (`DepenseEnregistree`) et dans le plafond (budget du mois restant). En simulation, les lignes portent
 * le fournisseur `simulation` : visibles comme ESSAI, jamais comptées.
 */
import type { LigneCout, Montant } from "@/domaine/types";
import { creditsPourPassage, type ModeleHiggsfield } from "@/fournisseurs/higgsfield/types";
import { centimes, multiplier } from "@/lib/montants";

/**
 * Prix d'un crédit Higgsfield (centimes d'euro). Essai du 08/10 : ≈ 90 crédits par vidéo de 90 s ≈ 4 à 5 € → 5 c.
 * À recaler sur la facture réelle du compte (JOURNAL-E1).
 */
export const PRIX_CREDIT_HIGGSFIELD_CENTIMES = 5;
/** Marge sur le solde et le plafond : on ne lance que si 1,2 × le devis tient. */
export const MARGE_DECOR = 1.2;
export const ETAPE_DECOR = "Décor IA";

export function montantCredits(credits: number): Montant {
  return multiplier(centimes(PRIX_CREDIT_HIGGSFIELD_CENTIMES), Math.max(0, credits));
}

/** Devis d'une vidéo entière (tout ou rien) : somme des passages. */
export function creditsPourVideo(modele: ModeleHiggsfield, durees: number[]): number {
  return durees.reduce((t, d) => t + creditsPourPassage(modele, d), 0);
}

export function ligneDecor(credits: number, nature: LigneCout["nature"], simule: boolean): LigneCout {
  return {
    etape: ETAPE_DECOR,
    fournisseur: simule ? "simulation" : "higgsfield",
    unite: "seconde",
    quantite: credits,
    prixUnitaire: centimes(PRIX_CREDIT_HIGGSFIELD_CENTIMES),
    total: montantCredits(credits),
    nature,
  };
}

/** Le devis (avec marge) tient-il dans ce qui reste du budget du mois ? */
export function tientDansLePlafond(creditsEstimes: number, restantDuMoisCentimes: number): boolean {
  return montantCredits(creditsEstimes * MARGE_DECOR).centimes <= Math.max(0, restantDuMoisCentimes);
}
