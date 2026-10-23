/**
 * BRIQUE MONTEUR (mission H) — l'agent monteur commun à TOUS les formats, extrait du lot D.
 *
 *  - `consignes`  : repérage des consignes « Monteur, … » dites dans une prise, messages du fil (PUR) ;
 *  - `ancrage`    : où s'applique une consigne (temps cité, mot cité, instant dit) (PUR) ;
 *  - `operations` : schémas communs, réponse d'un appel, relecture tolérante opération par opération (PUR) ;
 *  - `catalogue`  : forme commune d'un catalogue d'opérations (PUR) ;
 *  - `effets`     : catalogue commun des effets spéciaux (lot F3 / I), à la demande seulement (PUR) ;
 *  - `effet-realiste` : opération commune « effet réaliste par IA » (lot K), payante, toujours confirmée (PUR) ;
 *  - `adaptateur` : contrat d'un adaptateur par format, familles de demandes, réponse claire au refus (PUR).
 *
 * Adaptateurs : face caméra (`moteurs/montage-facecam/monteur/adaptateur.ts`, comportement du lot D inchangé) ;
 * avocat (`moteurs/montage-avocat/monteur.ts`, réglage caché `avocat.monteur`, coupé par défaut).
 * Registre par format : `moteurs/monteurs.ts`.
 */
export * from "./operations";
export * from "./ancrage";
export * from "./consignes";
export * from "./catalogue";
export * from "./adaptateur";
export * from "./effets";
export * from "./effet-realiste";

export const VERSION_BRIQUE_MONTEUR = 1;
