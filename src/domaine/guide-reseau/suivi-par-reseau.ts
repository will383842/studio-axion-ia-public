// Suivi par réseau (fiche « Détail du mot ») — aides PURES : classement du réseau et somme de fenêtres.
// Agrégats seulement : aucun nom, aucune clé, aucun identifiant de personne.
export const RESEAUX_SUIVIS = ["facebook", "instagram", "linkedin", "tiktok"] as const;
export const RESEAU_NON_PRECISE = "non_precise";
export const RESEAU_AUTRE = "autre";
/** Ordre d'affichage : les quatre réseaux, puis « autre », puis « non précisé ». */
export const ORDRE_RESEAUX: readonly string[] = [...RESEAUX_SUIVIS, RESEAU_AUTRE, RESEAU_NON_PRECISE];

/** Réseau absent ou vide (ancien enregistrement) → « non_precise » ; texte non reconnu → « autre ». Jamais d'exception. */
export function classerReseau(brut: unknown): string {
  if (typeof brut !== "string") return RESEAU_NON_PRECISE;
  const t = brut.trim().toLowerCase();
  if (t === "") return RESEAU_NON_PRECISE;
  return (RESEAUX_SUIVIS as readonly string[]).includes(t) ? t : RESEAU_AUTRE;
}
