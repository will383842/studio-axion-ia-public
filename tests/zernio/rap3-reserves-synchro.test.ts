/** RAP-3 · réserves de la relecture (synchro : retour à la normale et double constat). Client factice, données 100 % fictives, aucune clé. */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const MDP = "essai-rap3r-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio, BUDGET_REQUETES_PAR_PASSAGE } = await import("@/services/zernio");

const T0 = Date.parse("2026-11-20T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const ECART = "zernio.ecart_calendrier";

const fabrique = (n: number, status: string, extra: Partial<PostZernio> = {}): PostZernio => ({
  _id: `p-${status}-${n}`,
  content: "t",
  status,
  scheduledFor: iso(T0 + (n + 1) * 3600_000),
  platforms: [{ platform: "instagram", accountId: "compte-fictif", status: "pending" }],
  metadata: { origine: "import-buffer", studioCle: `imp-${status}-${n}` },
  ...extra,
});
const lot = (n: number, status: string) => Array.from({ length: n }, (_, i) => fabrique(i, status));

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

const rapatriees = async () => depots().publications.lister((p) => !!p.rapatrieeLe);
const ecart = async () => (await depots().parametres.obtenir(ECART))?.valeur as { verifie: boolean; absents: number; chezDiffuseur: number; exemples: unknown[]; luLe: string } | undefined;

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

describe("RAP-3 réserves · 1a retour à la normale, 1c double constat", () => {
  it("rapatriée « à vérifier » après un 404, puis relue en liste → redevient normale, plus introuvable ni retirable", async () => {
    const { estRapatrieeIntrouvable, estRapatrieeRetirable } = await import("@/services/retirer-rapatriee");
    const f = faux([fabrique(0, "scheduled")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    const sauve = f.posts;
    f.posts = [];
    await synchroniserEtatsZernio({ force: true, instant: T0 + 40 * 60_000 });
    let p = await unique("p-scheduled-0");
    expect(p.etatEnvoi).toBe("a-verifier");
    expect(estRapatrieeIntrouvable(p)).toBe(true);
    f.posts = sauve;
    await synchroniserEtatsZernio({ force: true, instant: T0 + 80 * 60_000 });
    p = await unique("p-scheduled-0");
    expect(p.etatEnvoi).toBeUndefined();
    expect(p.erreur).toBeUndefined();
    expect(p.introuvableDepuis).toBeUndefined();
    expect(p.constatsIntrouvable).toBeUndefined();
    expect(estRapatrieeIntrouvable(p)).toBe(false);
    expect(estRapatrieeRetirable(p, T0 + 30 * H)).toBe(false);
  });
  it("retirable seulement après 2 constats à des passages distincts ET 24 h ; un passage ne compte qu'une fois", async () => {
    const { estRapatrieeRetirable } = await import("@/services/retirer-rapatriee");
    const f = faux([fabrique(0, "scheduled")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    f.posts = [];
    await synchroniserEtatsZernio({ force: true, instant: T0 + 40 * 60_000 });
    let p = await unique("p-scheduled-0");
    expect(p.constatsIntrouvable).toBe(1);
    expect(estRapatrieeRetirable(p, T0 + 48 * H)).toBe(false); // un seul constat
    await synchroniserEtatsZernio({ force: true, instant: T0 + 50 * 60_000 });
    p = await unique("p-scheduled-0");
    expect(p.constatsIntrouvable).toBe(2);
    expect(estRapatrieeRetirable(p, T0 + 2 * H)).toBe(false); // moins de 24 h
    expect(estRapatrieeRetirable(p, T0 + 40 * 60_000 + 24 * H)).toBe(true);
    await synchroniserEtatsZernio({ force: true, instant: T0 + 60 * 60_000 });
    expect((await unique("p-scheduled-0")).constatsIntrouvable).toBeGreaterThanOrEqual(2);
  });
  it("publication d'avant (« à vérifier » sans les champs) : non retirable tant que les deux constats ne sont pas faits", async () => {
    const { estRapatrieeRetirable } = await import("@/services/retirer-rapatriee");
    const f = faux([fabrique(0, "scheduled")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    const p0 = await unique("p-scheduled-0");
    await depots().publications.modifier(p0.id, { etatEnvoi: "a-verifier" });
    expect(estRapatrieeRetirable(await unique("p-scheduled-0"), T0 + 99 * H)).toBe(false);
    f.posts = [];
    await synchroniserEtatsZernio({ force: true, instant: T0 + 1 * H });
    await synchroniserEtatsZernio({ force: true, instant: T0 + 2 * H });
    const p = await unique("p-scheduled-0");
    expect(p.constatsIntrouvable).toBe(2);
    expect(estRapatrieeRetirable(p, T0 + 2 * H)).toBe(false);
    expect(estRapatrieeRetirable(p, T0 + 1 * H + 24 * H)).toBe(true);
  });
  it("une publication née au Studio « à vérifier » : aucun champ de constat ajouté", async () => {
    await depots().publications.enregistrer({ id: "pub_s", reseau: "instagram", statut: "programmee", via: "zernio", idExterne: "ext-s", etatEnvoi: "a-verifier", date: iso(T0 + H), texte: "t", creeLe: iso(T0 - 5 * H), modifieLe: iso(T0 - 5 * H) } as never);
    const f = faux([]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().publications.obtenir("pub_s"))!.constatsIntrouvable).toBeUndefined();
  });
});
