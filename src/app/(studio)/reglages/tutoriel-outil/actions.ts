"use server";
/** Réglages › Tutoriel d'outil : un interrupteur à la fois, déclenché par un clic. Session exigée. N'appelle aucun fournisseur. */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { basculerReglage, enregistrerTexteMention, type ResultatConsole } from "@/services/tutoriel-console";

export async function basculerReglageTutoriel(cle: unknown, valeur: unknown): Promise<ResultatConsole> {
  await exigerSession();
  const r = await basculerReglage(cle, valeur);
  if (r.ok) revalidatePath("/reglages/tutoriel-outil");
  return r;
}

export async function enregistrerTexteMentionTutoriel(texte: unknown): Promise<ResultatConsole> {
  await exigerSession();
  const r = await enregistrerTexteMention(texte);
  if (r.ok) revalidatePath("/reglages/tutoriel-outil");
  return r;
}

/** Version formulaire : bouton Allumer / Éteindre. */
export async function basculerReglageFormulaire(donnees: FormData): Promise<void> {
  await basculerReglageTutoriel(donnees.get("cle"), donnees.get("valeur") === "oui");
}

/** Version formulaire : bouton « Enregistrer le texte ». */
export async function enregistrerTexteFormulaire(donnees: FormData): Promise<void> {
  await enregistrerTexteMentionTutoriel(donnees.get("texte"));
}
