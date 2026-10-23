"use server";

/** Action du lot G7b : « Mettre à jour les chiffres » (lecture seule chez Buffer et sur le site). Commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { importerMesures, type BilanImport } from "@/services/mesures-completes";

export async function importerMesuresAction(): Promise<Resultat<BilanImport>> {
  await exigerSession();
  return essayer(async () => {
    const r = await importerMesures();
    revalidatePath("/mesures/ce-qui-marche");
    revalidatePath("/mesures");
    return r;
  });
}
