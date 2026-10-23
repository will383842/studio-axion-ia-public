"use server";

/**
 * Actions serveur de Réglages → Sur le site (lot S1). Chacune commence par exigerSession() ; elles n'écrivent que
 * le réglage (éteint par défaut) : aucun envoi, aucun appel payant.
 */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirSiteAuto, definirSiteGenerateur } from "@/services/site-videos";

export async function definirSiteGenerateurAction(formatId: string, allume: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirSiteGenerateur(formatId, allume);
    revalidatePath("/reglages");
    return undefined;
  });
}

export async function definirSiteAutoAction(formatId: string, allume: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirSiteAuto(formatId, allume);
    revalidatePath("/reglages");
    return undefined;
  });
}
