import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  REGLAGES_CADENCE_DEFAUT,
  alertesObjectifs,
  avertissementsCreneau,
  normaliserReglagesCadence,
} from "@/domaine/cadence/reglages";

const memoire = new Map<string, unknown>();
vi.mock("@/services/_commun", () => ({
  lireParametre: async (id: string, defaut: unknown) => (memoire.has(id) ? memoire.get(id) : defaut),
  ecrireParametre: async (id: string, v: unknown) => void memoire.set(id, v),
  journaliser: async () => undefined,
  essayer: async (f: () => Promise<unknown>) => {
    try {
      return { ok: true, donnees: await f() };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
}));
vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

beforeEach(() => memoire.clear());

describe("cadence : créneaux", () => {
  it("accepte 8 h et 18 h sur LinkedIn, sans avertissement", () => {
    const r = REGLAGES_CADENCE_DEFAUT;
    expect(avertissementsCreneau(r, "linkedin", "2026-12-01T08:00", [])).toEqual([]);
    expect(avertissementsCreneau(r, "linkedin", "2026-12-01T18:00", [])).toEqual([]);
  });
  it("avertit au deuxième créneau LinkedIn le même jour (sans bloquer)", () => {
    const a = avertissementsCreneau(REGLAGES_CADENCE_DEFAUT, "linkedin", "2026-12-01T18:00", ["2026-12-01T08:00"]);
    expect(a.length).toBeGreaterThan(0);
    expect(a.join(" ")).toMatch(/LinkedIn/);
  });
  it("ne compte pas un autre jour ni un autre réseau", () => {
    const r = REGLAGES_CADENCE_DEFAUT;
    expect(avertissementsCreneau(r, "linkedin", "2026-12-02T08:00", ["2026-12-01T08:00"])).toEqual([]);
    expect(avertissementsCreneau(r, "linkedin", "2026-12-01T08:00", [])).toEqual([]);
  });
  it("avertit si l'écart minimum entre deux créneaux n'est pas respecté", () => {
    const r = normaliserReglagesCadence({ reseaux: { instagram: { heures: ["08:00", "09:30", "10:00"], quotaParJour: 5, ecartMinMinutes: 120 } } });
    expect(avertissementsCreneau(r, "instagram", "2026-12-01T09:30", ["2026-12-01T08:00"]).length).toBe(1);
    expect(avertissementsCreneau(r, "instagram", "2026-12-01T10:00", ["2026-12-01T08:00"])).toEqual([]);
  });
  it("avertit hors des heures proposées", () => {
    expect(avertissementsCreneau(REGLAGES_CADENCE_DEFAUT, "linkedin", "2026-12-01T03:00", []).length).toBe(1);
  });
});

describe("cadence : normalisation", () => {
  it("retombe sur les valeurs de départ si l'entrée est invalide", () => {
    expect(normaliserReglagesCadence("n'importe quoi")).toEqual(REGLAGES_CADENCE_DEFAUT);
    expect(normaliserReglagesCadence(null)).toEqual(REGLAGES_CADENCE_DEFAUT);
  });
  it("écarte les heures mal formées, trie et dédoublonne", () => {
    const r = normaliserReglagesCadence({ reseaux: { linkedin: { heures: ["18:00", "25:00", "08:00", "08:00", "x"], quotaParJour: 2 } } });
    expect(r.reseaux.linkedin.heures).toEqual(["08:00", "18:00"]);
    expect(r.reseaux.linkedin.quotaParJour).toBe(2);
  });
  it("borne les nombres négatifs ou absurdes", () => {
    const r = normaliserReglagesCadence({ reseaux: { linkedin: { quotaParJour: -3, ecartMinMinutes: 99999 } } });
    expect(r.reseaux.linkedin.quotaParJour).toBeGreaterThanOrEqual(0);
    expect(r.reseaux.linkedin.ecartMinMinutes).toBeLessThanOrEqual(1440);
  });
});

describe("cadence : objectifs en alertes", () => {
  it("alerte sans bloquer quand l'objectif n'est pas atteint", () => {
    const a = alertesObjectifs(REGLAGES_CADENCE_DEFAUT.objectifs, { video: 0, carrousel: 0, infographie: 0 });
    expect(a.map((x) => x.type).sort()).toEqual(["carrousel", "infographie", "video"]);
    expect(a.every((x) => x.bloquant === false)).toBe(true);
  });
  it("aucune alerte quand les objectifs sont atteints", () => {
    expect(alertesObjectifs(REGLAGES_CADENCE_DEFAUT.objectifs, { video: 1, carrousel: 1, infographie: 3 })).toEqual([]);
  });
});

describe("cadence : service et action", () => {
  it("lit les valeurs de départ puis relit ce qui a été enregistré", async () => {
    const { lireReglagesCadence } = await import("@/services/reglages-cadence");
    const { enregistrerReglagesCadenceAction } = await import("@/app/(studio)/reglages/cadence/actions");
    expect(await lireReglagesCadence()).toEqual(REGLAGES_CADENCE_DEFAUT);
    const res = await enregistrerReglagesCadenceAction({ reseaux: { linkedin: { heures: ["07:30"], quotaParJour: 1 } } });
    expect(res.ok).toBe(true);
    expect((await lireReglagesCadence()).reseaux.linkedin.heures).toEqual(["07:30"]);
  });
});
