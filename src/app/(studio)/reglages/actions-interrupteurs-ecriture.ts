"use server";
/** Réglages › Écriture des scripts : les 4 interrupteurs. Session exigée. N'appelle aucun fournisseur : il écrit seulement le réglage. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirInterrupteurEcriture, type CleInterrupteurEcriture } from "@/services/interrupteurs-ecriture";

export async function definirInterrupteurEcritureAction(cle: unknown, valeur: unknown): Promise<Resultat<{ cle: CleInterrupteurEcriture; valeur: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await definirInterrupteurEcriture(cle, valeur);
    revalidatePath("/reglages");
    return r;
  });
}
