/**
 * Pages sombres des carrousels (règles de variété L7) : tables PURES. La famille de mise en page d'un type est celle du registre
 * (`PAGES[type].famille`, `briques/visuels/registre-pages.ts`), seule source.
 */

/** Types sombres de CONTENU (fond encre), seuls permis en page 2. Aucun pour l'instant. */
export const TYPES_SOMBRES_CONTENU: readonly string[] = [];

/** Types dessinés sur fond encre : la dernière page (T21) et les types sombres de contenu. Une seule page sombre par carrousel. */
export const TYPES_SOMBRES: readonly string[] = ["T21", ...TYPES_SOMBRES_CONTENU];

/**
 * La page sombre de type `type`, d'index `index` (0 = couverture), est-elle à sa place dans un carrousel de `total` pages ? En dernière
 * page toujours ; en page 2 seulement pour un type sombre de contenu (T21 en page 2 retirerait l'invitation finale).
 */
export const placeSombrePermise = (type: string, index: number, total: number): boolean => index === total - 1 || (index === 1 && TYPES_SOMBRES_CONTENU.includes(type));
