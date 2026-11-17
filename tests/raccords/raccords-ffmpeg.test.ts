/**
 * C6-H24c-a · `filtresRaccords` : traduction pure « raccords → morceaux de graphe FFmpeg ». NON branchée : rien ne l'importe.
 * Aucune exécution de FFmpeg ici. 25 i/s dans tous les exemples.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filtresRaccords } from "../../studio-rendu/src/composition/raccords-ffmpeg";

const FPS = 25;
// Quatre morceaux : 2 s, 3 s, 2 s, 1 s.
const E = [
  { debutImage: 0, finImage: 50 },
  { debutImage: 50, finImage: 125 },
  { debutImage: 125, finImage: 175 },
  { debutImage: 175, finImage: 200 },
];

describe("filtresRaccords", () => {
  it("sans raccord → null (l'appelant garde le concat tel quel)", () => {
    expect(filtresRaccords(E, [], FPS)).toBeNull();
  });

  it("un fondu entre les morceaux 2 et 3 → un seul xfade à l'offset exact", () => {
    const r = filtresRaccords(E, [{ indexAvant: 1, type: "fondu" }], FPS)!;
    const xf = r.filtres.filter((f) => f.includes("xfade="));
    expect(xf).toHaveLength(1);
    // [m0][m1] concat → 5 s ; puis xfade avec m2 : offset = 5 − 0,3 = 4,7
    expect(xf[0]).toContain("xfade=transition=fade:duration=0.300:offset=4.700");
    expect(r.filtres.some((f) => f.includes("concat=n=2"))).toBe(true);
    expect(r.sortie).toMatch(/^\[[a-z0-9]+\]$/);
  });

  it("premier raccord : offset = durée du morceau 1 moins la durée du raccord", () => {
    const r = filtresRaccords(E, [{ indexAvant: 0, type: "fondu" }], FPS)!;
    expect(r.filtres.find((f) => f.includes("xfade="))).toContain("offset=1.700");
  });

  it("glissement → slideleft", () => {
    const r = filtresRaccords(E, [{ indexAvant: 0, type: "glissement" }], FPS)!;
    const xf = r.filtres.find((f) => f.includes("xfade="))!;
    expect(xf).toContain("transition=slideleft");
    expect(xf).not.toContain("transition=fade");
  });

  it("durée bornée à la moitié du plus court des deux morceaux", () => {
    // morceaux 3 et 4 : 2 s et 1 s → plafond 0,5 s
    const r = filtresRaccords(E, [{ indexAvant: 2, type: "fondu" }], FPS, { dureeSec: 5 })!;
    expect(r.filtres.find((f) => f.includes("xfade="))).toContain("duration=0.500");
  });

  it("deux raccords consécutifs → étiquettes uniques, la seconde chaîne sur la première", () => {
    const r = filtresRaccords(E, [{ indexAvant: 0, type: "fondu" }, { indexAvant: 1, type: "glissement" }], FPS)!;
    const xf = r.filtres.filter((f) => f.includes("xfade="));
    expect(xf).toHaveLength(2);
    const sorties = r.filtres.map((f) => f.match(/\[([^\]]+)\]$/)?.[1]).filter(Boolean) as string[];
    expect(new Set(sorties).size).toBe(sorties.length);
    expect(r.sortie).toBe(`[${sorties[sorties.length - 1]}]`);
    // durée cumulée : 2 + 3 − 0,3 = 4,7 s → offset du second = 4,7 − 0,3 = 4,4
    expect(xf[1]).toContain("offset=4.400");
  });

  it("formats 10 bits repris", () => {
    const r = filtresRaccords(E, [{ indexAvant: 0, type: "fondu" }], FPS, { formats: { rvb: "gbrp10le" } })!;
    expect(r.filtres.join(";")).toContain("format=gbrp10le");
    expect(r.filtres.join(";")).not.toContain("format=gbrp,");
    expect(filtresRaccords(E, [{ indexAvant: 0, type: "fondu" }], FPS)!.filtres.join(";")).toContain("format=gbrp");
  });

  it("déterministe, et raccords hors bornes ignorés", () => {
    const rac = [{ indexAvant: 1, type: "fondu" as const }];
    expect(filtresRaccords(E, rac, FPS)).toEqual(filtresRaccords(E, rac, FPS));
    expect(filtresRaccords(E, [{ indexAvant: 9, type: "fondu" }, { indexAvant: -1, type: "fondu" }], FPS)).toBeNull();
  });

  it("garde statique : aucun import de src/ ni de @/, pas de bibliotheque-video", () => {
    const code = readFileSync("studio-rendu/src/composition/raccords-ffmpeg.ts", "utf8");
    expect(code).not.toMatch(/from\s+["'](\.\.\/)+src\//);
    expect(code).not.toMatch(/from\s+["']@\//);
    expect(code).not.toContain("bibliotheque-video");
  });
});
