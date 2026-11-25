/** Catalogue des capacités : lignes du chantier 8 (logos, zoom, avis ; AM-16) (PLAN-FINAL § 3.3). Les identifiants viennent de `ID` (noms.ts). */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

export const LIGNES_LOGOS_ZOOM_AVIS: readonly LigneCatalogue[] = Object.freeze([
  { id: ID.texteLogoOutil, etat: "prevu", chantier: "8", decision: "AM-16" },
  { id: ID.cadrageZoomClassique, etat: "prod", chantier: "8", decision: "AM-16" },
  { id: ID.cadrageZoomAvocat, etat: "prod", chantier: "8", decision: "AM-16" },
  { id: ID.cadrageZoomDemo, etat: "prod", chantier: "8", decision: "AM-16" },
  { id: ID.cadrageCameraCasConcret, etat: "prod", chantier: "8", decision: "AM-16" },
  { id: ID.cadrageZoomV4, etat: "eteint", chantier: "8", decision: "AM-16", note: "branché, éteint : facecamAnimee.zoomGratuit ; allumage après la planche C8-Z10" },
  { id: ID.motionAvisClient, etat: "prevu", chantier: "8", decision: "AM-16" },
]);
