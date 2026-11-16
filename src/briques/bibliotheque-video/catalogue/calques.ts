/** Catalogue des capacités : lignes du chantier 5 (calques, plan-scènes) (PLAN-FINAL § 3.3). Les identifiants viennent de `ID` (noms.ts). */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

export const LIGNES_CALQUES: readonly LigneCatalogue[] = Object.freeze([
  { id: ID.calqueTexteDerriereDouble, etat: "absent", chantier: null, decision: "V4 plus tard, P7", note: "PAYANT, 2e rendu HeyGen par vidéo, 5.10 à 5.17 suspendues" },
  { id: ID.calqueTexteDerrierePrise, etat: "absent", chantier: null, decision: "Q6", note: "étude 5.20, 5.21" },
  { id: ID.planScenesCasConcret, etat: "prod", chantier: null },
  { id: ID.planScenesFacecam, etat: "eteint", chantier: "5 (5.02 à 5.09)", decision: "Q11" },
  { id: ID.planScenesTutorielOutil, etat: "prod", chantier: null, note: "format masqué (N-02)" },
  { id: ID.planScenesFacecamAnimee, etat: "eteint", chantier: null, decision: "P2 plus tard" },
]);
