"use server";
/** Réglages › Carrousels : allume ou éteint un générateur. Session exigée. N'appelle aucun fournisseur. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirGenerateur, type FamilleVisuelle } from "@/visuels/interrupteur";

export async function definirGenerateurAction(famille: unknown, valeur: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (famille !== "carrousels" && famille !== "infographies") throw new Error("famille inconnue");
    if (typeof valeur !== "boolean") throw new Error("valeur inconnue");
    await definirGenerateur(famille as FamilleVisuelle, valeur);
    revalidatePath("/reglages/carrousels");
    return undefined;
  });
}

/** Version formulaire de la page (boutons Allumer / Éteindre). */
export async function basculerGenerateurFormulaire(donnees: FormData): Promise<void> {
  await definirGenerateurAction(donnees.get("famille"), donnees.get("valeur") === "oui");
}
