"use server";
/** Réglages › Sujets déjà traités. Session exigée. N'appelle aucun fournisseur : il écrit seulement le réglage. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirGardeSujets } from "@/services/reglage-garde-sujets";
import type { GardeSujets } from "@/domaine/sujets-traites";

export async function definirGardeSujetsAction(valeur: unknown): Promise<Resultat<{ garde: GardeSujets }>> {
  await exigerSession();
  return essayer(async () => {
    const garde = await definirGardeSujets(valeur);
    revalidatePath("/reglages");
    return { garde };
  });
}
