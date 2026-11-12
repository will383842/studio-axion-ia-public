"use server";

/** Geste « Ranger » d'un carrousel ou d'une image sans réseau. Session exigée ; seuls l'identifiant et le réseau sont lus. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigerSession } from "@/services/auth";
import { rangerContenu } from "@/services/rangement-contenus";
import { dependancesCarrousels, lireIdFormulaire } from "@/visuels/services/production";

export async function rangerContenuAction(donnees: FormData): Promise<void> {
  await exigerSession();
  const id = lireIdFormulaire(donnees);
  const reseau = donnees.get("reseau");
  let retour = "/contenus/a-ranger?erreur=INTROUVABLE";
  if (id && typeof reseau === "string") {
    try {
      const { depot, verrou } = dependancesCarrousels();
      const r = await rangerContenu(id, reseau, { depot, verrou });
      retour = r.ok ? "/contenus/a-ranger?range=1" : `/contenus/a-ranger?erreur=${r.code}`;
    } catch {
      retour = "/contenus/a-ranger?erreur=INCONNUE";
    }
  }
  revalidatePath("/contenus/a-ranger");
  revalidatePath("/contenus");
  redirect(retour);
}
