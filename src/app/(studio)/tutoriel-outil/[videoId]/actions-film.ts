"use server";

/**
 * AUD-4 · Action serveur du dépôt manuel du film de navigation (fichier neuf : `../actions.ts` n'est pas touché).
 * Même garde que toutes les actions du tutoriel : éteint, refus et rien n'est écrit. Aucun appel payant.
 */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerTutorielAllume } from "@/services/tutoriel-depot";
import { deposerFilmNavigation, type IssueFilm } from "@/services/tutoriel-film";

export async function deposerFilmAction(videoId: string, demande: { fichierId: string; navigation?: string }): Promise<Resultat<IssueFilm>> {
  const r = await essayer(async () => {
    await exigerTutorielAllume();
    return deposerFilmNavigation(videoId, demande);
  });
  if (r.ok && r.donnees.statut === "ok") revalidatePath(`/tutoriel-outil/${videoId}`);
  return r;
}
