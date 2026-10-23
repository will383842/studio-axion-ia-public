"use server";

/**
 * Actions serveur PARTAGÉES (accueil, cartes de travaux). Chaque action commence par exigerSession().
 * Les écrans appellent des actions ; les actions appellent les services ; jamais l'inverse.
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { ajouterIdee } from "@/services/idees";
import { reessayerTravail } from "@/services/travaux";
import { accordPropre, type AccordPrix } from "@/domaine/accord";

/** « Réessayer » : `confirme` vient de l'écran (relance plus chère que d'habitude, CORRECTEUR 1 — B5). */
export async function reessayerTravailAction(travailId: string, confirme?: AccordPrix): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    const t = await reessayerTravail(travailId, { confirme: accordPropre(confirme) });
    revalidatePath("/");
    return { id: t.id };
  });
}

export async function ajouterIdeeAction(texte: string): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    const i = await ajouterIdee(texte);
    revalidatePath("/ecrire");
    return { id: i.id };
  });
}
