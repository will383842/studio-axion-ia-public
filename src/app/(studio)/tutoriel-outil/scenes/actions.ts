"use server";

import { revalidatePath } from "next/cache";
import { ErreurStudio } from "@/services/_commun";
import { garder, retirer } from "@/services/scenes-gardees";

export type ResultatGeste = { ok: true } | { ok: false; message: string };

async function faire(f: () => Promise<void>): Promise<ResultatGeste> {
  try {
    await f();
    revalidatePath("/tutoriel-outil/scenes");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof ErreurStudio ? e.message : "Cela n'a pas abouti. Réessayez dans un instant." };
  }
}

/** « Retirer » : enveloppe de `retirerSceneGardee` (session exigée par le service). */
export async function retirerSceneAction(cle: string): Promise<ResultatGeste> {
  return faire(() => retirer(String(cle)));
}

/** « Garder pour d'autres vidéos » : enveloppe de `validerSceneGardee`. */
export async function garderSceneAction(cle: string): Promise<ResultatGeste> {
  return faire(() => garder(String(cle)));
}
