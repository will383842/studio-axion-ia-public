import { describe, it, expect } from "vitest";
import {
  planDecoupe, listeConcat, argumentsRecollage, controleRecollage, verifierRecollable,
} from "../../studio-rendu/src/composition/recollage";
import type { SondeFfprobe } from "../../studio-rendu/src/composition/empreinte-encodage";

const cles = [0, 2, 4, 6, 8, 10];

describe("planDecoupe (G11-02)", () => {
  it("arrondit aux images clés qui entourent la plage 3,1-4,2 s → 2-6 s", () => {
    expect(planDecoupe(cles, { debutSec: 3.1, finSec: 4.2 })).toEqual({ ok: true, debutSec: 2, finSec: 6 });
  });
  it("garde une plage posée sur des clés exactes", () => {
    expect(planDecoupe(cles, { debutSec: 4, finSec: 8 })).toEqual({ ok: true, debutSec: 4, finSec: 8 });
  });
  it("accepte des clés en désordre", () => {
    expect(planDecoupe([6, 0, 4, 2], { debutSec: 3.1, finSec: 4.2 })).toEqual({ ok: true, debutSec: 2, finSec: 6 });
  });
  it("refuse sans clé avant le début ou après la fin, et une plage inversée", () => {
    expect(planDecoupe([2, 4], { debutSec: 1, finSec: 3 }).ok).toBe(false);
    expect(planDecoupe([0, 2], { debutSec: 1, finSec: 3 }).ok).toBe(false);
    expect(planDecoupe(cles, { debutSec: 5, finSec: 4 }).ok).toBe(false);
    expect(planDecoupe([], { debutSec: 0, finSec: 1 }).ok).toBe(false);
  });
});

describe("listeConcat", () => {
  it("écrit le fichier concat FFmpeg", () => {
    expect(listeConcat([{ chemin: "/t/a.mp4", dureeSec: 2 }, { chemin: "/t/b.mp4", dureeSec: 1.5 }])).toBe(
      "ffconcat version 1.0\nfile '/t/a.mp4'\nduration 2.000000\nfile '/t/b.mp4'\nduration 1.500000\n");
  });
  it("échappe l'apostrophe d'un chemin", () => {
    expect(listeConcat([{ chemin: "/t/l'été.mp4", dureeSec: 1 }])).toContain("file '/t/l'\\''été.mp4'");
  });
});

describe("argumentsRecollage", () => {
  it("copie le flux, sans son", () => {
    expect(argumentsRecollage("liste.txt", "sortie.mp4")).toEqual(
      ["-f", "concat", "-safe", "0", "-i", "liste.txt", "-c", "copy", "-an", "sortie.mp4"]);
  });
});

describe("controleRecollage", () => {
  const avant = { images: 3, tempsSec: [0, 0.1, 0.2] };
  it("accepte le même nombre d'images et des temps croissants", () => {
    expect(controleRecollage(avant, { images: 3, tempsSec: [0, 0.1, 0.2] })).toEqual({ ok: true, raisons: [] });
  });
  it("refuse une image en moins", () => {
    const r = controleRecollage(avant, { images: 2, tempsSec: [0, 0.1] });
    expect(r.ok).toBe(false);
    expect(r.raisons.join(" ")).toMatch(/image/);
  });
  it("refuse des temps qui reculent", () => {
    expect(controleRecollage(avant, { images: 3, tempsSec: [0, 0.2, 0.1] }).ok).toBe(false);
  });
});

function sonde(largeur: number): SondeFfprobe {
  return { streams: [{
    codec_type: "video", codec_name: "h264", profile: "High", pix_fmt: "yuv420p", width: largeur, height: 1920,
    r_frame_rate: "30/1", avg_frame_rate: "30/1", time_base: "1/15360", color_space: "bt709",
    color_transfer: "bt709", color_primaries: "bt709", color_range: "tv", field_order: "progressive", closed_gop: 1,
  }] };
}

describe("verifierRecollable", () => {
  it("accepte deux sondes identiques", () => {
    expect(verifierRecollable(sonde(1080), sonde(1080)).ok).toBe(true);
  });
  it("refuse avec les raisons quand les sondes diffèrent", () => {
    const r = verifierRecollable(sonde(1080), sonde(720));
    expect(r.ok).toBe(false);
    expect(r.raisons.join(" ")).toMatch(/taille/);
  });
});
