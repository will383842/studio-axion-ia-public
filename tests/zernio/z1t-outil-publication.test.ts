import { describe, expect, it } from "vitest";
import { OUTILS, cleEnvoiPublication, estChezUnOutil, outilDe, outilPour } from "@/domaine/outil-publication";

describe("z1t · outil de publication", () => {
  it("OUTILS liste buffer et zernio", () => {
    expect([...OUTILS]).toEqual(["buffer", "zernio"]);
  });
  it("outilDe et estChezUnOutil", () => {
    expect(outilDe({ via: "buffer" } as never)).toBe("buffer");
    expect(outilDe({ via: "zernio" } as never)).toBe("zernio");
    expect(outilDe({ via: "manuel" } as never)).toBeNull();
    expect(estChezUnOutil({ via: "zernio" } as never)).toBe(true);
    expect(estChezUnOutil({ via: "simulation" } as never)).toBe(false);
  });
  it("outilPour : défaut Zernio, clé la plus précise gagnante", () => {
    expect(outilPour({}, "linkedin", "exemple")).toBe("zernio");
    expect(outilPour(undefined, "linkedin")).toBe("zernio");
    expect(outilPour({ linkedin: "zernio" }, "linkedin", "exemple")).toBe("zernio");
    expect(outilPour({ linkedin: "zernio", "linkedin:exemple": "buffer" }, "linkedin", "exemple")).toBe("buffer");
    expect(outilPour({ linkedin: "buffer", "linkedin:exemple": "zernio" }, "linkedin", "exemple")).toBe("zernio");
    expect(outilPour({ "linkedin:exemple": "zernio" }, "linkedin", "autre")).toBe("zernio");
    expect(outilPour({ linkedin: "inconnu" }, "linkedin")).toBe("zernio");
    expect(outilPour({ constructor: "buffer" }, "toString")).toBe("zernio");
  });
  it("cleEnvoiPublication est stable et neutre", () => {
    const a = cleEnvoiPublication("video-exemple", "linkedin", "2026-01-01T10:00:00Z", "exemple");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(`studio-${a}`.length).toBeLessThanOrEqual(255);
    expect(cleEnvoiPublication("video-exemple", "linkedin", "2026-01-01T10:00:00Z", "exemple")).toBe(a);
    expect(cleEnvoiPublication("video-autre", "linkedin", "2026-01-01T10:00:00Z", "exemple")).not.toBe(a);
    expect(cleEnvoiPublication("video-exemple", "tiktok", "2026-01-01T10:00:00Z", "exemple")).not.toBe(a);
    expect(cleEnvoiPublication("video-exemple", "linkedin", "2026-01-02T10:00:00Z", "exemple")).not.toBe(a);
    expect(cleEnvoiPublication("video-exemple", "linkedin", "2026-01-01T10:00:00Z", "autre")).not.toBe(a);
  });
});
