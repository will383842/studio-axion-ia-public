"use server";

/** Actions de la liste des carrousels : restaurer depuis la corbeille. Session exigée ; seul l'identifiant est lu. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigerSession } from "@/services/auth";
import { restaurer } from "@/visuels/services/corbeille";
import { codeErreur, dependancesCarrousels, lireIdFormulaire } from "@/visuels/services/production";

export async function restaurerDepuisListeAction(donnees: FormData): Promise<void> {
  await exigerSession();
  const id = lireIdFormulaire(donnees);
  let erreur: string | undefined;
  try {
    if (!id) erreur = "INTROUVABLE";
    else if ((await restaurer([id], dependancesCarrousels())).restaurees === 0) erreur = "INTROUVABLE";
  } catch (e) {
    erreur = codeErreur(e);
  }
  revalidatePath("/carrousels");
  redirect(erreur ? `/carrousels?vue=corbeille&erreur=${erreur}` : "/carrousels?vue=tous");
}
