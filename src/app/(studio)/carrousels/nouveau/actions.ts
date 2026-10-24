"use server";

/** Création d'un carrousel (sujet ou texte écrit en session). Le rendu part après la réponse. */
import { after } from "next/server";
import { redirect } from "next/navigation";
import type { EtatCreation } from "@/domaine/visuels/etat-creation";
import { exigerSession } from "@/services/auth";
import { lancerRendu } from "@/visuels/services/carrousels";
import { creerDepuisFormulaire } from "@/visuels/services/creation";
import { dependancesCarrousels } from "@/visuels/services/production";

/** Signature `useActionState` : en cas d'erreur, on rend l'état (phrases + texte saisi) et on reste sur le formulaire. */
export async function creerCarrouselAction(_etat: EtatCreation, donnees: FormData): Promise<EtatCreation> {
  await exigerSession();
  const r = await creerDepuisFormulaire(donnees, dependancesCarrousels());
  if (!("id" in r)) return r;
  const aRendre = r.id;
  after(async () => {
    try {
      await lancerRendu(aRendre, dependancesCarrousels());
    } catch {
      // Un brouillon bloqué par la porte ne se rend pas : la fiche l'explique.
    }
  });
  // `redirect` lève une exception : appelé en dernier.
  redirect(`/carrousels/${encodeURIComponent(aRendre)}`);
}
