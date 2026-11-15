/** Catalogue des capacités : lignes du chantier 6 (habillage) (PLAN-FINAL § 3.3). Les identifiants viennent de `ID` (noms.ts). */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

export const LIGNES_HABILLAGE: readonly LigneCatalogue[] = Object.freeze([
  { id: ID.transitionCoupe, etat: "prod", chantier: null },
  { id: ID.transitionCasConcret, etat: "prod", chantier: null, note: "leur générateur" },
  { id: ID.transitionImageVideo, etat: "prod", chantier: null, note: "leur générateur" },
  { id: ID.transitionCommune, etat: "prevu", chantier: "6 (H1 à H4)", decision: "Q7" },
  { id: ID.transitionStyleMontage, etat: "prevu", chantier: "6 (H24a, H24b, H24c)", decision: "T1, Q7" },
  { id: ID.fondVivant, etat: "prevu", chantier: "6 (H5, H6)" },
  { id: ID.fondLumiere, etat: "prevu", chantier: "6 (H5, H6)" },
  { id: ID.etalonnageLutClairObscur, etat: "prod", chantier: null },
  { id: ID.etalonnageLutNaturelSelfie, etat: "prod", chantier: null },
  { id: ID.etalonnageLutDoux, etat: "demande", chantier: null },
  { id: ID.etalonnageLutNuit, etat: "demande", chantier: null },
  { id: ID.etalonnageLutNouvelle, etat: "prevu", chantier: "6 (H8, H9)", decision: "Q12" },
  { id: ID.sonBanqueStudio, etat: "prod", chantier: null, decision: "Q8", note: "porte d'écoute" },
  { id: ID.sonV4, etat: "prod", chantier: null, decision: "validé 15/10", note: "hors porte" },
  { id: ID.sonRegistreCommun, etat: "prevu", chantier: "6 (H11, H14)" },
  { id: ID.sonFamillesEtendues, etat: "prevu", chantier: "6 (H12, H13)", decision: "Q8", note: "bloqué Q8" },
  { id: ID.sonSurTransition, etat: "prevu", chantier: "6 (H15)", decision: "Q8", note: "bloqué Q8" },
  { id: ID.motionCartesCommunes, etat: "prod", chantier: null },
  { id: ID.motionPlaquettesV4, etat: "prod", chantier: null },
  { id: ID.motionIconesBibliotheque, etat: "prevu", chantier: "6 (H17, H18, H19, H20)" },
  { id: ID.motionIconesAnimees, etat: "prevu", chantier: "6 (H17, H18, H19, H20)" },
  { id: ID.motionLottie, etat: "prevu", chantier: "6 (H17, H18, H19, H20)" },
]);
