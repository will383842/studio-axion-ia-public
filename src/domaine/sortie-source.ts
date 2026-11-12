import { sourceDe } from "./types";

/**
 * Source d'une sortie : exactement un identifiant de vidéo OU de visuel.
 * Alias de `sourceDe` (une seule règle, qui lève si les deux sont donnés ou si aucun ne l'est).
 */
export const sourceDeSortie = sourceDe;
