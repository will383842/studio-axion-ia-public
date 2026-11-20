import "server-only";
/** RAP-3 · lecture LOCALE de la mesure de l'écart calendrier / diffuseur (écrite par la synchro). Aucun appel réseau ; ne lève jamais. */
import { depots } from "@/services/_commun";
import { estRapatrieeIntrouvable } from "@/services/retirer-rapatriee";
import { PARAM_ECART_CALENDRIER, type EcartCalendrier } from "@/services/zernio";

/** Mesure de l'écart + nombre de rapatriées introuvables chez le diffuseur (comptage local, aucun appel réseau). */
export type EcartAffiche = EcartCalendrier & { introuvables?: number };

async function compterIntrouvables(): Promise<number> {
  try {
    return (await depots().publications.lister(estRapatrieeIntrouvable)).length;
  } catch {
    return 0;
  }
}

export async function lireEcartCalendrier(): Promise<EcartAffiche | null> {
  const introuvables = await compterIntrouvables();
  try {
    const v = (await depots().parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as Partial<EcartCalendrier> | undefined;
    if (!v || typeof v.luLe !== "string" || typeof v.verifie !== "boolean" || typeof v.absents !== "number") {
      // Mesure absente : rien à dire sur l'écart, mais les introuvables se voient quand même.
      return introuvables > 0 ? { luLe: new Date().toISOString(), verifie: true, chezDiffuseur: 0, absents: 0, exemples: [], introuvables } : null;
    }
    return { luLe: v.luLe, verifie: v.verifie, chezDiffuseur: Number(v.chezDiffuseur) || 0, absents: v.absents, exemples: Array.isArray(v.exemples) ? v.exemples : [], introuvables };
  } catch {
    return null;
  }
}
