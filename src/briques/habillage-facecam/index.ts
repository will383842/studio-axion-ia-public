/**
 * HABILLAGE FACE CAMÉRA (facecam lot C, plan v4 B.8, B.19, B.21 à B.23). PUR, sans alias « @/ » : règles chiffrées
 * que le moteur `montage-facecam` applique avant la composition (brique commune « composition », paramètres
 * FACULTATIFS `sourcePreCadree`, `source10bits`, `ecranPartage`, `passagesJonction`, `lookBroll`).
 *   - cadrage par calque (moitié basse, côté, vignette) ; image 0 et fin ;
 *   - écrans partagés par passages (déclenchés par le texte, 2 à 3 par vidéo, 3 à 8 s, 25 % au plus) ;
 *   - cartes automatiques (10/10) : ce qui est dit, quand c'est dit, une carte toutes les 12 à 20 s environ ;
 *   - sous-titres face caméra (styles décidés, 1 à 4 mots coupés par le sens, 55-72 % de la hauteur, jonction) ;
 *   - B-roll accordés au Look Will (même LUT, 1,2 à 2,5 s, refus : filigrane, texte en anglais, regard caméra) ;
 *   - encodage final unique 8 bits.
 */
export * from "./cadrage";
export * from "./ecran-partage";
export * from "./cartes-auto";
export * from "./sous-titres";
export * from "./broll";
export * from "./encodage";
