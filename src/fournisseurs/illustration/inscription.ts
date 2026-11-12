/**
 * INSCRIPTION DES FOURNISSEURS D'ILLUSTRATION RÉELS (posée par l'architecte le 02/10, remplie au lot A2 = M5).
 * Le registre (`fournisseurs/index.ts`) l'appelle : le lot A2 la remplit sans toucher au registre.
 * Renvoie `{ reel: FournisseurIllustration }` (banques Pexels + Pixabay, fabrication fal.ai) quand au moins une clé
 * existe (`PEXELS_API_KEY`, `PIXABAY_API_KEY`, `FAL_KEY`) ; activation : `FOURNISSEUR_ILLUSTRATION=reel`.
 * Sans clé : vide, la simulation reste le défaut. `FAL_PLAFOND_USD` (facultatif) : plafond de dépense fal.ai du mois,
 * calculé depuis les dépenses en base (CORRECTEUR 1 — B3).
 */
import type { FournisseurIllustration } from "../types";
import type { TraceDemandeFal } from "./fal";
import { clesDepuisEnv, creerFournisseurIllustrationReel } from "./reel";

export function illustrationsReelles(env: Record<string, string | undefined> = process.env): Record<string, FournisseurIllustration> {
  const cles = clesDepuisEnv(env);
  if (!cles.pexels && !cles.pixabay && !cles.fal) return {};
  const plafond = Number(env.FAL_PLAFOND_USD);
  // CORRECTEUR 1 — B3 : le plafond (par mois) se compare à la dépense fal.ai lue EN BASE, pas à un compteur en mémoire.
  const depenseDeja = async () => (await import("@/services/illustrations")).depenseFalEnBase();
  // INTÉGRATION FINALE : chaque soumission fal.ai est tracée en base (identifiant gardé, jamais renvoyée).
  const journal = {
    lire: async (cle: string) => (await import("@/services/illustrations")).lireTraceFal(cle),
    ecrire: async (cle: string, trace: TraceDemandeFal) => (await import("@/services/illustrations")).ecrireTraceFal(cle, trace),
  };
  // L2-13 : `FAL_PLAFOND_USD` reste une constante technique du serveur ; au-delà, seul l'appel de l'usine est refusé.
  const auDepassementDuPlafond = async () => (await import("@/services/plafond-fournisseur")).decisionAuDepassementTechnique("fal");
  // L2-13 : quota de QUANTITÉ de l'usine, posé dans la fabrication elle-même : soumettre, generer et animer le traversent.
  const reserverQuota = async (genre: "image" | "clip", cleIdempotence: string) => (await import("@/services/plafond-fournisseur")).reserverQuota("fal", genre, cleIdempotence);
  const reel = creerFournisseurIllustrationReel(cles, { plafondUsdCentimes: Number.isFinite(plafond) && plafond > 0 ? plafond * 100 : undefined, auDepassementDuPlafond, reserverQuota, depenseDeja, journal });
  return { reel };
}
