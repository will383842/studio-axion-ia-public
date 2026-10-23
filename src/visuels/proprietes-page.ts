import { CarrouselSpec } from "../domaine/visuels/schema";
import type { CarrouselSpecType } from "../domaine/visuels/types";

export interface ProprietesPageValides {
  spec: CarrouselSpecType;
  index: number;
}

/**
 * Porte d'entrée de la composition `VisuelPage` : le spec passe par le schéma Zod strict (aucune URL, aucune propriété libre)
 * AVANT d'arriver à Remotion, et l'index doit désigner une page du spec. Lève une erreur sinon.
 */
export function validerProprietesPage(brut: unknown): ProprietesPageValides {
  if (typeof brut !== "object" || brut === null) throw new Error("Propriétés de VisuelPage invalides : objet attendu");
  const { spec, index, ...autres } = brut as Record<string, unknown>;
  if (Object.keys(autres).length > 0) throw new Error(`Propriétés de VisuelPage invalides : clé inconnue « ${Object.keys(autres)[0]} »`);
  const analyse = CarrouselSpec.safeParse(spec);
  if (!analyse.success) throw new Error(`Spec de carrousel invalide : ${analyse.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= analyse.data.pages.length) {
    throw new Error(`Index de page invalide : ${String(index)} (le spec a ${analyse.data.pages.length} page(s))`);
  }
  return { spec: analyse.data, index };
}
