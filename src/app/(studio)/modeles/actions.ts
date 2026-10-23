"use server";

/** Actions de « Mes modèles » (B.8 #12b). Chaque action commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { renommerModele, archiverModele, restaurerModele } from "@/services/modeles";
import { enregistrerCommeModele } from "@/services/videos";

export async function renommerModeleAction(id: string, nom: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await renommerModele(id, nom.trim());
    revalidatePath("/modeles");
    return undefined;
  });
}

export async function archiverModeleAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await archiverModele(id);
    revalidatePath("/modeles");
    revalidatePath("/nouvelle");
    return undefined;
  });
}

export async function restaurerModeleAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await restaurerModele(id);
    revalidatePath("/modeles");
    revalidatePath("/nouvelle");
    return undefined;
  });
}

export async function creerModeleAction(videoId: string, nom: string): Promise<Resultat<string>> {
  await exigerSession();
  return essayer(async () => {
    const id = await enregistrerCommeModele(videoId, nom.trim());
    revalidatePath("/modeles");
    revalidatePath("/nouvelle");
    return id;
  });
}
