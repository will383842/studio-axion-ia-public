"use server";

/**
 * C3-UT-3.10b-b : actions serveur de l'écran des extraits (archive). Minces : session, contrôle des arguments,
 * appel du geste du service (qui décide, journalise et ne supprime rien), puis rafraîchissement si le geste a réussi.
 * Aucune page ne les appelle encore (c'est 3.10b-d) ; aucun réglage n'est lu ici.
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { cocherVideo, ecarterPlage, rangerSource, retablirPlage, validerPlage, type ResultatGeste } from "@/services/archive-extraits";

const CHEMIN = "/bibliotheque/source-extraits";
const REFUS_TEXTE: ResultatGeste = { ok: false, message: "Demande incomplète : la vidéo et l'extrait doivent être indiqués." };
const REFUS_BOOLEEN: ResultatGeste = { ok: false, message: "Demande incomplète : la vidéo et le choix (oui ou non) doivent être indiqués." };

const texteNonVide = (x: unknown): x is string => typeof x === "string" && x.trim() !== "";

async function rafraichirSiOk(r: ResultatGeste): Promise<ResultatGeste> {
  if (r.ok) revalidatePath(CHEMIN);
  return r;
}

export async function ecarterPlageAction(videoId: string, plageId: string): Promise<ResultatGeste> {
  await exigerSession();
  if (!texteNonVide(videoId) || !texteNonVide(plageId)) return REFUS_TEXTE;
  return rafraichirSiOk(await ecarterPlage(videoId, plageId));
}

export async function retablirPlageAction(videoId: string, plageId: string): Promise<ResultatGeste> {
  await exigerSession();
  if (!texteNonVide(videoId) || !texteNonVide(plageId)) return REFUS_TEXTE;
  return rafraichirSiOk(await retablirPlage(videoId, plageId));
}

export async function validerPlageAction(videoId: string, plageId: string): Promise<ResultatGeste> {
  await exigerSession();
  if (!texteNonVide(videoId) || !texteNonVide(plageId)) return REFUS_TEXTE;
  return rafraichirSiOk(await validerPlage(videoId, plageId));
}

export async function rangerSourceAction(videoId: string, rangee: boolean): Promise<ResultatGeste> {
  await exigerSession();
  if (!texteNonVide(videoId) || typeof rangee !== "boolean") return REFUS_BOOLEEN;
  return rafraichirSiOk(await rangerSource(videoId, rangee));
}

export async function cocherVideoAction(videoId: string, cochee: boolean): Promise<ResultatGeste> {
  await exigerSession();
  if (!texteNonVide(videoId) || typeof cochee !== "boolean") return REFUS_BOOLEEN;
  return rafraichirSiOk(await cocherVideo(videoId, cochee));
}
