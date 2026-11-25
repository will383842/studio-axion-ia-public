"use server";

/** Action serveur de la vidéo longue (UI-3) : enveloppe du lancement, un Resultat sérialisable ; la session est vérifiée par le service. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { lancerVideoLongue, type DemandeVideoLongue, type IssueVideoLongue } from "@/services/video-longue-creation";

export async function lancerVideoLongueAction(demande: DemandeVideoLongue): Promise<Resultat<IssueVideoLongue>> {
  const r = await essayer(() => lancerVideoLongue(demande));
  if (r.ok && r.donnees.statut === "lancee") revalidatePath("/videos");
  return r;
}
