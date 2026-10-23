/**
 * Tire le résumé visuel d'une fiche de scènes (`src/briques/fiche-scenes`). Les éléments de scène sont propres au
 * format qui les déclare : on ne lit que deux formes, par leur champ `type` (« dessin » → `dessinId`,
 * « ligne » → `texte`) ; tout autre élément est ignoré.
 */
import type { FicheScenes } from "../fiche-scenes";
import type { ResumeVisuel } from "./types";

type Lisible = { type?: unknown; dessinId?: unknown; texte?: unknown };
const lisible = (e: unknown): Lisible => (typeof e === "object" && e !== null ? (e as Lisible) : {});

export function resumeVisuelDepuisFiche(fiche: FicheScenes<unknown>): ResumeVisuel {
  const dessins: string[] = [];
  for (const scene of fiche.scenes) {
    for (const e of scene.elements) {
      const l = lisible(e);
      if (l.type === "dessin" && typeof l.dessinId === "string") dessins.push(l.dessinId);
    }
  }
  // Accroche = les lignes écrites dans la première scène ; à défaut, ce qui y est dit.
  const premiere = fiche.scenes[0];
  const lignes = (premiere?.elements ?? [])
    .map(lisible)
    .filter((l) => l.type === "ligne" && typeof l.texte === "string")
    .map((l) => l.texte as string);
  const accroche = lignes.length > 0 ? lignes.join(" ") : (premiere?.texteDit ?? "");
  return { structure: fiche.structure, dessins, accroche, format: fiche.formatId };
}
