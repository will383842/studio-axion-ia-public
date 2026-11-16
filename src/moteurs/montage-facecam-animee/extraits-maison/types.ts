/** Extraits maison v4 (C4-U4.1) : types purs. Rien n'importe ce fichier tant que U4.2 et U4.3 ne sont pas écrites. */
import type { CandidatExtrait } from "@/briques/bibliotheque-video/types";

/** Un extrait candidat de la maison : licence vérifiée et vidéos parentes (qu'il ne doit pas illustrer deux fois). */
export type ExtraitMaisonV4 = CandidatExtrait & { licenceOk: boolean; parentes: string[] };

/** En dessous de cette durée (secondes), un extrait est écarté. */
export const DUREE_MIN_EXTRAIT_V4_SEC = 3;

/** Recherche « maison » lue dans une chaîne `axion:…`. */
export type RechercheAxion = { motsCles: string[] };
