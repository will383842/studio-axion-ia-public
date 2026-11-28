"use server";
/** Réglages › Pinterest : ouvrir ou fermer l'envoi. Session exigée. N'appelle aucun fournisseur. */
import { revalidatePath } from "next/cache";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirPinterestActif } from "@/services/pinterest-zernio";

/** Seul le booléen exact est accepté (`true` ouvre). */
export async function definirPinterestActifAction(allume: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (allume !== true && allume !== false) throw new ErreurStudio("CHOIX_INCONNU", "Ce choix n'existe pas.");
    await definirPinterestActif(allume);
    revalidatePath("/reglages");
    return undefined;
  });
}
