/**
 * LOTS GROUPÉS CLAUDE — API Message Batches, à MOITIÉ PRIX (lot « Idées : comité éditorial », 17/10). `fetch`, SANS SDK,
 * serveur seulement. Le client des messages (`client.ts`) n'est pas touché : la requête d'un lot est la MÊME
 * (`corpsRequete`), moins ce que l'API des lots refuse.
 *
 * Formes vérifiées dans la documentation officielle (platform.claude.com, « Batch processing », relevé du 17/10) :
 *  - `POST /v1/messages/batches`, corps `{ requests: [{ custom_id, params }] }` (`params` = une requête Messages) ;
 *  - `GET /v1/messages/batches/{id}` : `processing_status` (`in_progress` → `canceling` → `ended`),
 *    `request_counts` { processing, succeeded, errored, canceled, expired }, `results_url` (null avant la fin),
 *    `created_at`, `expires_at` (24 h), `ended_at` ;
 *  - résultats : `.jsonl` à `results_url`, UNE ligne par requête, dans N'IMPORTE QUEL ORDRE (lier par `custom_id`) :
 *    `{ custom_id, result: { type: "succeeded", message } }` ; `errored` (`result.error`, forme d'erreur standard,
 *    non facturé) ; `canceled` et `expired` (non facturés) ;
 *  - `POST /v1/messages/batches/{id}/cancel` ; `GET /v1/messages/batches?limit=` : `{ data: [message_batch…] }`, les
 *    plus récents d'abord ;
 *  - REFUSÉS dans un lot : `stream: true`, `speed`, `max_tokens: 0` ; `fallbacks` est refusé par l'API des lots
 *    (skill `claude-api`) : ni le paramètre ni l'en-tête bêta du repli ne partent ;
 *  - 50 % de remise sur TOUS les jetons (cache compris) ; cache 1 h conseillé (un lot peut durer plus de 5 min).
 * Erreurs classées comme le client des messages (`classerErreur`), messages masqués.
 */
import "server-only";
import { classerErreur, corpsRequete, ErreurClaude, extraireJson, VERSION_API, type OptionsClient, type ReponseClaude, type RequeteClaude } from "./client";
import type { JetonsClaude } from "./tarifs";

export const URL_LOTS = "https://api.anthropic.com/v1/messages/batches";
/** Remise de l'API des lots : 50 % sur tous les jetons. */
export const REMISE_LOT = 0.5;
/** Délai d'un appel HTTP aux lots (création, lecture, résultats) : réponses courtes, sans flux. */
export const DELAI_HTTP_LOT_MS = 60_000;

export type StatutLot = "in_progress" | "canceling" | "ended";

export interface EtatLot {
  id: string;
  statut: StatutLot;
  compteurs: { enCours: number; reussis: number; enErreur: number; annules: number; expires: number };
  urlResultats: string | null;
  creeLe?: string;
  expireLe?: string;
  finiLe?: string | null;
}

export interface DemandeLot {
  /** `custom_id` : 1 à 64 caractères, lettres, chiffres, `-` et `_`. */
  idPerso: string;
  requete: RequeteClaude;
}

export type ResultatLot =
  | { idPerso: string; type: "succeeded"; reponse: ReponseClaude }
  | { idPerso: string; type: "errored"; erreur: ErreurClaude }
  | { idPerso: string; type: "canceled" | "expired" };

/** `params` d'une requête de lot (exporté pour les tests) : la requête Messages, sans flux ni repli serveur. */
export function paramsLot(r: RequeteClaude): Record<string, unknown> {
  const { stream: _flux, fallbacks: _repli, ...params } = corpsRequete(r);
  void _flux;
  void _repli;
  return params;
}

/** Corps de création d'un lot (exporté pour les tests : aucune clé n'y figure). */
export function corpsLot(demandes: readonly DemandeLot[]): { requests: { custom_id: string; params: Record<string, unknown> }[] } {
  if (!demandes.length) throw new ErreurClaude("requete", "Lot vide.");
  const vus = new Set<string>();
  for (const d of demandes) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(d.idPerso)) throw new ErreurClaude("requete", `Identifiant de requête invalide : ${d.idPerso}`);
    if (vus.has(d.idPerso)) throw new ErreurClaude("requete", `Identifiant de requête en double : ${d.idPerso}`);
    vus.add(d.idPerso);
  }
  return { requests: demandes.map((d) => ({ custom_id: d.idPerso, params: paramsLot(d.requete) })) };
}

function entier(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

/** Lit l'objet `message_batch` de l'API (PUR, exporté pour les tests). */
export function lireEtatLot(j: Record<string, unknown>): EtatLot {
  const statut = j.processing_status;
  if (typeof j.id !== "string" || (statut !== "in_progress" && statut !== "canceling" && statut !== "ended")) throw new ErreurClaude("illisible", "Claude : lot illisible.");
  const c = (j.request_counts ?? {}) as Record<string, unknown>;
  return {
    id: j.id,
    statut,
    compteurs: { enCours: entier(c.processing), reussis: entier(c.succeeded), enErreur: entier(c.errored), annules: entier(c.canceled), expires: entier(c.expired) },
    urlResultats: typeof j.results_url === "string" ? j.results_url : null,
    ...(typeof j.created_at === "string" ? { creeLe: j.created_at } : {}),
    ...(typeof j.expires_at === "string" ? { expireLe: j.expires_at } : {}),
    finiLe: typeof j.ended_at === "string" ? j.ended_at : null,
  };
}

function jetonsDe(usage: Record<string, unknown> | undefined): JetonsClaude {
  const detail = (usage?.cache_creation ?? undefined) as Record<string, unknown> | undefined;
  const ecrit1h = detail?.ephemeral_1h_input_tokens;
  return {
    entree: entier(usage?.input_tokens),
    cacheLu: entier(usage?.cache_read_input_tokens),
    cacheEcrit: entier(usage?.cache_creation_input_tokens),
    ...(typeof ecrit1h === "number" ? { cacheEcrit1h: ecrit1h } : {}),
    sortie: entier(usage?.output_tokens),
  };
}

/**
 * Un `message` réussi d'un lot, sous la forme d'une réponse du client des messages (PUR, exporté pour les tests) :
 * texte des blocs `text` seulement (pensée ignorée) ; JSON demandé : extrait comme pour un appel normal, jamais si la
 * réponse est coupée (`max_tokens`). `jetons` : le prix PLEIN (la remise s'applique au coût, `coutLotUsd`).
 */
export function reponseDuMessage(message: Record<string, unknown>, requete: Pick<RequeteClaude, "modele" | "json">): ReponseClaude {
  const blocs = Array.isArray(message.content) ? (message.content as Record<string, unknown>[]) : [];
  const brut = blocs.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text as string).join("");
  const stopReason = typeof message.stop_reason === "string" ? message.stop_reason : null;
  return {
    ...(typeof message.id === "string" ? { idMessage: message.id } : {}),
    texte: requete.json && stopReason !== "max_tokens" ? extraireJson(brut) : brut,
    modeleDemande: requete.modele,
    modele: typeof message.model === "string" ? message.model : requete.modele,
    replis: [],
    stopReason,
    jetons: jetonsDe(message.usage as Record<string, unknown> | undefined),
  };
}

/**
 * Lit le fichier `.jsonl` des résultats (PUR, exporté pour les tests). Une ligne illisible ou d'un `custom_id` inconnu
 * est ignorée ; l'ordre n'est jamais supposé (`requetes` : par `custom_id`).
 */
export function lireResultatsJsonl(texte: string, requetes: ReadonlyMap<string, Pick<RequeteClaude, "modele" | "json">>, cles: (string | undefined)[] = []): ResultatLot[] {
  const sortie: ResultatLot[] = [];
  for (const ligne of texte.split(/\r?\n/)) {
    if (!ligne.trim()) continue;
    let j: { custom_id?: unknown; result?: Record<string, unknown> };
    try {
      j = JSON.parse(ligne) as typeof j;
    } catch {
      continue;
    }
    const idPerso = typeof j.custom_id === "string" ? j.custom_id : "";
    const requete = requetes.get(idPerso);
    const r = j.result ?? {};
    if (!requete) continue;
    if (r.type === "succeeded" && r.message && typeof r.message === "object") sortie.push({ idPerso, type: "succeeded", reponse: reponseDuMessage(r.message as Record<string, unknown>, requete) });
    else if (r.type === "errored") {
      // Forme d'erreur standard : `{ type: "error", error: { type, message } }` (ou directement `{ type, message }`).
      const e = (r.error ?? {}) as { type?: string; message?: string; error?: { type?: string; message?: string } };
      const interne = e.error ?? e;
      const statut = interne.type === "invalid_request_error" ? 400 : interne.type === "not_found_error" ? 404 : interne.type === "overloaded_error" ? 529 : 500;
      sortie.push({ idPerso, type: "errored", erreur: classerErreur(statut, interne.type, interne.message ?? "", cles) });
    } else if (r.type === "canceled" || r.type === "expired") sortie.push({ idPerso, type: r.type });
  }
  return sortie;
}

/** Appel HTTP court (JSON ou texte), délai borné ; toute erreur sort en `ErreurClaude`, message masqué. */
async function appelHttp(url: string, init: { method: "GET" | "POST"; corps?: unknown }, o: OptionsClient & { delaiMs?: number }): Promise<Response> {
  const appeler = o.fetch ?? fetch;
  const controle = new AbortController();
  let expire = false;
  const minuterie = setTimeout(() => {
    expire = true;
    controle.abort();
  }, o.delaiMs ?? DELAI_HTTP_LOT_MS);
  try {
    let reponse: Response;
    try {
      reponse = await appeler(url, {
        method: init.method,
        headers: { "content-type": "application/json", "x-api-key": o.cle, "anthropic-version": VERSION_API },
        ...(init.corps !== undefined ? { body: JSON.stringify(init.corps) } : {}),
        signal: controle.signal,
      });
    } catch {
      if (expire) throw new ErreurClaude("delai", "Claude n'a pas répondu à temps (lot).", undefined, true);
      throw new ErreurClaude("reseau", "Claude ne répond pas (réseau).", undefined, true);
    }
    if (!reponse.ok) {
      let type: string | undefined;
      let message = "";
      try {
        const j = (await reponse.json()) as { error?: { type?: string; message?: string } };
        type = j.error?.type;
        message = j.error?.message ?? "";
      } catch {
        /* corps illisible : le statut suffit */
      }
      const ra = Number(reponse.headers.get("retry-after"));
      throw classerErreur(reponse.status, type, message, [o.cle], Number.isFinite(ra) && ra > 0 ? ra : undefined, true);
    }
    return reponse;
  } finally {
    clearTimeout(minuterie);
  }
}

async function json(reponse: Response): Promise<Record<string, unknown>> {
  try {
    return (await reponse.json()) as Record<string, unknown>;
  } catch {
    throw new ErreurClaude("illisible", "Claude : réponse du lot illisible.");
  }
}

/** Crée un lot. Rien n'est facturé avant le traitement ; une requête en erreur ne l'est pas. */
export async function creerLot(demandes: readonly DemandeLot[], o: OptionsClient): Promise<EtatLot> {
  return lireEtatLot(await json(await appelHttp(URL_LOTS, { method: "POST", corps: corpsLot(demandes) }, o)));
}

/** État d'un lot. */
export async function lireLot(id: string, o: OptionsClient): Promise<EtatLot> {
  return lireEtatLot(await json(await appelHttp(`${URL_LOTS}/${encodeURIComponent(id)}`, { method: "GET" }, o)));
}

/** Lots récents (les plus récents d'abord, `GET /v1/messages/batches?limit=`) : retrouver un lot à la création incertaine. */
export async function listerLots(o: OptionsClient, limite = 100): Promise<EtatLot[]> {
  const j = await json(await appelHttp(`${URL_LOTS}?limit=${Math.min(Math.max(limite, 1), 1000)}`, { method: "GET" }, o));
  if (!Array.isArray(j.data)) throw new ErreurClaude("illisible", "Claude : liste des lots illisible.");
  return (j.data as Record<string, unknown>[]).map(lireEtatLot);
}

/** Résultats d'un lot FINI (`results_url`), liés par `custom_id`. */
export async function lireResultatsLot(etat: Pick<EtatLot, "urlResultats" | "statut">, requetes: ReadonlyMap<string, Pick<RequeteClaude, "modele" | "json">>, o: OptionsClient): Promise<ResultatLot[]> {
  if (etat.statut !== "ended" || !etat.urlResultats) throw new ErreurClaude("requete", "Lot pas encore fini.");
  if (!etat.urlResultats.startsWith("https://api.anthropic.com/")) throw new ErreurClaude("requete", "Adresse des résultats inattendue.");
  const reponse = await appelHttp(etat.urlResultats, { method: "GET" }, o);
  let texte: string;
  try {
    texte = await reponse.text();
  } catch {
    throw new ErreurClaude("reseau", "Claude : résultats du lot interrompus.", undefined, true);
  }
  return lireResultatsJsonl(texte, requetes, [o.cle]);
}

/** Demande l'annulation d'un lot (les requêtes non traitées ne sont pas facturées). */
export async function annulerLot(id: string, o: OptionsClient): Promise<EtatLot> {
  return lireEtatLot(await json(await appelHttp(`${URL_LOTS}/${encodeURIComponent(id)}/cancel`, { method: "POST" }, o)));
}
