"use server";

/**
 * Actions serveur du SON DES PLANS dans la fiche vidéo (lot du 02/10, D1) : choisir le son d'un plan, puis
 * « Appliquer » (seul le mixage est refait, gratuit, nouvelle version). Chacune commence par exigerSession().
 */
import { revalidatePath } from "next/cache";
import type { ChoixBruitagePlan } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { choisirSonDuPlan, sonsDeLaVersion, type SonsDeLaVersion } from "@/services/bruitages";
import { appliquerSons } from "@/services/recalque";
import { essayer, type Resultat } from "@/services/_commun";

export async function sonDuPlanVideoAction(videoId: string, planId: string, choix: ChoixBruitagePlan | null): Promise<Resultat<SonsDeLaVersion | null>> {
  await exigerSession();
  return essayer(async () => {
    await choisirSonDuPlan(planId, choix);
    return sonsDeLaVersion(videoId);
  });
}

export async function appliquerSonsAction(videoId: string): Promise<Resultat<{ travailId: string; versionId: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await appliquerSons(videoId);
    revalidatePath(`/videos/${videoId}`);
    return r;
  });
}
