/**
 * Porte de l'usine (idées de l'usine, onglet Idées d'Écrire). SERVEUR UNIQUEMENT : le secret ne quitte jamais ce fichier.
 * Éteinte tant que USINE_URL ou USINE_PORTE_SECRET manque : rien ne change alors dans le studio.
 * `fetch` est injectable (les tests ne touchent jamais le réseau).
 */
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { ErreurStudio } from "@/services/_commun";
import { lireIdeesUsine, lireMetiersUsine, NB_IDEES_USINE, type FiltresUsine, type IdeeUsine, type MetierUsine, type OrigineUsine } from "@/domaine/usine";

export const DELAI_PORTE_USINE_MS = 10_000;

type Env = { USINE_URL?: string; USINE_PORTE_SECRET?: string };
type Appel = typeof fetch;
export interface Options {
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

let retenuesEchouees = 0;
/** Nombre de retenues que l'usine n'a pas pu noter depuis le démarrage du serveur (le sujet existe quand même au Studio). */
export function compterRetenuesEchouees(): number {
  return retenuesEchouees;
}
export function reinitialiserRetenuesEchouees(): void {
  retenuesEchouees = 0;
}

/** Jour et réseau visés au calendrier : facultatifs côté porte, toujours donnés ensemble (contrat `retenir`, PR #50 de l'usine). */
export interface ViseeUsine {
  jour: string;
  reseau: string;
}
const viseeCourante = new AsyncLocalStorage<ViseeUsine>();
/** Le temps de `f`, les retenues faites vers l'usine portent aussi le jour et le réseau visés (sans changer `ecrireSujetDeLUsine`). */
export function avecViseeUsine<T>(visee: ViseeUsine, f: () => Promise<T>): Promise<T> {
  return viseeCourante.run(visee, f);
}
export function viseeUsineCourante(): ViseeUsine | undefined {
  return viseeCourante.getStore();
}

/** Dit à l'usine que ce sujet est pris. Renvoie false (sans lever) si l'appel échoue : le sujet existe déjà. Chaque échec est compté. */
export async function retenirSujetUsine(origine: OrigineUsine, referenceStudio: string, o: Options = {}): Promise<boolean> {
  try {
    const visee = viseeCourante.getStore();
    await appeler("/api/porte/sujets/retenir", { methode: "POST", corps: { signature: origine.signature, parts: origine.parts, type_contenu: origine.typeContenu, reference_studio: referenceStudio, ...(visee ? { jour: visee.jour, reseau: visee.reseau } : {}) } }, o);
    return true;
  } catch {
    retenuesEchouees += 1;
    return false;
  }
}

/** Une ligne de la semaine proposée par l'usine, telle que la porte la dit (lue champ par champ, aucun statut n'est repris). */
export interface LigneSemaineUsine {
  cle: string;
  jour: string;
  reseau: string;
  type: string;
  heure?: string;
  titre?: string;
  pourquoi?: string;
  ressembleA?: string;
  /** Le sujet à retenir (même forme qu'une ligne de `/sujets`). Absent ou illisible : pas de bouton « Retenir ce sujet ». */
  sujet?: IdeeUsine;
}

const texteOptionnel = (v: unknown, max = 300): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** Lit la réponse `{ propositions: [...] }` ; une ligne qui n'est pas un objet avec clé, jour, réseau et type est ignorée. Le statut de l'usine n'est jamais lu. */
export function lireSemaineUsine(corps: unknown): LigneSemaineUsine[] {
  const lignes = corps && typeof corps === "object" ? (corps as { propositions?: unknown }).propositions : undefined;
  if (!Array.isArray(lignes)) return [];
  const sortie: LigneSemaineUsine[] = [];
  for (const l of lignes) {
    if (!l || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    const cle = texteOptionnel(o.cle, 120);
    if (!cle || typeof o.jour !== "string" || typeof o.reseau !== "string" || typeof o.type !== "string") continue;
    const heure = texteOptionnel(o.heure, 5);
    const titre = texteOptionnel(o.titre);
    const pourquoi = texteOptionnel(o.pourquoi);
    const ressembleA = texteOptionnel(o.ressemble_a);
    const sujet = o.sujet && typeof o.sujet === "object" ? lireIdeesUsine({ lignes: [o.sujet] })[0] : undefined;
    sortie.push({ cle, jour: o.jour, reseau: o.reseau, type: o.type, ...(sujet ? { sujet } : {}), ...(heure ? { heure } : {}), ...(titre ? { titre } : {}), ...(pourquoi ? { pourquoi } : {}), ...(ressembleA ? { ressembleA } : {}) });
  }
  return sortie;
}

/**
 * Demande à l'usine de PROPOSER une semaine (tirage, rythmes, anti-répétition : tout se passe côté usine, le Studio ne choisit aucun sujet).
 * La demande ne porte aucun statut : l'usine ne peut rien écrire dans le calendrier par cet appel, le Studio affiche seulement.
 */
export async function proposerSemaineUsine(demande: { debut: string; reseaux?: readonly string[] }, o: Options = {}): Promise<LigneSemaineUsine[]> {
  const corps = { debut: demande.debut, ...(demande.reseaux?.length ? { reseaux: [...demande.reseaux] } : {}) };
  return lireSemaineUsine(await appeler("/api/porte/planification/semaine", { methode: "POST", corps }, o));
}
