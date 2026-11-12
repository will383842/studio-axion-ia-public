"use server";

/**
 * Actions serveur de la réserve Image → vidéo. Elles enveloppent le service (session vérifiée par lui) : un Resultat
 * sérialisable, jamais de prix à valider, UN clic = UNE fabrication.
 */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { ajouterReserveIV, fabriquerSuivantReserveIV, retirerReserveIV, type IssueAjoutReserveIV, type IssueFabricationReserveIV } from "@/services/image-video-reserve";
import type { NatureReserveIV } from "@/domaine/image-video/reserve";

const CHEMIN = "/image-video/reserve";

export async function ajouterReserveIVAction(e: { nature: NatureReserveIV; texte: string; reseaux?: string[] }): Promise<Resultat<IssueAjoutReserveIV>> {
  const r = await essayer(() => ajouterReserveIV(e));
  revalidatePath(CHEMIN);
  return r;
}

export async function retirerReserveIVAction(id: string): Promise<Resultat<boolean>> {
  const r = await essayer(() => retirerReserveIV(id));
  revalidatePath(CHEMIN);
  return r;
}

export async function fabriquerSuivantReserveIVAction(): Promise<Resultat<IssueFabricationReserveIV>> {
  const r = await essayer(() => fabriquerSuivantReserveIV());
  revalidatePath(CHEMIN);
  return r;
}
