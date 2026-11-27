/**
 * Couleur de Pinterest, clair puis sombre. Le jeton `--res-pinterest` n'est PAS défini dans src/app/globals.css (zone
 * partagée : la garde de zone refuse ce fichier sans annonce lue sur la base). La valeur vit ici et sert de repli au
 * jeton ; si un jour le jeton est posé dans globals.css, il l'emporte. `light-dark()` suit `color-scheme`
 * (clair sur :root, sombre sur .theme-sombre). Fichier à part : les composants du calendrier restent sans couleur en dur.
 */
export const PINTEREST_CLAIR = "#b5121b";
export const PINTEREST_SOMBRE = "#ff8a8f";
export const REPLI_PINTEREST = `light-dark(${PINTEREST_CLAIR}, ${PINTEREST_SOMBRE})`;
