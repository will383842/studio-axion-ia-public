"use server";

/** Action serveur de l'import d'une vidéo déjà faite (page « À publier »). Le fichier est déjà arrivé (`envoyerFichier`) : seul son identifiant part ici. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { importerVideoExterne, type DonneesImportVideo } from "@/services/import-video-externe";

export async function importerVideoAction(donnees: DonneesImportVideo): Promise<Resultat<{ videoId: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await importerVideoExterne(donnees);
    revalidatePath("/a-publier");
    return r;
  });
}
