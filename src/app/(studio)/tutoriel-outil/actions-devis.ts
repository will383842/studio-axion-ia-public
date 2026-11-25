"use server";

/**
 * AUD-7 : action serveur du geste « accepter le devis » (fichier à part : actions.ts n'est pas touché). Même garde que les autres
 * gestes du tutoriel : éteint, refus et rien n'est écrit. Aucun appel payant.
 */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerTutorielAllume } from "@/services/tutoriel-depot";
import { accepterDevis, type IssueDevis } from "@/services/tutoriel-devis";

export async function accepterDevisAction(videoId: string, empreinteVue: string): Promise<Resultat<IssueDevis>> {
  const r = await essayer(async () => {
    await exigerTutorielAllume();
    return accepterDevis(videoId, empreinteVue);
  });
  if (r.ok && r.donnees.statut === "ok") {
    revalidatePath(`/tutoriel-outil/${videoId}`);
    revalidatePath(`/tutoriel-outil/suivi/${videoId}`);
  }
  return r;
}
