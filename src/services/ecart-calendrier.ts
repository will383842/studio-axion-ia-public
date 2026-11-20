import "server-only";
/** RAP-3 · lecture LOCALE de la mesure de l'écart calendrier / diffuseur (écrite par la synchro). Aucun appel réseau ; ne lève jamais. */
import { depots } from "@/services/_commun";
import { PARAM_ECART_CALENDRIER, type EcartCalendrier } from "@/services/zernio";

export async function lireEcartCalendrier(): Promise<EcartCalendrier | null> {
  try {
    const v = (await depots().parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as Partial<EcartCalendrier> | undefined;
    if (!v || typeof v.luLe !== "string" || typeof v.verifie !== "boolean" || typeof v.absents !== "number") return null;
    return { luLe: v.luLe, verifie: v.verifie, chezDiffuseur: Number(v.chezDiffuseur) || 0, absents: v.absents, exemples: Array.isArray(v.exemples) ? v.exemples : [] };
  } catch {
    return null;
  }
}
