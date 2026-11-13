/** FACE CAMÉRA ANIMÉE · phrases du coût, PUR. Règle du fondateur : aucun prix ni montant à l'écran ; les coûts restent calculés et enregistrés côté serveur. */
import type { EstimationFA } from "@/services/facecam-animee";

export interface LignesCout {
  titre: string;
  pireCas: string;
  plafond: string;
  autres: string;
}

/** Les lignes (sans aucun montant) de l'estimation d'une ou plusieurs vidéos. */
export function lignesCout(e: EstimationFA): LignesCout {
  const lot = e.videos > 1;
  return {
    titre: lot ? `Coût pour ${e.videos} vidéos` : "Coût de cette vidéo",
    pireCas: `Jusqu'à ${e.essaisMax} essais de Claude${lot ? " par vidéo" : ""}, +${e.essaisRepliMax} si aucune vidéo fidèle n'est trouvée.`,
    plafond: "Le coût est plafonné pour chaque vidéo. Rien n'est dépensé au-delà.",
    autres: "Montage et voix : rien à payer en plus (votre voix, montage sur le serveur du studio)",
  };
}

/** Phrase pour une vidéo en fabrication ou finie : sans montant. */
export const phrasePaye = (): string => "Déjà payé";
