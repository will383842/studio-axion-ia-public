/**
 * ÉCOUTE PAR LE RELAIS DU STUDIO (lot M0b) — PUR.
 * La page ne lit JAMAIS un domaine tiers (CSP inchangée) : un son de voix est écouté par `/api/voix/ecoute?cle=…`,
 * qui relit le fichier côté serveur. Trois sources seulement :
 *  - `local` : un fichier du studio (`/demo/…`) — servi tel quel ;
 *  - `distant` : une adresse HeyGen (son d'essai, aperçu d'une voix) — seuls les domaines HeyGen sont relus ;
 *  - `stockage` : une clé du stockage du studio (`studio/…`, R2) — relue par une adresse signée courte.
 * Tout le reste est refusé (pas de relais ouvert).
 */
export type SourceEcoute = { genre: "local"; chemin: string } | { genre: "distant"; url: string } | { genre: "stockage"; cle: string };

/** Domaines HeyGen dont le relais accepte de relire un son. */
export const DOMAINES_HEYGEN = /^(?:[a-z0-9-]+\.)*heygen\.(?:ai|com)$/i;

export function classerSourceEcoute(cle: string | null | undefined): SourceEcoute | null {
  const c = (cle ?? "").trim();
  if (!c || c.length > 2000) return null;
  if (c.startsWith("/") && !c.startsWith("//") && !c.includes("..") && /^\/[\w\-./]+$/.test(c)) return { genre: "local", chemin: c };
  if (/^https:\/\//i.test(c)) {
    try {
      const u = new URL(c);
      return u.protocol === "https:" && DOMAINES_HEYGEN.test(u.hostname) && !u.username && !u.password ? { genre: "distant", url: u.toString() } : null;
    } catch {
      return null;
    }
  }
  if (/^studio\/[\w\-./]+$/.test(c) && !c.includes("..")) return { genre: "stockage", cle: c };
  return null;
}

/** Adresse d'écoute d'un son pour la page : le fichier local tel quel, le reste par le relais. Chaîne vide : rien. */
export function urlEcoute(cle: string | null | undefined): string {
  const source = classerSourceEcoute(cle);
  if (!source) return "";
  if (source.genre === "local") return source.chemin;
  return `/api/voix/ecoute?cle=${encodeURIComponent(source.genre === "distant" ? source.url : source.cle)}`;
}
