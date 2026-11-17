/**
 * X2-11b-a : refus commun du cas concret en un appel (réglage + voisines + garde → « tirage → raison »),
 * aucun appelant (X2-11b branchera `OutilsVariete.refusCommun?`). Lecture seule, aucun appel à Claude.
 * Éteint par défaut : seul `true` exact allume (décidé par `refusCommunPour`).
 */
import "server-only";
import type { Tirage } from "@/moteurs/montage-cas-concret/variete";
import { refusCommunPour } from "./refus";
import { refusPourTirage } from "./refus-tirage-cas-concret";

/** Dérivé de `refusCommunPour` : suit sans changement quand `garde` deviendra facultative (X2-10b). `le` = date ISO de l'empreinte candidate. */
export type DemandeRefusCommunCasConcret = Parameters<typeof refusCommunPour>[0] & { le: string };

/** Éteint → undefined (une seule lecture, celle du réglage). Allumé → (tirage) => raison | null. Jamais bloquant. */
export async function refusCommunCasConcret(
  d: DemandeRefusCommunCasConcret,
): Promise<((t: Tirage) => string | null) | undefined> {
  try {
    const { le, ...demande } = d;
    const refus = await refusCommunPour(demande);
    if (!refus) return undefined;
    return refusPourTirage(refus, d.videoId, le);
  } catch (e) {
    console.warn("[studio] refus commun cas concret : indisponible, aucun refus :", e instanceof Error ? e.message : e);
    return undefined;
  }
}
