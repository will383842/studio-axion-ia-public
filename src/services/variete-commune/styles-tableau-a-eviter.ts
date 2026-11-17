/**
 * Styles de tableau à éviter selon le refus commun (E2-ANTI-REPETITION, fiche X2-12b-a). Fonction PURE : aucune
 * entrée-sortie, aucune date du jour, aucun hasard. Aucun appelant en production (tout éteint) ; le branchement
 * dans `tableau-branchements.ts` est la fiche X2-12b-b.
 * Rend la liste BRUTE : la règle « tout évité → règle d'aujourd'hui » appartient au moteur (X2-12a).
 */
import type { EmpreinteVideo, ResultatGarde } from "@/briques/variete-commune/types";
import { STYLES_TABLEAU, type StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { empreinteTableau } from "./empreintes-a";

/**
 * Pour chaque style de `STYLES_TABLEAU` (dans cet ordre), l'empreinte du tableau candidat est soumise au `refus` ;
 * on rend les styles dont la garde dit `ok: false`. `refus` absent → `[]`. `refus` qui lève pour un style → ce style
 * n'est pas évité.
 */
export function stylesAEviter(
  refus: ((e: EmpreinteVideo) => ResultatGarde) | undefined,
  videoId: string,
  le: string,
  resume?: Parameters<typeof empreinteTableau>[3],
): StyleTableau[] {
  if (!refus) return [];
  const evites: StyleTableau[] = [];
  for (const style of STYLES_TABLEAU) {
    try {
      if (refus(empreinteTableau(videoId, le, style, resume)).ok === false) evites.push(style);
    } catch {
      // refus en panne pour ce style : on ne l'évite pas
    }
  }
  return evites;
}
