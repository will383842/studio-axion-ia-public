/**
 * Lecture HTTP des sources publiques de la veille : délai maximal, agent identifiable, aucune clé envoyée
 * (sauf `GITHUB_TOKEN_VEILLE`, facultatif, pour le quota GitHub). Une réponse non 2xx = source muette.
 */
import { createHash } from "node:crypto";

export const DELAI_SOURCE_MS = 15_000;
export const AGENT_VEILLE = "Mozilla/5.0 (compatible; veille-studio-axion-ia/1.0; +https://studio.axion-ia.com)";

export class SourceMuette extends Error {
  constructor(public readonly raison: string) {
    super(raison);
    this.name = "SourceMuette";
  }
}

async function lire(appeler: typeof fetch, url: string, delaiMs: number, entetes: Record<string, string> = {}): Promise<Response> {
  let r: Response;
  try {
    r = await appeler(url, { headers: { "user-agent": AGENT_VEILLE, ...entetes }, signal: AbortSignal.timeout(delaiMs), redirect: "follow" });
  } catch {
    throw new SourceMuette("La source ne répond pas.");
  }
  if (r.status === 404) throw new SourceMuette("Adresse introuvable.");
  if (r.status === 401 || r.status === 403) throw new SourceMuette("La source refuse la lecture.");
  if (r.status === 429) throw new SourceMuette("Trop de lectures : nouvel essai demain.");
  if (!r.ok) throw new SourceMuette(`La source a répondu ${r.status}.`);
  return r;
}

export async function lireJson<T>(appeler: typeof fetch, url: string, delaiMs: number, entetes: Record<string, string> = {}): Promise<T> {
  const r = await lire(appeler, url, delaiMs, { accept: "application/json", ...entetes });
  try {
    return (await r.json()) as T;
  } catch {
    throw new SourceMuette("Réponse illisible.");
  }
}

export async function lireTexte(appeler: typeof fetch, url: string, delaiMs: number, entetes: Record<string, string> = {}): Promise<string> {
  const r = await lire(appeler, url, delaiMs, entetes);
  return r.text();
}

/** Empreinte courte (16 caractères hexadécimaux) d'un texte. */
export function empreinte(texte: string): string {
  return createHash("sha256").update(texte).digest("hex").slice(0, 16);
}
