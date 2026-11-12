/**
 * NIVEAU DE CRÉDIT EN MOTS — AFFICHAGE SEULEMENT. Règle du propriétaire : aucun prix dans le studio, les limites se
 * disent en quantités (« ≈ 7 vidéos restantes ») ou, à défaut, en mots. Ce fichier ne décide de rien : mêmes seuils que
 * le bandeau de l'Accueil (`SEUIL_VIDEOS_ALERTE`) et la jauge (`tonJauge`) ; aucun calcul, plafond ni blocage ne change.
 */
import { SEUIL_PRESQUE_VIDE_CENTIMES, type EtatRestant } from "./credit-claude";
import { SEUIL_VIDEOS_ALERTE } from "./credits";

export type NiveauCredit = "suffisant" | "bientot" | "epuise" | "inconnu";

export const LIBELLES_NIVEAU: Record<NiveauCredit, string> = {
  suffisant: "Crédit suffisant",
  bientot: "À recharger bientôt",
  epuise: "À recharger",
  inconnu: "Pas encore connu",
};

/** Un forfait Claude (abonnements) se renouvelle, il ne se recharge pas : jamais le mot « recharger » pour lui. */
export const LIBELLES_NIVEAU_FORFAIT: Record<NiveauCredit, string> = {
  suffisant: "Crédit suffisant",
  bientot: "Presque épuisé",
  epuise: "Épuisé jusqu'au renouvellement",
  inconnu: "À renseigner",
};

/** Niveau d'une carte de crédit d'un fournisseur (mêmes seuils que le bandeau : épuisé, ≈ 10 unités ou moins, jauge orange/rouge). */
export function niveauCredit(c: { epuise?: boolean; cleRefusee?: boolean; ton: "vert" | "orange" | "rouge" | "neutre"; videosRestantes: number | null; comptesEpuises?: number; soldeConnu: boolean }): NiveauCredit {
  if (c.epuise || c.comptesEpuises !== undefined || c.videosRestantes === 0 || c.ton === "rouge") return "epuise";
  if (c.ton === "orange" || (c.videosRestantes !== null && c.videosRestantes <= SEUIL_VIDEOS_ALERTE)) return "bientot";
  if (!c.soldeConnu) return "inconnu";
  return "suffisant";
}

/** Niveau d'un compte Claude d'abonnement (restant estimé, seuil « presque vide » déjà en place). */
export function niveauCompteClaude(c: { etat: EtatRestant; restantCentimes: number | null }): NiveauCredit {
  if (c.etat === "expire" || (c.etat === "estime" && c.restantCentimes === 0)) return "epuise";
  if (c.etat === "estime" && c.restantCentimes !== null) return c.restantCentimes < SEUIL_PRESQUE_VIDE_CENTIMES ? "bientot" : "suffisant";
  if (c.etat === "a-venir") return "suffisant";
  return "inconnu";
}

/** Niveau de l'ensemble des comptes retenus (hors total exclus) : le pire des niveaux, « épuisé » seulement si tous le sont. */
export function niveauTotalClaude(comptes: readonly { etat: EtatRestant; restantCentimes: number | null; horsTotalTexte: string | null }[]): NiveauCredit {
  const niveaux = comptes.filter((c) => !c.horsTotalTexte).map(niveauCompteClaude);
  if (!niveaux.length || niveaux.every((n) => n === "inconnu")) return "inconnu";
  const connus = niveaux.filter((n) => n !== "inconnu");
  if (connus.every((n) => n === "epuise")) return "epuise";
  if (connus.some((n) => n === "bientot" || n === "epuise")) return "bientot";
  return "suffisant";
}
