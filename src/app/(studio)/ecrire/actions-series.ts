"use server";

/** Équipe 7 : séries reconnaissables (Écrire › Séries, atelier). Chaque action commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { creerSerie, rattacherSujet } from "@/services/series";

export async function creerSerieAction(nom: string): Promise<Resultat<{ id: string; nom: string }>> {
  await exigerSession();
  return essayer(async () => {
    const s = await creerSerie(nom);
    revalidatePath("/ecrire");
    revalidatePath("/ecrire/atelier");
    return { id: s.id, nom: s.nom };
  });
}

export async function rattacherSujetAction(sujetId: string, serieId: string | null): Promise<Resultat<{ episode?: number }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await rattacherSujet(sujetId, serieId);
    revalidatePath("/ecrire");
    revalidatePath(`/ecrire/sujets/${sujetId}`);
    return r;
  });
}
