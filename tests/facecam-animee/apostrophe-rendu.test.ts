/** Rendu : « L » + « 'IA » recollés aussi dans `groupesDuPlan` (copie de `recollerElisions` du réalisateur, test d'égalité). */
import { describe, expect, it } from "vitest";
import { recollerElisions } from "@/moteurs/montage-facecam-animee/realisateur/mots";

const MOTS = [
  ["à", 17.51], ["l", 17.65], ["'IA", 17.71], ["on", 17.95],
  ["pour", 37.043], ["absorber", 37.323], ["l", 37.683], ["'administratif", 37.803], ["On", 38.623], ["a", 38.743], ["d", 38.883], ["'abord", 38.923], ["regardé", 39.123],
] as const;
const plats = MOTS.map(([w, a], k) => ({ w, a, f: MOTS[k + 1]?.[1] ?? a + 0.3 }));
const charger = () => import("../../studio-rendu/compositions/interface-claire/VideoAnimeeV4");

describe("rendu · apostrophes recollées", () => {
  it("groupesDuPlan : aucun mot ne commence par une apostrophe, « L'IA » et « D'ABORD » présents", async () => {
    const { groupesDuPlan } = await charger();
    const plan = [{ mots: plats.slice(0, 4).map(({ w, a }) => ({ w, a })), debut: 17.51, fin: 18.2 }, { mots: plats.slice(4).map(({ w, a }) => ({ w, a })), debut: 37.04, fin: 39.5 }] as never;
    const mots = groupesDuPlan(plan, 90).flatMap((g) => g.mots.map((m) => m.mot));
    expect(mots.filter((m) => /^['’]/.test(m))).toEqual([]);
    for (const attendu of ["L'IA", "L'ADMINISTRATIF", "D'ABORD"]) expect(mots, attendu).toContain(attendu);
  });
  it("recollerElisionsRendu donne les mêmes mots que le réalisateur", async () => {
    const { recollerElisionsRendu } = await charger();
    const cas = [...plats.map(({ w, a }) => ({ w, a })), { w: "fin.", a: 40 }, { w: "'IA", a: 40.2 }];
    const attendu = recollerElisions(cas.map((m) => ({ ...m, f: m.a + 0.1 }))).map(({ w, a }) => ({ w, a }));
    expect(recollerElisionsRendu(cas)).toEqual(attendu);
    expect(recollerElisionsRendu([{ w: "'IA", a: 1 }]).map((m) => m.w)).toEqual(["IA"]);
  });
});
