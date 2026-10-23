import { z } from "zod";
import reglesBrutes from "./carrousel-regles.json";

// Mécanisme seulement : les listes de mots signalés et de familles d'accroche restent vides ici,
// elles sont fournies par un dépôt privé.
const SchemaRegles = z
  .object({
    version: z.literal("carrousel-regles/1"),
    longueurs: z.object({
      titreMax: z.number().int().positive(),
      corpsMax: z.number().int().positive(),
      altMax: z.number().int().positive(),
    }),
    // Nombre de cartes PAR PAGE de type T02 (pas par carrousel) : min = plancher du schéma, max = PAGES.T02.cartesMax.
    cartes: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
    structure: z.object({
      premiereCarte: z.enum(["couverture", "libre"]),
      derniereCarte: z.enum(["appel", "libre"]),
    }),
    motsSignales: z.array(z.string().min(1).max(60)).max(500),
    famillesAccroche: z.array(z.string().min(1).max(60)).max(100),
    appels: z.array(z.string().min(1).max(60)).max(100),
  })
  .refine((r) => r.cartes.min <= r.cartes.max, { message: "cartes.min doit être ≤ cartes.max" });

export type ReglesCarrousel = z.infer<typeof SchemaRegles>;

/** Unique point d'import de carrousel-regles.json. `source` sert aux tests. */
export function chargerReglesCarrousel(source: unknown = reglesBrutes): ReglesCarrousel {
  return SchemaRegles.parse(source);
}
