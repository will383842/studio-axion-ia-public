/** FACE CAMÉRA ANIMÉE · phrases du coût (estimation avant, vrai coût après), PUR. */
import { centimes, formaterMontant } from "@/lib/montants";
import type { EstimationFA } from "@/services/facecam-animee";

export const eurosFA = (c: number) => formaterMontant(centimes(c));
export const dollarsFA = (usd: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(usd)} $`;

export interface LignesCout {
  titre: string;
  pireCas: string;
  plafond: string;
  autres: string;
}

/** Les lignes affichées au-dessus du bouton « Animer ». */
export function lignesCout(e: EstimationFA): LignesCout {
  const lot = e.videos > 1;
  return {
    titre: lot ? `Coût pour ${e.videos} vidéos` : "Coût de cette vidéo",
    pireCas: lot
      ? `Au plus ${eurosFA(e.pireCasLotCentimesEur)} (jusqu'à ${e.essaisMax} essais de Claude par vidéo, +${e.essaisRepliMax} si aucune vidéo fidèle n'est trouvée, ${eurosFA(e.pireCasCentimesEur)} au plus pour la plus longue)`
      : `Un essai : ${eurosFA(e.unEssaiCentimesEur)} au plus. Au pire : ${eurosFA(e.pireCasCentimesEur)} (jusqu'à ${e.essaisMax} essais de Claude, +${e.essaisRepliMax} si aucune vidéo fidèle n'est trouvée)`,
    plafond: `Plafond Claude : ${dollarsFA(e.plafondUsd)} par vidéo (≈ ${eurosFA(e.plafondCentimesEur)}). Rien n'est dépensé au-delà.`,
    autres: "Montage et voix : 0 € (votre voix, montage sur le serveur du studio)",
  };
}

/** « Déjà payé : 1,38 € » pour une vidéo en fabrication ou finie. */
export const phrasePaye = (centimesEur: number) => `Déjà payé : ${eurosFA(centimesEur)}`;
