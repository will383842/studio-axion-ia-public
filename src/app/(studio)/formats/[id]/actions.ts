"use server";

import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { noterMePrevenir } from "@/services/reglages";

/** « Me prévenir » quand un format « bientôt » devient disponible. */
export async function mePrevenirAction(formatId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await noterMePrevenir(formatId);
    revalidatePath(`/formats/${formatId}`);
    return undefined;
  });
}
