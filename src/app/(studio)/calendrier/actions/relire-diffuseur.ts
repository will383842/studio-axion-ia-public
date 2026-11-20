"use server";

/**
 * Action serveur du calendrier (RAP-2) : relire le diffuseur. Chaque action commence par exigerSession().
 * Fichier propre à ce geste : actions.ts ne garde que les deux actions de la fiche d'entrée.
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { synchroniserEtatsZernio } from "@/services/zernio";

/**
 * RAP-2 · « Relire le diffuseur » : un passage de synchronisation forcé et complet, DANS le processus du serveur (les dépôts y vivent en
 * mémoire : un script à part les désynchroniserait). Lecture seule chez le diffuseur ; la seule écriture est locale (publications rapatriées
 * et mesure de l'écart). Réglages d'envoi non concernés.
 */
export async function relireDiffuseurAction(): Promise<Resultat<{ lues: number; changees: number }>> {
  await exigerSession();
  const r = await essayer(() => synchroniserEtatsZernio({ force: true, complet: true }));
  if (r.ok) revalidatePath("/calendrier");
  return r;
}
