"use server";

/** Action serveur du document promis : la validation seule. Rien n'est envoyé. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { corrigerDocument, validerDocument } from "@/services/cas-concret-document";

export async function validerDocumentAction(videoId: string): Promise<Resultat<{ valideLe: string }>> {
  const r = await essayer(() => validerDocument(videoId));
  if (r.ok) {
    revalidatePath(`/cas-concret/document/${videoId}`);
    revalidatePath(`/videos/${videoId}`);
  }
  return r;
}

/** « Enregistrer mes corrections » : le document redevient un brouillon à valider. */
export async function corrigerDocumentAction(videoId: string, texte: string): Promise<Resultat<{ etat: "brouillon" }>> {
  const r = await essayer(() => corrigerDocument(videoId, texte));
  if (r.ok) {
    revalidatePath(`/cas-concret/document/${videoId}`);
    revalidatePath(`/videos/${videoId}`);
  }
  return r as Resultat<{ etat: "brouillon" }>;
}
