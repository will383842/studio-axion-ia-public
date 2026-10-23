/**
 * Identifiants des moteurs inscrits, SANS dépendre des moteurs eux-mêmes (relecture finale : la brique « visage » lit le
 * moteur d'une commande comme partout ailleurs, sans cycle d'imports moteurs → briques → moteurs).
 */
import { trouverFormat } from "@/formats";
import type { CommandeFabrication } from "@/domaine/types";

export const IDS_MOTEURS = ["simulation", "montage-avocat", "montage-facecam", "montage-tableau", "montage-cas-concret", "montage-facecam-animee", "montage-image-video"] as const;
export type IdMoteur = (typeof IDS_MOTEURS)[number];

export function moteurExiste(id: string): boolean {
  return (IDS_MOTEURS as readonly string[]).includes(id);
}

/** Identifiant du moteur d'une commande : `moteurId` figé (v2), sinon celui du format (commandes v1), sinon la simulation. */
export function idMoteurDeCommande(commande: Pick<CommandeFabrication, "moteurId" | "formatId">): string {
  if (commande.moteurId && moteurExiste(commande.moteurId)) return commande.moteurId;
  const duFormat = trouverFormat(commande.formatId)?.moteur;
  return duFormat && moteurExiste(duFormat) ? duFormat : "simulation";
}
