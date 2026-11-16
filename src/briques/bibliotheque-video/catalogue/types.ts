/** Forme d'une ligne du catalogue des capacités (PLAN-FINAL § 3.3). Aucun comportement, aucun réglage. */
import type { EtatCapacite, IdCapacite } from "../types";

export interface LigneCatalogue {
  id: IdCapacite;
  etat: EtatCapacite;
  /** Chantier qui livre la capacité, recopié du § 3.3 (« 2 (U5, U5bis, U6) ») ; `null` quand le plan met « — ». */
  chantier: string | null;
  /** Décision liée (« S1, Q3 »). */
  decision?: string;
  note?: string;
}
