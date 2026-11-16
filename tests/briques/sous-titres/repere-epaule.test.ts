/** C2-U18 : repère rond près de l'épaule (pièce neuve, éteinte). Aucune voix, aucun réseau. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("remotion", () => ({
  useCurrentFrame: () => 30,
  useVideoConfig: () => ({ width: 1080, height: 1920, fps: 25 }),
  delayRender: () => 1,
  continueRender: () => undefined,
}));

import { rapportContraste } from "@/briques/habillage/contraste";
import { MARQUEURS } from "@/briques/sous-titres/marqueur";
import { geometrieRepere, POLICE_REPERE, REPERE_EPAULE_ACTIF, type ParametresRepere } from "@/briques/sous-titres/repere-epaule";

const base: ParametresRepere = { x: 0.3, y: 0.5, cote: "gauche", texte: "Pause café", teinte: "terracotta" };
const TEINTES = ["terracotta", "ivoire", "ardoise"] as const;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    if (n === "node_modules" || n.startsWith(".")) return [];
    const p = join(dossier, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("repère épaule", () => {
  it("(a) éteint par défaut", () => expect(REPERE_EPAULE_ACTIF).toBe(false));

  it("(b) texte de 4 mots, vide, ou position hors cadre : null", () => {
    expect(geometrieRepere({ ...base, texte: "un deux trois quatre" }, 1080, 1920, 1)).toBeNull();
    expect(geometrieRepere({ ...base, texte: "  " }, 1080, 1920, 1)).toBeNull();
    expect(geometrieRepere({ ...base, x: 1.2 }, 1080, 1920, 1)).toBeNull();
    expect(geometrieRepere({ ...base, y: -0.1 }, 1080, 1920, 1)).toBeNull();
    expect(geometrieRepere(base, 1080, 1920, 1)).not.toBeNull();
  });

  it("(c) cercle et étiquette dans le cadre, étiquette du côté demandé", () => {
    for (const [l, h] of [[1080, 1920], [1920, 1080]]) {
      for (let i = 0; i <= 19; i++) {
        for (const cote of ["gauche", "droite"] as const) {
          const g = geometrieRepere({ ...base, x: i / 19, y: (19 - i) / 19, cote }, l, h, 2)!;
          const { cercle: c, etiquette: e } = g;
          expect(c.cx - c.r).toBeGreaterThanOrEqual(0);
          expect(c.cx + c.r).toBeLessThanOrEqual(l);
          expect(c.cy - c.r).toBeGreaterThanOrEqual(0);
          expect(c.cy + c.r).toBeLessThanOrEqual(h);
          expect(e.x).toBeGreaterThanOrEqual(0);
          expect(e.x + e.largeur).toBeLessThanOrEqual(l);
          expect(e.y).toBeGreaterThanOrEqual(0);
          expect(e.y + e.hauteur).toBeLessThanOrEqual(h);
          const centre = e.x + e.largeur / 2;
          if (cote === "gauche") expect(centre).toBeLessThanOrEqual(c.cx);
          else expect(centre).toBeGreaterThanOrEqual(c.cx);
        }
      }
    }
  });

  it("(d) couleurs des paires de marqueur.ts, contraste ≥ 4,5", () => {
    for (const teinte of TEINTES) {
      const g = geometrieRepere({ ...base, teinte }, 1080, 1920, 2)!;
      expect(g.couleurs.fond).toBe(MARQUEURS[teinte].fond);
      expect(g.couleurs.texte).toBe(MARQUEURS[teinte].texte);
      expect(rapportContraste(g.couleurs.fond, g.couleurs.texte)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("(e) police Manrope", () => expect(POLICE_REPERE).toMatch(/^Manrope (Bold|SemiBold)$/));

  it("entrée : opacité et échelle croissantes, finales à 1", () => {
    const a = geometrieRepere(base, 1080, 1920, 0)!;
    const b = geometrieRepere(base, 1080, 1920, 0.2)!;
    const c = geometrieRepere(base, 1080, 1920, 5)!;
    expect(a.opacite).toBe(0);
    expect(b.opacite).toBeGreaterThan(a.opacite);
    expect(c.opacite).toBe(1);
    expect(c.echelle).toBe(1);
  });

  it("(f) ajout pur : aucun autre fichier ne l'importe", () => {
    const neufs = ["repere-epaule.ts", "RepereEpaule.tsx", "repere-epaule.test.ts", "planche-repere-epaule.mts"];
    for (const racine of ["src", "studio-rendu/src", "studio-rendu/compositions"]) {
      for (const f of fichiers(racine)) {
        if (neufs.some((n) => f.endsWith(n))) continue;
        expect(readFileSync(f, "utf8"), f).not.toMatch(/(?:from|import)\s*\(?\s*["'][^"']*(?:repere-epaule|RepereEpaule)["']/);
      }
    }
  });

  it("(g) aucun import @/ dans repere-epaule.ts", () => {
    expect(readFileSync("src/briques/sous-titres/repere-epaule.ts", "utf8")).not.toMatch(/from\s+["']@\//);
  });

  it("(h) rien de dessiné quand la géométrie est null", async () => {
    // Chemin calculé : `studio-rendu` a son propre `remotion` (absent à la racine) ; tsc racine ne doit pas suivre ce fichier.
    const chemin = "../../../studio-rendu/compositions/sous-titres/RepereEpaule";
    const { RepereEpaule } = (await import(/* @vite-ignore */ chemin)) as {
      RepereEpaule: (p: ParametresRepere) => ReturnType<typeof createElement> | null;
    };
    expect(renderToStaticMarkup(createElement(RepereEpaule, { ...base, texte: "" }))).toBe("");
    expect(renderToStaticMarkup(createElement(RepereEpaule, base))).toContain("Pause café");
  });
});
