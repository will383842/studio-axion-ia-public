/**
 * Outils communs des lecteurs de crédit (lot « crédits », 02/10, D2).
 * Une clé ne sort JAMAIS d'ici : ni dans une réponse, ni dans un message, ni dans un journal (seulement « …a1B2 »).
 */
import { finDeCle, masquerCles } from "@/domaine/credits";
import type { TestConnexion } from "../types";

export type Env = Record<string, string | undefined>;
export type Fetch = typeof fetch;

export const DELAI_LECTURE_MS = 15_000;

export function cleDans(env: Env, variable: string): string | undefined {
  const c = env[variable]?.trim();
  return c ? c : undefined;
}

/** Résultat d'un test : statut, 4 derniers caractères, message court ; la clé elle-même n'y est jamais. */
export function resultatTest(ok: boolean, cle: string | undefined, message: string): TestConnexion {
  return { ok, finCle: finDeCle(cle), message: masquerCles(message, [cle]), testeLe: new Date().toISOString() };
}

export const CLE_ABSENTE = "Aucune clé sur le serveur.";

/** Erreur d'une lecture de solde : code court (`refuse` : clé refusée, `indisponible` : réessayer plus tard). */
export class ErreurLecture extends Error {
  constructor(
    public readonly code: "refuse" | "indisponible" | "absente" | "inconnu",
    message: string,
  ) {
    super(message);
    this.name = "ErreurLecture";
  }
}

/** GET JSON avec délai ; 401/403 → `refuse`, réseau / 429 / 5xx → `indisponible`. Les messages sont masqués. */
export async function lireJson(appeler: Fetch, url: string, entetes: Record<string, string>, nom: string, cle: string): Promise<unknown> {
  let r: Response;
  try {
    r = await appeler(url, { method: "GET", headers: { accept: "application/json", ...entetes }, signal: AbortSignal.timeout(DELAI_LECTURE_MS) });
  } catch {
    throw new ErreurLecture("indisponible", `${nom} ne répond pas.`);
  }
  if (r.status === 401 || r.status === 403) throw new ErreurLecture("refuse", `${nom} refuse la clé.`);
  // Le code HTTP va en console serveur seulement : Will lit une phrase simple (garde-ecran).
  if (r.status === 429 || r.status >= 500) {
    console.warn(`[crédits] ${nom} : réponse ${r.status}`);
    throw new ErreurLecture("indisponible", `${nom} est momentanément indisponible.`);
  }
  if (!r.ok) {
    console.warn(masquerCles(`[crédits] ${nom} : réponse ${r.status}`, [cle]));
    throw new ErreurLecture("inconnu", `${nom} a répondu de façon inattendue. Réessayez plus tard.`);
  }
  try {
    return await r.json();
  } catch {
    throw new ErreurLecture("inconnu", `${nom} : réponse illisible.`);
  }
}

/** Message de test pour Will à partir d'une erreur de lecture. */
export function messageErreur(e: unknown, nom: string): string {
  if (e instanceof ErreurLecture) {
    if (e.code === "refuse") return "Clé refusée : remplacez-la dans Coolify, redémarrez, puis testez à nouveau.";
    if (e.code === "indisponible") return `${nom} ne répond pas pour l'instant. Réessayez dans un instant.`;
    return e.message;
  }
  return `${nom} : lecture impossible.`;
}
