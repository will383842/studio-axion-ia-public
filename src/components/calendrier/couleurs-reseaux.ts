import type { IdReseau } from "@/domaine/types";
import { REPLI_PINTEREST } from "./couleurs-pinterest";

/**
 * Réseau → jeton CSS de couleur (définis dans src/app/globals.css, :root ET .theme-sombre ; Pinterest : repli défini ici, voir plus bas).
 * Aucune couleur n'est écrite ici ni dans les composants : ils lisent seulement `var(--res-...)`.
 * Une couleur n'est jamais seule : le picto et le nom du réseau l'accompagnent (voir PictoReseau).
 */
export const COULEURS_RESEAUX: Readonly<Record<IdReseau, string>> = {
  linkedin: "var(--res-linkedin)",
  instagram: "var(--res-instagram)",
  facebook: "var(--res-facebook)",
  tiktok: "var(--res-tiktok)",
  youtube: "var(--res-youtube)",
  "youtube-shorts": "var(--res-youtube-shorts)",
  pinterest: "var(--res-pinterest)",
};

/** Repli d'un jeton quand il n'est pas défini : le trait neutre, sauf Pinterest (sa propre couleur). */
export function repliReseau(reseau: IdReseau): string {
  return reseau === "pinterest" ? REPLI_PINTEREST : "var(--trait-fort)";
}

/** Les réseaux qui ont une couleur, dans l'ordre de la légende. */
export const RESEAUX_COLORES: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts", "pinterest"];

/** La couleur (jeton CSS) d'un réseau. */
export function couleurReseau(reseau: IdReseau): string | undefined {
  return Object.hasOwn(COULEURS_RESEAUX, reseau) ? COULEURS_RESEAUX[reseau] : undefined;
}
