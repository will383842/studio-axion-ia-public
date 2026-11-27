import type { IdReseau } from "@/domaine/types";
import { RESEAUX_CALENDRIER } from "./BarreFiltres";

/** Les quatre réseaux de l'ancienne barre (avant Pinterest) : un vieux lien qui les liste tous veut dire « tous ». */
const ANCIENS_RESEAUX: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok"];

/** Réseaux allumés d'après ?reseaux=a,b (absent : tous ; vide ou inconnu : aucun ; les 4 anciens réseaux seuls : tous). Toujours dans l'ordre de la maquette. */
export function lireReseaux(brut: string | string[] | undefined): IdReseau[] {
  if (brut === undefined) return [...RESEAUX_CALENDRIER];
  const demandes = new Set((Array.isArray(brut) ? brut.join(",") : brut).split(","));
  if (demandes.size === ANCIENS_RESEAUX.length && ANCIENS_RESEAUX.every((r) => demandes.has(r))) return [...RESEAUX_CALENDRIER];
  return RESEAUX_CALENDRIER.filter((r) => demandes.has(r));
}
