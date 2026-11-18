"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LIBELLES_A_RELANCER } from "@/components/calendrier/ContenusARelancer";
import { exigerSession } from "@/services/auth";
import { creerNouvelleVersion, depsParDefaut } from "@/services/republication";

const PAGE = "/calendrier/a-relancer";
const MESSAGE_MAX = 300;

const champ = (f: FormData, nom: string): string => {
  const v = f.get(nom);
  return typeof v === "string" ? v : "";
};

/**
 * Crée UNE nouvelle version « à valider » dans le calendrier. Rien n'est envoyé ni programmé d'ici :
 * la validation reste un geste à part, dans le calendrier.
 */
export async function creerNouvelleVersionAction(formulaire: FormData): Promise<void> {
  await exigerSession();
  const demande = {
    publicationId: champ(formulaire, "publicationId"),
    jour: champ(formulaire, "jour"),
    heure: champ(formulaire, "heure"),
    texte: champ(formulaire, "texte"),
    compteCible: champ(formulaire, "compteCible"),
  };
  let message: string;
  if (!demande.publicationId || !demande.jour || !demande.heure || !demande.texte.trim()) {
    message = "Le formulaire est incomplet : indiquez le texte, le jour et l'heure.";
  } else {
    const resultat = await creerNouvelleVersion(depsParDefaut(), demande);
    message = resultat.ok
      ? resultat.deja
        ? "Une nouvelle version de ce contenu est déjà au calendrier, à valider. Rien n'est envoyé."
        : LIBELLES_A_RELANCER.succes
      : resultat.motifs.join(" ");
  }
  revalidatePath("/calendrier");
  revalidatePath(PAGE);
  redirect(`${PAGE}?message=${encodeURIComponent(message.slice(0, MESSAGE_MAX))}`);
}
