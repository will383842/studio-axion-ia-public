/**
 * Outils communs des lecteurs de mesures (lot G7b) et du client Buffer (lot R1).
 * - `posterJson` : le SEUL transport « POST JSON avec la clé en en-tête » (Plausible, Buffer). Il ne lève jamais et ne
 *   dit rien de la clé : chaque appelant traduit le résultat en ses propres erreurs.
 * - `lireJsonPost` : LECTURE seule (Plausible `/api/v2/query`, statistiques Buffer) ; aucune requête n'écrit.
 * - `nettoyerDetail` : un texte venu d'un service, prêt pour le journal : sans clé (`masquerSecrets`) et sans partie
 *   signée d'adresse (`?X-Amz-…`, toute chaîne de requête).
 * Écart assumé entre les deux appelants : un 429 est « indisponible » pour une lecture de mesures, « limite » pour un
 * envoi Buffer (même conduite : réessayer plus tard, mais Will doit savoir que c'est un plafond d'envois).
 */
import { masquerSecrets } from "../claude/secret";

export type Env = Record<string, string | undefined>;
export type Fetch = typeof fetch;

export const DELAI_MESURE_MS = 15_000;

export class ErreurMesure extends Error {
  constructor(
    public readonly code: "absente" | "refuse" | "indisponible" | "illisible",
    message: string,
  ) {
    super(message);
    this.name = "ErreurMesure";
  }
}

export function cleDans(env: Env, variable: string): string | undefined {
  const c = env[variable]?.trim();
  return c ? c : undefined;
}

/** Résultat du transport : la réponse lue, ou ce qui a empêché de la lire (jamais la clé). */
export type RetourPost = { ok: true; status: number; corps: unknown } | { ok: false; raison: "reseau" } | { ok: false; raison: "http" | "illisible"; status: number };

/** POST JSON, clé dans `Authorization`, délai maximal. Un code d'erreur HTTP n'est pas lu (corps ignoré). */
export async function posterJson(appeler: Fetch, url: string, cle: string, corps: unknown, delaiMs: number = DELAI_MESURE_MS): Promise<RetourPost> {
  let r: Response;
  try {
    r = await appeler(url, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${cle}` },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(delaiMs),
    });
  } catch {
    return { ok: false, raison: "reseau" };
  }
  if (!r.ok) return { ok: false, raison: "http", status: r.status };
  try {
    return { ok: true, status: r.status, corps: await r.json() };
  } catch {
    return { ok: false, raison: "illisible", status: r.status };
  }
}

/** Texte d'un service prêt pour le journal : sans clé, sans partie signée d'adresse, 300 caractères au plus. */
export function nettoyerDetail(texte: string, cles: (string | undefined)[] = []): string {
  return masquerSecrets(texte, cles)
    .replace(/(https?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/g, "$1")
    .replace(/X-Amz-[A-Za-z-]+=?[^\s&"'<>]*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/**
 * Requête de LECTURE en JSON (Plausible `/api/v2/query` et l'interface GraphQL de Buffer ne lisent qu'en POST : le corps
 * est une question, jamais une modification). 401/403 → `refuse`, réseau / 429 / 5xx → `indisponible`. Aucun message
 * ne porte de code HTTP (il s'affiche à l'écran) : le code part en `console.warn` côté serveur.
 */
export async function lireJsonPost(appeler: Fetch, url: string, cle: string, corps: unknown, nom: string): Promise<unknown> {
  const r = await posterJson(appeler, url, cle, corps);
  if (r.ok) return r.corps;
  if (r.raison === "reseau") throw new ErreurMesure("indisponible", `${nom} ne répond pas.`);
  if (r.raison === "illisible") throw new ErreurMesure("illisible", `${nom} : réponse illisible.`);
  if (r.status === 401 || r.status === 403) throw new ErreurMesure("refuse", `${nom} refuse la clé.`);
  // Le code HTTP part au journal du serveur seulement : le message, lui, s'affiche à l'écran.
  console.warn(`[studio] ${nom} : réponse HTTP ${r.status}`);
  if (r.status === 429 || r.status >= 500) throw new ErreurMesure("indisponible", `${nom} est momentanément indisponible : réessayez dans un instant.`);
  throw new ErreurMesure("illisible", `${nom} n'a pas pu répondre : réessayez plus tard.`);
}
