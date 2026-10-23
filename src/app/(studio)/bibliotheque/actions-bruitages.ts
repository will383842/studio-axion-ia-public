"use server";

/**
 * Actions serveur des BRUITAGES (lot du 02/10, D1) : écoute et validation par Will. Chacune commence par exigerSession().
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { changerEcouteBruitage } from "@/services/bruitages";
import { essayer, type Resultat } from "@/services/_commun";

/** « Valider » (le son pourra être posé) ou « Retirer » (il redevient à écouter). Jamais effacé. */
export async function ecouteBruitageAction(elementId: string, ecoute: "validee" | "a_verifier"): Promise<Resultat<undefined>> {
  await exigerSession();
  return essayer(async () => {
    await changerEcouteBruitage(elementId, ecoute === "validee" ? "validee" : "a_verifier");
    revalidatePath("/bibliotheque/bruitage");
    return undefined;
  });
}
