import { DELAI_TITRES_MS } from "../commun/attente-police";

const PAS_MS = 25;

/** Attend (25 s au plus : plus que l'attente de police des titres) que plus aucun titre ne soit « en attente » ; lève s'il en reste un : mesurer un bloc vide serait un faux « ok ». */
export async function attendreTitres(racine: () => Element | null, pause: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<void> {
  for (let i = 0; i < DELAI_TITRES_MS / PAS_MS && racine()?.querySelector("[data-titre-attente]"); i++) await pause(PAS_MS);
  if (racine()?.querySelector("[data-titre-attente]")) throw new Error(`Un titre est resté en attente de sa mesure après ${DELAI_TITRES_MS / 1000} s : la page ne peut pas être mesurée`);
}
