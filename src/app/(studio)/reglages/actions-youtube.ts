"use server";
/** Réglages › YouTube Shorts : enregistrer les 5 réglages, allumer ou éteindre l'envoi. Session exigée. N'appelle aucun fournisseur. */
import { revalidatePath } from "next/cache";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirReglagesYoutube, definirYoutubeActif } from "@/services/youtube-zernio";

export async function enregistrerReglagesYoutubeAction(reglages: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirReglagesYoutube(reglages);
    revalidatePath("/reglages");
    return undefined;
  });
}

/** Seul le booléen exact est accepté (`true` allume). `confirmerPublic` : seul `true` exact confirme (exigé si la visibilité enregistrée est « public »). */
export async function definirYoutubeActifAction(allume: unknown, confirmerPublic?: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    if (allume !== true && allume !== false) throw new ErreurStudio("CHOIX_INCONNU", "Ce choix n'existe pas.");
    await definirYoutubeActif(allume, confirmerPublic === true);
    revalidatePath("/reglages");
    return undefined;
  });
}
