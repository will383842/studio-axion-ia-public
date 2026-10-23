/**
 * Porte de l'usine (idées de l'usine, onglet Idées d'Écrire). SERVEUR UNIQUEMENT : le secret ne quitte jamais ce fichier.
 * Éteinte tant que USINE_URL ou USINE_PORTE_SECRET manque : rien ne change alors dans le studio.
 * `fetch` est injectable (les tests ne touchent jamais le réseau).
 */
import "server-only";
import { ErreurStudio } from "@/services/_commun";
import { lireIdeesUsine, lireMetiersUsine, NB_IDEES_USINE, type FiltresUsine, type IdeeUsine, type MetierUsine, type OrigineUsine } from "@/domaine/usine";

export const DELAI_PORTE_USINE_MS = 10_000;

type Env = { USINE_URL?: string; USINE_PORTE_SECRET?: string };
type Appel = typeof fetch;
interface Options {
  env?: Env;
  fetchImpl?: Appel;
  delaiMs?: number;
}

/** L'usine exige un secret d'au moins 32 caractères, sinon sa porte est éteinte (404) : même règle ici. */
export const LONGUEUR_MIN_SECRET_USINE = 32;

export function usineActive(env: Env = process.env as Env): boolean {
  return !!env.USINE_URL?.trim() && (env.USINE_PORTE_SECRET?.trim().length ?? 0) >= LONGUEUR_MIN_SECRET_USINE;
}

/** Message selon le corps d'erreur de la porte `{ erreur, code }`. */
async function erreurDePorte(r: Response): Promise<ErreurStudio> {
  const corps = (await r.json().catch(() => null)) as { erreur?: unknown; code?: unknown } | null;
  const phrase = typeof corps?.erreur === "string" && corps.erreur.trim() ? corps.erreur.trim() : undefined;
  const code = typeof corps?.code === "string" ? corps.code : undefined;
  if (r.status === 409 || r.status === 400) return new ErreurStudio("USINE_" + (code ?? "DEMANDE").toUpperCase(), phrase ?? "L'usine n'a pas pu traiter cette demande.");
  if (r.status === 404) return new ErreurStudio("USINE_PORTE_ETEINTE", "La porte de l'usine est éteinte côté usine (clé absente ou trop courte). Vérifiez la configuration de l'usine.");
  if (r.status === 413) return new ErreurStudio("USINE_TROP_GROS", "La demande est trop volumineuse pour l'usine.");
  if (r.status === 415) return new ErreurStudio("USINE_FORMAT", "L'usine n'accepte pas ce format de demande.");
  return new ErreurStudio("USINE_ERREUR", "L'usine a répondu par une erreur. Réessayez dans un instant.");
}

async function appeler(chemin: string, init: { methode: "GET" | "POST"; corps?: unknown }, o: Options): Promise<unknown> {
  const env = o.env ?? (process.env as Env);
  if (!usineActive(env)) throw new ErreurStudio("USINE_ETEINTE", "L'usine n'est pas reliée.");
  const url = `${env.USINE_URL!.trim().replace(/\/+$/, "")}${chemin}`;
  const ctl = new AbortController();
  const minuteur = setTimeout(() => ctl.abort(), o.delaiMs ?? DELAI_PORTE_USINE_MS);
  try {
    const r = await (o.fetchImpl ?? fetch)(url, {
      method: init.methode,
      headers: { Authorization: `Bearer ${env.USINE_PORTE_SECRET!.trim()}`, ...(init.corps !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.corps !== undefined ? JSON.stringify(init.corps) : undefined,
      signal: ctl.signal,
      cache: "no-store",
    });
    if (r.status === 401 || r.status === 403) throw new ErreurStudio("USINE_REFUS", "L'usine refuse la clé de connexion. Vérifiez-la dans la configuration du serveur.");
    if (!r.ok) throw await erreurDePorte(r);
    return await r.json();
  } catch (e) {
    if (e instanceof ErreurStudio) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new ErreurStudio("USINE_DELAI", "L'usine ne répond pas (plus de 10 secondes). Réessayez dans un instant.");
    throw new ErreurStudio("USINE_INJOIGNABLE", "L'usine ne répond pas. Réessayez dans un instant.");
  } finally {
    clearTimeout(minuteur);
  }
}

export async function proposerIdeesUsine(f: FiltresUsine, o: Options = {}): Promise<IdeeUsine[]> {
  const corps = {
    n: NB_IDEES_USINE,
    type_contenu: f.type,
    reseaux: f.reseaux,
    ...(f.metiers.length ? { metiers: f.metiers } : {}),
    ...(f.tailles.length ? { tailles: f.tailles } : {}),
  };
  return lireIdeesUsine(await appeler("/api/porte/sujets", { methode: "POST", corps }, o));
}

export async function listerMetiersUsine(o: Options = {}): Promise<MetierUsine[]> {
  return lireMetiersUsine(await appeler("/api/porte/metiers", { methode: "GET" }, o));
}

/** Dit à l'usine que ce sujet est pris. Renvoie false (sans lever) si l'appel échoue : le sujet existe déjà. */
export async function retenirSujetUsine(origine: OrigineUsine, referenceStudio: string, o: Options = {}): Promise<boolean> {
  try {
    await appeler("/api/porte/sujets/retenir", { methode: "POST", corps: { signature: origine.signature, parts: origine.parts, type_contenu: origine.typeContenu, reference_studio: referenceStudio } }, o);
    return true;
  } catch {
    return false;
  }
}
