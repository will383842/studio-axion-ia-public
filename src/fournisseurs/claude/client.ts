/**
 * CLIENT CLAUDE MINIMAL (lot G0, plan v5 B.3.2) — `fetch` + flux SSE, SANS SDK (`@anthropic-ai/sdk` n'est pas installé
 * et l'installation est exclue ici). Serveur seulement. Forme des requêtes vérifiée avec la skill `claude-api` (02/10) :
 *  - `POST https://api.anthropic.com/v1/messages`, en-têtes `x-api-key`, `anthropic-version: 2023-06-01` ;
 *  - Opus 5.5 / Sonnet 5.5 : pensée adaptative toujours active (on n'envoie PAS `thinking`), profondeur réglée par
 *    `output_config.effort` (fixe par rôle, toujours explicite : le défaut d'Opus 5.5 est `medium`) ; pas de
 *    `temperature` (refusée) ; pas de pré-remplissage ; pas de `tool_choice` forcé ;
 *  - sortie structurée : `output_config.format = { type: "json_schema", schema }`, SEULEMENT si `schema` est donné : les
 *    rôles ne l'envoient plus (un format propre à chaque rôle invalide le cache, relevé du 15/10) ; ils demandent le
 *    JSON dans leur consigne (`json: true` : une clôture Markdown entière autour de la réponse est retirée) ;
 *  - cache : `cache_control: { type: "ephemeral" }` (5 min) ou `{ type: "ephemeral", ttl: "1h" }` sur au plus 4 blocs de
 *    `system`, dans un ordre figé (B.3.3), les points 1 h AVANT les points 5 min (règle de l'API) ;
 *  - repli serveur en cas de refus : `fallbacks: "default"` + en-tête `anthropic-beta: server-side-fallback-2026-07-01` ;
 *  - flux (`stream: true`) : délai d'INACTIVITÉ 150 s, délai TOTAL 300 s par appel (B.3.2 ; relevés au banc G4 : un appel Opus en effort `high` peut rester muet plus de 60 s).
 * Erreurs classées (`ErreurClaude.code`) ; leurs messages sont TOUJOURS masqués (aucune clé ne sort d'ici).
 */
import "server-only";
import { masquerSecrets } from "./secret";
import type { JetonsClaude } from "./tarifs";

export const URL_MESSAGES = "https://api.anthropic.com/v1/messages";
export const VERSION_API = "2023-06-01";
export const BETA_REPLI = "server-side-fallback-2026-07-01";
export const DELAI_INACTIVITE_MS = 150_000;
export const DELAI_TOTAL_MS = 300_000;

export type EffortClaude = "low" | "medium" | "high" | "xhigh" | "max";

export interface RequeteClaude {
  modele: string;
  maxTokens: number;
  effort: EffortClaude;
  /** Blocs de `system` dans l'ordre FIGÉ ; `cache` pose un point de cache (au plus 4, B.3.3) : `true` = 5 min, `"1h"` = 1 h. */
  systeme: { texte: string; cache?: boolean | "1h" }[];
  /**
   * `images` (plan facecam v4, lot D, FACULTATIF) : images jointes au message (relecture des images de contrôle), placées
   * avant le texte. Absentes : le message part en texte seul, comme aujourd'hui.
   */
  messages: { role: "user" | "assistant"; contenu: string; images?: ImageClaude[] }[];
  /** Schéma JSON de la sortie structurée (déjà converti, `additionalProperties: false`). Les rôles ne l'envoient plus. */
  schema?: Record<string, unknown>;
  /** Réponse attendue : un objet JSON demandé dans la consigne (une clôture Markdown entière autour est retirée). */
  json?: boolean;
}

/** Image jointe (JPEG ou PNG en base64, sans en-tête `data:`), avec une légende lue juste avant elle. */
export interface ImageClaude {
  type: "image/jpeg" | "image/png";
  base64: string;
  legende?: string;
}

export interface ReponseClaude {
  idMessage?: string;
  texte: string;
  modeleDemande: string;
  /** Modèle qui a VRAIMENT répondu (repli compris) : le coût se calcule sur lui. */
  modele: string;
  /** Modèles qui ont décliné avant le repli (vide le plus souvent). */
  replis: string[];
  stopReason: string | null;
  jetons: JetonsClaude;
}

export type CodeErreurClaude = "facturation" | "modele-introuvable" | "surcharge" | "cle-refusee" | "requete" | "reseau" | "delai" | "illisible";

/** Erreur d'un appel Claude. `message` est déjà masqué ; `reessayable` : 429, 529, 5xx, coupure réseau. */
export class ErreurClaude extends Error {
  constructor(
    public readonly code: CodeErreurClaude,
    message: string,
    public readonly statut?: number,
    public readonly reessayable: boolean = false,
    /** Secondes conseillées par l'API (`retry-after`). */
    public readonly attenteSec?: number,
    /**
     * Refus rendu AVANT tout flux (réponse HTTP non-ok) : rien n'a été généré ni facturé. Seul un refus de facturation
     * « hors flux » autorise le passage au compte Claude suivant ; un billing_error DANS le flux ne le permet jamais.
     */
    public readonly horsFlux: boolean = false,
  ) {
    super(message);
    this.name = "ErreurClaude";
  }
  /** Pour `fournisseurDeLErreur` de la brique Crédits. */
  readonly fournisseur = "anthropic";
}

/** Corps JSON de la requête (exporté pour les tests : aucune clé n'y figure). */
export function corpsRequete(r: RequeteClaude): Record<string, unknown> {
  const points = r.systeme.filter((b) => b.cache);
  if (points.length > 4) throw new ErreurClaude("requete", "Au plus 4 points de cache par requête.");
  const premier5min = points.findIndex((b) => b.cache === true);
  if (premier5min >= 0 && points.slice(premier5min).some((b) => b.cache === "1h")) throw new ErreurClaude("requete", "Les points de cache 1 h viennent avant les points 5 min.");
  const outputConfig: Record<string, unknown> = { effort: r.effort };
  if (r.schema) {
    const { $schema: _ignore, ...schema } = r.schema;
    void _ignore;
    outputConfig.format = { type: "json_schema", schema };
  }
  return {
    model: r.modele,
    max_tokens: r.maxTokens,
    stream: true,
    ...(r.systeme.length ? { system: r.systeme.map((b) => ({ type: "text", text: b.texte, ...(b.cache ? { cache_control: b.cache === "1h" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" } } : {}) })) } : {}),
    messages: r.messages.map((m) =>
      m.images?.length
        ? {
            role: m.role,
            content: [
              ...m.images.flatMap((i) => [...(i.legende ? [{ type: "text", text: i.legende }] : []), { type: "image", source: { type: "base64", media_type: i.type, data: i.base64 } }]),
              { type: "text", text: m.contenu },
            ],
          }
        : { role: m.role, content: m.contenu },
    ),
    output_config: outputConfig,
    fallbacks: "default",
  };
}

/**
 * Classe une erreur de l'API (statut HTTP + `error.type` + message). Formes vérifiées dans la skill `claude-api` :
 * 402 `billing_error` ; 404 `not_found_error` dont le message commence par `model:` ; 429 `rate_limit_error` ;
 * 529 `overloaded_error` ; 500 `api_error`. Formes historiques AUSSI traitées comme facturation (à reconfirmer au
 * premier vrai refus, B.3.4) : 400 « Your credit balance is too low… » et « You have reached your specified API usage
 * limits… » (limite mensuelle du compte).
 */
export function classerErreur(statut: number, type: string | undefined, message: string, cles: (string | undefined)[] = [], attenteSec?: number, horsFlux = false): ErreurClaude {
  const propre = masquerSecrets(message, cles).slice(0, 300);
  const texte = `Claude : ${propre || `réponse ${statut}`}`;
  if (statut === 402 || type === "billing_error" || ([400, 402, 403].includes(statut) && /credit balance|usage limits?|spend(ing)? limit|billing/i.test(message))) {
    return new ErreurClaude("facturation", texte, statut, false, undefined, horsFlux);
  }
  if (statut === 401 || statut === 403 || type === "authentication_error" || type === "permission_error") return new ErreurClaude("cle-refusee", "Claude refuse la clé du studio.", statut, false, undefined, horsFlux);
  if (statut === 404 || type === "not_found_error") {
    if (/^model:|model/i.test(message)) return new ErreurClaude("modele-introuvable", texte, statut, false, undefined, horsFlux);
    return new ErreurClaude("requete", texte, statut, false, undefined, horsFlux);
  }
  if (statut === 429 || statut === 529 || statut >= 500 || type === "overloaded_error" || type === "rate_limit_error" || type === "api_error") {
    return new ErreurClaude("surcharge", texte, statut, true, attenteSec, horsFlux);
  }
  return new ErreurClaude("requete", texte, statut, false, undefined, horsFlux);
}

interface EtatFlux {
  texte: string;
  modele?: string;
  idMessage?: string;
  replis: string[];
  stopReason: string | null;
  jetons: JetonsClaude;
}

function nombre(x: unknown): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

function lireUsage(e: EtatFlux, usage: Record<string, unknown> | undefined): void {
  if (!usage) return;
  // Détail des écritures par durée (`ephemeral_1h_input_tokens` / `ephemeral_5m_input_tokens`) : coût exact.
  const detail = (usage.cache_creation ?? undefined) as Record<string, unknown> | undefined;
  const ecrit1h = nombre(detail?.ephemeral_1h_input_tokens) ?? e.jetons.cacheEcrit1h;
  e.jetons = {
    entree: nombre(usage.input_tokens) ?? e.jetons.entree,
    cacheLu: nombre(usage.cache_read_input_tokens) ?? e.jetons.cacheLu,
    cacheEcrit: nombre(usage.cache_creation_input_tokens) ?? e.jetons.cacheEcrit,
    ...(ecrit1h !== undefined ? { cacheEcrit1h: ecrit1h } : {}),
    sortie: nombre(usage.output_tokens) ?? e.jetons.sortie,
  };
}

/**
 * Réponse JSON demandée dans la consigne (sans sortie structurée) : une clôture Markdown ENTIÈRE (trois accents graves,
 * langue facultative) est retirée, comme pour le cas concret. Un texte avant ou après reste tel quel (refusé ensuite).
 */
export function sansCloture(texte: string): string {
  const m = /^\s*```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```\s*$/.exec(texte);
  return m ? m[1]! : texte;
}

/**
 * Réponse JSON sans sortie structurée : l'UNIQUE objet JSON de premier niveau, même entouré de texte ou d'une clôture
 * Markdown (les accolades dans les chaînes ne comptent pas ; un groupe d'accolades illisible, « {fin} », est ignoré).
 * Le texte est rendu tel quel, donc refusé ensuite comme avant, quand : aucun objet lisible ; un objet ouvert n'est
 * jamais fermé (réponse coupée : aucun de ses sous-objets n'est pris) ; plusieurs objets lisibles (aucun choix au
 * hasard). Un seul parcours, linéaire.
 */
export function extraireJson(texte: string): string {
  const nu = sansCloture(texte);
  const lisible = (t: string): boolean => {
    try {
      const v: unknown = JSON.parse(t);
      return typeof v === "object" && v !== null;
    } catch {
      return false;
    }
  };
  if (lisible(nu)) return nu;
  const objets: string[] = [];
  let debut = -1;
  let profondeur = 0;
  let enChaine = false;
  for (let i = 0; i < nu.length; i++) {
    const c = nu[i]!;
    if (profondeur === 0) {
      if (c === "{") {
        debut = i;
        profondeur = 1;
      }
    } else if (enChaine) {
      if (c === "\\") i++;
      else if (c === '"') enChaine = false;
    } else if (c === '"') enChaine = true;
    else if (c === "{") profondeur++;
    else if (c === "}" && --profondeur === 0) {
      const candidat = nu.slice(debut, i + 1);
      if (lisible(candidat)) objets.push(candidat);
    }
  }
  return profondeur === 0 && objets.length === 1 ? objets[0]! : texte;
}

/** Applique un événement SSE à l'état (PUR, exporté pour les tests). Un événement `error` lève une `ErreurClaude`. */
export function appliquerEvenement(e: EtatFlux, type: string, data: Record<string, unknown>, cles: (string | undefined)[] = []): void {
  switch (type) {
    case "message_start": {
      const m = (data.message ?? {}) as Record<string, unknown>;
      if (typeof m.model === "string") e.modele = m.model;
      if (typeof m.id === "string") e.idMessage = m.id;
      lireUsage(e, m.usage as Record<string, unknown> | undefined);
      return;
    }
    case "content_block_start": {
      const b = (data.content_block ?? {}) as Record<string, unknown>;
      if (b.type === "fallback") {
        // Un modèle a décliné, un autre continue : seul le texte du modèle qui répond compte.
        const de = (b.from as { model?: string } | undefined)?.model;
        const vers = (b.to as { model?: string } | undefined)?.model;
        if (de) e.replis.push(de);
        if (vers) e.modele = vers;
        e.texte = "";
      } else if (b.type === "text" && typeof b.text === "string") {
        e.texte += b.text;
      }
      return;
    }
    case "content_block_delta": {
      const d = (data.delta ?? {}) as Record<string, unknown>;
      if (d.type === "text_delta" && typeof d.text === "string") e.texte += d.text;
      return;
    }
    case "message_delta": {
      const d = (data.delta ?? {}) as Record<string, unknown>;
      if (typeof d.stop_reason === "string") e.stopReason = d.stop_reason;
      lireUsage(e, data.usage as Record<string, unknown> | undefined);
      return;
    }
    case "error": {
      const err = (data.error ?? {}) as { type?: string; message?: string };
      const statut = err.type === "overloaded_error" ? 529 : err.type === "rate_limit_error" ? 429 : err.type === "billing_error" ? 402 : err.type === "not_found_error" ? 404 : 500;
      throw classerErreur(statut, err.type, err.message ?? "", cles);
    }
    default:
      return; // ping, content_block_stop, message_stop, pensée (thinking_delta, signature_delta) : ignorés.
  }
}

export interface OptionsClient {
  cle: string;
  fetch?: typeof fetch;
  delaiInactiviteMs?: number;
  delaiTotalMs?: number;
}

/** Envoie une requête et lit le flux jusqu'au bout. Toute erreur sort en `ErreurClaude`, message masqué. */
export async function envoyerMessage(r: RequeteClaude, o: OptionsClient): Promise<ReponseClaude> {
  const appeler = o.fetch ?? fetch;
  const cles = [o.cle];
  const controle = new AbortController();
  let raison: "inactivite" | "total" | null = null;
  const total = setTimeout(() => {
    raison = "total";
    controle.abort();
  }, o.delaiTotalMs ?? DELAI_TOTAL_MS);
  let inactif: ReturnType<typeof setTimeout> | undefined;
  const reveil = () => {
    if (inactif) clearTimeout(inactif);
    inactif = setTimeout(() => {
      raison = "inactivite";
      controle.abort();
    }, o.delaiInactiviteMs ?? DELAI_INACTIVITE_MS);
  };
  const etat: EtatFlux = { texte: "", replis: [], stopReason: null, jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 } };
  try {
    reveil();
    let reponse: Response;
    try {
      reponse = await appeler(URL_MESSAGES, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream", "x-api-key": o.cle, "anthropic-version": VERSION_API, "anthropic-beta": BETA_REPLI },
        body: JSON.stringify(corpsRequete(r)),
        signal: controle.signal,
      });
    } catch {
      if (raison) throw new ErreurClaude("delai", `Claude n'a pas répondu à temps (${raison === "total" ? "300 s" : "150 s sans nouvelles"}).`, undefined, true);
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
      throw classerErreur(reponse.status, type, message, cles, Number.isFinite(ra) && ra > 0 ? ra : undefined, true);
    }
    if (!reponse.body) throw new ErreurClaude("illisible", "Claude : réponse vide.");
    const lecteur = reponse.body.getReader();
    const decodeur = new TextDecoder();
    let tampon = "";
    for (;;) {
      let morceau: ReadableStreamReadResult<Uint8Array>;
      try {
        morceau = await lecteur.read();
      } catch {
        if (raison) throw new ErreurClaude("delai", `Claude n'a pas répondu à temps (${raison === "total" ? "300 s" : "150 s sans nouvelles"}).`, undefined, true);
        throw new ErreurClaude("reseau", "Claude : flux interrompu.", undefined, true);
      }
      if (morceau.done) break;
      reveil();
      tampon += decodeur.decode(morceau.value, { stream: true }).replace(/\r\n/g, "\n");
      let fin: number;
      while ((fin = tampon.indexOf("\n\n")) >= 0) {
        traiterBloc(etat, tampon.slice(0, fin), cles);
        tampon = tampon.slice(fin + 2);
      }
    }
    if (tampon.trim()) traiterBloc(etat, tampon, cles);
    if (!etat.modele && !etat.stopReason) throw new ErreurClaude("illisible", "Claude : flux sans message.");
    // Réponse coupée par max_tokens : un échec, jamais un JSON extrait (le texte brut est refusé ensuite, comme avant).
    const extraire = r.json && etat.stopReason !== "max_tokens";
    return { idMessage: etat.idMessage, texte: extraire ? extraireJson(etat.texte) : etat.texte, modeleDemande: r.modele, modele: etat.modele ?? r.modele, replis: etat.replis, stopReason: etat.stopReason, jetons: etat.jetons };
  } finally {
    clearTimeout(total);
    if (inactif) clearTimeout(inactif);
  }
}

function traiterBloc(etat: EtatFlux, bloc: string, cles: (string | undefined)[]): void {
  let type = "";
  const donnees: string[] = [];
  for (const ligne of bloc.split("\n")) {
    if (ligne.startsWith("event:")) type = ligne.slice(6).trim();
    else if (ligne.startsWith("data:")) donnees.push(ligne.slice(5).trimStart());
  }
  if (!donnees.length) return;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(donnees.join("\n")) as Record<string, unknown>;
  } catch {
    throw new ErreurClaude("illisible", "Claude : événement illisible.");
  }
  appliquerEvenement(etat, type || String(data.type ?? ""), data, cles);
}
