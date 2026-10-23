"use server";

/**
 * Actions serveur de l'« Historique » du tableau animé : le fichier à télécharger et la publication saisie à la main.
 * La session est vérifiée par le service.
 */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { noterPublication, telechargerHistorique } from "@/services/tableau-tracabilite";

/** Le fichier de l'historique (CSV pour un tableur, ou JSON), tel quel. */
export async function telechargerHistoriqueAction(videoId: string, format: "csv" | "json"): Promise<Resultat<{ nom: string; type: string; contenu: string }>> {
  return essayer(() => telechargerHistorique(videoId, format === "json" ? "json" : "csv"));
}

/** « Publiée sur… » : ajoute un événement à l'historique. */
export async function noterPublicationAction(videoId: string, reseau: string, date: string, lien?: string): Promise<Resultat<{ publiee: true }>> {
  const r = await essayer(async () => {
    await noterPublication(videoId, { reseau, date, lien });
    return { publiee: true as const };
  });
  if (r.ok) revalidatePath(`/videos/${videoId}`);
  return r;
}
