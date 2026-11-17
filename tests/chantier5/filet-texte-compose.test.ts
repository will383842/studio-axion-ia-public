/**
 * Filet C5-5.09a : rejoué sans changement par 5.04, 5.05b, 5.06, 5.08 ; un instantané ne se régénère jamais sans accord écrit du relecteur.
 *
 * Il FIGE, sans rien corriger, le balisage du calque texte de la face caméra 9:16 d'avant le chantier 5 : phrase fictive
 * (`outils/chantier5/mots-planche.json`, piste muette, aucune voix), sans plan de scènes. Se saute si le rendu
 * (`studio-rendu/node_modules`) n'est pas installé ; la lecture du fichier de mots, elle, ne se saute jamais.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, useCurrentFrame: () => 0, useVideoConfig: () => ({ fps: 30, width: 1080, height: 1920, durationInFrames: 300, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});

import { donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import type { ProprietesTexteComposition } from "@/briques/composition/scene";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { instantsTexte } from "../../studio-rendu/src/composition/texte-instants";

// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine, qui exclut studio-rendu) ne suit pas ce import.
type Module = { TexteCompose: never };
const chemin = ["..", "..", "studio-rendu", "compositions", "commune", "TexteCompose"].join("/");
const TEXTE = AVEC_RENDU ? ((await import(/* @vite-ignore */ chemin)) as Module) : null;

interface Planche {
  dureeSec: number;
  fps: number;
  mots: { mot: string; debutSec: number; finSec: number }[];
}
const planche = JSON.parse(readFileSync("outils/chantier5/mots-planche.json", "utf8")) as Planche;
const FPS = planche.fps;
const IMAGES = Math.ceil(planche.dureeSec * FPS);
const PHRASE = planche.mots.map((m) => m.mot).join(" ");
const EN_VALEUR = ["paniers", "pommes", "rouges"];

const arrondi = (v: unknown): unknown => (typeof v === "number" ? +v.toFixed(4) : Array.isArray(v) ? v.map(arrondi) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, arrondi(x)])) : v);

function proprietes(): ProprietesTexteComposition {
  const segments = fabriquerSousTitres({ texte: PHRASE, dureeSec: planche.dureeSec, mots: planche.mots, emphase: EN_VALEUR, base: "karaoke", intensite: "equilibre" });
  const centre = RECETTE_COMPOSITION_FACECAM.centreSousTitres["9:16"];
  const sousTitres = donneesCalque({ segments, base: "karaoke", ratio: "9:16", style: { positionPct: centre } as never });
  return { ratio: "9:16", largeur: 1080, hauteur: 1920, fps: FPS, images: IMAGES, incrustations: [], sousTitres };
}

describe("mots de la planche (C5-5.09a)", () => {
  it("20 à 30 mots triés, durées positives, dernier mot avant la fin", () => {
    expect(planche.fps).toBe(30);
    expect(planche.mots.length).toBeGreaterThanOrEqual(20);
    expect(planche.mots.length).toBeLessThanOrEqual(30);
    planche.mots.forEach((m, i) => {
      expect(m.finSec).toBeGreaterThan(m.debutSec);
      if (i > 0) expect(m.debutSec).toBeGreaterThanOrEqual(planche.mots[i - 1].debutSec);
    });
    expect(planche.mots.at(-1)!.finSec).toBeLessThan(planche.dureeSec);
  });
});

describe.skipIf(!AVEC_RENDU)("filet C5-5.09a : calque texte face caméra, état d'avant le chantier", () => {
  const p = proprietes();
  const segs = p.sousTitres!.segments;
  const valeur = segs.flatMap((s) => s.mots).find((m) => m.enValeur);
  const instants = [0.1, segs[0].debutSec + 0.05, (valeur ? valeur.debutSec : segs[0].mots[0].debutSec) + 0.05, planche.dureeSec / 2, (segs[1] ?? segs[0]).debutSec + 0.02, planche.dureeSec + 1].map((x) => +x.toFixed(3));

  it("instantsTexte : images rendues et durées", () => {
    const it = instantsTexte(p);
    expect(it.durees.reduce((a, b) => a + b, 0)).toBe(IMAGES);
    expect(arrondi({ images: IMAGES, ...it })).toMatchSnapshot();
  });

  it("balisage statique à 6 instants", () => {
    const balisages = instants.map((t) => ({ t, html: renderToStaticMarkup(createElement(TEXTE!.TexteCompose, { ...p, instants: [t] } as never)) }));
    expect(new Set(balisages.map((b) => b.html)).size).toBeGreaterThan(1);
    expect(balisages).toMatchSnapshot();
  });
});
