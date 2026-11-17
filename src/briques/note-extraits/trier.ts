/**
 * X4-06b : tri d'une vidéo, côté brique de la note. Étiquettes par défaut : `usagesDe`, chiffres réels **non**
 * (E4-3 : seul Williams coche). Rien ne l'appelle encore (X4-10b appelle `tri-video.ts` avec son propre étiqueteur).
 */
import { trierVideo as trierSansEtiquettes } from "@/briques/archive-extraits/tri-video";
import type { OptionsTri } from "@/briques/archive-extraits/tri-video";
import { SEUILS_PAR_DEFAUT } from "./reglage";
import type { SeuilsNoteInteret } from "./reglage";
import type { ContexteNote } from "./noter";
import type { Moment, ResultatTri } from "./types";
import { usagesDe } from "./usages";

export type { OptionsTri };

export function trierVideo(
  moments: readonly Moment[],
  contexte: ContexteNote | ((m: Moment) => ContexteNote),
  seuils: SeuilsNoteInteret = SEUILS_PAR_DEFAUT,
  options?: OptionsTri,
): ResultatTri {
  return trierSansEtiquettes(moments, contexte, seuils, {
    etiqueter: options?.etiqueter ?? ((m) => usagesDe(m, { chiffresReels: false })),
  });
}
