/** Catalogue des capacités : lignes du chantier 2 (texte à l'écran) (PLAN-FINAL § 3.3). Les identifiants viennent de `ID` (noms.ts). */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

export const LIGNES_TEXTE: readonly LigneCatalogue[] = Object.freeze([
  { id: ID.texteMotDitAccent, etat: "prod", chantier: null },
  { id: ID.texteSousTitresV4, etat: "prod", chantier: null, decision: "rendu validé", note: "v4 seule" },
  { id: ID.texteSurlignageMarqueur, etat: "eteint", chantier: "2 (U5, U5bis, U6)", decision: "S1, Q3" },
  { id: ID.texteStyleVarie, etat: "eteint", chantier: "2 (U5bis, U12)", decision: "S2, Q3" },
  { id: ID.textePastilleAxion, etat: "coulisse", chantier: "2 (U13, U14)", decision: "S3, Q2" },
  { id: ID.textePave, etat: "prevu", chantier: "2 (U7a, U7b)", decision: "Q2" },
  { id: ID.texteNomOutil, etat: "prevu", chantier: "2 (U8)", decision: "texte seul" },
  { id: ID.texteNomOutilAutonome, etat: "prevu", chantier: "2 (U9)", decision: "V3, Q1" },
  { id: ID.texteBandeauNom, etat: "prevu", chantier: "2 (U10, U11)", decision: "bandeau autorisé" },
  { id: ID.texteRepereEpaule, etat: "prevu", chantier: "2 (U18)", decision: "V1, Q1, Q2" },
  { id: ID.texteSortieAnimee, etat: "prevu", chantier: "2 (U19)", decision: "AM-08" },
  { id: ID.texteEscalier, etat: "prevu", chantier: "2 (U20a, U20b)", decision: "AM-09", note: "permis: false" },
]);
