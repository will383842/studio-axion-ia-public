"use server";
/** Réglages › Vidéo longue : l'interrupteur. Session exigée, booléen exact seulement. N'appelle aucun fournisseur. */
import { revalidatePath } from "next/cache";
import { ErreurStudio, essayer, journaliser, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { ecrireVideoLongueActif, lireVideoLongueActif } from "@/services/reglage-video-longue";

export async function definirVideoLongueActiveAction(valeur: unknown): Promise<Resultat<{ valeur: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    if (valeur !== true && valeur !== false) throw new ErreurStudio("CHOIX_INCONNU", "Ce choix n'existe pas.");
    if ((await lireVideoLongueActif()) !== valeur) {
      await ecrireVideoLongueActif(valeur);
      await journaliser("reglages", `Vidéo longue ${valeur ? "allumée" : "éteinte"}`);
    }
    revalidatePath("/reglages");
    revalidatePath("/videos/longue");
    return { valeur };
  });
}
