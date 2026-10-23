/**
 * RÉFÉRENCE DE MISE EN PAGE PARTAGÉE par la règle 4 et la règle 5 (`regles.ts`) et la mise en page (`mise-en-page.ts`).
 *
 * Ce fichier ne porte que la FORME des valeurs ; leur seule source est `REFERENCE_CONTROLE` de `mise-en-page.ts`
 * (cadre de page réel, tailles de l'habillage). Il existe pour que la mise en page n'importe rien de `regles.ts` :
 * `regles.ts` importe la mise en page, jamais l'inverse. N'importe rien.
 */

/** Niveau d'une ligne écrite (même union que `NiveauLigne` de `fiche.ts`). */
export type NiveauReference = "titre" | "texte";

/** Mise en page prévue pour le contrôle (règles 4 et 5). */
export interface MiseEnPageControle {
  hauteurImagePx: number;
  /** Largeur utile : largeur du cadre de page, où chaque mot d'une ligne doit tenir. */
  largeurUtilePx: number;
  /** Taille prévue du texte par niveau de ligne, à l'échelle 1. Les lignes d'une preuve sont au niveau « texte ». */
  taillePx: Record<NiveauReference, number>;
}
