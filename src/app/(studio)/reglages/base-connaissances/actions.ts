"use server";
/** Réglages › Base de connaissances : interrupteur « Le comité lit les idées de l'usine ». Session exigée. N'appelle jamais l'usine. */
import { revalidatePath } from "next/cache";
import { ecrireParametre, essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { REGLAGE_SOURCE_USINE } from "@/services/branchement-idees-usine";

export async function definirSourceUsineAction(valeur: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (typeof valeur !== "boolean") throw new Error("valeur inconnue");
    await ecrireParametre(REGLAGE_SOURCE_USINE, valeur);
    revalidatePath("/reglages/base-connaissances");
    return undefined;
  });
}

/** Version formulaire de la page (boutons Allumer / Éteindre). */
export async function basculerSourceUsineFormulaire(donnees: FormData): Promise<void> {
  await definirSourceUsineAction(donnees.get("valeur") === "oui");
}
