"use server";

/**
 * Action serveur du calendrier (RAP-3 finitions) : retirer du calendrier les publications reprises du diffuseur qu'il ne retrouve plus
 * (« à vérifier »). Geste LOCAL : il pose `retireeLe`, n'efface rien, n'écrit rien chez le diffuseur. Session exigée, sous verrou.
 */
import { revalidatePath } from "next/cache";
import { depots, essayer, ErreurStudio, maintenant, sousVerrou, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { retirerLesRapatrieesIntrouvables } from "@/services/retirer-rapatriee";

export async function retirerIntrouvablesAction(): Promise<Resultat<{ retirees: number; message: string }>> {
  await exigerSession();
  return essayer(() =>
    sousVerrou(async () => {
      const d = depots();
      const { retirees } = await retirerLesRapatrieesIntrouvables({ lister: () => d.publications.lister(() => true), ecrire: async (id, modif) => void (await d.publications.modifier(id, modif)), maintenant });
      if (retirees === 0) throw new ErreurStudio("RIEN_A_RETIRER", "Aucune publication introuvable à retirer. Rechargez la page.");
      revalidatePath("/calendrier");
      return { retirees, message: `C'est fait : ${retirees} publication${retirees > 1 ? "s" : ""} retirée${retirees > 1 ? "s" : ""} du calendrier. Rien n'est supprimé ni changé chez le diffuseur.` };
    }),
  );
}
