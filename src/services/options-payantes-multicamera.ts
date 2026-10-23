/**
 * MULTICAMÉRA RÉELLE ET OPTIONS PAYANTES (lot J). Serveur seulement.
 *
 * Un seul appel pour les deux formats (avocat, face caméra) : en simulation, rien à confirmer (aucune dépense) ; en
 * réel, la garde de la version du travail si elle porte une confirmation valide, sinon la demande est créée (carte
 * « Option payante » sur « Votre vidéo ») et la garde rendue refuse chaque rendu : la passe rend la version gratuite (la face seule).
 * Appelé par `services/multicamera.ts` (fabrication commune, mission H). Sans garde, le fournisseur réel refuse de toute
 * façon chaque look et chaque rendu.
 */
import "server-only";
import { gardeRefus, type GardeOptionPayante } from "@/briques/options-payantes/garde";
import { journaliser } from "./_commun";
import { preparerOptionPayante } from "./options-payantes";

export async function gardeMulticamera(optionId: "multicamera-avocat" | "multicamera-facecam", reel: boolean, travailId: string, dureeSec: number): Promise<GardeOptionPayante | undefined> {
  if (!reel) return undefined;
  const accord = await preparerOptionPayante(optionId, { travailId, dureeSec, angles: 2 });
  if (accord.statut === "autorisee") return accord.garde;
  await journaliser("fabrication", accord.message);
  return gardeRefus(optionId);
}
