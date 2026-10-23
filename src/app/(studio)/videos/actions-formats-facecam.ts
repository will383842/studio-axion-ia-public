"use server";

/** Action serveur des pastilles de format de « Votre vidéo » face caméra (lot F1). */
import { revalidatePath } from "next/cache";
import type { Ratio } from "@/domaine/types";
import { essayer, type Resultat } from "@/services/_commun";
import { changerFormatsFacecam } from "@/services/formats-facecam";

export async function changerFormatsFacecamAction(videoId: string, ratios: Ratio[]): Promise<Resultat<{ ratios: Ratio[]; travaux: string[] }>> {
  const r = await essayer(() => changerFormatsFacecam(videoId, ratios));
  revalidatePath("/videos");
  revalidatePath(`/videos/${videoId}`);
  return r;
}
