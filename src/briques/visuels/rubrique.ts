// Rubrique AFFICHÉE au-dessus du titre d'une page intérieure. Hors de `textes-fixes.ts` (qui ne porte que des textes) : la règle vit ici,
// les textes viennent de `RUBRIQUES`.
import { RUBRIQUES, type TypePageAvecRubrique } from "./textes-fixes";

/** Minuscules, sans accent, apostrophes et ponctuation ramenées à une espace. */
const motsCompares = (texte: string): string =>
  ` ${texte.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

/**
 * Rubrique à afficher au-dessus du titre, ou `undefined` quand le titre la dit déjà (« Idée reçue, réalité » sous « IDÉE REÇUE ») :
 * la rubrique, sans son article de tête, est comparée mot pour mot au titre, sans casse ni accents.
 */
export function rubriqueAffichee(type: TypePageAvecRubrique, titre: string | undefined): string | undefined {
  const rubrique = RUBRIQUES[type];
  const coeur = motsCompares(rubrique).replace(/^ (?:le|la|les|l) /u, " ");
  return titre && motsCompares(titre).includes(coeur) ? undefined : rubrique;
}
