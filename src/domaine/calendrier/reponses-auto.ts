/**
 * CAL-04 : quels réseaux acceptent la réponse automatique au mot-clé ?
 * Fonction unique, en lecture seule : elle ne déclenche rien. LinkedIn et TikTok : toujours non, quel que soit le réglage.
 */

/** Les seuls réseaux où la réponse automatique au mot-clé peut exister. */
const RESEAUX_REPONSE_AUTO: ReadonlySet<string> = new Set(["instagram", "facebook"]);

/** Réseaux où la réponse aux commentaires reste toujours à la main, avec leur nom lisible. */
const NOMS_A_LA_MAIN: Readonly<Record<string, string>> = { linkedin: "LinkedIn", tiktok: "TikTok" };

const normaliser = (reseau: unknown): string => (typeof reseau === "string" ? reseau.trim().toLowerCase() : "");

/** Vrai pour Instagram et Facebook seulement. Le réglage éventuel est ignoré : il ne peut jamais rouvrir LinkedIn ni TikTok. */
export function accepteReponseAutomatique(reseau: unknown, _reglage?: unknown): boolean {
  return RESEAUX_REPONSE_AUTO.has(normaliser(reseau));
}

/** Nom lisible du réseau où les réponses sont toujours à la main (LinkedIn, TikTok), sinon null. */
export function nomReponseALaMain(reseau: unknown): string | null {
  return NOMS_A_LA_MAIN[normaliser(reseau)] ?? null;
}
