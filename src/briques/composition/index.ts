/**
 * BRIQUE COMMUNE « COMPOSITION » (centralisée le 02/10/2026, demande de Will : « certaines choses sont centralisées pour
 * ne pas les refaire à chaque moteur »). Toute la mise en image d'une vidéo, pour TOUS les formats :
 *
 *   décor · double (piste transparente, image détourée, silhouette simulée) · liseré de lumière · accessoires (micro
 *   dessiné ou image) · recadrage (plans large / poitrine, zoom lent, 9:16 recadré, 4:5 et 1:1 ancrés en bas) ·
 *   illustrations plein écran · incrustations graphiques · encadré de titre placé sous les sous-titres · LUT par plan,
 *   grain, vignette · son et export · demandes à `studio-rendu` et leur suivi · contrôles du fichier exporté.
 *
 * Un moteur de format n'apporte que sa RECETTE (`RecetteComposition`) : il appelle `parametresComposition(c, e,
 * recette)` et met `recette` dans ses `OutilsMontage`. Côté `studio-rendu`, la même scène (`scene.ts`, PUR, sans
 * alias) est lue par les compositions communes (`studio-rendu/compositions/commune/`) et par la passe FFmpeg des
 * calques image (`studio-rendu/src/composition/image-ffmpeg.ts`). Inventaire : `docs/ARCHITECTURE.md`, « Briques
 * communes ».
 */
export * from "./scene";
export * from "./recette";
export * from "./image";
export * from "./encadre";
export * from "./incrustations";
export * from "./parametres";
export * from "./montage";
export * from "./controles";
export * from "./vignette-decor";
export { CARACTERES_INTER, INTER_BOLD } from "./metriques-inter";
