"use server";
/** Réglages › Écriture des scripts. Session exigée. N'appelle aucun fournisseur : il écrit seulement le réglage. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirChaineEcriture, type ChaineChoisie } from "@/services/chaine-ecriture";

export async function definirChaineEcritureAction(valeur: unknown): Promise<Resultat<{ chaine: ChaineChoisie }>> {
  await exigerSession();
  return essayer(async () => {
    const chaine = await definirChaineEcriture(valeur);
    revalidatePath("/reglages");
    return { chaine };
  });
}
