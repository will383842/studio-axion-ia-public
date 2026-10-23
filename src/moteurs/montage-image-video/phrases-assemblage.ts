/**
 * Phrases de l'assemblage lues aussi par l'écran (`components/formats/image-video/vue.ts`, rendu côté navigateur) :
 * module SANS IMPORT, pour ne pas tirer l'assemblage (et ses services) dans le paquet du navigateur.
 */

/** Fin de la phrase d'un refus Q17 : « Refaire cette partie » relance la conversion, sans relire la voix. */
export const SUITE_REFUS_WAV_IV = "Aucun repli MP3 : sans WAV, la voix ne peut être coupée que dans des silences mesurés. Relancez la conversion du son (la voix déjà payée n'est pas relue).";

/**
 * Cœur de la phrase d'un refus « coupe en plein son » de l'assemblage. 15/10 (v-dd3049053f88) : ce refus venait du seuil
 * fixe −45 dB sur une voix à bruit de fond ; « Refaire cette partie » reprend l'assemblage (mesure adaptée), sans relire.
 */
export const COUPE_EN_PLEIN_SON_IV = "tombe en plein son, hors de tout silence mesuré";
