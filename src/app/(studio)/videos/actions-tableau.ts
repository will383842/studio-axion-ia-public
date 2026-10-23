"use server";

/**
 * Actions serveur de « Votre vidéo » du tableau animé (raccord 2) : les boutons de retouche. Même modèle que les
 * actions face caméra : un Resultat sérialisable, la session vérifiée par le service.
 */
import { revalidatePath } from "next/cache";
import type { AccordPrix } from "@/domaine/accord";
import { essayer, type Resultat } from "@/services/_commun";
import { retoucherTableau, type IssueRetoucheTableau } from "@/services/tableau-vue";

function rafraichir(videoId?: string) {
  revalidatePath("/videos");
  if (videoId) revalidatePath(`/videos/${videoId}`);
}

/** Une retouche par bouton ; payante : `accord` = le montant annoncé (centimes), sinon rien n'est lancé. */
export async function retoucherTableauAction(videoId: string, operation: unknown, accord?: AccordPrix): Promise<Resultat<IssueRetoucheTableau>> {
  const r = await essayer(() => retoucherTableau(videoId, operation, { accord }));
  if (r.ok && r.donnees.statut === "lancee") rafraichir(videoId);
  return r;
}
