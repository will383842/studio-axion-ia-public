/**
 * L5-06 · synchronisation complète et incrémentale avec le diffuseur, en LECTURE seule.
 * - 130 posts répartis sur 3 pages : tous lus, aucune écriture chez le diffuseur ;
 * - un visuel dont la publication est publiée passe « Publié » ; programmée, « Programmé » ;
 * - un post absent de la liste est relu un à un, sans dépasser 50 lectures ; sans option, au-delà de 50 publications le passage est complet ;
 * - une page de liste en échec ramène au passage incrémental de 50 lectures ; l'étape d'un visuel ne bloque jamais la synchro.
 * Faux client uniquement : aucun appel réel, données fictives.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-l5-06-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio } = await import("@/services/zernio");
const { listerToutesLesPagesZernio } = await import("@/services/zernio");
const { creerFauxClientZernio, postExemple } = await import("../zernio/aides/faux-zernio");
type AppelEnregistre = import("../zernio/aides/faux-zernio").AppelEnregistre;

const T0 = Date.parse("2026-11-11T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const COMPTE = "exemple-compte-1";
const DATE = "2026-11-12T08:00:00.000Z";

const postPublie = (n: number) => postExemple({ _id: `exemple-post-${n}`, status: "published", platforms: [{ platform: "instagram", accountId: COMPTE, status: "published", platformPostUrl: `https://exemple.invalid/p/${n}` }] });

/** Faux diffuseur : `total` posts publiés servis par pages (`page`, `limit`) ; les lectures unitaires sont comptées. */
function diffuseur(total: number, absents: ReadonlySet<number> = new Set(), listeEnPanne = false) {
  const posts = Array.from({ length: total }, (_, i) => postPublie(i + 1)).filter((_, i) => !absents.has(i + 1));
  const appels: AppelEnregistre[] = [];
  const { client } = creerFauxClientZernio((a) => {
    appels.push(a);
    const u = new URL(a.url);
    if (a.methode === "GET" && u.pathname.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: COMPTE, platform: "instagram", isActive: true }] } };
    if (a.methode === "GET" && u.pathname.endsWith("/v1/posts")) {
      if (listeEnPanne) return { statut: 500, corps: { error: "panne simulée" } };
      const page = Number(u.searchParams.get("page") ?? 1);
      const limite = Number(u.searchParams.get("limit") ?? 10);
      return { statut: 200, corps: { posts: posts.slice((page - 1) * limite, page * limite) } };
    }
    const m = /\/v1\/posts\/(exemple-post-(\d+))$/.exec(u.pathname);
    if (a.methode === "GET" && m) return { statut: 200, corps: { post: postPublie(Number(m[2])) } };
    return { statut: 500, corps: { error: "appel inattendu" } };
  });
  return { client, appels };
}

async function publications(n: number, extra: (i: number) => Record<string, unknown> = () => ({})) {
  for (let i = 1; i <= n; i++) {
    await depots().publications.enregistrer({ id: `p${i}`, videoId: "v-03", reseau: "instagram", statut: "programmee", via: "zernio", date: DATE, texte: "Texte d'exemple", idExterne: `exemple-post-${i}`, canalId: COMPTE, etatEnvoi: "envoye", envoiCommenceLe: iso(T0 - 3600_000), creeLe: iso(T0), modifieLe: iso(T0), ...extra(i) } as never);
  }
}

const ecritures = (appels: AppelEnregistre[]) => appels.filter((a) => a.methode !== "GET");

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  await auth.seConnecter(MDP, false);
  for (const p of await depots().publications.lister()) await depots().publications.supprimer(p.id);
});

describe("L5-06 · lecture de toutes les pages", () => {
  it("130 posts sur 3 pages : tous lus, trois lectures de liste, aucune écriture", async () => {
    const { client, appels } = diffuseur(130);
    const tous = await listerToutesLesPagesZernio(client, { status: "published" });
    expect(tous).toHaveLength(130);
    expect(new Set(tous.map((p) => p._id)).size).toBe(130);
    const listes = appels.filter((a) => new URL(a.url).pathname.endsWith("/v1/posts"));
    expect(listes.map((a) => new URL(a.url).searchParams.get("page"))).toEqual(["1", "2", "3"]);
    expect(ecritures(appels)).toHaveLength(0);
  });

  it("une page qui répète les mêmes posts arrête la lecture (jamais de boucle)", async () => {
    const { client } = creerFauxClientZernio(() => ({ statut: 200, corps: { posts: Array.from({ length: 50 }, (_, i) => postPublie(i + 1)) } }));
    expect(await listerToutesLesPagesZernio(client)).toHaveLength(50);
  });
});

describe("L5-06 · synchronisation complète", () => {
  it("130 publications : toutes passent « publiée » par 3 lectures de liste, sans lecture unitaire ni écriture", async () => {
    await publications(130);
    const { client, appels } = diffuseur(130);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(r).toEqual({ lues: 130, changees: 130 });
    expect((await depots().publications.lister()).every((p) => p.statut === "publiee" && p.urlPubliee?.startsWith("https://exemple.invalid/p/"))).toBe(true);
    expect(appels.filter((a) => /\/v1\/posts\/[^/?]+$/.test(new URL(a.url).pathname))).toHaveLength(0);
    expect(ecritures(appels)).toHaveLength(0);
  });

  it("un post absent de la liste est relu seul ; les autres ne le sont pas", async () => {
    await publications(5);
    const { client, appels } = diffuseur(5, new Set([3]));
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(r.lues).toBe(5);
    const unitaires = appels.filter((a) => /\/v1\/posts\/[^/?]+$/.test(new URL(a.url).pathname)).map((a) => new URL(a.url).pathname);
    expect(unitaires).toEqual(["/api/v1/posts/exemple-post-3"]);
  });

  it("sans l'option « complet » et jusqu'à 50 publications, le passage reste incrémental : lectures unitaires, sans liste", async () => {
    await publications(40);
    const { client, appels } = diffuseur(40);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r.lues).toBe(40);
    expect(appels.filter((a) => new URL(a.url).pathname.endsWith("/v1/posts"))).toHaveLength(0);
  });
});

describe("L5-06 · un visuel publié", () => {
  const visuel = (statut: string) => depots().visuels.enregistrer({ id: "vis_1", famille: "carrousel", titre: "Visuel d'exemple", statut, versionSpec: 1, coutCentimes: 0, creeLe: iso(T0), modifieLe: iso(T0) } as never);

  it("passe « Publié » quand le diffuseur l'a publié (synchro complète)", async () => {
    await visuel("programme");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });

  it("passe « Publié » aussi au passage incrémental", async () => {
    await visuel("programme");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });

  it("un visuel déjà publié ne change plus", async () => {
    await visuel("publie");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });
});

describe("L5-06 · cas limites", () => {
  const visuel = (statut: string) => depots().visuels.enregistrer({ id: "vis_1", famille: "carrousel", titre: "Visuel d'exemple", statut, versionSpec: 1, coutCentimes: 0, creeLe: iso(T0), modifieLe: iso(T0) } as never);
  const unitaires = (appels: AppelEnregistre[]) => appels.filter((a) => /\/v1\/posts\/[^/?]+$/.test(new URL(a.url).pathname));

  it("sans option, au-delà de 50 publications suivies : passage complet par la liste paginée", async () => {
    await publications(60);
    const { client, appels } = diffuseur(60);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r.lues).toBe(60);
    expect(appels.filter((a) => new URL(a.url).pathname.endsWith("/v1/posts")).length).toBeGreaterThanOrEqual(2);
    expect(unitaires(appels)).toHaveLength(0);
  });

  it("mode complet : 60 posts absents de la liste, 50 lectures unitaires au plus", async () => {
    await publications(60);
    const { client, appels } = diffuseur(60, new Set(Array.from({ length: 60 }, (_, i) => i + 1)));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(unitaires(appels)).toHaveLength(50);
  });

  it("une page de liste en échec : retour au passage incrémental limité à 50 lectures", async () => {
    await publications(60);
    const { client, appels } = diffuseur(60, new Set(), true);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(r.lues).toBe(50);
    expect(unitaires(appels)).toHaveLength(50);
    expect(ecritures(appels)).toHaveLength(0);
  });

  it("le visuel passe « Programmé » quand le diffuseur programme la publication", async () => {
    await visuel("valide");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1", statut: "brouillon" }));
    const { client } = creerFauxClientZernio(() => ({ statut: 200, corps: { post: postExemple({ _id: "exemple-post-1", status: "scheduled", scheduledFor: DATE }) } }));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("programme");
  });

  it("un visuel « validé » passe « publié » en deux étapes permises", async () => {
    await visuel("valide");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });

  it("une erreur sur le visuel ne bloque pas les autres publications ; le rattrapage la reprend", async () => {
    await visuel("programme");
    await publications(3, (i) => (i === 1 ? { videoId: undefined, visuelId: "vis_1" } : {}));
    const { client } = diffuseur(3);
    injecterClientZernio(client);
    const vrai = depots().visuels.modifier.bind(depots().visuels);
    const espion = vi.spyOn(depots().visuels, "modifier").mockRejectedValueOnce(new Error("panne simulée"));
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r.changees).toBe(3);
    expect((await depots().publications.lister()).every((p) => p.statut === "publiee")).toBe(true);
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("programme");
    espion.mockRestore();
    void vrai;
    await synchroniserEtatsZernio({ force: true, instant: T0 + 1000 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });
});
