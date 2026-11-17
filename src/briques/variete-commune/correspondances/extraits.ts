/** Extraits : clés d'usage `extrait:<elementId>:<plageId>` → valeurs de l'axe commun `objets` (une par source). Rien ne l'importe encore. */
const PREFIXE_ARCHIVE = "archive-extraits-";

/** Nombre de sources récentes retenues par le réseau (lu plus tard par X2-10). */
export const SOURCES_RECENTES_RESEAU = 3;

export function valeursObjetsExtraits(
  clesUsage: readonly string[],
  sourceDe?: (elementId: string) => string | undefined,
): string[] {
  const sources = new Set<string>();
  for (const cle of clesUsage) {
    const morceaux = cle.split(":");
    if (morceaux.length < 3 || morceaux[0] !== "extrait" || !morceaux[1] || !morceaux[2]) continue;
    const elementId = morceaux[1];
    const id =
      sourceDe?.(elementId) ??
      (elementId.startsWith(PREFIXE_ARCHIVE) && elementId.length > PREFIXE_ARCHIVE.length
        ? elementId.slice(PREFIXE_ARCHIVE.length)
        : elementId);
    sources.add(`source:${id}`);
  }
  return [...sources].sort();
}
