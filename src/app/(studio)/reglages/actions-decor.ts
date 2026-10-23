"use server";

/**
 * Actions serveur du bloc « Décor IA » de Réglages (lot L10). Chacune commence par exigerSession().
 * Aucune n'appelle Higgsfield : elles ne font qu'écrire le réglage (option coupée par défaut).
 */
import { revalidatePath } from "next/cache";
import { MESSAGE_OPTION_RETIREE, optionRetiree } from "@/briques/options-payantes";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirReglageDecorIa, type ReglageDecorIa } from "@/services/decor-ia";

export async function definirDecorIaAction(changement: Pick<Partial<ReglageDecorIa>, "actif" | "description">, options: { confirme?: boolean } = {}): Promise<Resultat<ReglageDecorIa>> {
  await exigerSession();
  return essayer(async () => {
    // Lot J : option payante : on ne l'allume qu'après « Confirmer » sur la carte (vérifié ici, pas seulement à l'écran).
    // Vérif V4 (règle de Will) : le Décor IA est retiré, il ne s'allume plus, même confirmé.
    if (changement.actif === true && optionRetiree("decor-ia")) throw new ErreurStudio("REFUSE", MESSAGE_OPTION_RETIREE);
    if (changement.actif === true && options.confirme !== true) throw new ErreurStudio("CONFIRMATION_REQUISE", "Option payante : confirmez d'abord sur la carte.");
    const r = await definirReglageDecorIa({
      ...(typeof changement.actif === "boolean" ? { actif: changement.actif } : {}),
      ...(typeof changement.description === "string" ? { description: changement.description } : {}),
    });
    revalidatePath("/reglages");
    return r;
  });
}
