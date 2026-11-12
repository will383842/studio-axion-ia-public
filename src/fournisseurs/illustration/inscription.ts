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
import { ErreurIllustration } from "./depot";
import { clesDepuisEnv, creerFournisseurIllustrationReel } from "./reel";
import type { FabricationParEtapes } from "./types";

/**
 * L2-13 : quota de QUANTITÉ de l'usine avant toute soumission (origine « usine » seulement ; le fondateur n'est jamais
 * bloqué). Quota atteint : refus sans aucun envoi, sans montant. Si l'envoi échoue sans être parti, l'unité est rendue.
 */
function avecQuotaUsine(f: FabricationParEtapes): FabricationParEtapes {
  return {
    ...f,
    async soumettre(d) {
      const { reserverQuota } = await import("@/services/plafond-fournisseur");
      const reservation = await reserverQuota("fal", d.genre, d.cleIdempotence);
      if (!reservation) throw new ErreurIllustration({ code: "quota", reessayable: false, message: "Limite de fabrication automatique atteinte : rien n'est envoyé." });
      try {
        return await f.soumettre(d);
      } catch (e) {
        if (!(e as { soumissionIncertaine?: boolean }).soumissionIncertaine) await reservation.liberer();
        throw e;
      }
    },
  };
}

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
  const reel = creerFournisseurIllustrationReel(cles, { plafondUsdCentimes: Number.isFinite(plafond) && plafond > 0 ? plafond * 100 : undefined, auDepassementDuPlafond, depenseDeja, journal });
  return { reel: reel.fabrication ? { ...reel, fabrication: avecQuotaUsine(reel.fabrication) } : reel };
}
