"use server";

/** Actions serveur de l'envoi face caméra depuis l'iPhone (plan facecam v4, lot D). */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { creerVersionFacecamDepuisTexte, recevoirVideoFacecam, type ResultatReception } from "@/services/envoi-facecam";

export async function recevoirVideoFacecamAction(varianteId: string, fichierId: string, dureeSec: number, demande?: string): Promise<Resultat<ResultatReception>> {
  const r = await essayer(() => recevoirVideoFacecam(varianteId, fichierId, dureeSec, demande));
  revalidatePath("/videos");
  revalidatePath("/");
  return r;
}

/** « J'ai déjà filmé ma vidéo » : le texte dit, tel quel, devient une version face caméra validée (aucun appel Claude). */
export async function creerVersionDejaFilmeeAction(texte?: string, titre?: string): Promise<Resultat<{ varianteId: string }>> {
  const r = await essayer(() => creerVersionFacecamDepuisTexte(texte, titre));
  if (r.ok) revalidatePath("/");
  return r;
}
