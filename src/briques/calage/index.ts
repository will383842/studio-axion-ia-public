/**
 * BRIQUE CALAGE (mission H, déplacée du moteur avocat sans changement de code) — commune à tous les formats.
 *  - `report`     : report des horodatages du texte PRONONCÉ (prononciations substituées) sur le texte VALIDÉ, lettre à
 *                   lettre ; `normaliser` des mots (utilisé aussi par la brique `coupes`) ;
 *  - `alignement` : demande à l'aligneur (`studio-aligneur`), garde-fous et application du calage des mots sur le son.
 * Utilisée par le moteur avocat (voix, prises « je lis ») et la chaîne face caméra (texte validé calé sur le son monté).
 */
export * from "./report";
export * from "./alignement";
