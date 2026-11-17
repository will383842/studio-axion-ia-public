/**
 * Styles de tableau à éviter selon le refus commun (fiche X2-12b-b-a). Composition réglage → voisines → garde → liste.
 * Éteint par défaut (seul `true` exact allume, via `refusCommunPour`) : rend alors `undefined` et l'appelant ne passe
 * pas `eviter` (appel identique à aujourd'hui). Aucun appelant à ce stade ; lecture seule, jamais bloquant.
 * La liste est BRUTE : la règle « tout évité → règle d'aujourd'hui » appartient au moteur (`tirerStyleTableau`).
 */
import "server-only";
import type { StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { refusCommunPour } from "./refus";
import { stylesAEviter } from "./styles-tableau-a-eviter";

export type DemandeStylesCommuns = Parameters<typeof refusCommunPour>[0] & {
  le: string;
  resume?: Parameters<typeof stylesAEviter>[3];
};

/** Éteint → undefined (une seule lecture). Allumé → liste brute des styles refusés (peut être vide ou complète). */
export async function stylesTableauAEviterCommun(d: DemandeStylesCommuns): Promise<StyleTableau[] | undefined> {
  try {
    const refus = await refusCommunPour(d);
    if (!refus) return undefined;
    return stylesAEviter(refus, d.videoId, d.le, d.resume);
  } catch (e) {
    console.warn("[studio] styles de tableau communs : refus illisible, rien n'est évité :", e instanceof Error ? e.message : e);
    return undefined;
  }
}
