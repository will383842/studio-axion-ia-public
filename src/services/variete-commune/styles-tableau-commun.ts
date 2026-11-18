/**
 * Styles de tableau à éviter selon le refus commun (fiche X2-12b-b-a). Composition réglage → voisines → garde → liste.
 * Éteint par défaut (seul `true` exact allume, via `refusCommunPour`) : rend alors `undefined` et l'appelant ne passe
 * pas `eviter` (appel identique à aujourd'hui). Aucun appelant à ce stade ; lecture seule, jamais bloquant.
 * La liste est BRUTE : la règle « tout évité → règle d'aujourd'hui » appartient au moteur (`tirerStyleTableau`).
 * Garde par défaut PROPRE AU TABLEAU (BR-TABLEAU-STYLE-b1) : la garde commune `verifier` exige 4 axes communs
 * (`MIN_AXES_COMPTES`) alors qu'une empreinte de tableau n'en a que 2 → `score: null`, tout accepté, liste toujours vide.
 * Ici, un décor est refusé s'il est celui d'une des 2 voisines les plus récentes du réseau ; les autres axes ne comptent pas.
 */
import "server-only";
import type { StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { refusCommunPour, type GardeCommune } from "./refus";
import { stylesAEviter } from "./styles-tableau-a-eviter";

export type DemandeStylesCommuns = Parameters<typeof refusCommunPour>[0] & {
  le: string;
  resume?: Parameters<typeof stylesAEviter>[3];
};

/** Nombre de voisines les plus récentes (rang 0 et 1) dont le décor est évité. */
export const RANGS_HABILLAGE_TABLEAU = 2;

/** Refus si une valeur de l'axe `habillage` du candidat est celle d'une voisine de rang 0 ou 1 (peu importe son générateur). Pure. */
export const gardeHabillageTableau: GardeCommune = (e, voisines) => {
  const siens = e.axes.habillage ?? [];
  for (const v of voisines) {
    if (v.rang >= RANGS_HABILLAGE_TABLEAU) continue;
    const siennes = v.empreinte.axes.habillage ?? [];
    if (siens.some((h) => siennes.includes(h))) {
      return { ok: false, score: 1, voisine: v.empreinte.videoId, axesCommuns: ["habillage"], phrase: `même décor que ${v.empreinte.videoId}` };
    }
  }
  return { ok: true, score: null, axesCommuns: [], phrase: "" };
};

/** Éteint → undefined (une seule lecture). Allumé → liste brute des styles refusés (peut être vide ou complète). */
export async function stylesTableauAEviterCommun(d: DemandeStylesCommuns): Promise<StyleTableau[] | undefined> {
  try {
    const refus = await refusCommunPour({ ...d, garde: d.garde ?? gardeHabillageTableau });
    if (!refus) return undefined;
    return stylesAEviter(refus, d.videoId, d.le, d.resume);
  } catch (e) {
    console.warn("[studio] styles de tableau communs : refus illisible, rien n'est évité :", e instanceof Error ? e.message : e);
    return undefined;
  }
}
