import { describe, it, expect } from "vitest";
import { grapheEcranDivise } from "../../studio-rendu/src/composition/graphe-ecran-divise";
import { FORMATS_10_BITS, FORMATS_8_BITS } from "../../studio-rendu/src/composition/image-ffmpeg";

/** Rectangles de la démo (écran partagé de `rectanglesEcranPartage`), recopiés en données : l'écran en haut, le visage en bas. */
const DEMO = {
  "9:16": { largeur: 1080, hauteur: 1920, rectEcran: { x: 0, y: 0, largeur: 1080, hauteur: 960 }, rectVisage: { x: 0, y: 960, largeur: 1080, hauteur: 960 } },
  "4:5": { largeur: 1080, hauteur: 1350, rectEcran: { x: 0, y: 0, largeur: 1080, hauteur: 608 }, rectVisage: { x: 0, y: 608, largeur: 1080, hauteur: 742 } },
} as const;

const graphe = (r: "9:16" | "4:5", dixBits?: boolean) => grapheEcranDivise({ ...DEMO[r], fps: 30, dixBits });

describe("grapheEcranDivise : texte du graphe", () => {
  it("9:16, 8 bits", () => {
    expect(graphe("9:16")).toBe(
      [
        "color=c=black:s=1080x1920:r=30,format=gbrp[toile]",
        "[1:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,format=gbrp[e]",
        "[0:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,format=gbrp[f]",
        "[toile][e]overlay=x=0:y=0:format=gbrp:eof_action=pass[t]",
        "[t][f]overlay=x=0:y=960:format=gbrp:eof_action=pass[o]",
        "[o]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[sortie]",
      ].join(";"),
    );
  });
  it("4:5, 8 bits", () => {
    const g = graphe("4:5");
    expect(g).toContain("color=c=black:s=1080x1350:r=30");
    expect(g).toContain("[1:v]scale=1080:608:force_original_aspect_ratio=increase,crop=1080:608");
    expect(g).toContain("[0:v]scale=1080:742:force_original_aspect_ratio=increase,crop=1080:742");
    expect(g).toContain("[t][f]overlay=x=0:y=608");
  });
});

describe("grapheEcranDivise : formats", () => {
  it("8 bits : format d'overlay des superpositions 8 bits, sortie yuv420p", () => {
    const g = graphe("9:16", false);
    const ovs = g.split(";").filter((x) => x.includes("overlay="));
    expect(ovs).toHaveLength(2);
    expect(ovs.every((o) => o.includes(`:format=${FORMATS_8_BITS.ov}:`))).toBe(true);
    expect(g).toContain("format=yuv420p[sortie]");
    expect(g).not.toContain("10le");
  });
  it("10 bits : overlay en yuv444p10, sortie yuv420p10le", () => {
    const g = graphe("9:16", true);
    const ovs = g.split(";").filter((x) => x.includes("overlay="));
    expect(ovs).toHaveLength(2);
    expect(ovs.every((o) => o.includes(`:format=${FORMATS_10_BITS.ov}:`))).toBe(true);
    expect(g).toContain("format=yuv420p10le[sortie]");
    expect(g).not.toContain("gbrp");
  });
});

describe("grapheEcranDivise : refus clairs", () => {
  const base = DEMO["9:16"];
  const refus = (surcharge: object, motif: RegExp) => expect(() => grapheEcranDivise({ ...base, fps: 30, ...surcharge })).toThrow(motif);
  it("rectangle hors toile", () => {
    refus({ rectEcran: { x: 0, y: 0, largeur: 1200, hauteur: 960 } }, /écran.*hors de la toile/i);
    refus({ rectVisage: { x: 0, y: 1000, largeur: 1080, hauteur: 960 } }, /visage.*hors de la toile/i);
    refus({ rectVisage: { x: -2, y: 960, largeur: 1080, hauteur: 960 } }, /visage.*hors de la toile/i);
  });
  it("rectangle vide ou non fini", () => {
    refus({ rectEcran: { x: 0, y: 0, largeur: 0, hauteur: 960 } }, /écran/i);
    refus({ rectVisage: { x: 0, y: 960, largeur: NaN, hauteur: 960 } }, /visage/i);
  });
  it("toile ou fps invalides", () => {
    refus({ largeur: 0 }, /toile/i);
    refus({ fps: 0 }, /fps/i);
  });
  it("l'écran ne se pose jamais sur le visage", () => {
    refus({ rectEcran: { x: 0, y: 0, largeur: 1080, hauteur: 1000 } }, /recouvre/i);
  });
});

describe("grapheEcranDivise : rien sur le visage", () => {
  it("le visage est posé en dernier : aucune superposition après lui, et rien d'autre que scale/crop/overlay", () => {
    for (const r of ["9:16", "4:5"] as const) {
      const g = graphe(r);
      const dernier = g.split(";").filter((p) => p.includes("overlay"));
      expect(dernier[dernier.length - 1]).toContain("[t][f]overlay");
      expect(g).not.toMatch(/drawtext|drawbox|lut3d|subtitles|eq=|gblur|boxblur/);
    }
  });
  it("pur : même entrée, même sortie, entrées non modifiées", () => {
    const e = { ...DEMO["9:16"], fps: 30 };
    const avant = JSON.stringify(e);
    expect(grapheEcranDivise(e)).toBe(grapheEcranDivise(e));
    expect(JSON.stringify(e)).toBe(avant);
  });
});
