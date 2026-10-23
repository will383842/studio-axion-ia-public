import "server-only";
import type { ContexteAxion } from "@/domaine/types";
import { depots } from "./_commun";

/**
 * Ce que la marque interdit d'écrire à l'écran du tableau (même lecture que le cas concret) : les interdits de Will
 * (avec expression) et les mots interdits (`jargonInterdit`, `promessesInterdites`) de la version la plus récente du
 * contexte Axion. UNE seule lecture, pour la création (`tableau-creation.ts`) et les retouches de « Votre vidéo »
 * (`tableau-vue.ts`) : un titre retouché à la main ne peut pas écrire ce que le découpage refuse.
 */
export async function interditsDeLaMarque(): Promise<{ interdits: ContexteAxion["interdits"]; motsInterdits: string[] }> {
  const contextes = await depots().contexteAxion.lister();
  const marque = [...contextes].sort((a, b) => b.version - a.version)[0];
  const motsInterdits = [...(marque?.jargonInterdit ?? []), ...(marque?.promessesInterdites ?? [])].filter((x): x is string => typeof x === "string" && !!x.trim());
  return { interdits: marque?.interdits ?? [], motsInterdits };
}
