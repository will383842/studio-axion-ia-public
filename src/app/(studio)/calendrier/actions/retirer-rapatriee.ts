"use server";

/**
 * Action serveur du calendrier (RAP-3) : retirer du calendrier une publication reprise du diffuseur. Geste LOCAL : il pose `retireeLe`.
 * Aucun appel d'écriture au diffuseur, jamais d'effacement. Session exigée.
 */
import { revalidatePath } from "next/cache";
import { depots, essayer, ErreurStudio, maintenant, sousVerrou, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { retirerRapatrieeDuCalendrier } from "@/services/retirer-rapatriee";

export async function retirerRapatrieeAction(publicationId: string): Promise<Resultat<{ message: string }>> {
  await exigerSession();
  return essayer(() =>
    sousVerrou(async () => {
      const d = depots();
      const r = await retirerRapatrieeDuCalendrier({ publication: (id) => d.publications.obtenir(id), ecrire: async (id, modif) => void (await d.publications.modifier(id, modif)), maintenant }, String(publicationId ?? ""));
      if (!r.ok) throw new ErreurStudio("RETRAIT_REFUSE", r.message);
      revalidatePath("/calendrier");
      return { message: r.message };
    }),
  );
}
