/**
 * Petits outils COMMUNS des demandes à `studio-rendu` (lots R4-R5) : une seule copie pour les fournisseurs et les
 * services qui signent des adresses pour le serveur de rendu.
 */

/** Validité des adresses signées données au serveur de rendu (lecture des entrées, dépôt du résultat). */
export const VALIDITE_ADRESSES_RENDU_SEC = 3600;

/** Segment d'environnement des clés de stockage : `studio/{prod|dev}/…`. */
export function segmentStockage(env: Record<string, string | undefined> = process.env): "prod" | "dev" {
  return env.NODE_ENV === "production" ? "prod" : "dev";
}

/** Morceau d'identifiant de rendu sûr (`idRendu` n'accepte que lettres, chiffres, « _ . : - »), 60 signes au plus. */
export function identifiantSur(s: string): string {
  return s.replace(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 60);
}

/** Attente réelle (remplacée dans les tests). */
export const attendreParDefaut = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
