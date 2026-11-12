import { z } from "zod";
import { texteSansLien } from "./schema";

/** Infographie (L1-02) : un titre, 2 à 8 blocs ; aucun lien, aucune couleur, objets stricts (comme le carrousel). */
const Bloc = z
  .object({
    titre: texteSansLien(1, 60),
    texte: texteSansLien(1, 160),
    /** Chiffre ou mot mis en avant (« 42 % »). */
    valeur: texteSansLien(1, 20).optional(),
  })
  .strict();

export const InfographieSpec = z
  .object({
    version: z.literal("infographie/1"),
    alt: texteSansLien(1, 125),
    titre: texteSansLien(1, 80),
    blocs: z.array(Bloc).min(2).max(8),
  })
  .strict();

export type InfographieSpecType = z.infer<typeof InfographieSpec>;
