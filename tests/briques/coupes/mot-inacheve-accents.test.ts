import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { calculerCoupes } from "@/briques/coupes";
import { estMotInacheve } from "@/briques/coupes/texte";

function dire(texte: string): MotHorodate[] {
  let t = 1;
  return texte.split(/\s+/).filter(Boolean).map((mot) => {
    const m = { mot, debutSec: +t.toFixed(3), finSec: +(t + 0.3).toFixed(3) };
    t += 0.35;
    return m;
  });
}

describe("estMotInacheve · lettres accentuées", () => {
  it("un mot accentué coupé par des points de suspension est inachevé", () => {
    expect(estMotInacheve("ré…")).toBe(true);
    expect(estMotInacheve("ré...")).toBe(true);
    expect(estMotInacheve("été…")).toBe(true);
  });
  it("cas inchangés", () => {
    expect(estMotInacheve("pro…")).toBe(true);
    expect(estMotInacheve("impor-")).toBe(true);
    expect(estMotInacheve("…")).toBe(false);
    expect(estMotInacheve("...")).toBe(false);
    expect(estMotInacheve("fini.")).toBe(false);
    expect(estMotInacheve("été")).toBe(false);
  });
});

describe("calculerCoupes · « ré… » est un faux départ", () => {
  it("le mot passe en statut hesitation", () => {
    const mots = dire("Nous allons ré… reprendre chaque dossier ensemble.");
    const plan = calculerCoupes({ mots, dureeSec: 6 });
    const coupe = plan.coupes.find((c) => c.type === "hesitation" && c.debutSec <= mots[2].debutSec + 0.01 && c.finSec >= mots[2].finSec - 0.01);
    expect(coupe).toBeDefined();
  });
});
