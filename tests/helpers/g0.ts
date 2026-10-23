/**
 * Aides des tests du lot G0 (Claude et crédits) : réponses de l'API Claude ENREGISTRÉES à la main d'après la forme
 * documentée (skill `claude-api`, 02/10), servies par un faux `fetch`. Aucun réseau, aucune vraie clé.
 */

/** Fausse clé (forme d'une vraie, jamais une vraie). */
export const CLE_ESSAI_CLAUDE = "sk-ant-api03-ESSAI_cle_secrete_g0_ABCDEFGHIJKLMNOP-qrst-9Zx2";

export type EvenementSse = [string, Record<string, unknown>];

/** Une réponse en flux SSE, découpée en petits morceaux (comme sur le réseau). */
export function reponseFlux(evenements: EvenementSse[], morceau = 37): Response {
  const texte = evenements.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join("");
  const octets = new TextEncoder().encode(texte);
  const flux = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < octets.length; i += morceau) c.enqueue(octets.slice(i, i + morceau));
      c.close();
    },
  });
  return new Response(flux, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** Flux d'un message réussi : texte, modèle, jetons. */
export function fluxReussi(o: { texte: string; modele?: string; entree?: number; cacheLu?: number; cacheEcrit?: number; sortie?: number; stop?: string; repliDe?: string }): EvenementSse[] {
  const modele = o.modele ?? "claude-opus-5-5";
  const ev: EvenementSse[] = [
    ["message_start", { type: "message_start", message: { id: "msg_essai", type: "message", role: "assistant", model: o.repliDe ?? modele, content: [], usage: { input_tokens: o.entree ?? 1200, cache_read_input_tokens: o.cacheLu ?? 0, cache_creation_input_tokens: o.cacheEcrit ?? 800, output_tokens: 1 } } }],
    ["ping", { type: "ping" }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "" } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
  ];
  if (o.repliDe) {
    ev.push(["content_block_start", { type: "content_block_start", index: 1, content_block: { type: "text", text: "Je " } }]);
    ev.push(["content_block_start", { type: "content_block_start", index: 2, content_block: { type: "fallback", from: { model: o.repliDe }, to: { model: modele } } }]);
  }
  ev.push(
    ["content_block_start", { type: "content_block_start", index: 3, content_block: { type: "text", text: "" } }],
    ...chunks(o.texte).map((t): EvenementSse => ["content_block_delta", { type: "content_block_delta", index: 3, delta: { type: "text_delta", text: t } }]),
    ["content_block_stop", { type: "content_block_stop", index: 3 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: o.stop ?? "end_turn", stop_sequence: null }, usage: { output_tokens: o.sortie ?? 150 } }],
    ["message_stop", { type: "message_stop" }],
  );
  return ev;
}

function chunks(t: string): string[] {
  const s: string[] = [];
  for (let i = 0; i < t.length; i += 7) s.push(t.slice(i, i + 7));
  return s.length ? s : [""];
}

/** Réponse d'erreur JSON de l'API. */
export function reponseErreur(statut: number, type: string, message: string, entetes: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ type: "error", error: { type, message } }), { status: statut, headers: { "content-type": "application/json", ...entetes } });
}

/** Faux `fetch` : sert les réponses dans l'ordre, garde chaque requête (en-têtes et corps). */
export function fauxFetch(reponses: (() => Response)[]) {
  const appels: { url: string; entetes: Record<string, string>; corps: Record<string, unknown> }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), entetes: Object.fromEntries(new Headers(init?.headers).entries()), corps: JSON.parse(String(init?.body ?? "{}")) });
    const r = reponses[Math.min(appels.length - 1, reponses.length - 1)];
    if (!r) throw new Error("aucune réponse prévue");
    return r();
  }) as typeof fetch;
  return { fetch: f, appels };
}
