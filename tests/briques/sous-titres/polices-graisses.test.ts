import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CARACTERES, METRIQUES } from "../../../src/briques/sous-titres/metriques";
import { largeurMot } from "../../../src/briques/sous-titres/mesure";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const delayRender = vi.fn((libelle: string) => libelle.length + Math.random());
const continueRender = vi.fn();
vi.mock("remotion", () => ({ delayRender: (l: string) => delayRender(l), continueRender: (h: number) => continueRender(h) }));
vi.mock("../../../src/briques/sous-titres/polices/Manrope-Medium.ttf", () => ({ default: "medium.ttf" }));
vi.mock("../../../src/briques/sous-titres/polices/Manrope-SemiBold.ttf", () => ({ default: "semibold.ttf" }));
vi.mock("../../../src/briques/sous-titres/polices/Manrope-Bold.ttf", () => ({ default: "bold.ttf" }));
vi.mock("../../../src/briques/sous-titres/polices/Manrope-ExtraBold.ttf", () => ({ default: "extrabold.ttf" }));

const faces: { famille: string; weight?: string }[] = [];
class FauxFontFace {
  constructor(
    public famille: string,
    _src: string,
    opts?: { weight?: string },
  ) {
    faces.push({ famille, weight: opts?.weight });
  }
  async load() {
    return this;
  }
}

describe("C2-U3 : graisses Manrope", () => {
  it("les entrées existantes et les caractères sont identiques à master", () => {
    expect(sha(JSON.stringify(METRIQUES["Manrope Medium"]))).toBe("47035dba6e26911818d2d1e86a4740fc07f0a211631954d032d0154010242462");
    expect(sha(JSON.stringify(METRIQUES["Manrope ExtraBold"]))).toBe("ad44d3aae70ee254bdb25573544ed0c62376484f58b45b2db8486b90186e5ee3");
    expect(sha(CARACTERES)).toBe("d6585d8a87a6af75a72bcb3298f790f37c4299bdd59fa40371ef05306ea4db8e");
  });

  it("« Bonjour » à 100 px : Medium < SemiBold < Bold < ExtraBold", () => {
    const l = (p: "Manrope Medium" | "Manrope SemiBold" | "Manrope Bold" | "Manrope ExtraBold") => largeurMot("Bonjour", p, 100);
    expect(l("Manrope Medium")).toBeLessThan(l("Manrope SemiBold"));
    expect(l("Manrope SemiBold")).toBeLessThan(l("Manrope Bold"));
    expect(l("Manrope Bold")).toBeLessThan(l("Manrope ExtraBold"));
  });

  for (const [fichier, nom] of [
    ["Manrope-SemiBold.ttf", "Manrope SemiBold"],
    ["Manrope-Bold.ttf", "Manrope Bold"],
  ]) {
    it(`${fichier} : TTF valide au nom de son instance`, () => {
      const t = readFileSync(join(process.cwd(), "src/briques/sous-titres/polices", fichier));
      expect(t.readUInt32BE(0)).toBe(0x00010000);
      expect(t.includes(Buffer.from(nom, "utf16le").swap16())).toBe(true);
    });
  }

  describe("rendu (chargerPolices)", () => {
    beforeEach(() => {
      faces.length = 0;
      delayRender.mockClear();
      continueRender.mockClear();
      vi.resetModules();
      vi.stubGlobal("FontFace", FauxFontFace);
      vi.stubGlobal("document", { fonts: { add: vi.fn() } });
    });
    it("une promesse et un delayRender par police, union des demandes", async () => {
      // Chemin calculé : `studio-rendu` a son propre `remotion` (absent à la racine) ; tsc racine ne doit pas suivre ce fichier.
      const chemin = "../../../studio-rendu/compositions/sous-titres/polices";
      const m = (await import(/* @vite-ignore */ chemin)) as {
        chargerPolices: (noms?: readonly string[]) => unknown;
      };
      await m.chargerPolices();
      expect(faces.map((f) => f.famille).sort()).toEqual(["Axion Manrope ExtraBold", "Axion Manrope Medium"]);
      expect(delayRender).toHaveBeenCalledTimes(2);
      await m.chargerPolices(["Manrope Bold"]);
      expect(faces).toHaveLength(3);
      expect(delayRender).toHaveBeenCalledTimes(3);
      await m.chargerPolices(["Manrope Bold", "Manrope Medium"]);
      expect(faces).toHaveLength(3);
      expect(delayRender).toHaveBeenCalledTimes(3);
      expect(continueRender).toHaveBeenCalledTimes(3);
      for (const r of delayRender.mock.results) expect(continueRender).toHaveBeenCalledWith(r.value);
    });
  });

  describe("aperçu (chargerPolicesSousTitres)", () => {
    beforeEach(() => {
      faces.length = 0;
      vi.resetModules();
      vi.stubGlobal("FontFace", FauxFontFace);
      vi.stubGlobal("document", { fonts: { add: vi.fn() } });
    });
    it("union des demandes et graisses 600/700", async () => {
      const m = await import("../../../src/components/bibliotheque/polices-sous-titres");
      await m.chargerPolicesSousTitres();
      expect(faces).toHaveLength(2);
      await m.chargerPolicesSousTitres(["Manrope Bold", "Manrope SemiBold"]);
      expect(faces).toHaveLength(4);
      expect(faces.find((f) => f.famille === "Axion Manrope SemiBold")?.weight).toBe("600");
      expect(faces.find((f) => f.famille === "Axion Manrope Bold")?.weight).toBe("700");
      await m.chargerPolicesSousTitres(["Manrope Bold", "Manrope Medium"]);
      expect(faces).toHaveLength(4);
    });
  });
});
