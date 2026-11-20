/**
 * N-04c : calque de rendu `ObjetsTableau` (petits objets d'une scène du tableau, dans leur boîte).
 * Rendu statique seulement, aucun réseau. Chemin CALCULÉ (piège tsc/remotion). Se saute si studio-rendu n'est pas installé.
 */
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
let IMAGE = 10;
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return {
    ...vrai,
    // Sequence factice : n'affiche l'enfant que dans [from, from + durée[ (comme le vrai), image relative non simulée.
    Sequence: (p: { from?: number; durationInFrames?: number; children?: unknown }) => {
      const de = p.from ?? 0;
      const fin = de + (p.durationInFrames ?? Infinity);
      return IMAGE >= de && IMAGE < fin ? (p.children ?? null) : null;
    },
    useCurrentFrame: () => IMAGE,
    useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 250, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }),
  };
});

import type { ObjetScene } from "@/briques/tableau-scene/objets";
import { EXEMPLES_GROS_CHIFFRE } from "@/briques/motion/petits-objets/gros-chiffre";
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
const chemin = (c: string) => `../../../studio-rendu/compositions/${c}`;
type Module = { ObjetsTableau: (p: { objets: readonly ObjetScene[]; fps: number }) => unknown };
const MODULE = (AVEC_RENDU ? await import(/* @vite-ignore */ chemin("tableau/ObjetsTableau")) : null) as Module | null;

const BOITE = { x: 100, y: 200, largeur: 600, hauteur: 400 };
const chiffre = (extra: Partial<ObjetScene> = {}): ObjetScene => ({ id: "objet-gros-chiffre", debutMs: 400, finMs: 2000, parametres: EXEMPLES_GROS_CHIFFRE[0] as unknown as Record<string, unknown>, boite: BOITE, ...extra });
const rendre = (objets: readonly ObjetScene[]) => renderToStaticMarkup(createElement(MODULE!.ObjetsTableau as never, { objets, fps: 25 }) as never) as string;

describe.skipIf(!AVEC_RENDU)("ObjetsTableau (N-04c)", () => {
  it("éteint = identique : liste vide, rendu vide", () => {
    IMAGE = 10;
    expect(rendre([])).toBe("");
  });

  it("un gros chiffre : absent avant debutMs, présent dans [debut, fin], dans sa boîte", () => {
    IMAGE = 5; // 200 ms < 400 ms
    expect(rendre([chiffre()])).not.toContain("minutes");
    IMAGE = 40; // 1600 ms
    const html = rendre([chiffre()]);
    expect(html).toContain("minutes");
    expect(html).toMatch(/left:\s*100px/);
    expect(html).toMatch(/top:\s*200px/);
    expect(html).toMatch(/width:\s*600px/);
    expect(html).toMatch(/height:\s*400px/);
    IMAGE = 60; // 2400 ms > fin
    expect(rendre([chiffre()])).not.toContain("minutes");
  });

  it("id inconnu ou paramètres invalides : ignoré, ne lève pas", () => {
    IMAGE = 40;
    expect(rendre([chiffre({ id: "objet-inconnu" })])).toBe("");
    expect(() => rendre([chiffre({ parametres: { n: "x" } })])).not.toThrow();
    expect(rendre([chiffre({ parametres: { n: "x" } })])).toBe("");
  });
});
