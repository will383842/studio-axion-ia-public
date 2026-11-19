"use server";

/**
 * G3-06a-b : lancement de la démo facecam au prix lu, accord exigé, derrière `demoFacecam.envoi` (éteint par défaut).
 * Volontairement À CÔTÉ de `actions.ts` (sa garde statique y interdit l'argent). Rien ne l'appelle encore (écran : G3-06b).
 * Éteint : aucun prix lu, rien de lancé. Jamais de lancement sans un accord ≥ prix (`lancerAvecAccord`). Aucune lecture de réglage ici.
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { depots, essayer, type Resultat } from "@/services/_commun";
import { lancerAvecAccord } from "@/services/creation-format";
import { apercuFabrication } from "@/services/fabrication";
import { libellePrixDemo, type IssueLancementDemo } from "@/domaine/demo-facecam/prix";
import { demoFacecamOuverte } from "./actions";

export async function lancerDemoFacecam(videoId: string, accordCentimes: unknown): Promise<Resultat<IssueLancementDemo>> {
  if (!(await demoFacecamOuverte())) return { ok: false, message: "La démo facecam n'est pas encore ouverte.", code: "DEMO_FERMEE" };
  await exigerSession();
  const video = typeof videoId === "string" ? await depots().videos.obtenir(videoId) : null;
  if (video?.formatId !== "demo-facecam") return { ok: false, code: "PAS_UNE_DEMO", message: "Cette vidéo n'est pas une démo facecam." };
  return essayer(async () => {
    const montant = (await apercuFabrication(videoId)).estimation.total.centimes;
    const issue = await lancerAvecAccord(videoId, accordCentimes, montant);
    if (issue.statut === "lancee") revalidatePath("/videos");
    return issue.statut === "accord-requis" ? { ...issue, prix: libellePrixDemo(issue.centimes) } : issue;
  });
}
