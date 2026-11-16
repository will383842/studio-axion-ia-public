// Suivi par réseau (fiche « Détail du mot ») — aides PURES : classement du réseau et somme de fenêtres.
// Agrégats seulement : aucun nom, aucune clé, aucun identifiant de personne.
export const RESEAUX_SUIVIS = ["facebook", "instagram", "linkedin", "tiktok"] as const;
export const RESEAU_NON_PRECISE = "non_precise";
export const RESEAU_AUTRE = "autre";
/** Ordre d'affichage : les quatre réseaux, puis « autre », puis « non précisé ». */
export const ORDRE_RESEAUX: readonly string[] = [...RESEAUX_SUIVIS, RESEAU_AUTRE, RESEAU_NON_PRECISE];

/** Noms envoyés par le Studio → clé d'affichage. « page_guide » n'est pas un réseau : « non précisé ». */
const ALIAS_RESEAUX: Readonly<Record<string, string>> = {
  linkedin_page: "linkedin",
  page_guide: RESEAU_NON_PRECISE,
};

/** Réseau absent ou vide (ancien enregistrement) → « non_precise » ; texte non reconnu → « autre ». Jamais d'exception. */
export function classerReseau(brut: unknown): string {
  if (typeof brut !== "string") return RESEAU_NON_PRECISE;
  const t = brut.trim().toLowerCase();
  if (t === "") return RESEAU_NON_PRECISE;
  const cle = ALIAS_RESEAUX[t] ?? t;
  return (RESEAUX_SUIVIS as readonly string[]).includes(cle) || cle === RESEAU_NON_PRECISE ? cle : RESEAU_AUTRE;
}
