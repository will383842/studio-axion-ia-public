import type { SensVolet } from "../../motion/petits-objets/volet-avant-apres";

export interface ParametresVoletPlan {
  sens?: SensVolet;
  etiquettes?: boolean;
}

/** Volet pour le plan de scènes : refuse toute adresse (avant/apres), Claude n'écrit jamais d'image. */
export function validerVoletPlan(p: unknown): ParametresVoletPlan | null {
  try {
    if (typeof p !== "object" || p === null || Array.isArray(p)) return null;
    if (Object.hasOwn(p, "avant") || Object.hasOwn(p, "apres")) return null;
    const o = p as Record<string, unknown>;
    const sens = o.sens;
    const etiquettes = o.etiquettes;
    if (sens !== undefined && sens !== "gauche-droite" && sens !== "droite-gauche") return null;
    if (etiquettes !== undefined && typeof etiquettes !== "boolean") return null;
    const sortie: ParametresVoletPlan = {};
    if (sens !== undefined) sortie.sens = sens;
    if (etiquettes !== undefined) sortie.etiquettes = etiquettes;
    return sortie;
  } catch {
    return null;
  }
}
