"use server";

/**
 * Réglages > L'Usine en automatique (AUT-B). Une seule action : le fondateur allume ou éteint, et fixe le plafond du mois.
 * Commence par exigerSession(). Ne touche jamais au réglage directement : tout passe par `reglerAutonomieUsine`
 * (seul point d'écriture, AUT-A). Aucun montant par défaut.
 */
import { revalidatePath } from "next/cache";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { eteindreDepuisStudio, reglerAutonomieUsine } from "@/services/autonomie-usine";

export async function reglerAutonomieUsineAction(actif: boolean, plafondEuros: number): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (typeof actif !== "boolean") throw new ErreurStudio("CHAMP_INVALIDE", "L'interrupteur doit être allumé ou éteint.");
    if (typeof plafondEuros !== "number" || !Number.isFinite(plafondEuros) || plafondEuros < 0 || plafondEuros > 100_000) {
      throw new ErreurStudio("CHAMP_INVALIDE", "Indiquez un plafond du mois compris entre zéro et cent mille euros.");
    }
    const plafondCents = Math.round(plafondEuros * 100);
    await reglerAutonomieUsine({ actif, plafondCents });
    revalidatePath("/reglages");
    return undefined;
  });
}

/** Bouton d'urgence « Éteindre » quand l'Usine règle l'autonomie : éteint seulement, n'allume jamais. */
export async function eteindreAutonomieUsineAction(): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await eteindreDepuisStudio();
    revalidatePath("/reglages");
    return undefined;
  });
}
