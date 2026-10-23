/**
 * LOT R1 — DOUBLURE DE L'INTERFACE GRAPHQL DE BUFFER (aucun appel réseau, aucune clé réelle).
 *
 * Répond aux opérations du client du studio par les réponses RÉELLES enregistrées et anonymisées
 * (`tests/fixtures/r1-buffer-lectures.json`, `outils/buffer/lire-compte.mts`) ; `createPost` répond selon le schéma relevé
 * (`docs/buffer/schema-2026-10.json`, union `PostActionPayload`). Chaque appel est noté : le test compte les mutations.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const LECTURES = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "r1-buffer-lectures.json"), "utf8"));
export const URL_BUFFER = "https://api.buffer.com";

/** Identifiants d'exemple des canaux enregistrés (instagram, facebook ×2, linkedin ×2). */
export const CANAUX = {
  instagram: "e00003000000000000000000",
  facebook1: "e00004000000000000000000",
  facebook2: "e00005000000000000000000",
  linkedinProfil: "e00006000000000000000000",
  linkedinPage: "e00007000000000000000000",
} as const;

export interface AppelBuffer {
  operation: string;
  variables: Record<string, unknown>;
  query: string;
  autorisation: string | null;
}

/** Ce que fait Buffer à la n-ième création : la créer, la créer puis couper la ligne, refuser (union), ou un code HTTP. */
export type Comportement = "ok" | "coupure-apres" | "coupure-avant" | { union: string; message: string } | { http: number; corps?: string };

interface PostEnregistre {
  id: string;
  channelId: string;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  createdAt: string;
  text: string;
  externalLink: string | null;
  error: { message: string; supportUrl: string | null } | null;
}

export function fauxBuffer(options: { creation?: (n: number) => Comportement; canauxEnPlus?: object[]; delaiMutationMs?: number; /** Horloge de Buffer décalée (ms, négatif : en retard sur le studio). */ decalageHorlogeMs?: number } = {}) {
  const appels: AppelBuffer[] = [];
  const posts = new Map<string, PostEnregistre>();
  let n = 0;
  const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });

  const appeler = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (String(url) !== URL_BUFFER) throw new Error(`Adresse inattendue : ${String(url)}`);
    const corps = JSON.parse(String(init?.body ?? "{}")) as { query: string; variables?: Record<string, unknown> };
    const operation = /^\s*(?:query|mutation)\s+(\w+)/.exec(corps.query)?.[1] ?? "?";
    const entetes = new Headers(init?.headers);
    appels.push({ operation, variables: corps.variables ?? {}, query: corps.query, autorisation: entetes.get("authorization") });

    switch (operation) {
      case "Compte":
        return json(LECTURES.compte);
      case "Canaux":
        return json({ data: { channels: [...LECTURES.canaux.data.channels, ...(options.canauxEnPlus ?? [])] } });
      case "CreerPublication": {
        const k = ++n;
        const c = options.creation?.(k) ?? "ok";
        if (options.delaiMutationMs) await new Promise((r) => setTimeout(r, options.delaiMutationMs));
        if (c === "coupure-avant") throw new DOMException("La requête a dépassé le délai.", "TimeoutError");
        if (typeof c === "object" && "http" in c) return new Response(c.corps ?? "", { status: c.http });
        if (typeof c === "object" && "union" in c) return json({ data: { createPost: { __typename: c.union, message: c.message } } });
        const input = (corps.variables?.input ?? {}) as { channelId: string; text?: string; dueAt?: string; saveToDraft?: boolean; mode: string };
        const post: PostEnregistre = {
          id: `f1a2b3c4d5e6f7a8b9c0d${String(k).padStart(3, "0")}`,
          channelId: input.channelId,
          status: input.saveToDraft ? "draft" : "scheduled",
          dueAt: input.dueAt ?? null,
          sentAt: null,
          createdAt: new Date(Date.now() + (options.decalageHorlogeMs ?? 0)).toISOString(),
          text: input.text ?? "",
          externalLink: null,
          error: null,
        };
        posts.set(post.id, post);
        // Buffer a créé la publication, mais la réponse se perd en chemin (délai dépassé, ligne coupée).
        if (c === "coupure-apres") throw new DOMException("La requête a dépassé le délai.", "TimeoutError");
        return json({ data: { createPost: { __typename: "PostActionSuccess", post: { id: post.id, channelId: post.channelId, status: post.status, dueAt: post.dueAt, externalLink: null } } } });
      }
      case "EtatPublication": {
        const p = posts.get(String(corps.variables?.id));
        if (!p) return json({ errors: [{ message: `Post not found for id: ${String(corps.variables?.id)}`, path: ["post"], extensions: { code: "NOT_FOUND" } }], data: null });
        return json({ data: { post: { id: p.id, channelId: p.channelId, status: p.status, dueAt: p.dueAt, sentAt: p.sentAt, externalLink: p.externalLink, error: p.error } } });
      }
      case "PublicationsRecentes": {
        const ids = (corps.variables?.channelIds as string[] | undefined) ?? [];
        const depuis = String(corps.variables?.depuis ?? "1970-01-01T00:00:00.000Z");
        const liste = [...posts.values()].filter((p) => (!ids.length || ids.includes(p.channelId)) && p.createdAt >= depuis).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return json({ data: { posts: { edges: liste.map((p) => ({ node: { id: p.id, channelId: p.channelId, status: p.status, dueAt: p.dueAt, sentAt: p.sentAt, createdAt: p.createdAt, text: p.text, externalLink: p.externalLink } })) } } });
      }
      default:
        return json({ errors: [{ message: `Opération inconnue de la doublure : ${operation}` }] });
    }
  };

  return {
    appeler: appeler as typeof fetch,
    appels,
    posts,
    mutations: () => appels.filter((a) => a.operation === "CreerPublication"),
    /** Buffer publie (ou échoue) : ce que la synchronisation doit lire. */
    changer(id: string, modif: Partial<PostEnregistre>) {
      const p = posts.get(id);
      if (!p) throw new Error(`Publication inconnue de la doublure : ${id}`);
      posts.set(id, { ...p, ...modif });
    },
  };
}
