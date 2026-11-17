/**
 * Dosage de l'animation (X3-05) : cartes automatiques du face caméra selon le cran. PUR : aucun réseau, aucune date,
 * aucun hasard. Les retraits du cran s'ajoutent à ceux de Williams (`cartesAutoRetirees`, `cartes-video.ts`) : les
 * cartes demandées au monteur ne sont jamais touchées, et les sous-titres non plus.
 */
import type { DosageMotion } from "@/briques/dosage-motion/types";
import { cartesPosees, type EntreeHabillageFacecam } from "./habillage";

/** Ce qu'il faut savoir d'une carte automatique : son identifiant stable et son sort. */
export interface CarteVueDosage {
  idStable: string;
  etat: string;
}

/** Identifiants à retirer : toutes en `aucun`, une sur deux en `sobre` (la 2e, la 4e…), aucune sinon. */
export function cartesAutoSelonDosage(cran: DosageMotion, cartesVues: readonly CarteVueDosage[]): string[] {
  const vives = cartesVues.filter((v) => v.etat === "posee");
  if (cran === "aucun") return vives.map((v) => v.idStable);
  if (cran === "sobre") return vives.filter((_, i) => i % 2 === 1).map((v) => v.idStable);
  return [];
}

type EntreeCartes = Pick<EntreeHabillageFacecam, "cartes" | "cartesAuto" | "occupes" | "mots" | "dureeSec" | "memoireCartes">;

/**
 * `cartesAutoRetirees` de Williams + retraits du cran. Sans cran, en équilibre et en dynamique : la MÊME liste, rendue
 * telle quelle (aucun calcul de plus).
 */
export function retireesAvecDosage(cran: DosageMotion | undefined, retirees: string[], entree: EntreeCartes): string[] {
  if (cran !== "aucun" && cran !== "sobre") return retirees;
  const { vues } = cartesPosees({ ...entree, cartesAutoRetirees: retirees });
  // En `aucun`, les cartes masquées sont retirées aussi : aucune ne réapparaît une fois sa voisine partie.
  const retrait = cran === "aucun" ? vues.filter((v) => v.etat !== "retiree").map((v) => v.idStable) : cartesAutoSelonDosage(cran, vues);
  return [...new Set([...retirees, ...retrait])];
}
