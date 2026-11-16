/** Les 13 plaquettes en coulisse (jamais rebranchées, 19/10). Noms construits depuis `COULISSE_V4` lu seulement. */
import { COULISSE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { PREFIXE_COULISSE_V4 } from "../noms";
import type { IdCapacite } from "../types";
import type { LigneCatalogue } from "./types";

export const LIGNES_COULISSE_V4: readonly LigneCatalogue[] = Object.freeze(
  COULISSE_V4.map((f): LigneCatalogue => ({
    id: `${PREFIXE_COULISSE_V4}${f.id}` as IdCapacite,
    etat: "coulisse",
    chantier: null,
    decision: "19/10 : jamais rebranchées",
    note: f.raison,
  })),
);
