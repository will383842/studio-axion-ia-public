"use server";
/** Réglages › Mes réseaux : l'interrupteur de la page « À publier ». Session exigée ; n'écrit que le réglage. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirPageAPublier } from "@/services/a-publier";

export async function definirPageAPublierAction(valeur: unknown): Promise<Resultat<{ valeur: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    const v = await definirPageAPublier(valeur);
    revalidatePath("/reglages");
    revalidatePath("/", "layout");
    return { valeur: v };
  });
}
