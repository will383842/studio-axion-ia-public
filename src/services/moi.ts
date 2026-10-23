/** TEST-UI-REEL U1 (CORRECTEUR FINAL A) : le « Moi » de Will, lu en base (voir `@/domaine/moi`). */
import "server-only";
import { choisirMoi } from "@/domaine/moi";
import type { Personnage } from "@/domaine/types";
import { depots, lireParametre } from "./_commun";

/** Le « Moi » à utiliser : le vrai d'abord ; celui d'exemple seulement si les exemples sont affichés. */
export async function trouverMoi(): Promise<Personnage | null> {
  const afficher = await lireParametre("afficherExemples", true);
  return choisirMoi(await depots().personnages.lister((p) => p.nature === "moi"), (p) => p, afficher) ?? null;
}
