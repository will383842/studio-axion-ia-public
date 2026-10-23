/** « l'IA » transcrit en « l » + « 'IA » : les sous-titres ne doivent jamais afficher une apostrophe de tête (vidéo v-e5d262bd9da5). */
import { describe, expect, it } from "vitest";
import { groupesSousTitres } from "@/moteurs/montage-facecam-animee/realisateur/sous-titres";
import { recollerElisions, type MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur/mots";

// Mots réels du plan (f = début du mot suivant).
const BRUTS: [string, number, number][] = [
  ["à", 17.51, 17.65], ["l", 17.65, 17.71], ["'IA", 17.71, 17.95], ["on", 17.95, 18.1],
  ["pour", 37.043, 37.323], ["absorber", 37.323, 37.683], ["l", 37.683, 37.803], ["'administratif", 37.803, 38.623],
  ["On", 38.623, 38.743], ["a", 38.743, 38.883], ["d", 38.883, 38.923], ["'abord", 38.923, 39.123], ["regardé", 39.123, 39.5],
];
const MOTS: MotTranscrit[] = BRUTS.map(([w, a, f]) => ({ w, a, f }));

describe("sous-titres · apostrophe de tête recollée", () => {
  const groupes = groupesSousTitres(MOTS);
  const tous = groupes.flatMap((g) => g.mots);

  it("aucun mot affiché ne commence par une apostrophe", () => {
    expect(tous.filter((m) => /^['’]/.test(m.w))).toEqual([]);
  });
  it("« l'IA », « l'administratif » et « d'abord » sont présents, entiers dans un seul groupe", () => {
    for (const attendu of ["l'IA", "l'administratif", "d'abord"]) {
      expect(tous.some((m) => m.w === attendu), attendu).toBe(true);
    }
  });
  it("« l'IA » commence quand « l » commence (17,65)", () => {
    expect(tous.find((m) => m.w === "l'IA")?.a).toBeCloseTo(17.65, 3);
  });
  it("recollerElisions : sans précédent, l'apostrophe de tête est retirée ; après une ponctuation, aussi", () => {
    expect(recollerElisions([{ w: "'IA", a: 1, f: 2 }]).map((m) => m.w)).toEqual(["IA"]);
    expect(recollerElisions([{ w: "fin.", a: 0, f: 1 }, { w: "'IA", a: 1, f: 2 }]).map((m) => m.w)).toEqual(["fin.", "IA"]);
    expect(recollerElisions([{ w: "l", a: 1, f: 1.2 }, { w: "’IA", a: 1.2, f: 2 }])).toEqual([{ w: "l’IA", a: 1, f: 2 }]);
  });
});
