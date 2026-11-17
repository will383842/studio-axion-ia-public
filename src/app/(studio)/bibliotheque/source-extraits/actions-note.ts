"use server";

/**
 * X4-12b : actions serveur des gestes de la note (garder quand même, changer le sujet, chiffres réels).
 * Minces : session avant toute lecture, contrôle des arguments, appel du geste du service (qui décide et journalise,
 * sans rien supprimer), puis rafraîchissement seulement si le geste a réussi.
 * Fichier à part pour laisser `actions.ts` inchangé (garde P-7). Rien ne l'importe encore (X4-12d) ; aucun réglage lu.
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import type { ResultatGeste } from "@/services/archive-extraits";
import { changerSujetExtrait, garderQuandMemeExtrait, marquerChiffresReelsVideo } from "@/services/gestes-note-extraits";

const CHEMIN = "/bibliotheque/source-extraits";
const REFUS_TEXTE: ResultatGeste = { ok: false, message: "Demande incomplète : la vidéo et l'extrait doivent être indiqués." };
const REFUS_BOOLEEN: ResultatGeste = { ok: false, message: "Demande incomplète : la vidéo et le choix (oui ou non) doivent être indiqués." };
const REFUS_SUJET: ResultatGeste = { ok: false, message: "Demande incomplète : la vidéo, l'extrait et le sujet doivent être indiqués." };

const texteNonVide = (x: unknown): x is string => typeof x === "string" && x.trim() !== "";

async function rafraichirSiOk(r: ResultatGeste): Promise<ResultatGeste> {
  if (r.ok) revalidatePath(CHEMIN);
  return r;
}

export async function garderQuandMemeAction(videoId: string, plageId: string): Promise<ResultatGeste> {
  await exigerSession();
  if (!texteNonVide(videoId) || !texteNonVide(plageId)) return REFUS_TEXTE;
  return rafraichirSiOk(await garderQuandMemeExtrait(videoId, plageId));
}

export async function changerSujetAction(videoId: string, plageId: string, sujet: string): Promise<ResultatGeste> {
  await exigerSession();
  if (!texteNonVide(videoId) || !texteNonVide(plageId) || !texteNonVide(sujet)) return REFUS_SUJET;
  return rafraichirSiOk(await changerSujetExtrait(videoId, plageId, sujet));
}

export async function marquerChiffresReelsAction(videoId: string, oui: boolean): Promise<ResultatGeste> {
  await exigerSession();
  if (!texteNonVide(videoId) || typeof oui !== "boolean") return REFUS_BOOLEEN;
  return rafraichirSiOk(await marquerChiffresReelsVideo(videoId, oui));
}
