/**
 * PLANCHE-CONTOURS-a-v21r : planche locale des contours de sous-titres V0 / V1 / V2 (4 gabarits × 3 fonds × 3 variantes).
 * Outil local, 0 €, rien allumé, aucun rendu Remotion en CI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { casesContours, FONDS_PLANCHE, GABARITS_PLANCHE, PlancheContours, VARIANTES_CONTOUR } from "../../outils/planche-contours/PlancheContours";
import { GABARITS } from "../../src/briques/sous-titres/style";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const html = (variante: "V0" | "V1" | "V2", format: "9x16" | "16x9" = "9x16") => renderToStaticMarkup(createElement(PlancheContours, { variante, format }));

describe("planche contours", () => {
  it("(a) V0 = valeurs du code : Karaoké 3, Impact 8, ombres égales à GABARITS (rien de recopié)", () => {
    const v0 = VARIANTES_CONTOUR.V0;
    expect(v0.karaoke.contourPx).toBe(GABARITS.karaoke.contourPx);
    expect(v0.karaoke.contourPx).toBe(3);
    expect(v0.impact.contourPx).toBe(GABARITS.impact.contourPx);
    expect(v0.impact.contourPx).toBe(8);
    for (const g of GABARITS_PLANCHE) expect(v0[g].ombre).toEqual(GABARITS[g].ombre);
  });

  it("(b) V1 = 4 / 10, V2 = 3 / 8 avec ombre douce (flou × 1,3, opacité − 0,1), Minimal et Bandeau à 0 dans les 3", () => {
    expect([VARIANTES_CONTOUR.V1.karaoke.contourPx, VARIANTES_CONTOUR.V1.impact.contourPx]).toEqual([4, 10]);
    expect([VARIANTES_CONTOUR.V2.karaoke.contourPx, VARIANTES_CONTOUR.V2.impact.contourPx]).toEqual([3, 8]);
    for (const g of ["karaoke", "impact"] as const) {
      const base = GABARITS[g].ombre;
      expect(VARIANTES_CONTOUR.V1[g].ombre).toEqual(base);
      expect(VARIANTES_CONTOUR.V2[g].ombre.flouPx).toBeCloseTo(base.flouPx * 1.3, 10);
      expect(VARIANTES_CONTOUR.V2[g].ombre.opacite).toBeCloseTo(base.opacite - 0.1, 10);
      expect(VARIANTES_CONTOUR.V2[g].ombre.decalagePx).toBe(base.decalagePx);
    }
    for (const v of ["V0", "V1", "V2"] as const) for (const g of ["minimal", "bandeau"] as const) expect(VARIANTES_CONTOUR[v][g].contourPx).toBe(0);
  });

  it("(c) 36 cases sans doublon ; V2 Karaoké dessine 3px et V0 Impact 8px par cssElement ; rendu déterministe", () => {
    const cases = casesContours();
    expect(cases).toHaveLength(36);
    expect(new Set(cases.map((c) => `${c.variante}|${c.gabarit}|${c.fond}`)).size).toBe(36);
    expect(FONDS_PLANCHE).toHaveLength(3);
    expect(html("V2")).toContain("-webkit-text-stroke:3px");
    expect(html("V0")).toContain("-webkit-text-stroke:8px");
    expect(html("V0")).toContain("-webkit-text-stroke:3px");
    expect(html("V1")).toContain("-webkit-text-stroke:10px");
    for (const mot of ["Ton", "droit", "reste", "gratuit"]) expect(html("V0")).toContain(`>${mot}<`);
    expect(html("V0")).toContain("V0 · contour 3 px / 8 px");
    expect(html("V2")).toContain("V2 · contour 3 px / 8 px");
    expect(html("V0")).toContain("background:#FAF9F5;padding:");
    expect(html("V0")).toContain("color:#141413;opacity:1;position:relative"); // Bandeau : texte noir sur crème, lisible // le Bandeau garde son rectangle crème (lu dans PALETTE)
    expect(html("V1")).toBe(html("V1"));
    expect(html("V0")).not.toBe(html("V2"));
    expect(html("V1", "16x9")).toContain("data-fond=\"illustration-claire\"");
  });

  it("(d) gardes de l'outil : pas de réglage, env, réseau, mention IA ; finally + rmSync ; sortie captures/contours ; aucun hexadécimal", () => {
    for (const f of ["outils/planche-contours/PlancheContours.tsx", "outils/planche-contours/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/reglages|depots|process\.env|fetch\(|mention-ia|MentionIA/i);
    }
    const s = lire("outils/planche-contours/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain('"captures", "contours"');
    expect(lire("outils/planche-contours/PlancheContours.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("(e) rien n'importe l'outil : aucun fichier de src/ ni de studio-rendu/ ne cite planche-contours ou PlancheContours", () => {
    const parcourir = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        if (n === "node_modules" || n.startsWith(".")) return [];
        const p = join(dir, n);
        return statSync(p).isDirectory() ? parcourir(p) : /\.(tsx?|mts|json)$/.test(n) ? [p] : [];
      });
    const fichiers = [...parcourir(join(process.cwd(), "src")), ...parcourir(join(process.cwd(), "studio-rendu"))];
    expect(fichiers.length).toBeGreaterThan(50);
    for (const f of fichiers) expect(readFileSync(f, "utf8"), f).not.toMatch(/planche-contours|PlancheContours/);
  });
});
