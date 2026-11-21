/**
 * REGISTRE DES RENDUS DE BRIQUES (lot C) — sans Zod : importé par la composition Remotion `PlanDeScenes`.
 * Ajouter une brique : son schéma dans `../catalogue.ts`, sa toile dans `../toiles.ts`, son composant ici.
 */
import type { ComponentType, ReactNode } from "react";
import type { IdPiece } from "../catalogue";
import type { ProprietesBrique } from "./communs";
import { BulleChat } from "./BulleChat";
import { CarteKpi } from "./CarteKpi";
import { Curseur } from "./Curseur";
import { FenetreApp } from "./FenetreApp";
import { FrappeClavier } from "./FrappeClavier";
import { Graphique } from "./Graphique";
import { CourbeSeries } from "../../plan-scenes-donnees/CourbeSeries";
import { Legende } from "./Legende";
import { ListeCrm } from "./ListeCrm";
import { AvantApres, Barres, Citation, Compteur, Etapes, Jauge, ListeAuMot, Repere } from "./PiecesDonnees";
import { TableauDeBord } from "./TableauDeBord";
import { RENDUS_OBJETS } from "./objets-inscrits";
import { CadreCapture, FluxRamifie, IntercalaireChapitre } from "./PiecesLongues";
import { ZoomCamera, transformZoom } from "./ZoomCamera";

export type RenduBrique = ComponentType<ProprietesBrique<never> & { enfants?: ReactNode }>;

export const RENDUS_BRIQUES: Record<IdPiece, RenduBrique> = {
  curseur: Curseur as RenduBrique,
  "zoom-camera": ZoomCamera as RenduBrique,
  "frappe-clavier": FrappeClavier as RenduBrique,
  "carte-kpi": CarteKpi as RenduBrique,
  graphique: Graphique as RenduBrique,
  "tableau-de-bord": TableauDeBord as RenduBrique,
  "liste-crm": ListeCrm as RenduBrique,
  "fenetre-app": FenetreApp as RenduBrique,
  "bulle-chat": BulleChat as RenduBrique,
  legende: Legende as RenduBrique,
  compteur: Compteur as RenduBrique,
  jauge: Jauge as RenduBrique,
  "avant-apres": AvantApres as RenduBrique,
  barres: Barres as RenduBrique,
  etapes: Etapes as RenduBrique,
  "liste-au-mot": ListeAuMot as RenduBrique,
  citation: Citation as RenduBrique,
  repere: Repere as RenduBrique,
  ...RENDUS_OBJETS,
  // VL-10 : pièces 16:9 de la vidéo longue (porte fermée : PIECES_GARDEES)
  "intercalaire-chapitre": IntercalaireChapitre as RenduBrique,
  "flux-ramifie": FluxRamifie as RenduBrique,
  "cadre-capture": CadreCapture as RenduBrique,
  // G4-11b-2 : courbe à plusieurs séries (porte fermée : PIECES_GARDEES)
  "courbe-series": CourbeSeries as RenduBrique,
};

export { transformZoom };
export type { ProprietesBrique };
