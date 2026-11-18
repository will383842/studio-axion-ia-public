import { pireCasRequete } from "@/generateur/roles/types";
import { roleRegard, variableRegard } from "./role";

export const IMAGES_REGARD_MAX = 24;
export const LARGEUR_IMAGES_REGARD = 540;

/** Pire cas d'un regard sur `nombreImages` images, par le calcul commun (aucun prix recopié). */
export function coutPireRegardUsd(nombreImages: number): number {
  const n = Math.max(0, Math.floor(nombreImages));
  const instants = Array.from({ length: n }, (_, i) => ({ nom: `i${String(i + 1).padStart(2, "0")}`, instantSec: i }));
  const images = Array.from({ length: n }, () => ({ type: "image/jpeg" as const, base64: "" }));
  return pireCasRequete(roleRegard, { contexte: {}, variable: variableRegard(instants), images });
}
