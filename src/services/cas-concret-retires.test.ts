import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";

const C1 = CATALOGUE_TS[0]!;

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
  maintenant: () => "2026-10-24T10:00:00.000Z",
  journaliser: vi.fn(async (_t: string, m: string) => {
    etat.journal.push(m);
  }),
}));
vi.mock("./auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!etat.session) throw new Error("SESSION");
  }),
}));
vi.mock("./cas-concret-stock-acces", () => ({ trouverCasAutorise: async (id: string) => CATALOGUE_TS.find((c) => c.id === id) }));

import { lireCasRetires, refusCasRetire, remettreCas, retirerCas, type SourcesCasRetires } from "./cas-concret-retires";

function faux(depart: Record<string, unknown> = {}) {
  const s = { v: depart as Record<string, never>, ecritures: 0, t: "2026-10-24T10:00:00.000Z" };
  const src: SourcesCasRetires = {
    lire: async () => s.v as never,
    ecrire: async (v) => {
      s.v = v as never;
      s.ecritures++;
    },
    maintenant: () => s.t,
  };
  return { s, src };
}

beforeEach(() => {
  etat.session = true;
  etat.journal = [];
});

describe("cas retirés (service)", () => {
  it("la session est exigée", async () => {
    etat.session = false;
    const { src, s } = faux();
    await expect(retirerCas(C1.id, src)).rejects.toThrow("SESSION");
    await expect(remettreCas(C1.id, src)).rejects.toThrow("SESSION");
    expect(s.ecritures).toBe(0);
  });

  it("un identifiant inconnu, trop long ou de mauvais type est refusé", async () => {
    const { src, s } = faux();
    await expect(retirerCas("n-existe-pas", src)).rejects.toThrow("Ce cas n'existe plus.");
    await expect(retirerCas("x".repeat(121), src)).rejects.toThrow("Ce cas n'existe plus.");
    await expect(retirerCas(42 as never, src)).rejects.toThrow("Ce cas n'existe plus.");
    expect(s.ecritures).toBe(0);
  });

  it("retirer écrit le retrait avec le titre et journalise ; idempotent", async () => {
    const { src, s } = faux();
    await retirerCas(C1.id, src);
    expect(s.v[C1.id]).toMatchObject({ retireLe: "2026-10-24T10:00:00.000Z", titre: C1.titre });
    expect(etat.journal).toEqual([`Cas retiré : ${C1.titre}`]);
    expect([...(await lireCasRetires(src))]).toEqual([C1.id]);
    await retirerCas(C1.id, src);
    expect(s.ecritures).toBe(1);
  });

  it("remettre écrit remisLe sans rien effacer ; un cas non retiré ne se remet pas ; retirer de nouveau fonctionne", async () => {
    const { src, s } = faux();
    await expect(remettreCas(C1.id, src)).rejects.toThrow("Ce cas n'est pas retiré.");
    await retirerCas(C1.id, src);
    s.t = "2026-10-24T11:00:00.000Z";
    await remettreCas(C1.id, src);
    expect(s.v[C1.id]).toMatchObject({ retireLe: "2026-10-24T10:00:00.000Z", remisLe: "2026-10-24T11:00:00.000Z" });
    expect((await lireCasRetires(src)).size).toBe(0);
    s.t = "2026-10-24T12:00:00.000Z";
    await retirerCas(C1.id, src);
    expect([...(await lireCasRetires(src))]).toEqual([C1.id]);
    expect(s.v[C1.id]).toMatchObject({ retireLe: "2026-10-24T12:00:00.000Z", remisLe: "2026-10-24T11:00:00.000Z" });
  });

  it("refusCasRetire : la phrase pour un cas retiré, null sinon, null en porte B", async () => {
    const { src } = faux({ [C1.id]: { retireLe: "2026-10-24T10:00:00.000Z", titre: C1.titre } });
    expect(await refusCasRetire({ casConcret: { casId: C1.id } }, undefined, src)).toContain("Ce cas est retiré");
    expect(await refusCasRetire({ casConcret: { casId: "autre" } }, undefined, src)).toBeNull();
    expect(await refusCasRetire({ casConcret: { porte: "porte-b", casId: C1.id } }, undefined, src)).toBeNull();
    expect(await refusCasRetire({}, undefined, src)).toBeNull();
  });
});
