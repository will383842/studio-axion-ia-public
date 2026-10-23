"use server";
/** Réglages › Plafond d'un sujet (Écrire). Session exigée. N'appelle aucun fournisseur : il écrit seulement le réglage. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirPlafondSujet } from "@/services/plafond-sujet";

/** `centimesUsd` : centimes de dollar ENTIERS (150 = 1,50 $), de 50 à 500. */
export async function definirPlafondSujetAction(centimesUsd: unknown): Promise<Resultat<{ centimes: number }>> {
  await exigerSession();
  return essayer(async () => {
    const centimes = await definirPlafondSujet(centimesUsd);
    revalidatePath("/reglages");
    return { centimes };
  });
}
