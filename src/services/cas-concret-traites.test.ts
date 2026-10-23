import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoCasTraite } from "@/domaine/cas-traites";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";

const C1 = CATALOGUE[0]!.id;

const etat = vi.hoisted(() => ({ session: true, journal: [] as string[] }));
vi.mock("./_commun", () => ({
  ErreurStudio: class extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
  creerVerrou: () => <T>(f: () => Promise<T>) => f(),
  depots: () => ({}),
  ecrireParametre: vi.fn(),
  lireParametre: vi.fn(async (_id: string, d: unknown) => d),
  maintenant: () => "2026-10-23T10:00:00.000Z",
  journaliser: vi.fn(async (_t: string, m: string) => {
    etat.journal.push(m);
  }),
}));
vi.mock("./auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!etat.session) throw new Error("SESSION");
  }),
}));

import { estCasTraite, inscrireLesCasDejaTraites, lireCasTraites, noterAvantSuppression, noterCasTraite, remettreEnStock, type SourcesCasTraites } from "./cas-concret-traites";

const video = (id: string, casId: string, plus: Partial<VideoCasTraite> = {}): VideoCasTraite => ({
  id,
  titre: `Vidéo ${id}`,
  formatId: "cas-concret",
  statut: "prete",
  entrees: { casConcret: { casId } },
  terminee: "2026-10-10T10:00:00.000Z",
  ...plus,
});

/** Faux dépôts en mémoire. */
function faux(videos: VideoCasTraite[], inscrits = {}, remis = {}) {
  const s = {
    videos,
    inscrits: inscrits as Record<string, { videoId?: string; titre: string; le: string }>,
    remis: remis as Record<string, { remisLe: string; videoIds?: string[] }>,
    ecritures: 0,
  };
  const src: SourcesCasTraites = {
    videos: async () => s.videos,
    inscrits: async () => s.inscrits,
    remis: async () => s.remis,
    ecrireInscrits: async (v) => {
      s.ecritures++;
      s.inscrits = v;
    },
    ecrireRemis: async (v) => {
      s.ecritures++;
      s.remis = v;
    },
    maintenant: () => "2026-10-23T10:00:00.000Z",
  };
  return { s, src };
}

beforeEach(() => {
  etat.session = true;
  etat.journal = [];
});

describe("lireCasTraites / estCasTraite", () => {
  it("une vidéo prête rend le cas traité ; une vidéo en file non", async () => {
    const { src } = faux([video("v1", C1), video("v2", "c2", { statut: "en_file" })]);
    expect(await estCasTraite(C1, {}, src)).toBe(true);
    expect(await estCasTraite("c2", {}, src)).toBe(false);
    expect([...(await lireCasTraites(src)).keys()]).toEqual([C1]);
  });
  it("la vidéo relancée elle-même ne compte pas contre son cas", async () => {
    const { src } = faux([video("v1", C1)]);
    expect(await estCasTraite(C1, { saufVideoId: "v1" }, src)).toBe(false);
    expect(await estCasTraite(C1, { saufVideoId: "autre" }, src)).toBe(true);
  });
});

describe("noterCasTraite", () => {
  const v = { id: "v1", titre: "T", formatId: "cas-concret", entrees: { casConcret: { casId: C1 } } };
  it("inscrit le cas, une seule fois (idempotent)", async () => {
    const { s, src } = faux([]);
    expect(await noterCasTraite(v, src)).toBe(true);
    expect(await noterCasTraite({ ...v, id: "v2" }, src)).toBe(false);
    expect(s.ecritures).toBe(1);
    expect(s.inscrits[C1]).toMatchObject({ videoId: "v1", titre: "T" });
    expect(await estCasTraite(C1, {}, src)).toBe(true);
  });
  it("ignore l'avocat, la démonstration, les vidéos dérivées et sans cas", async () => {
    const { s, src } = faux([]);
    expect(await noterCasTraite({ ...v, formatId: "avocat" }, src)).toBe(false);
    expect(await noterCasTraite({ ...v, estDemo: true }, src)).toBe(false);
    expect(await noterCasTraite({ ...v, sourceVideoId: "m" }, src)).toBe(false);
    expect(await noterCasTraite({ ...v, entrees: {} }, src)).toBe(false);
    expect(s.ecritures).toBe(0);
  });
});

describe("remettreEnStock", () => {
  it("sans session : refus, rien n'est écrit", async () => {
    etat.session = false;
    const { s, src } = faux([video("v1", C1)]);
    await expect(remettreEnStock(C1, src)).rejects.toThrow("SESSION");
    expect(s.ecritures).toBe(0);
  });
  it("le cas réapparaît, l'action est journalisée, la vidéo reste", async () => {
    const { s, src } = faux([video("v1", C1)], { [C1]: { videoId: "v1", titre: "x", le: "2026-10-10T10:00:00.000Z" } });
    await remettreEnStock(C1, src);
    expect(await estCasTraite(C1, {}, src)).toBe(false);
    expect(s.inscrits[C1]).toBeUndefined();
    expect(s.videos).toHaveLength(1);
    expect(etat.journal[0]).toContain(C1);
  });
  it("une nouvelle vidéo finie retire le cas de nouveau (par vidéo ou par inscription)", async () => {
    const { s, src } = faux([video("v1", C1)]);
    await remettreEnStock(C1, src);
    s.videos = [...s.videos, video("v2", C1, { terminee: "2026-10-24T08:00:00.000Z" })];
    expect(await estCasTraite(C1, {}, src)).toBe(true);
    // Même vidéo supprimée ensuite : l'inscription de la nouvelle vidéo le garde traité.
    expect(await noterCasTraite({ id: "v2", titre: "N", formatId: "cas-concret", terminee: "2026-10-24T08:00:00.000Z", entrees: { casConcret: { casId: C1 } } }, src)).toBe(true);
    s.videos = [];
    expect(await estCasTraite(C1, {}, src)).toBe(true);
  });
  it("l'ancienne vidéo retouchée après la remise ne rend pas le cas traité", async () => {
    const { s, src } = faux([video("v1", C1)]);
    await remettreEnStock(C1, src);
    s.videos = [video("v1", C1, { terminee: "2026-10-25T08:00:00.000Z" })];
    expect(await estCasTraite(C1, {}, src)).toBe(false);
    expect(await noterCasTraite({ id: "v1", titre: "x", formatId: "cas-concret", entrees: { casConcret: { casId: C1 } } }, src)).toBe(false);
  });
});

describe("remettreEnStock : garde-fous", () => {
  it("un identifiant inconnu, trop long ou pas traité est refusé (CAS_INCONNU), rien n'est écrit", async () => {
    const { s, src } = faux([video("v1", C1)]);
    await expect(remettreEnStock("inconnu", src)).rejects.toMatchObject({ code: "CAS_INCONNU" });
    await expect(remettreEnStock("x".repeat(500), src)).rejects.toMatchObject({ code: "CAS_INCONNU" });
    await expect(remettreEnStock(CATALOGUE[1]!.id, src)).rejects.toMatchObject({ code: "CAS_INCONNU" });
    expect(s.ecritures).toBe(0);
    expect(etat.journal.join(" ")).not.toContain("inconnu");
  });
});

describe("noterAvantSuppression et passe unique", () => {
  const prete = (plus: Record<string, unknown> = {}) => ({ id: "v1", titre: "T", formatId: "cas-concret", statut: "prete", entrees: { casConcret: { casId: C1 } }, ...plus }) as never;
  it("vidéo finie : le cas est inscrit avant l'effacement ; en panne, démo, dérivée : rien", async () => {
    const { s, src } = faux([]);
    await noterAvantSuppression(prete({ statut: "echec" }), src);
    await noterAvantSuppression(prete({ estDemo: true }), src);
    await noterAvantSuppression(prete({ sourceVideoId: "m" }), src);
    expect(s.ecritures).toBe(0);
    await noterAvantSuppression(prete({ statut: "archivee", statutAvantArchive: "prete" }), src);
    expect(s.inscrits[C1]).toMatchObject({ videoId: "v1" });
  });
  it("une erreur d'écriture ne remonte jamais (la suppression n'est pas bloquée)", async () => {
    const { src } = faux([]);
    src.ecrireInscrits = async () => {
      throw new Error("base");
    };
    await expect(noterAvantSuppression(prete(), src)).resolves.toBeUndefined();
    expect(etat.journal.some((m) => m.includes("avant suppression"))).toBe(true);
  });
  it("passe unique : ajoute les cas des vidéos prêtes, jamais ne retire ni n'écrase, respecte une remise", async () => {
    const { s, src } = faux([video("v1", C1), video("v2", CATALOGUE[1]!.id), video("v3", CATALOGUE[2]!.id)], { [CATALOGUE[1]!.id]: { videoId: "ancienne", titre: "Gardée", le: "2026-01-01T00:00:00.000Z" } }, { [CATALOGUE[2]!.id]: { remisLe: "2026-10-20T00:00:00.000Z" } });
    expect(await inscrireLesCasDejaTraites(src)).toBe(1);
    expect(s.inscrits[C1]).toBeDefined();
    expect(s.inscrits[CATALOGUE[1]!.id]!.titre).toBe("Gardée");
    expect(s.inscrits[CATALOGUE[2]!.id]).toBeUndefined();
    expect(await inscrireLesCasDejaTraites(src)).toBe(0);
  });
});
