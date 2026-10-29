/** Cadre de l'écran « chiffres » par format (PUR : lu aussi par `decalage-repere.ts`, que les tests appellent sans `remotion`). */
/** Cadre d'un format : contenu au-dessus des sous-titres, zone d'appoint dessous (9:16 seulement). */
export type CadreChiffres = { hauteur: number; etiquetteY: number; haut: number; bas: number; sousTitres: number; appoint: { haut: number; bas: number } | null };
export function cadreChiffres(hauteur: number): CadreChiffres {
  return hauteur < 1600
    ? { hauteur, etiquetteY: 96, haut: 130, bas: 1020, sousTitres: 1042, appoint: null }
    : { hauteur, etiquetteY: 250, haut: 300, bas: 1120, sousTitres: 1152, appoint: { haut: 1300, bas: 1536 } };
}
