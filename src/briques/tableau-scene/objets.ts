import type { RectPx } from "./types";

/**
 * Un petit objet posé sur une scène du tableau (N-04b). Types seuls : la brique n'importe aucune valeur.
 * `id` = id de pièce (`objet-…`) ; `debutMs` / `finMs` RELATIFS au début de la scène ; `boite` en px de l'image de la scène.
 */
export type ObjetScene = { id: string; debutMs: number; finMs: number; parametres: Readonly<Record<string, unknown>>; boite: RectPx };
