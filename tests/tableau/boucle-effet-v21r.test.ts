import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decisionBoucleTableau, scenesBoucleDeTableau, styleBoucleTableau } from "@/moteurs/montage-tableau/boucle-effet";

const fiche = (habillage: string, styleTableau?: string) => ({ habillage, styleTableau }) as never;
const SCENES = [
  { debutMs: 0, finMs: 3000 },
  { debutMs: 3000, finMs: 6000 },
  { debutMs: 6000, finMs: 9000 },
];
const STYLES_LISTES: [string, string | undefined, string][] = [
  ["reference/1", undefined, "reference/1"],
  ["reference/2", undefined, "reference/2"],
  ["reference/3", undefined, "reference/3"],
  ["reference/3", "ardoise", "tableau/ardoise"],
];

describe("boucle du tableau (BOUCLE-TABLEAU-a)", () => {
  it("(a) jamais de visage : scènes « tableau », même fond, état d'entrée = style|page-vide", () => {
    for (const [h, st, style] of STYLES_LISTES) {
      expect(styleBoucleTableau(fiche(h, st))).toBe(style);
      const sc = scenesBoucleDeTableau(style, SCENES);
      expect(sc).toHaveLength(3);
      for (const s of sc) {
        expect(s.type).toBe("tableau");
        expect(s.fond).toBe(style);
        expect(s.etatEntree).toBe(`${style}|page-vide`);
      }
    }
  });
  it("(b) boucle possible : raccord première → dernière scène sur la page vide", () => {
    for (const [h, st, style] of STYLES_LISTES) {
      expect(decisionBoucleTableau({ fiche: fiche(h, st), scenes: SCENES, finAMontrer: false })).toEqual({
        boucle: true,
        raccord: { sceneInitiale: 0, sceneFinale: 2, etatFinal: `${style}|page-vide` },
      });
    }
  });
  it("(c) fin à montrer : refus prioritaire sur tout le reste", () => {
    for (const [h, st] of STYLES_LISTES) expect(decisionBoucleTableau({ fiche: fiche(h, st), scenes: SCENES, finAMontrer: true })).toEqual({ boucle: false, raison: "fin-a-montrer" });
    expect(decisionBoucleTableau({ fiche: fiche("blocs/2"), scenes: [], finAMontrer: true })).toEqual({ boucle: false, raison: "fin-a-montrer" });
  });
  it("(d) style non listé : blocs/2, charte-video/1, inconnu ; reference/3 à styleTableau invalide = reference/3", () => {
    for (const h of ["blocs/2", "charte-video/1", "inconnu"]) {
      expect(styleBoucleTableau(fiche(h))).toBeNull();
      expect(decisionBoucleTableau({ fiche: fiche(h), scenes: SCENES, finAMontrer: false })).toEqual({ boucle: false, raison: "style-non-liste" });
    }
    expect(styleBoucleTableau(fiche("reference/3", "n-importe-quoi"))).toBe("reference/3");
  });
  it("(e) règle commune : vide, 1 999 ms trop court, 2 000 ms boucle", () => {
    const f = fiche("reference/2");
    expect(decisionBoucleTableau({ fiche: f, scenes: [], finAMontrer: false })).toEqual({ boucle: false, raison: "vide" });
    expect(decisionBoucleTableau({ fiche: f, scenes: [{ debutMs: 0, finMs: 1999 }], finAMontrer: false })).toEqual({ boucle: false, raison: "trop-court" });
    expect(decisionBoucleTableau({ fiche: f, scenes: [{ debutMs: 0, finMs: 2000 }], finAMontrer: false })).toMatchObject({ boucle: true });
  });
  it("(f) déterminisme : même entrée, même décision, entrée non modifiée", () => {
    const e = { fiche: fiche("reference/3", "paperboard"), scenes: SCENES, finAMontrer: false };
    const copie = JSON.stringify(e);
    expect(decisionBoucleTableau(e)).toEqual(decisionBoucleTableau(e));
    expect(JSON.stringify(e)).toBe(copie);
  });
  it("(g) sans appelant : rien dans src/** ni studio-rendu/** ne cite la décision du tableau", () => {
    const lister = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (n === "node_modules" || n === "dist") return [];
        const c = join(d, n);
        return statSync(c).isDirectory() ? lister(c) : /\.(ts|tsx)$/.test(n) ? [c] : [];
      });
    const sources = [...lister("src"), ...lister("studio-rendu")].filter((f) => !f.replace(/\\/g, "/").endsWith("src/moteurs/montage-tableau/boucle-effet.ts"));
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.filter((f) => /montage-tableau\/boucle-effet|decisionBoucleTableau/.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
