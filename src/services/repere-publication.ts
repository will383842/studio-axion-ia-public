/**
 * Repère et signature de l'usine, recopiés du créneau de la commande jusqu'à la publication (lecture seule : rien n'est écrit, aucun appel réel).
 * Une publication est « née d'une commande » quand un créneau `cmd-<clé>` porte la même vidéo et a une heure pour son réseau.
 */
import "server-only";
import type { Depots } from "@/domaine/depots";
import type { RepereDePublication } from "@/domaine/releve-usine";
import type { Publication } from "@/domaine/types";
import { depots as depotsDuStudio } from "@/donnees/memoire";

type LectureDepots = Pick<Depots, "creneauxEditoriaux" | "videos" | "scriptsMaitres">;

/** { commande_id, repere, signature }, ou null pour une publication hors usine (aucun repère inventé). */
export async function repereDePublication(pub: Pick<Publication, "videoId" | "reseau">, d: LectureDepots = depotsDuStudio()): Promise<RepereDePublication | null> {
  if (!pub.videoId) return null;
  const creneaux = await d.creneauxEditoriaux.lister((c) => c.id.startsWith("cmd-") && c.videoId === pub.videoId && Boolean(c.heuresParReseau[pub.reseau]));
  const creneau = creneaux.sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!creneau) return null;
  let signature = creneau.signatureUsine || null;
  if (!signature) {
    const video = await d.videos.obtenir(pub.videoId);
    const script = video?.scriptId ? await d.scriptsMaitres.obtenir(video.scriptId) : undefined;
    signature = script?.origineUsine?.signature || null;
  }
  return { commande_id: creneau.id, repere: creneau.repereUsine ?? null, signature };
}
