/**
 * LOT A1 — GARDE-FOU I1 : Buffer gelé, la relecture des envois ZERNIO « à vérifier » continue (seul chemin de réconciliation
 * Zernio). Un envoi Buffer « à vérifier » n'est plus relu.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CANAUX, fauxBuffer } from "../helpers/r1-buffer";
import { CLE_FICTIVE, postExemple, type AppelEnregistre } from "../zernio/aides/faux-zernio";
import { serveurSimule } from "../zernio/aides/serveur-simule";

process.env.BUFFER_API_KEY = "cle-buffer-de-test-gel-0001";
process.env.ZERNIO_API_KEY = CLE_FICTIVE;
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { injecterClientZernio } = await import("@/services/zernio");
const buf = await import("@/services/buffer");

const TEXTE = "Texte envoyé par le nouvel outil.";
let buffer: ReturnType<typeof fauxBuffer>;
let postsZernio: ReturnType<typeof postExemple>[];
let appelsZernio: AppelEnregistre[];

function brancher() {
  const serveur = serveurSimule({
    surmesure: (a) => {
      if (a.methode === "GET" && a.url.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: "exemple-compte-1", platform: "instagram", displayName: "Exemple IG" }] } };
      if (a.methode === "GET" && a.url.split("?")[0].endsWith("/v1/posts")) return { statut: 200, corps: { posts: postsZernio } };
      return undefined;
    },
  });
  appelsZernio = [];
  vi.stubGlobal("fetch", async (url: unknown, init: RequestInit = {}) => {
    const u = String(url);
    if (u.startsWith("https://api.buffer.com")) return buffer.appeler(url as never, init as never);
    const corps = typeof init.body === "string" ? init.body : undefined;
    const a: AppelEnregistre = { url: u, methode: String(init.method ?? "GET"), entetes: { ...(init.headers as Record<string, string>) }, corps, json: corps ? JSON.parse(corps) : undefined };
    appelsZernio.push(a);
    const r = serveur.repondre(a);
    if ("erreur" in r) throw Object.assign(new Error("fetch failed"), { name: "TypeError" });
    return new Response(r.corps === undefined ? null : JSON.stringify(r.corps), { status: r.statut, headers: { "content-type": "application/json", ...(r.entetes ?? {}) } });
  });
}

async function semer(id: string, p: Record<string, unknown>) {
  const t = new Date(Date.now() - 40 * 60_000).toISOString();
  await depots().publications.enregistrer({ id, creeLe: t, modifieLe: t, videoId: "v-15", reseau: "instagram", statut: "brouillon", date: t, texte: TEXTE, etatEnvoi: "a-verifier", envoiCommenceLe: t, ...p } as never);
}

beforeAll(async () => {
  await preparerMotDePasse("essai-a1-zernio");
});
beforeEach(async () => {
  vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "");
  vi.unstubAllGlobals();
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  buffer = fauxBuffer();
  postsZernio = [];
  brancher();
  // Comptes lus à l'instant : la synchronisation n'a aucune raison d'appeler Buffer avant le gel.
  await ecrireParametre("buffer.canaux", { lusLe: new Date().toISOString(), canaux: [{ id: CANAUX.instagram, nom: "Exemple IG", service: "instagram", deconnecte: false, organisationId: "org-exemple" }] });
});
afterEach(() => vi.unstubAllEnvs());

describe("A1 · réconciliation Zernio, Buffer gelé", () => {
  it("cas 1 : l'envoi Zernio « à vérifier » est retrouvé et passe « envoyé » (0 appel Buffer)", async () => {
    await semer("pub-z", { via: "zernio", canalId: "exemple-compte-1" });
    postsZernio = [postExemple({ _id: "exemple-post-7", content: TEXTE, status: "scheduled", createdAt: new Date(Date.now() - 39 * 60_000).toISOString() } as never)];
    const r = await buf.synchroniserEtatsBuffer({ force: true });
    expect(r.lues).toBeGreaterThanOrEqual(1);
    const p = (await depots().publications.obtenir("pub-z"))!;
    expect(p.etatEnvoi).toBe("envoye");
    expect(p.idExterne).toBe("exemple-post-7");
    expect(buffer.appels.length).toBe(0);
  });

  it("cas 2 : Zernio ne rend rien, délai d'absence passé → « absent » + notification (0 appel Buffer)", async () => {
    await semer("pub-z", { via: "zernio", canalId: "exemple-compte-1" });
    await buf.synchroniserEtatsBuffer({ force: true });
    expect((await depots().publications.obtenir("pub-z"))!.etatEnvoi).toBe("absent");
    expect((await depots().notifications.lister()).length).toBeGreaterThanOrEqual(1);
    expect(buffer.appels.length).toBe(0);
  });

  it("cas 3 : un envoi Buffer « à vérifier » n'est PAS relu (inchangé, 0 appel Buffer)", async () => {
    await semer("pub-b", { via: "buffer", canalId: CANAUX.instagram });
    const avant = JSON.stringify(await depots().publications.obtenir("pub-b"));
    const r = await buf.reconcilierEnvoi("pub-b");
    expect(JSON.stringify(r)).toBe(avant);
    expect(JSON.stringify(await depots().publications.obtenir("pub-b"))).toBe(avant);
    expect(buffer.appels.length).toBe(0);
  });
});
