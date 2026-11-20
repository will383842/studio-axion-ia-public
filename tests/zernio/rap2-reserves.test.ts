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
    await depots().publications.enregistrer({ id: "pub-studio", videoId: "v1", reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-12-01T09:00:00.000Z", texte: "t", idExterne: "p-fictif", creeLe: "2026-11-20T10:00:00.000Z", modifieLe: "2026-11-20T10:00:00.000Z" } as never);
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
