"use server";

/**
 * Actions serveur des options payantes (lot J) : « Confirmer » / « Annuler » sur la carte (fil du monteur, « Votre
 * vidéo »), et l'estimation montrée dans Réglages avant d'allumer une option payante. Session vérifiée par le service.
 */
import { revalidatePath } from "next/cache";
import { estOptionPayante, type IdOptionPayante } from "@/briques/options-payantes";
import { essayer, ErreurStudio, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { annulerOptionPayante, carteReglages, confirmerOptionPayante } from "@/services/options-payantes";

function rafraichir(videoId?: string) {
  revalidatePath("/videos");
  if (videoId) revalidatePath(`/videos/${videoId}`);
}

export async function confirmerOptionPayanteAction(jeton: string, videoId?: string): Promise<Resultat<{ travailId: string }>> {
  const r = await essayer(async () => {
    if (typeof jeton !== "string" || jeton.length < 16 || jeton.length > 200) throw new ErreurStudio("INTROUVABLE", "Cette demande n'existe plus.");
    const v = await confirmerOptionPayante(jeton);
    return { travailId: v.travailId };
  });
  rafraichir(videoId);
  return r;
}

export async function annulerOptionPayanteAction(jeton: string, videoId?: string): Promise<Resultat<null>> {
  const r = await essayer(async () => {
    if (typeof jeton !== "string" || jeton.length < 16 || jeton.length > 200) throw new ErreurStudio("INTROUVABLE", "Cette demande n'existe plus.");
    await annulerOptionPayante(jeton);
    return null;
  });
  rafraichir(videoId);
  return r;
}

/** Réglages : la phrase de la carte avant d'allumer une option payante (vidéo type d'une minute). */
export async function carteReglagesAction(optionId: IdOptionPayante): Promise<Resultat<{ phrase: string } | { plafond: string }>> {
  await exigerSession();
  return essayer(async () => {
    if (!estOptionPayante(optionId)) throw new ErreurStudio("INTROUVABLE", "Option inconnue.");
    return carteReglages(optionId, { dureeSec: 60 });
  });
}
