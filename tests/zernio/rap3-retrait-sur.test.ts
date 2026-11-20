/** RAP-3 · retrait groupé SÛR : clé d'un autre espace, retrait de masse, post publié ou en échec après disparition. Client factice, données fictives, aucune clé. */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-rap3s-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio } = await import("@/services/zernio");

const T0 = Date.parse("2026-11-20T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const fabrique = (n: number, status: string, extra: Partial<PostZernio> = {}): PostZernio => ({
  _id: `p-${status}-${n}`,
  content: "t",
  status,
  scheduledFor: iso(T0 + (n + 1) * 3600_000),
  platforms: [{ platform: "instagram", accountId: "compte-fictif", status: "pending" }],
  metadata: { origine: "import-buffer", studioCle: `imp-${status}-${n}` },
  ...extra,
});
interface Faux {
  client: ClientZernio;
  posts: PostZernio[];
  introuvables: Set<string>;
  etat: { liste: number; unitaires: number; comptes: number; erreurListe: "debit" | null; ecritures: number };
}

/** Client factice : lit (comptes, liste, post seul) ; TOUTE écriture lève et est comptée. */
function faux(posts: PostZernio[]): Faux {
  const f: Faux = { client: null as never, posts, introuvables: new Set(), etat: { liste: 0, unitaires: 0, comptes: 0, erreurListe: null, ecritures: 0 } };
  const interdit = (nom: string) => () => {
    f.etat.ecritures++;
    throw new Error(`écriture interdite : ${nom}`);
  };
  const base = {
    async listerComptes() {
      f.etat.comptes++;
      return [];
    },
    async listerPosts(q?: Record<string, string | number | boolean>) {
      f.etat.liste++;
      if (f.etat.erreurListe) throw new ErreurZernio("debit", "plafond de débit");
      const tous = f.posts.filter((p) => (q?.status ? p.status === q.status : true));
      const page = Number(q?.page ?? 1);
      const limite = Number(q?.limit ?? 50);
      return tous.slice((page - 1) * limite, page * limite);
    },
    async lirePost(id: string) {
      f.etat.unitaires++;
      const p = f.posts.find((x) => x._id === id);
      if (!p || f.introuvables.has(id)) throw new ErreurZernio("introuvable", "404", { statut: 404 });
      return p;
    },
    creerPost: interdit("creerPost"),
    promouvoir: interdit("promouvoir"),
    retirer: interdit("retirer"),
    requete: interdit("requete"),
    publishNow: interdit("publishNow"),
  };
  f.client = new Proxy(base, {
    get(cible, cle) {
      if (cle in cible) return (cible as never)[cle];
      return interdit(String(cle));
    },
  }) as unknown as ClientZernio;
  return f;
}

afterEach(() => vi.useRealTimers());

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  await auth.seConnecter(MDP, false);
  for (const p of await depots().publications.lister()) await depots().publications.supprimer(p.id);
});



const unique = async (id: string) => (await depots().publications.lister((x) => x.idExterne === id))[0];
const H = 3600_000;
const M = 60_000;
const { lireEcartCalendrier } = await import("@/services/ecart-calendrier");
const { retirerIntrouvablesAction } = await import("@/app/(studio)/calendrier/actions/retirer-introuvables");

async function passe(instant: number): Promise<void> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(instant);
  await synchroniserEtatsZernio({ force: true, instant });
}
const retirables = async (): Promise<string[]> => (((await lireEcartCalendrier()) as { retirables?: string[] } | null)?.retirables ?? []).sort();
const retirees = async () => (await depots().publications.lister((x) => !!x.retireeLe)).map((x) => x.idExterne).sort();
const ids = async () => (await depots().publications.lister((x) => !!x.idExterne)).map((x) => x.id).sort();

/** Deux posts rapatriés, puis le diffuseur répond « vide » et 404 : constats à +40 min, +55 min, puis ~25 h. */
async function disparitionLongue(f: Faux): Promise<number> {
  await passe(T0);
  f.introuvables = new Set(f.posts.map((p) => p._id));
  f.posts = [];
  await passe(T0 + 40 * M);
  await passe(T0 + 55 * M);
  await passe(T0 + 24 * H + 50 * M);
  await passe(T0 + 25 * H + 5 * M);
  return T0 + 25 * H + 5 * M;
}

describe("RAP-3 retrait sûr · (a) clé d'un autre espace et retrait de masse", () => {
  it("clé d'un autre espace VIDE pendant 25 h : ni bouton ni action ne retirent", async () => {
    const f = faux([fabrique(0, "scheduled"), fabrique(1, "scheduled")]);
    injecterClientZernio(f.client);
    const fin = await disparitionLongue(f);
    vi.setSystemTime(fin);
    expect(await retirables()).toEqual([]);
    const e = (await lireEcartCalendrier()) as { retraitRefuse?: string } | null;
    expect(e?.retraitRefuse).toBe("Le diffuseur ne retrouve aucun de vos posts : vérifiez la connexion avant de retirer quoi que ce soit.");
    const r = await retirerIntrouvablesAction([...(await ids())]);
    expect(r.ok).toBe(false);
    expect(await retirees()).toEqual([]);
  });
  it("clé d'un autre espace qui CONTIENT des posts (importés) : la mesure redevient vérifiée, mais le retrait reste refusé", async () => {
    const f = faux([fabrique(0, "scheduled"), fabrique(1, "scheduled")]);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(f.posts.map((p) => p._id));
    f.posts = [fabrique(7, "draft", { _id: "etranger-1" }), fabrique(8, "scheduled", { _id: "etranger-2" })];
    for (const dt of [40 * M, 55 * M, 24 * H + 50 * M, 25 * H + 5 * M]) await passe(T0 + dt);
    expect((await unique("etranger-1"))?.rapatrieeLe).toBeTruthy(); // aujourd'hui, le rapatriement les importe (voir la PR)
    vi.setSystemTime(T0 + 25 * H + 5 * M);
    expect(await retirables()).toEqual([]);
    expect((await retirerIntrouvablesAction([...(await ids())])).ok).toBe(false);
    expect(await retirees()).toEqual([]);
  });
  it("retrait de masse : TOUTES les rapatriées suivies introuvables en même temps (un post du Studio reste présent) → refus", async () => {
    await depots().publications.enregistrer({ id: "pub_s", reseau: "instagram", statut: "programmee", via: "zernio", idExterne: "p-scheduled-9", etatEnvoi: "envoye", date: iso(T0 + 9 * H), texte: "t", creeLe: iso(T0 - H), modifieLe: iso(T0 - H) } as never);
    const f = faux([fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(9, "scheduled")]);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(["p-scheduled-0", "p-scheduled-1"]);
    f.posts = f.posts.filter((p) => p._id === "p-scheduled-9");
    for (const dt of [40 * M, 55 * M, 24 * H + 50 * M, 25 * H + 5 * M]) await passe(T0 + dt);
    vi.setSystemTime(T0 + 25 * H + 5 * M);
    expect(await retirables()).toEqual([]);
    expect((await retirerIntrouvablesAction(["zr_p-scheduled-0_compte-fictif", "zr_p-scheduled-1_compte-fictif"])).ok).toBe(false);
    expect(await retirees()).toEqual([]);
  });
  it("cas sain : 2 sur 3 disparaissent, la 3e est encore chez le diffuseur → ces 2 seulement sont retirables et retirées", async () => {
    const f = faux([fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")]);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(["p-scheduled-0", "p-scheduled-1"]);
    f.posts = f.posts.filter((p) => p._id === "p-scheduled-2");
    for (const dt of [40 * M, 55 * M, 24 * H + 50 * M, 25 * H + 5 * M]) await passe(T0 + dt);
    expect(await retirables()).toEqual(["zr_p-scheduled-0_compte-fictif", "zr_p-scheduled-1_compte-fictif"]);
    const r = await retirerIntrouvablesAction(["zr_p-scheduled-0_compte-fictif", "zr_p-scheduled-1_compte-fictif"]);
    expect(r).toMatchObject({ ok: true });
    expect(await retirees()).toEqual(["p-scheduled-0", "p-scheduled-1"]);
  });
});

describe("RAP-3 retrait sûr · (b) disparu puis publié ou en échec", () => {
  for (const statut of ["published", "failed"] as const) {
    it(`disparu 15 min (2 constats) puis ${statut} : relu, remis à la normale avec son vrai statut, jamais retirable`, async () => {
      const f = faux([fabrique(0, "scheduled"), fabrique(1, "scheduled")]);
      injecterClientZernio(f.client);
      await passe(T0);
      const garde = f.posts[0];
      f.introuvables = new Set(f.posts.map((p) => p._id));
      f.posts = [];
      await passe(T0 + 40 * M);
      await passe(T0 + 55 * M);
      expect((await unique("p-scheduled-0")).constatsIntrouvable).toBe(2);
      f.introuvables = new Set(["p-scheduled-1"]);
      f.posts = [{ ...garde, status: statut }];
      await passe(T0 + 25 * H);
      const p = await unique("p-scheduled-0");
      expect(p.etatEnvoi).toBeUndefined();
      expect(p.introuvableDepuis).toBeUndefined();
      expect(p.statut).toBe(statut === "published" ? "publiee" : "echec");
      vi.setSystemTime(T0 + 25 * H);
      expect(await retirables()).not.toContain("zr_p-scheduled-0_compte-fictif");
    });
  }
  it("retirable seulement si le DERNIER constat a moins d'une heure ET qu'il est à 24 h du premier", async () => {
    const { estRapatrieeRetirable } = await import("@/services/retirer-rapatriee");
    const f = faux([fabrique(0, "scheduled")]);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(["p-scheduled-0"]);
    f.posts = [];
    await passe(T0 + 40 * M);
    await passe(T0 + 55 * M);
    let p = await unique("p-scheduled-0");
    expect(estRapatrieeRetirable(p, T0 + 25 * H)).toBe(false); // dernier constat trop ancien, écart de 15 min
    await passe(T0 + 10 * H);
    p = await unique("p-scheduled-0");
    expect(estRapatrieeRetirable(p, T0 + 10 * H)).toBe(false); // récent, mais moins de 24 h depuis le premier
    await passe(T0 + 25 * H);
    p = await unique("p-scheduled-0");
    expect(estRapatrieeRetirable(p, T0 + 25 * H + 30 * M)).toBe(true);
    expect(estRapatrieeRetirable(p, T0 + 25 * H + 90 * M)).toBe(false); // le dernier constat a plus d'une heure
  });
  it("lecture unitaire espacée : une rapatriée « à vérifier » aux 2 constats est relue de temps en temps, 10 au plus par passage, budget de 51 tenu", async () => {
    const posts = Array.from({ length: 15 }, (_, i) => fabrique(i, "scheduled"));
    const f = faux(posts);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(posts.map((p) => p._id));
    f.posts = [];
    await passe(T0 + 40 * M);
    await passe(T0 + 55 * M);
    f.etat.unitaires = 0;
    f.etat.liste = 0;
    f.etat.comptes = 0;
    await passe(T0 + 2 * H);
    expect(f.etat.unitaires).toBeGreaterThan(0);
    expect(f.etat.unitaires).toBeLessThanOrEqual(10);
    expect(f.etat.unitaires + f.etat.liste + f.etat.comptes).toBeLessThanOrEqual(51);
    f.etat.unitaires = 0;
    await passe(T0 + 2 * H + 10 * M); // moins de 30 min après : celles déjà relues attendent
    expect(f.etat.unitaires).toBeLessThanOrEqual(5);
  });
});
