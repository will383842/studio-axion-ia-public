/**
 * Données de l'axe « caméra » lues par les compositions (miroir des types posés par le moteur dans
 * `src/moteurs/montage-image-video/variete/axes/camera.ts` : une composition n'importe jamais `src/moteurs/**`).
 */
import type { EnteteSceneIV, ImageCleCamera } from "../../../../../src/briques/schema-motion";

/** Séquence de toile filmée par CAM-B ou CAM-C (`variete.donnees.camera`). */
export type DonneesCameraToile = {
  code: "CAM-B" | "CAM-C";
  trajectoire: ImageCleCamera[];
  fond: "ivoire" | "sombre";
  entetes?: EnteteSceneIV[];
  vue?: { fin: number; noeud: string; icone?: string };
  courses?: { de: string; vers: string; t0: number; t1: number }[];
  icones?: Record<string, string>;
  ensembles?: { debut: number; fin: number }[];
};

export type EtapeCameraE = { id: string; libelle: string; icone?: string; t: number };
export type BrancheCameraE = { titre: string; part?: { texte: string; t: number }; couleur: "orange" | "noir"; etapes: EtapeCameraE[] };
/** Écran CAM-E (`bloc.donnees` d'un bloc `variete` de l'axe caméra). */
export type DonneesCameraEcran = { code: "CAM-E"; fond: "ivoire"; branches: [BrancheCameraE, BrancheCameraE] };

/** Lecture prudente : `null` si les données ne sont pas celles d'une toile filmée par l'axe. */
export function donneesToile(x: unknown): DonneesCameraToile | null {
  const d = x as DonneesCameraToile | null | undefined;
  return d && (d.code === "CAM-B" || d.code === "CAM-C") && Array.isArray(d.trajectoire) ? d : null;
}

export function donneesEcran(x: unknown): DonneesCameraEcran | null {
  const d = x as DonneesCameraEcran | null | undefined;
  return d && d.code === "CAM-E" && Array.isArray(d.branches) && d.branches.length === 2 ? d : null;
}
