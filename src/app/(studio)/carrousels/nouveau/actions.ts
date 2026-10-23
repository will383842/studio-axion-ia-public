"use server";

/** Création d'un carrousel (sujet ou texte écrit en session). Le rendu part après la réponse. */
import { after } from "next/server";
import { redirect } from "next/navigation";
import { verifierDepotTexte } from "@/domaine/visuels/depot";
import { exigerSession } from "@/services/auth";
import { creerDepuisSujet, deposerSession, lancerRendu } from "@/visuels/services/carrousels";
import { codeErreur, dependancesCarrousels } from "@/visuels/services/production";

export async function creerCarrouselAction(donnees: FormData): Promise<void> {
  await exigerSession();
  const deps = dependancesCarrousels();
  const type = donnees.get("type");
  let id: string | undefined;
  let erreur: string | undefined;
  try {
    if (type === "sujet") {
      const sujet = donnees.get("sujet");
      id = (await creerDepuisSujet(typeof sujet === "string" ? sujet : "", deps)).id;
    } else if (type === "paquet-session") {
      const contenu = donnees.get("contenu");
      if (typeof contenu !== "string" || !verifierDepotTexte(contenu).ok) erreur = "PAQUET_INVALIDE";
      else id = (await deposerSession(contenu, deps)).id;
    } else {
      erreur = "INCONNUE";
    }
  } catch (e) {
    erreur = codeErreur(e);
  }
  // `redirect` lève une exception : appelé hors du try.
  if (!id) redirect(`/carrousels/nouveau?erreur=${erreur ?? "INCONNUE"}`);
  const aRendre = id;
  after(async () => {
    try {
      await lancerRendu(aRendre, dependancesCarrousels());
    } catch {
      // Un brouillon bloqué par la porte ne se rend pas : la fiche l'explique.
    }
  });
  redirect(`/carrousels/${encodeURIComponent(id)}`);
}
