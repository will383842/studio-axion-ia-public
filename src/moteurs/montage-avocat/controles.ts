/**
 * Ancien emplacement des contrôles du fichier exporté (lot M4) : brique commune `@/briques/composition` depuis le
 * 02/10. Ré-exportés ici pour les imports du lot M4.
 */
import { beneficeClair, cibleNommee, debutParle } from "@/domaine/ciblage/controles";
import type { Ciblage } from "@/domaine/ciblage/types";

export { controlesExport, noteDepuisAlertes, PAUSES_DB, type MesuresComposition } from "@/briques/composition";

/* ---------- Ciblage (C100, C101) : remarques jamais bloquantes ---------- */
export interface RemarqueCiblage {
  code: "C100" | "C101";
  message: string;
  bloquant: false;
}

/** Sans cible déclarée : aucune remarque. Une vidéo n'est jamais bloquée. */
export function remarquesCiblageAvocat(texte: string, ciblage: Ciblage | undefined): RemarqueCiblage[] {
  if (!ciblage) return [];
  const r: RemarqueCiblage[] = [];
  if (!cibleNommee(debutParle(texte), ciblage)) r.push({ code: "C100", message: `La cible « ${ciblage.libelle} » n'est pas nommée dans les 5 premières secondes.`, bloquant: false });
  if (!beneficeClair(texte)) r.push({ code: "C101", message: "Aucun bénéfice clair (temps, argent, erreurs évitées).", bloquant: false });
  return r;
}
