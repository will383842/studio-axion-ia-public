// VL-01 — brique « geo » : chapitres YouTube vérifiés et modèle de description (PUR, 0 €). ÉTEINTE par défaut.
// Pas de données structurées : le site les fabrique (docs/site-videos/PLAN-VIDEOS-SUR-LE-SITE.md:81).
import { exporterSrt } from "@/briques/sous-titres/export";
import type { SegmentSousTitres } from "@/domaine/types";
import { verifierChapitres, type RemarqueChapitres } from "./chapitres";
import { modeleDescription, type BlocDescription, type EntreeDescription } from "./description";
import type { ChapitreWeb } from "@/domaine/site-videos/types";

export * from "./chapitres";
export * from "./description";

/** Seul `true` exact allume (même règle que `lireParametre`). */
export const geoAllume = (valeur: unknown): boolean => valeur === true;

export interface PreparationGeo {
  remarques: RemarqueChapitres[];
  description: BlocDescription[];
  /** Fichier .srt déjà fabriqué par la brique sous-titres, à déposer sur YouTube. */
  srt: string;
}

/** Éteint : renvoie `null`, rien n'est calculé. Allumé : remarques + modèle + .srt, sans aucune dépense. */
export function preparerGeo(
  actif: unknown,
  entree: EntreeDescription & { chapitres: readonly ChapitreWeb[]; segments?: SegmentSousTitres[] },
): PreparationGeo | null {
  if (!geoAllume(actif)) return null;
  return {
    remarques: verifierChapitres(entree.chapitres),
    description: modeleDescription(entree),
    srt: exporterSrt(entree.segments ?? []),
  };
}
