/** RAP-2 · réserves de la relecture de RAP-1 : date normalisée, création sans doublon, photographie honnête. Données fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PostZernio } from "@/fournisseurs/publication/zernio-client";
import { deciderRapatriement, type ConnusLocaux } from "@/domaine/rapatriement-zernio";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { listerCalendrier } = await import("@/services/publications");
const { depsRapatriementServeur } = await import("@/services/rapatriement-zernio");
// @ts-expect-error l'outil est un module .mts
const outil = await import("../../outils/zernio/ecart-calendrier.mts");

const VIDE: ConnusLocaux = { idsExternes: new Set(), clesEnvoi: new Set(), clesCreneaux: new Set() };
const post = (scheduledFor: string): PostZernio => ({ _id: "p-fictif", content: "t", status: "scheduled", scheduledFor, platforms: [{ platform: "instagram", accountId: "compte-fictif", status: "scheduled" }] });
const dateStockee = (s: string) => deciderRapatriement([post(s)], VIDE, { instant: "2026-11-20T10:00:00.000Z" }).aCreer[0].date;

beforeEach(() => {
  reinitialiserDepots();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("RAP-2 · réserve 3 : date stockée normalisée", () => {
  it("sans millisecondes → format ISO complet ; décalage +01:00 → ramenée en UTC", () => {
    expect(dateStockee("2026-11-20T23:59:59Z")).toBe("2026-11-20T23:59:59.000Z");
    expect(dateStockee("2026-11-21T00:30:00+01:00")).toBe("2026-11-20T23:30:00.000Z");
  });

  it("aux bornes : la dernière seconde de la fenêtre est incluse, une heure plus tard exclue (comparaison en chaînes)", async () => {
    for (const [id, s] of [["a", "2026-11-20T23:59:59Z"], ["b", "2026-11-21T00:30:00+01:00"], ["c", "2026-11-21T00:00:30Z"]] as const) {
      const p = deciderRapatriement([{ ...post(s), _id: `p-${id}` }], VIDE, { instant: "2026-11-20T10:00:00.000Z" }).aCreer[0];
      await depots().publications.enregistrer({ ...p, creeLe: p.rapatrieeLe!, modifieLe: p.rapatrieeLe! } as never);
    }
    const jours = await listerCalendrier("2026-11-20T00:00:00.000Z", "2026-11-20T23:59:59.999Z");
    const ids = jours.flatMap((j) => j.publications.map((x) => x.id)).filter((i) => i.startsWith("zr_")).sort();
    expect(ids).toEqual(["zr_p-a_compte-fictif", "zr_p-b_compte-fictif"]);
  });
});

describe("RAP-2 · réserve 5 : création sous verrou, revérifiée sur l'idExterne", () => {
  it("une publication locale (née d'un envoi du Studio) a déjà cet idExterne : aucune rapatriée en double", async () => {
    const d = await depsRapatriementServeur();
    await depots().publications.enregistrer({ id: "pub-studio", reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-12-01T09:00:00.000Z", texte: "t", idExterne: "p-fictif", creeLe: "2026-11-20T10:00:00.000Z", modifieLe: "2026-11-20T10:00:00.000Z" } as never);
    const a = deciderRapatriement([post("2026-12-01T09:00:00.000Z")], VIDE, { instant: "2026-11-20T10:00:00.000Z" }).aCreer[0];
    expect(await d.creerSiAbsente(a)).toBe("existait");
    expect(await depots().publications.compter((x) => x.idExterne === "p-fictif")).toBe(1);
  });
});

describe("RAP-2 · réserve 4 : photographie honnête", () => {
  it("platforms absent → une ligne « inconnue », la lecture n'échoue pas", () => {
    const lignes = outil.ligneDe({ _id: "p-fictif", content: "t", status: "scheduled", scheduledFor: "2026-12-01T09:00:00.000Z" } as unknown as PostZernio);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ plateforme: "inconnue", compte: "" });
  });

  it("plafond de pages atteint sur une page pleine → lecture déclarée incomplète ; fin normale → complète", async () => {
    const pleine = Array.from({ length: 100 }, (_, i) => ({ _id: `p-${i}`, content: "t", status: "scheduled", platforms: [] }) as unknown as PostZernio);
    const sans = { listerPosts: vi.fn(async (q?: Record<string, string | number | boolean>) => (q?.status === "scheduled" ? pleine.map((p) => ({ ...p, _id: `${p._id}-${q.page}` })) : [])) };
    const r = await outil.lirePhotographie(sans as never, 3);
    expect(r.complete).toBe(false);
    expect(sans.listerPosts).toHaveBeenCalledTimes(3 + 2);
    const fin = await outil.lirePhotographie({ listerPosts: async () => [] } as never, 3);
    expect(fin.complete).toBe(true);
  });
});

// ── Réserve 1 de la relecture de #1490 : une rapatriée supprimée chez le diffuseur ne doit pas affamer le suivi des publications du Studio. ──
describe("RAP-2 · rapatriées introuvables : le suivi des publications du Studio n'est pas affamé", () => {
  it("40 rapatriées introuvables + une publication du Studio hors de la liste : relue en un passage au plus, budget tenu", async () => {
    const { injecterClientZernio, synchroniserEtatsZernio, BUDGET_REQUETES_PAR_PASSAGE } = await import("@/services/zernio");
    const { ErreurZernio } = await import("@/fournisseurs/publication/zernio-erreurs");
    const T0 = Date.parse("2026-11-20T08:00:00Z");
    const iso = (ms: number) => new Date(ms).toISOString();
    const mk = (id: string, status: string, n: number): PostZernio => ({ _id: id, content: "t", status, scheduledFor: iso(T0 + (n + 1) * 3600_000), platforms: [{ platform: "instagram", accountId: "compte-fictif", status: "pending" }] });
    const programmes = Array.from({ length: 40 }, (_, i) => mk(`p-r-${i}`, "scheduled", i));
    // Passage 0 : les 40 sont rapatriées. Le diffuseur en tient aussi 600 déjà publiées, puis le post du Studio (hors des 500 premiers de la liste complète).
    let posts: PostZernio[] = [...programmes];
    const compte = { total: 0, unitaires: 0, introuvables: new Set<string>() };
    const client = {
      async listerComptes() { compte.total++; return []; },
      async listerPosts(q?: Record<string, string | number | boolean>) {
        compte.total++;
        const tous = posts.filter((p) => (q?.status ? p.status === q.status : true));
        const page = Number(q?.page ?? 1), limite = Number(q?.limit ?? 50);
        return tous.slice((page - 1) * limite, page * limite);
      },
      async lirePost(id: string) {
        compte.total++; compte.unitaires++;
        const p = posts.find((x) => x._id === id);
        if (!p || compte.introuvables.has(id)) throw new ErreurZernio("introuvable", "404", { statut: 404 });
        return p;
      },
    } as never;
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(await depots().publications.compter((p) => !!p.rapatrieeLe)).toBe(40);
    // Une publication née au Studio, programmée, lue pour la dernière fois à T0 + 45 min.
    await depots().publications.enregistrer({ id: "pub-studio", reseau: "instagram", statut: "programmee", via: "zernio", date: iso(T0 + 5 * 3600_000), texte: "t", idExterne: "p-studio", cleEnvoi: "k-studio", etatEnvoi: "envoye", etatLuLe: iso(T0 + 45 * 60_000), creeLe: iso(T0), modifieLe: iso(T0) } as never);
    // Le diffuseur supprime les 40 ; le post du Studio est publié mais loin dans la liste (derrière 600 posts publiés).
    for (const p of programmes) compte.introuvables.add(p._id);
    posts = [...Array.from({ length: 600 }, (_, i) => mk(`p-pub-${i}`, "published", i)), { ...mk("p-studio", "published", 0), publishedAt: iso(T0 + 3600_000) } as PostZernio];
    await synchroniserEtatsZernio({ force: true, instant: T0 + 31 * 60_000, complet: true }); // elles passent « à vérifier »
    compte.total = 0; compte.unitaires = 0;
    await synchroniserEtatsZernio({ force: true, instant: T0 + 46 * 60_000, complet: true });
    expect((await depots().publications.obtenir("pub-studio"))!.statut).toBe("publiee"); // relue, malgré les 40 introuvables
    expect(compte.total).toBeLessThanOrEqual(BUDGET_REQUETES_PAR_PASSAGE);
    // Toutes les rapatriées sont à vérifier, aucune notification d'envoi (cloche seulement).
    expect(await depots().publications.compter((p) => !!p.rapatrieeLe && p.etatEnvoi === "a-verifier")).toBe(40);
  });
});
