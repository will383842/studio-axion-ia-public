import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ICONES_BIBLIOTHEQUE } from "../../../src/briques/motion/bibliotheque-icones";
import type { IconeBibliotheque } from "../../../src/briques/motion/bibliotheque-icones";
import { harmoniser, nomPermis } from "../../../src/briques/motion/bibliotheque-icones/harmoniser";

describe("harmoniser les icônes (C9-31)", () => {
  it("les 43 icônes lucide:* restent identiques (déjà conformes)", () => {
    const entrees = Object.entries(ICONES_BIBLIOTHEQUE).filter(([n]) => n.startsWith("lucide:"));
    expect(entrees).toHaveLength(43);
    for (const [nom, ic] of entrees) expect(harmoniser(ic), nom).toEqual(ic);
  });

  it("une icône 48×48 rouge, trait 3 passe en grille 24, currentColor, trait 2", () => {
    const fausse: IconeBibliotheque = {
      jeu: "test",
      viewBox: "0 0 48 48",
      noeuds: [
        ["circle", { cx: "24", cy: "24", r: "20", stroke: "red", "stroke-width": "3", fill: "#ff0000" }],
        ["path", { d: "M10 10 L38 38 h-4 a4 4 0 0 1 -8 8", stroke: "#f00", "stroke-width": "3" }],
      ],
    };
    const h = harmoniser(fausse);
    expect(h.viewBox).toBe("0 0 24 24");
    const [, c] = h.noeuds[0];
    expect(c).toMatchObject({ cx: "12", cy: "12", r: "10", stroke: "currentColor", "stroke-width": "2", fill: "currentColor" });
    expect(h.noeuds[1][1].d).toBe("M5 5L19 19h-2a2 2 0 0 1 -4 4");
    expect(h.noeuds[1][1].stroke).toBe("currentColor");
    expect(JSON.stringify(h)).not.toMatch(/red|#f/i);
    expect(fausse.viewBox).toBe("0 0 48 48");
  });

  it("ne lève jamais d'exception", () => {
    expect(() => harmoniser(null as never)).not.toThrow();
    expect(() => harmoniser({ jeu: "x", viewBox: "n'importe quoi", noeuds: [["path", { d: "M1 ??" }]] })).not.toThrow();
  });

  it("nomPermis refuse visages et personnages", () => {
    expect(nomPermis("lucide:visage-sourire")).toBe(false);
    for (const n of ["lucide:smile", "lucide:emoji", "face", "lucide:user-circle"]) expect(nomPermis(n), n).toBe(false);
    expect(nomPermis("lucide:coche")).toBe(true);
    expect(nomPermis(42 as never)).toBe(false);
  });

  it("le fichier est pur : ni « @/ » ni droits", () => {
    const src = readFileSync("src/briques/motion/bibliotheque-icones/harmoniser.ts", "utf8");
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/droits/);
  });
});
