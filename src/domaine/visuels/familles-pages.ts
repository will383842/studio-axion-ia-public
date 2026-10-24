/** Familles de mise en page, page sombre et grandes surfaces orange des carrousels (règles de variété L7) : tables PURES. */
import type { TypePage } from "../../briques/visuels/registre-pages";

/**
 * Famille VISUELLE d'une page : ce que l'œil voit en premier. Deux pages de même famille à la suite se ressemblent, même de types
 * différents. « donnee » : une structure montrée (étapes reliées, schéma de flux). T29 (« appel ») est réservé : sa famille est prête.
 */
export type FamilleVariete = "titre-seul" | "rangees" | "grille" | "duo" | "donnee" | "appel";

export const FAMILLE_VARIETE: Record<TypePage | "T29", FamilleVariete> = {
  T01: "titre-seul",
  T01B: "titre-seul",
  T01C: "titre-seul",
  T10: "titre-seul",
  T06: "rangees",
  T23: "rangees",
  T27: "rangees",
  T02: "grille",
  T08: "duo",
  T22: "duo",
  T24: "duo",
  T26: "duo",
  T20: "donnee",
  T28: "donnee",
  T21: "appel",
  T29: "appel",
};

export const LIBELLE_FAMILLE: Record<FamilleVariete, string> = { "titre-seul": "titre seul", rangees: "rangées", grille: "grille", duo: "duo", donnee: "donnée", appel: "appel" };

export const familleDe = (type: string): FamilleVariete | undefined => (Object.hasOwn(FAMILLE_VARIETE, type) ? FAMILLE_VARIETE[type as TypePage] : undefined);

/** Types dessinés sur fond encre. Une seule page sombre par carrousel, en page 2 ou en dernière page. */
export const TYPES_SOMBRES: readonly string[] = ["T21"];

/** La page d'index `index` (0 = couverture) peut-elle être sombre dans un carrousel de `total` pages ? */
export const placeSombrePermise = (index: number, total: number): boolean => index === 1 || index === total - 1;

/**
 * Types qui posent un aplat orange de plus de 12 % de la page (mesuré sur les gabarits, `docs/carrousels/style-c-a.md`), et ce qu'il porte :
 * aucun n'est jamais vide (la couverture a toujours une illustration, `illustrationCouverture`). Un seul par carrousel.
 */
export const SURFACE_ORANGE: Partial<Record<TypePage | "T29", string>> = {
  T01: "le bloc du bas, avec l'illustration",
  T01B: "la demi-page du haut, avec l'illustration",
  T01C: "le bloc du titre",
  T08: "la moitié « après »",
  T10: "le bloc du message",
};
