/**
 * C6-H24c-c · repli navigateur du calque image : mêmes fondus et glissés entre illustrations que le chemin FFmpeg.
 * Rendu statique par instants (aucun réseau). Sans `raccords` : balisage identique à celui d'avant (empreintes figées).
 * Se saute si les dépendances de studio-rendu ne sont pas installées.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { ProprietesImageComposition } from "../../src/briques/composition/scene";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
const etat = { image: 0 };
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const reactRendu = (AVEC_RENDU ? await import("../../studio-rendu/node_modules/react/index.js") : {}) as typeof import("react");
const CtxTemps = AVEC_RENDU ? reactRendu.createContext<{ decalage: number; fige?: number }>({ decalage: 0 }) : (null as never);
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return {
    ...vrai,
    // Une `Sequence` rend ses enfants seulement dans sa fenêtre ET décale le temps local de ses enfants (comme Remotion) ; `Freeze` fige le temps local ; `useCurrentFrame` est piloté par le test.
    Sequence: (p: { children?: unknown; from?: number; durationInFrames?: number }) => {
      const parent = reactRendu.useContext(CtxTemps);
      const de = p.from ?? 0;
      const local = etat.image - parent.decalage;
      if (!(local >= de && local < de + (p.durationInFrames ?? Infinity))) return null;
      return reactRendu.createElement(CtxTemps.Provider, { value: { ...parent, decalage: parent.decalage + de } }, p.children as never);
    },
    Freeze: (p: { children?: unknown; frame: number }) => {
      const parent = reactRendu.useContext(CtxTemps);
      return reactRendu.createElement(CtxTemps.Provider, { value: { ...parent, fige: p.frame } }, p.children as never);
    },
    Audio: () => null,
    // La vidéo montre son temps local : image courante moins le début de ses `Sequence` (ou l'image figée).
    OffthreadVideo: (p: { src: string }) => {
      const c = reactRendu.useContext(CtxTemps);
      if (!p.src.startsWith("entree:clip")) return null; // le double n'est pas lu : les empreintes « avant » restent celles de master
      return reactRendu.createElement("video", { "data-src": p.src, "data-t": c.fige ?? etat.image - c.decalage });
    },
    Img: (p: { src: string }) => ({ type: "img", key: null, ref: null, props: { src: p.src }, $$typeof: Symbol.for("react.transitional.element"), _owner: null, _store: {} }),
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
const RACCORDS = AVEC_RENDU ? await import(/* @vite-ignore */ ["..", "..", "studio-rendu", "src", "composition", "raccords-instants"].join("/")) : null;

const CADRAGE = { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 };
const illu = (debutSec: number, finSec: number, n: number) => ({ debutSec, finSec, type: "illustration", angle: "principal", cadrage: CADRAGE, illustration: { url: `entree:illu-${n}`, video: false } });
const clip = (debutSec: number, finSec: number, n: number) => ({ ...illu(debutSec, finSec, n), illustration: { url: `entree:clip-${n}`, video: true } });
const double = (debutSec: number, finSec: number) => ({ debutSec, finSec, type: "double", angle: "principal", cadrage: CADRAGE });
const proprietes = (plans: unknown[], raccords?: unknown) =>
  ({
    ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 150,
    decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false },
    doubles: { principal: { type: "video", url: "entree:double", transparent: true } },
    plans,
    ...(raccords === undefined ? {} : { raccords }),
  }) as unknown as ProprietesImageComposition;

const TROIS = [illu(0, 2, 0), illu(2, 4, 1), illu(4, 6, 2)];
const IMAGES = [0, 45, 49, 50, 51, 55, 100];
const rendre = (p: ProprietesImageComposition, image: number): string => {
  etat.image = image;
  return renderToStaticMarkup(createElement(COMPOSEE.ImageComposee, p as never) as never);
};
const empreinte = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
/** Les illustrations présentes dans le balisage, avec leur opacité et leur décalage horizontal. */
const presentes = (h: string) =>
  [...h.matchAll(/<div style="([^"]*)"><img src="entree:illu-(\d)"/g)].map((m) => ({
    n: Number(m[2]),
    opacite: Number(/opacity:([\d.]+)/.exec(m[1]!)?.[1] ?? 1),
    decalage: Number(/translateX\((-?[\d.]+)px\)/.exec(m[1]!)?.[1] ?? 0),
  }));
/** Les vidéos présentes : source et temps local lu par la vidéo. */
const videos = (h: string) => [...h.matchAll(/<video data-src="entree:clip-(\d)" data-t="(-?\d+)"/g)].map((m) => ({ n: Number(m[1]), t: Number(m[2]) }));
const nbIllu = (h: string) => presentes(h).length;

// Empreintes du balisage de master (avant la modification), aux images IMAGES.
const EMPREINTES_AVANT: Record<number, string> = { 0: "c1a9a45bb5fc57fa", 45: "c1a9a45bb5fc57fa", 49: "c1a9a45bb5fc57fa", 50: "95319b20de0dfebb", 51: "95319b20de0dfebb", 55: "95319b20de0dfebb", 100: "346af5e79a8f089b" };

describe.skipIf(!AVEC_RENDU)("ImageComposee : raccords entre illustrations (C6-H24c-c)", () => {
  it("(a) sans `raccords`, ou liste vide : balisage identique à celui d'avant", () => {
    for (const image of IMAGES) {
      const sans = rendre(proprietes(TROIS), image); if (image===0) console.log("MARK", sans.slice(-700));
      expect(rendre(proprietes(TROIS, []), image)).toBe(sans);
      expect(empreinte(sans), `image ${image}`).toBe(EMPREINTES_AVANT[image]);
    }
  });

  it("(b) fondu : les deux illustrations sont là au milieu de la fenêtre, avec les opacités du calcul commun", () => {
    const p = proprietes(TROIS, [{ indexAvant: 0, type: "fondu" }]);
    const plans = [0, 1, 2].map((i) => ({ debutImage: i * 50, finImage: i * 50 + 50 }));
    const e = RACCORDS.etatRaccordA(50, 25, plans, [{ indexAvant: 0, type: "fondu" }], { largeurPx: 1080 });
    const h = rendre(p, 50);
    const v = presentes(h);
    expect(v.map((x) => x.n).sort()).toEqual([0, 1]);
    expect(v.find((x) => x.n === 0)!.opacite).toBeCloseTo(e.opaciteAvant, 2);
    expect(v.find((x) => x.n === 1)!.opacite).toBeCloseTo(e.opaciteApres, 2);
    expect(v.find((x) => x.n === 0)!.opacite).toBeGreaterThan(0.3);
    expect(v.find((x) => x.n === 0)!.opacite).toBeLessThan(0.7);
    for (const image of [40, 60]) {
      const hh = rendre(p, image);
      expect(nbIllu(hh)).toBe(1);
      expect(hh).not.toContain("opacity:0.");
    }
  });

  it("(c) glissement : décalages non nuls de signes opposés, bornés", () => {
    const h = rendre(proprietes(TROIS, [{ indexAvant: 0, type: "glissement" }]), 50);
    const v = presentes(h);
    expect(v).toHaveLength(2);
    const [a, b] = [v.find((x) => x.n === 0)!, v.find((x) => x.n === 1)!];
    expect(a.decalage).not.toBe(0);
    expect(b.decalage).not.toBe(0);
    expect(Math.sign(a.decalage)).toBe(-Math.sign(b.decalage));
    const max = RACCORDS.DECALAGE_MAX_PART * 1080;
    expect(Math.abs(a.decalage)).toBeLessThanOrEqual(max + 0.01);
    expect(Math.abs(b.decalage)).toBeLessThanOrEqual(max + 0.01);
  });

  it("(d) raccord demandé contre un plan avec la personne : ignoré, jamais posé sur le visage", () => {
    const plans = [illu(0, 2, 0), double(2, 4), illu(4, 6, 2)];
    for (const image of IMAGES) {
      const sans = rendre(proprietes(plans), image);
      expect(rendre(proprietes(plans, [{ indexAvant: 0, type: "fondu" }, { indexAvant: 1, type: "glissement" }]), image)).toBe(sans);
    }
  });

  it("(e) même entrée, même balisage", () => {
    const p = proprietes(TROIS, [{ indexAvant: 0, type: "fondu" }]);
    expect(rendre(p, 50)).toBe(rendre(p, 50));
  });

  it("(f) vidéos : sans raccord, chaque vidéo démarre à son image 0 ; avec raccord, seule la vidéo ENTRANTE avance, et son image 0 reste à `de`", () => {
    const CLIPS = [clip(0, 2, 0), clip(2, 4, 1), clip(4, 6, 2)];
    // Sans raccord : temps local = image - début du plan.
    expect(videos(rendre(proprietes(CLIPS), 60))).toEqual([{ n: 1, t: 10 }]);
    const r = [{ indexAvant: 0, type: "fondu" }];
    const p = proprietes(CLIPS, r);
    // Plan 2 (hors raccord) : exactement le même temps local qu'en coupe franche.
    for (const image of [100, 120, 149]) expect(videos(rendre(p, image))).toEqual(videos(rendre(proprietes(CLIPS), image)));
    // Plan 0 (sortant) : temps local inchangé (démarre à `de`).
    expect(videos(rendre(p, 49)).find((v) => v.n === 0)!.t).toBe(49);
    // Plan 1 (entrant) : figé sur l'image 0 avant `de`, puis image 0 exactement à `de` (50), puis 1, 2…
    expect(videos(rendre(p, 40)).find((v) => v.n === 1)).toBeUndefined();
    const avant = [44, 45, 46, 47, 48, 49].map((i) => videos(rendre(p, i)).find((v) => v.n === 1)).filter(Boolean);
    expect(avant.length).toBeGreaterThan(0); // la fenêtre du raccord commence avant `de`
    for (const v of avant) expect(v!.t).toBe(0); // figée sur l'image 0, jamais « en avance » dans sa vidéo
    expect(videos(rendre(p, 50)).find((v) => v.n === 1)!.t).toBe(0);
    expect(videos(rendre(p, 51)).find((v) => v.n === 1)!.t).toBe(1);
    expect(videos(rendre(p, 60)).find((v) => v.n === 1)!.t).toBe(10);
  });
});
