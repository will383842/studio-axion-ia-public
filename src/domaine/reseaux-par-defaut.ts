/**
 * Réseaux cochés par défaut (Réglages › Réseaux) : UNE seule constante pour tous les emplacements du défaut.
 * YouTube Shorts n'y est plus (lot C) : il ne part qu'après l'accord du fondateur et l'allumage de son interrupteur.
 * `RESEAUX_PAR_DEFAUT` est figée : on ne la modifie jamais, on en prend une copie (`reseauxParDefautNeufs`).
 */
import type { IdReseau } from "./types";

export const RESEAUX_PAR_DEFAUT: readonly IdReseau[] = Object.freeze(["linkedin", "instagram", "tiktok"] as IdReseau[]);

/** Copie neuve et modifiable du défaut. */
export const reseauxParDefautNeufs = (): IdReseau[] => [...RESEAUX_PAR_DEFAUT];

/** Réseau retiré des défauts par la migration n° 24 (l'ancienne valeur est gardée en base). */
export const RESEAU_RETIRE_DES_DEFAUTS = "youtube-shorts";
