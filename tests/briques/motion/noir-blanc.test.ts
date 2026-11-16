/**
 * C10-05 — noir et blanc narratif sur des plages données (étape FFmpeg `hue=s=0` avec `enable`), NON BRANCHÉ.
 * Éteint = identique : sans `noirBlanc`, la chaîne des couleurs est inchangée au caractère près.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { etapeNoirBlanc, normaliserPlagesNoirBlanc } from "../../../src/briques/motion/habillage-commun/noir-blanc";
import { chaineCouleurs, expressionPlages } from "../../../studio-rendu/src/composition/ffmpeg";

const COUL = { grainPct: 4, grainTaillePx: 2, vignettePct: 8 };
const TAILLE = { largeur: 1080, hauteur: 1920 };
const LUTS = [{ fichier: "lut-1-melangee.cube", plages: [[0, 2.26], [3.96, 5.51]] as [number, number][] }];
const BASE = { entree: "[0:v]", grain: "[1:v]", dejaRvb: false };

describe("normaliserPlagesNoirBlanc", () => {
  it("fusionne les chevauchements et trie", () => {
    expect(normaliserPlagesNoirBlanc([[4, 5], [1, 2.5], [2, 3]], 10)).toEqual([[1, 3], [4, 5]]);
  });
  it("borne une plage qui dépasse la durée", () => {
    expect(normaliserPlagesNoirBlanc([[8, 15]], 10)).toEqual([[8, 10]]);
  });
  it("retire les plages négatives, vides, hors durée ou non finies", () => {
    expect(normaliserPlagesNoirBlanc([[-3, -1], [5, 5], [6, 4], [12, 14], [NaN, 2], [1, 2]], 10)).toEqual([[1, 2]]);
  });
  it("borne un début négatif à 0", () => {
    expect(normaliserPlagesNoirBlanc([[-2, 1]], 10)).toEqual([[0, 1]]);
  });
});

describe("etapeNoirBlanc", () => {
  it("null sans plage", () => expect(etapeNoirBlanc([])).toBeNull());
  it("même forme d'expression que expressionPlages", () => {
    const p: [number, number][] = [[1, 2.5], [4, 5]];
    expect(etapeNoirBlanc(p)).toBe(`hue=s=0:enable='${expressionPlages(p)}'`);
  });
});

describe("chaineCouleurs et noirBlanc", () => {
  for (const dixBits of [false, true]) {
    const o = { ...BASE, ...(dixBits ? { dixBits: true } : {}) };
    const label = dixBits ? "10 bits" : "8 bits";
    it(`éteint (absent, [] ) = chaîne identique (${label})`, () => {
      const ref = chaineCouleurs(COUL, LUTS, TAILLE, o);
      expect(chaineCouleurs(COUL, LUTS, TAILLE, { ...o, noirBlanc: [] })).toBe(ref);
      expect(chaineCouleurs(COUL, LUTS, TAILLE, { ...o, noirBlanc: undefined })).toBe(ref);
      expect(ref).not.toContain("hue=");
    });
    it(`allumé : une seule étape, après lut3d et avant scale=out_color_matrix (${label})`, () => {
      const g = chaineCouleurs(COUL, LUTS, TAILLE, { ...o, noirBlanc: [[1, 2.5], [4, 5]] });
      expect(g.match(/hue=s=0/g)).toHaveLength(1);
      const i = g.indexOf("hue=s=0:enable=");
      expect(i).toBeGreaterThan(g.lastIndexOf("lut3d"));
      expect(i).toBeLessThan(g.indexOf("scale=out_color_matrix"));
    });
  }
  it("sans LUT, l'étape précède quand même le retour en YUV", () => {
    const g = chaineCouleurs(COUL, [], TAILLE, { ...BASE, noirBlanc: [[1, 2]] });
    expect(g.indexOf("hue=s=0")).toBeLessThan(g.indexOf("scale=out_color_matrix"));
  });
  const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
  it.skipIf(!ffmpeg)("FFmpeg accepte hue=s=0 en gbrp et gbrp10le", () => {
    for (const fmt of ["gbrp", "gbrp10le"]) {
      const r = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=s=64x64:d=1:r=5", "-vf", `format=${fmt},${etapeNoirBlanc([[0.2, 0.6]])},format=yuv420p`, "-f", "null", "-"]);
      expect(r.status, r.stderr?.toString()).toBe(0);
    }
  });
});

describe("jamais la v4 (Q12)", () => {
  function fichiers(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  }
  it("aucun fichier v4 ni montage-facecam-animee n'importe noir-blanc", () => {
    const racine = resolve(__dirname, "../../..");
    const tous = [...fichiers(join(racine, "studio-rendu/compositions/interface-claire/motion-v4")), ...fichiers(join(racine, "src/moteurs/montage-facecam-animee"))];
    for (const f of tous) expect(readFileSync(f, "utf8"), f).not.toMatch(/noir-blanc/);
  });
  it("noir-blanc.ts n'importe pas @/", () => {
    expect(readFileSync(resolve(__dirname, "../../../src/briques/motion/habillage-commun/noir-blanc.ts"), "utf8")).not.toMatch(/from\s+["']@\//);
  });
});
