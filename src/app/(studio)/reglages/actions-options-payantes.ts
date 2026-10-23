"use server";

/**
 * Vérif V4 : interrupteur « Couper toutes les options payantes » (Réglages › Budget). Session exigée. N'appelle aucun
 * fournisseur : il écrit seulement le réglage. Coupé : aucune carte payante proposée, rien ne part.
 */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirOptionsPayantesCoupees } from "@/services/options-payantes";

export async function definirOptionsPayantesCoupeesAction(coupees: boolean): Promise<Resultat<{ coupees: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await definirOptionsPayantesCoupees(coupees === true);
    revalidatePath("/reglages");
    revalidatePath("/videos");
    return { coupees: r };
  });
}
