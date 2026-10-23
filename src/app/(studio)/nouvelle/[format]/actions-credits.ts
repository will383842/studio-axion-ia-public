"use server";

/**
 * Actions serveur des CRÉDITS côté création (lot « crédits », 02/10, D2). Chacune commence par exigerSession().
 * - feuille « Crédit HeyGen insuffisant » de l'écran « Votre vidéo » : ce qui manque, version économique, brouillon gardé ;
 * - brouillons « lancer dès que possible » : lancés depuis l'Accueil quand le crédit le permet.
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { detailCreditVideo, garderEnAttente, lancerVideosEnAttente, type DetailCredit } from "@/services/credits";
import { accordPropre, type AccordPrix } from "@/domaine/accord";

export async function detailCreditAction(videoId: string): Promise<Resultat<DetailCredit>> {
  await exigerSession();
  return essayer(() => detailCreditVideo(String(videoId)));
}

/**
 * « Garder en brouillon » ; `lancerDesQuePossible` : elle partira seule après la recharge. `scriptRelu` : le repère
 * « script relu » de l'assistant (brique 6), repris par la relance.
 */
export async function garderEnAttenteAction(videoId: string, lancerDesQuePossible: boolean, fournisseur: string, confirme: AccordPrix, scriptRelu?: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await garderEnAttente(String(videoId), { lancerDesQuePossible: !!lancerDesQuePossible, fournisseur: String(fournisseur), confirme: accordPropre(confirme), ...(typeof scriptRelu === "string" && scriptRelu ? { scriptRelu } : {}) });
    revalidatePath("/");
    return undefined;
  });
}

/** Lance les brouillons « dès que possible » que le crédit permet (dans l'ordre d'arrivée). */
export async function lancerVideosEnAttenteAction(): Promise<Resultat<{ lancees: string[] }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await lancerVideosEnAttente();
    if (r.lancees.length) revalidatePath("/");
    return r;
  });
}
