/** Payé et simulé d'UNE vidéo (fiche vidéo, E2E-2 argent n° 6 et 7). Lecture seule. */
import "server-only";
import { depots } from "@/donnees/memoire";
import type { Id, Montant } from "@/domaine/types";
import { additionner } from "@/lib/montants";
import { exigerSession } from "./auth";
import { montantPaye, montantSimule } from "./couts";

export async function coutsDeLaVideo(videoId: Id): Promise<{ paye: Montant; essai: Montant; nbDepenses: number }> {
  await exigerSession();
  const deps = await depots().depenses.lister((d) => d.videoId === videoId);
  return { paye: additionner(...deps.map(montantPaye)), essai: additionner(...deps.map(montantSimule)), nbDepenses: deps.length };
}
