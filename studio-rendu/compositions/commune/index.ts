/**
 * Compositions Remotion de la brique commune « composition » (nées au lot M4 pour l'avocat, communes depuis le 02/10) :
 * calques image, calques texte, accessoire seul (M4b), double d'essai simulé. Aucun format n'est connu ici.
 */
export { ImageComposee } from "./ImageComposee";
export { TexteCompose } from "./TexteCompose";
export { DoubleEssai, type ProprietesDoubleEssai } from "./DoubleEssai";
export { AccessoireSeul, type ProprietesAccessoire } from "./Accessoire";
// Lot R4 : miniatures réelles (image fixe, titre de couverture dans la zone sûre).
export { Miniature } from "./Miniature";
// Vignettes Axion v2 (lot 1, 17/10) : socle invariable, 2 ambiances, 3 mises en page.
export { VignetteAxion } from "./vignette/VignetteAxion";
