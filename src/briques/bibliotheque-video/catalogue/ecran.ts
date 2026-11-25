/** Catalogue des capacités : lignes du chantier 4 (écran) (PLAN-FINAL § 3.3). Les identifiants viennent de `ID` (noms.ts). */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

export const LIGNES_ECRAN: readonly LigneCatalogue[] = Object.freeze([
  { id: ID.ecranClipV4, etat: "prod", chantier: null, note: "v4 seule" },
  { id: ID.ecranMosaiqueExtraits, etat: "eteint", chantier: "4 (U4.1 à U4.6)", decision: "Q4, Q5" },
  { id: ID.ecranTelephoneExtrait, etat: "eteint", chantier: "4 (U4.7 à U4.9c)", decision: "Q1, P-6" },
]);
