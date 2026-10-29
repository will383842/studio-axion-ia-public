/**
 * Place de la queue et de l'affiche dans l'habillage de variété. Sans calque caméra (CAM-B, CAM-C), elles gardent leur place
 * de master : dans la scène, après l'en-tête, donc SOUS la matière et les transitions qui dessinent leur couche après le
 * contenu. Filmée par CAM-B ou CAM-C, elles passent par `horsCamera` : le calque caméra les pose après la scène recadrée
 * (jamais recadrées), avant le point sur le fil, l'en-tête reposé, les transitions et la matière.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";

vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async () => {
  const exiger = createRequire(join(process.cwd(), "studio-rendu/package.json"));
  const { createElement } = exiger("react") as typeof import("react");
  return {
    AbsoluteFill: ({ children, style }: { children?: unknown; style?: object }) => createElement("div", { style }, children as never),
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({ fps: 25, width: 1080, height: 1350, durationInFrames: 250 }),
    interpolate: (x: number) => x,
    random: () => 0.5,
    Img: () => null,
    cancelRender: () => undefined,
    continueRender: () => undefined,
    delayRender: () => 0,
  };
});

const exiger = createRequire(join(process.cwd(), "studio-rendu/package.json"));
const { createElement } = exiger("react") as typeof import("react");
const { renderToStaticMarkup } = exiger("react-dom/server") as typeof import("react-dom/server");

const marque = (id: string) => createElement("i", { id });
const POSE = { cx: 540, cy: 960, zoom: 1 };
const camera = { code: "CAM-B", trajectoire: [{ t: 0, ...POSE }, { t: 10, cx: 400, cy: 800, zoom: 2 }], entetes: [], fond: "ivoire", ensembles: [] };
const scene = { trajectoire: { images: [{ t: 0, ...POSE }, { t: 10, ...POSE }] } };

async function rendre(avecCamera: boolean, horsCamera: boolean): Promise<string> {
  const { ContexteVariete } = await import("../../../studio-rendu/compositions/image-video/variete/ContexteVariete");
  const { HabillageVariete } = await import("../../../studio-rendu/compositions/image-video/variete/HabillageVariete");
  const variete = { recette: { ...RECETTE_REFERENCE_IV } as RecetteVarieteIV, format: "4:5" as const, donnees: avecCamera ? { camera } : {} };
  const contenu = createElement("div", { id: "scene" }, marque("entete"), horsCamera ? null : [marque("queue"), marque("affiche")]);
  return renderToStaticMarkup(createElement(ContexteVariete, { variete, scene, children: createElement(HabillageVariete, { horsCamera: horsCamera ? createElement("div", { id: "hors" }, marque("queue"), marque("affiche")) : undefined }, contenu) }));
}
const pos = (h: string, motif: string) => h.indexOf(motif);

describe("queue et affiche : place dans l'habillage", () => {
  it("sans caméra filmée : dans la scène, après l'en-tête (place de master), sans horsCamera", async () => {
    const h = await rendre(false, false);
    expect(pos(h, 'id="entete"')).toBeGreaterThan(-1);
    expect(pos(h, 'id="queue"')).toBeGreaterThan(pos(h, 'id="entete"'));
    expect(pos(h, 'id="affiche"')).toBeGreaterThan(pos(h, 'id="queue"'));
    expect(h).not.toContain('id="hors"');
  });
  it("caméra filmée : horsCamera vient après la scène recadrée (et l'en-tête de la scène), une seule fois", async () => {
    const h = await rendre(true, true);
    expect(h.split('id="hors"').length).toBe(2);
    expect(pos(h, 'id="hors"')).toBeGreaterThan(pos(h, 'id="scene"'));
    expect(pos(h, 'id="queue"')).toBeGreaterThan(pos(h, 'id="hors"'));
    expect(pos(h, 'id="affiche"')).toBeGreaterThan(pos(h, 'id="queue"'));
  });
  it("sans variété : horsCamera est rendu après le contenu", async () => {
    const { HabillageVariete } = await import("../../../studio-rendu/compositions/image-video/variete/HabillageVariete");
    const h = renderToStaticMarkup(createElement(HabillageVariete, { horsCamera: marque("queue") }, marque("scene")));
    expect(h).toBe('<i id="scene"></i><i id="queue"></i>');
  });
});

describe("Compositions : la queue et l'affiche gardent la place de master hors CAM-B / CAM-C", () => {
  const src = readFileSync(join(process.cwd(), "studio-rendu/compositions/image-video/Compositions.tsx"), "utf8");
  it("scènes Objets et Moments : dans l'AbsoluteFill interne, jamais après HabillageVariete", () => {
    expect(src).not.toMatch(/<\/HabillageVariete>\s*(\{\/\*[^]*?\*\/\}\s*)?<QueueFin/);
    expect(src.match(/<\/EnteteVarie>|<EnteteVarie [^\n]*\/>\n\s*<QueueFin/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/<TemoinEntete p=\{p\} t=\{t\} \/> : null\}\n\s*<QueueFin[^\n]*\n\s*<Affiche[^\n]*\n\s*<\/AbsoluteFill>/);
    expect(src).toMatch(/fond=\{m\.fond\} marque=\{p\.marque\}[^\n]*\/>\n\s*<QueueFin[^\n]*\n\s*<Affiche[^\n]*\n\s*<\/AbsoluteFill>/);
  });
  it("SceneImageVideo : place de master quand camC est faux, horsCamera quand camC est vrai", () => {
    expect(src).toContain("{camC ? null : finDeScene}");
    expect(src).toContain("<HabillageVariete horsCamera={camC ? finDeScene : undefined}>");
  });
});
