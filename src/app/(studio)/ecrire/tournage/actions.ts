"use server";

/** Actions du tournage (lot G4c). Chacune commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { creerSeance, enregistrerPrise, priseRatee } from "@/services/tournage";

function rafraichir(seanceId?: string) {
  revalidatePath("/ecrire/tournage");
  if (seanceId) revalidatePath(`/ecrire/tournage/${seanceId}`);
  revalidatePath("/ecrire");
  revalidatePath("/videos");
}

export async function creerSeanceAction(varianteIds: string[]): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    const s = await creerSeance(varianteIds);
    rafraichir(s.id);
    return { id: s.id };
  });
}

/** La prise est arrivée (fichier enregistré) : elle est rangée sous son code, sans autre geste. */
export async function enregistrerPriseAction(seanceId: string, varianteId: string, fichierId: string, dureeSec: number): Promise<Resultat<{ nom: string; suivanteId: string | null }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await enregistrerPrise({ seanceId, varianteId, fichierId, dureeSec });
    rafraichir(seanceId);
    return { nom: r.nom, suivanteId: r.suivanteId };
  });
}

export async function priseRateeAction(seanceId: string, varianteId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await priseRatee(seanceId, varianteId);
    rafraichir(seanceId);
    return undefined;
  });
}
