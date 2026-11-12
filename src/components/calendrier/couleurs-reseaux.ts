import type { IdReseau } from "@/domaine/types";

/**
 * Réseau → jeton CSS de couleur (définis dans src/app/globals.css, :root ET .theme-sombre).
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
};

/** Les réseaux qui ont une couleur, dans l'ordre de la légende. */
export const RESEAUX_COLORES: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];

/** La couleur (jeton CSS) d'un réseau. */
export function couleurReseau(reseau: IdReseau): string {
  return COULEURS_RESEAUX[reseau];
}
