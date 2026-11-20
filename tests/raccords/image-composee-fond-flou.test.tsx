/**
 * C10-03b-v20f · champ de rendu `fondFlouCartes` du calque image : le DÉCOR seul se floute et s'assombrit
 * pendant une fenêtre (fondu linéaire à l'entrée et à la sortie). ÉTEINT : personne ne passe le champ.
 * Rendu statique par instants (aucun réseau). Se saute si les dépendances de studio-rendu ne sont pas installées.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { ProprietesImageComposition } from "../../src/briques/composition/scene";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
const etat = { image: 0 };
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const reactRendu = (AVEC_RENDU ? await import("../../studio-rendu/node_modules/react/index.js") : {}) as typeof import("react");
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return {
    ...vrai,
    Sequence: (p: { children?: unknown }) => p.children as never,
    Freeze: (p: { children?: unknown }) => p.children as never,
    Audio: () => null,
    // La vidéo du double porte un marqueur ; l'image garde son style (le flou du décor s'y lit).
    OffthreadVideo: (p: { src: string }) => reactRendu.createElement("video", { "data-src": p.src }),
    Img: (p: { src: string; style?: Record<string, unknown> }) => reactRendu.createElement("img", { src: p.src, style: p.style }),
    useCurrentFrame: () => etat.image,
    useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 150, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }),
  };
});

// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : le tsc racine ne suit pas ces imports (piège `remotion`).
const chemin = (c: string) => `../../studio-rendu/compositions/${c}`;
const COMPOSEE = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("commune/ImageComposee")) : null;

const CADRAGE = { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 };
const FENETRE = { debutSec: 1, finSec: 3, flouPx: 12, assombrir: 0.4, fonduSec: 0.4, cible: "decor" as const };
const proprietes = (extra: Record<string, unknown> = {}, decor: Record<string, unknown> = {}) =>
  ({
    ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 150,
    decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false, image: "entree:decor", ...decor },
    doubles: { principal: { type: "video", url: "entree:double", transparent: true } },
    plans: [{ debutSec: 0, finSec: 6, type: "double", angle: "principal", cadrage: CADRAGE }],
    ...extra,
  }) as unknown as ProprietesImageComposition;
const rendreA = (p: ProprietesImageComposition, sec: number): string => {
  etat.image = Math.round(sec * 25);
  return renderToStaticMarkup(createElement(COMPOSEE.ImageComposee, p as never) as never);
};
const empreinte = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
/** Balisage du décor (l'image `entree:decor`) et voile noir éventuel qui la suit. */
const decor = (h: string) => /<img src="entree:decor" style="([^"]*)"\/>/.exec(h)?.[1] ?? "";
const voile = (h: string) => /<div style="[^"]*background-color:#000[^"]*opacity:([\d.]+)[^"]*"><\/div>|<div style="[^"]*opacity:([\d.]+)[^"]*background-color:#000[^"]*"><\/div>/.exec(h);
const opaciteVoile = (h: string) => { const m = voile(h); return m ? Number(m[1] ?? m[2]) : 0; };
const flouDe = (style: string) => Number(/blur\(([\d.]+)px\)/.exec(style)?.[1] ?? 0);

// Empreintes du balisage de master (avant la modification), relevées avec le même montage de test.
const EMPREINTES_AVANT: Record<number, string> = { 0.5: "59ac9370dd1140ff", 2: "59ac9370dd1140ff", 3.5: "59ac9370dd1140ff" };

describe.skipIf(!AVEC_RENDU)("ImageComposee : fond flou pendant une carte (C10-03b-v20f)", () => {
  it("(a) champ absent : balisage identique à celui d'avant", () => {
    for (const sec of [0.5, 2, 3.5]) expect(empreinte(rendreA(proprietes(), sec)), `t=${sec}`).toBe(EMPREINTES_AVANT[sec]);
  });

  it("(b) liste vide : identique au champ absent", () => {
    for (const sec of [0.5, 2, 3.5]) expect(rendreA(proprietes({ fondFlouCartes: [] }), sec)).toBe(rendreA(proprietes(), sec));
  });

  it("(c) fenêtre 1–3 s, t = 2 s : le décor est flou, le voile vaut `assombrir`, le double n'est pas touché", () => {
    const h = rendreA(proprietes({ fondFlouCartes: [FENETRE] }), 2);
    expect(decor(h)).toContain("blur(");
    expect(flouDe(decor(h))).toBeCloseTo(12, 1);
    expect(decor(h)).toContain("scale(1.04)");
    expect(opaciteVoile(h)).toBeCloseTo(0.4, 2);
    const sans = rendreA(proprietes(), 2);
    // Le double (vidéo) et tout ce qui suit le décor sont inchangés : seul le calque décor diffère.
    expect(h.slice(h.indexOf("<video"))).toBe(sans.slice(sans.indexOf("<video")));
    expect((h.match(/blur\(/g) ?? []).length).toBe(1);
  });

  it("(d) fondu : moitié de l'effet à mi-fondu, rien hors de la fenêtre", () => {
    const mi = rendreA(proprietes({ fondFlouCartes: [FENETRE] }), 1 + 0.2);
    expect(opaciteVoile(mi)).toBeCloseTo(0.2, 2);
    expect(flouDe(decor(mi))).toBeCloseTo(6, 1);
    const sortie = rendreA(proprietes({ fondFlouCartes: [FENETRE] }), 3 - 0.2);
    expect(opaciteVoile(sortie)).toBeCloseTo(0.2, 2);
    for (const sec of [0.5, 3.5]) {
      const h = rendreA(proprietes({ fondFlouCartes: [FENETRE] }), sec);
      expect(h).not.toContain("blur(");
      expect(opaciteVoile(h)).toBe(0);
      expect(h).toBe(rendreA(proprietes(), sec));
    }
  });

  it("(f) décor sans image (teinte seule) : voile seul, aucun flou ; même entrée, même balisage", () => {
    const p = proprietes({ fondFlouCartes: [FENETRE] }, { image: undefined });
    const h = rendreA(p, 2);
    expect(h).not.toContain("blur(");
    expect(opaciteVoile(h)).toBeCloseTo(0.4, 2);
    expect(rendreA(p, 2)).toBe(h);
  });
});
